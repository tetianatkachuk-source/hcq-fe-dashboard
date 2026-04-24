// Goal resolution per daily-scrum-prompt-v2.md §🎯 Sprint Goals + §🗂 Розпізнавання типу цілі (Task vs Epic).
// - Variant A (Task): summary value → summary-search within current sprint.
// - Variant B (Epic): value starts with "Epic " → cross-project Epic search → children by "Epic Link" + sprint filter.

import type { JiraClient } from '../jira/client.ts';
import type { Goal, GoalKind, TeamConfig, Ticket } from '../model/types.ts';
import { FIELD, GOAL_FIELDS, REQUIRED_FIELDS } from '../jira/fields.ts';
import {
  qSprintReview,
  qGoalTaskBySummary,
  qEpicBySummary,
  qEpicChildrenInSprint,
} from '../jira/queries.ts';
import { enrichIssue } from './enrich.ts';
import { bucketOf, isDone } from './workflow.ts';

export interface GoalRaw {
  index: 0 | 1 | 2 | 3;
  rawValue: string;
}

export async function fetchSprintGoalValues(client: JiraClient, cfg: TeamConfig): Promise<GoalRaw[]> {
  const reviews = await client.searchAll(qSprintReview(cfg), [...REQUIRED_FIELDS, ...GOAL_FIELDS]);
  if (reviews.length === 0) return [];
  const review = reviews[0]!;
  const out: GoalRaw[] = [];
  const fields = [FIELD.goal1, FIELD.goal2, FIELD.goal3, FIELD.goal4];
  for (let i = 0; i < 4; i++) {
    const raw = review.fields[fields[i]!];
    if (typeof raw === 'string' && raw.trim() !== '') {
      out.push({ index: i as 0 | 1 | 2 | 3, rawValue: raw.trim() });
    }
  }
  return out;
}

function classifyGoal(rawValue: string): GoalKind {
  if (/^epic\s+/i.test(rawValue)) return 'epic';
  return 'task';
}

function stripEpicPrefix(s: string): string {
  // "Epic [WEB] Agreements without bettermeUserId" → "Agreements without bettermeUserId"
  let r = s.replace(/^epic\s+/i, '').trim();
  // remove leading tags like [WEB], [BE], [FE], [Quiz]
  r = r.replace(/^\[[^\]]+\]\s*/g, '').trim();
  return r;
}

export async function resolveGoal(
  client: JiraClient,
  cfg: TeamConfig,
  raw: GoalRaw,
  allSprintTickets: Ticket[],
): Promise<Goal> {
  const kind = classifyGoal(raw.rawValue);
  const base: Goal = {
    index: raw.index,
    rawValue: raw.rawValue,
    kind,
    key: null,
    summary: raw.rawValue,
    status: 'Dev Backlog',
    bucket: 'todo',
    childTickets: [],
    spDone: 0,
    spTotal: 0,
    qaDone: 0,
    qaTotal: 0,
    donePct: 0,
    blockerKeys: [],
  };

  try {
    if (kind === 'task') {
      // exact-ish match via summary-search; prefer the single best match
      const hits = await client.searchAll(
        qGoalTaskBySummary(cfg, raw.rawValue),
        [...REQUIRED_FIELDS],
      );
      // Jira's `summary ~` is fuzzy; try exact match first
      const exact = hits.find((h) => (h.fields.summary as string)?.trim() === raw.rawValue)
        ?? hits[0];
      if (exact) {
        const ticket =
          allSprintTickets.find((t) => t.key === exact.key)
          ?? enrichIssue(exact);
        base.key = ticket.key;
        base.summary = ticket.summary;
        base.status = ticket.status;
        base.bucket = ticket.bucket;
        base.childTickets = [ticket];
      } else {
        base.kind = 'missing';
      }
    } else {
      // Epic: cross-project search
      const stripped = stripEpicPrefix(raw.rawValue);
      const candidates = await client.searchAll(qEpicBySummary(stripped), [...REQUIRED_FIELDS]);
      const epic = candidates[0];
      if (epic) {
        base.key = epic.key;
        base.summary = (epic.fields.summary as string) ?? stripped;
        base.status = (epic.fields.status?.name as string) ?? 'Dev Backlog';
        base.bucket = bucketOf(base.status);
        // children in this sprint
        const kidsRaw = await client.searchAll(
          qEpicChildrenInSprint(cfg, epic.key),
          [...REQUIRED_FIELDS],
        );
        base.childTickets = kidsRaw.map((i) => {
          const existing = allSprintTickets.find((t) => t.key === i.key);
          return existing ?? enrichIssue(i);
        });
      } else {
        base.kind = 'missing';
        base.summary = stripped;
      }
    }
  } catch (err) {
    base.note = `goal resolution error: ${(err as Error).message}`;
  }

  // roll-up SP/QA
  for (const ch of base.childTickets) {
    const sp = ch.storyPoints ?? 0;
    const qa = ch.qaEstimate ?? 0;
    base.spTotal += sp;
    base.qaTotal += qa;
    if (isDone(ch.status)) {
      base.spDone += sp;
      base.qaDone += qa;
    }
    if (ch.blockedByKeys.length > 0 || ch.bucket === 'blocked' || ch.bucket === 'onhold') {
      base.blockerKeys.push(ch.key);
    }
  }
  base.donePct = base.spTotal > 0 ? Math.round((base.spDone / base.spTotal) * 100) : 0;
  if (base.kind === 'task' && base.childTickets[0] && isDone(base.childTickets[0].status)) {
    base.donePct = 100;
  }
  // If epic itself is Done/Accepted, force 100%
  if (base.kind === 'epic' && isDone(base.status)) {
    base.donePct = 100;
  }

  return base;
}

export function tagTicketsWithGoalIndex(tickets: Ticket[], goals: Goal[]): void {
  for (const g of goals) {
    for (const ch of g.childTickets) {
      const t = tickets.find((x) => x.key === ch.key);
      if (t) t.goalIndex = g.index;
    }
  }
}
