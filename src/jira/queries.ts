// JQL queries — pulled verbatim from daily-scrum-prompt-v2.md §Основні JQL-запити.
// Each function takes dynamic inputs (sprintId, team) to stay config-driven.

import type { TeamConfig } from '../model/types.ts';

const joinNames = (names: string[]): string => names.map((n) => `"${n}"`).join(', ');

export function qDevTasks(cfg: TeamConfig): string {
  return `project = ${cfg.projectKey} AND sprint = ${cfg.sprintId} AND assignee in (${joinNames(cfg.team.devs)}) ORDER BY status ASC, updated DESC`;
}

export function qQaTasks(cfg: TeamConfig): string {
  return `project = ${cfg.projectKey} AND sprint = ${cfg.sprintId} AND assignee in (${joinNames(cfg.team.qa)}) ORDER BY status ASC, updated DESC`;
}

// Everything in the sprint (all assignees — needed for BugsNoProgress, Release Pressure, unassigned).
export function qAllSprint(cfg: TeamConfig): string {
  return `project = ${cfg.projectKey} AND sprint = ${cfg.sprintId} ORDER BY status ASC, updated DESC`;
}

export function qWaitingForQa(cfg: TeamConfig): string {
  return `project = ${cfg.projectKey} AND sprint = ${cfg.sprintId} AND status in ("Ready for Testing", "In Testing", "Returned from Testing") ORDER BY status ASC, updated DESC`;
}

export function qImpediments(cfg: TeamConfig): string {
  return `project = ${cfg.projectKey} AND sprint = ${cfg.sprintId} AND (status in (Blocked, "On hold") OR issueLinkType = "is blocked by" OR priority in (Highest, High)) ORDER BY priority DESC`;
}

export function qSubtasks(cfg: TeamConfig): string {
  return `project = ${cfg.projectKey} AND sprint = ${cfg.sprintId} AND issuetype = Sub-task AND status != Done ORDER BY parent, status`;
}

export function qSprintReview(cfg: TeamConfig): string {
  return `project = ${cfg.projectKey} AND sprint = ${cfg.sprintId} AND issuetype = "Sprint review"`;
}

// Goal resolution — search a ticket by summary in current sprint (Task variant A)
export function qGoalTaskBySummary(cfg: TeamConfig, summary: string): string {
  const escaped = summary.replace(/"/g, '\\"');
  return `project = ${cfg.projectKey} AND sprint = ${cfg.sprintId} AND summary ~ "${escaped}"`;
}

// Cross-project Epic search by summary (Variant B)
export function qEpicBySummary(summary: string): string {
  const escaped = summary.replace(/"/g, '\\"');
  return `issuetype = Epic AND summary ~ "${escaped}" ORDER BY updated DESC`;
}

// Children of an epic within current sprint
export function qEpicChildrenInSprint(cfg: TeamConfig, epicKey: string): string {
  return `"Epic Link" = ${epicKey} AND sprint = ${cfg.sprintId} ORDER BY status ASC, updated DESC`;
}
