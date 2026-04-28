// Orchestrator: raw Jira → ReportData.

import type { JiraClient } from '../jira/client.ts';
import type { ReportData, ReportVariant, TeamConfig, Ticket } from '../model/types.ts';
import { qAllSprint } from '../jira/queries.ts';
import { REQUIRED_FIELDS } from '../jira/fields.ts';
import { enrichIssue } from './enrich.ts';
import { applyRules } from './rules.ts';
import { computeVelocity } from './metrics.ts';
import { buildDevLoads, buildQaLoads } from './loads.ts';
import { buildBlockers } from './blockers.ts';
import { buildSubtaskRows } from './subtasks.ts';
import { buildBugGroups } from './bugs.ts';
import { fetchSprintGoalValues, resolveGoal, tagTicketsWithGoalIndex } from './goals.ts';
import { bucketOf, isActiveProgress } from './workflow.ts';
import {
  buildQuestions,
  velocityForecast,
  verdictFromGoals,
  verdictSummaryLine,
} from './forecast.ts';

const RELEASE_PRESSURE_DAYS = 2;

function isReleasePressure(t: Ticket, now: Date): boolean {
  if (!t.releaseDate) return false;
  if (t.bucket === 'done') return false;
  if (t.bucket === 'testing' || t.bucket === 'rfd') return false; // already handed off
  const rd = new Date(t.releaseDate);
  const diffDays = Math.ceil((rd.getTime() - now.getTime()) / 86_400_000);
  return diffDays <= RELEASE_PRESSURE_DAYS;
}

export async function buildReport(
  client: JiraClient,
  cfg: TeamConfig,
  variant: ReportVariant,
): Promise<ReportData> {
  // 1. Fetch sprint + all sprint tickets.
  // The new /rest/api/3/search/jql endpoint does NOT reliably return changelog
  // even with expand=changelog. So we re-fetch per-issue changelogs for tickets
  // we actually need accurate "days in status" for (active progress + onhold/blocked).
  const sprintInfo = await client.getSprint(cfg.sprintId);
  const allIssues = await client.searchAll(qAllSprint(cfg), [...REQUIRED_FIELDS], { expand: ['changelog'] });
  const now = new Date();

  // Hydrate changelog for tickets where stale-days actually matters.
  await Promise.all(
    allIssues.map(async (issue) => {
      if (issue.changelog && issue.changelog.histories?.length) return; // already have it
      const status = (issue.fields?.status?.name as string) ?? '';
      const needsChangelog =
        bucketOf(status as any) === 'progress' ||
        bucketOf(status as any) === 'review' ||
        bucketOf(status as any) === 'rft' ||
        bucketOf(status as any) === 'testing' ||
        bucketOf(status as any) === 'rfd' ||
        bucketOf(status as any) === 'onhold' ||
        bucketOf(status as any) === 'blocked';
      if (!needsChangelog) return;
      try {
        const full = await client.getIssue(issue.key, { expand: ['changelog'] });
        issue.changelog = full.changelog;
      } catch {
        /* swallow — fallback to created date */
      }
    }),
  );

  const tickets = allIssues.map((i) => enrichIssue(i, now.toISOString()));

  // 2. Goal resolution
  const goalRaws = await fetchSprintGoalValues(client, cfg);
  const goals = await Promise.all(goalRaws.map((r) => resolveGoal(client, cfg, r, tickets)));
  tagTicketsWithGoalIndex(tickets, goals);

  // 3. Rules
  applyRules(tickets);

  // 4. Per-person loads
  const devs = buildDevLoads(cfg, tickets);
  const qa = buildQaLoads(cfg, tickets);

  // 5. Velocity
  const velocity = computeVelocity(tickets);

  // 6. Blockers / subtasks / bugs.
  // Pre-fetch statuses for "is blocked by" links pointing OUTSIDE our sprint
  // (typically WEBBE-* cross-team deps). Without this, cross-team blockers
  // would either be silently skipped (old behaviour) or shown without status.
  const localKeys = new Set(tickets.map((t) => t.key));
  const externalBlockerKeys = new Set<string>();
  for (const t of tickets) {
    for (const k of t.blockedByKeys) {
      if (!localKeys.has(k)) externalBlockerKeys.add(k);
    }
  }
  const externalStatuses = new Map<string, { status: string; bucket: string }>();
  await Promise.all(
    [...externalBlockerKeys].map(async (key) => {
      try {
        const issue = await client.getIssue(key, { fields: ['status'] });
        const status = (issue.fields?.status?.name as string) ?? '';
        externalStatuses.set(key, { status, bucket: bucketOf(status as any) });
      } catch {
        /* unknown — buildBlockers will still include the blocker */
      }
    }),
  );
  const blockers = buildBlockers(tickets, externalStatuses);
  const subtasks = buildSubtaskRows(tickets);
  const bugsNoProgress = buildBugGroups(tickets);

  const readyForDeploy = tickets
    .filter((t) => t.status === 'Ready for Deploy')
    .sort((a, b) => a.key.localeCompare(b.key));

  const releasePressure = tickets
    .filter((t) => isReleasePressure(t, now))
    .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''));

  // 7. Sprint day calculation
  const start = sprintInfo.startDate ?? now.toISOString();
  const end = sprintInfo.endDate ?? now.toISOString();
  const sprintStart = new Date(start);
  const sprintEnd = new Date(end);
  const msPerDay = 86_400_000;
  const totalDays = Math.max(1, Math.round((sprintEnd.getTime() - sprintStart.getTime()) / msPerDay));
  const dayN = Math.max(1, Math.min(totalDays, Math.round((now.getTime() - sprintStart.getTime()) / msPerDay) + 1));

  const verdict = verdictFromGoals(goals, velocity, dayN, totalDays);
  const verdictSummary = verdictSummaryLine(goals);
  velocity.forecast = velocityForecast(goals, velocity, dayN, totalDays);

  const partial: Omit<ReportData, 'questions' | 'smActions'> = {
    generatedAt: now.toISOString(),
    variant,
    sprint: {
      id: cfg.sprintId,
      name: sprintInfo.name ?? `Sprint ${cfg.sprintId}`,
      dayN,
      totalDays,
      startDate: start,
      endDate: end,
    },
    verdict,
    verdictSummary,
    goals,
    tickets,
    devs,
    qa,
    blockers,
    subtasks,
    bugsNoProgress,
    readyForDeploy,
    releasePressure,
    velocity,
  };

  const questions = buildQuestions(partial);
  // SM Actions section removed from report — keep field for schema stability.
  const smActions: string[] = [];

  return { ...partial, questions, smActions };
}

// Re-export for downstream
export { isActiveProgress, bucketOf };
