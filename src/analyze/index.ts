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
  buildSmActions,
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
  // 1. Fetch sprint + all sprint tickets (with changelog for age calcs)
  const sprintInfo = await client.getSprint(cfg.sprintId);
  const allIssues = await client.searchAll(qAllSprint(cfg), [...REQUIRED_FIELDS], { expand: ['changelog'] });
  const now = new Date();
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

  // 6. Blockers / subtasks / bugs
  const blockers = buildBlockers(tickets);
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
  const smActions = buildSmActions(partial);

  return { ...partial, questions, smActions };
}

// Re-export for downstream
export { isActiveProgress, bucketOf };
