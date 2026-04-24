// Per-dev and per-QA loads.

import type { DevLoad, QaLoad, TeamConfig, Ticket } from '../model/types.ts';
import { isActiveProgress, isQaActive, isQaIssueType, isRftQueue } from './workflow.ts';

export function buildDevLoads(cfg: TeamConfig, tickets: Ticket[]): DevLoad[] {
  return cfg.team.devs.map((name) => {
    const mine = tickets.filter((t) => t.assignee === name);
    const active = mine.filter((t) => isActiveProgress(t.status) && !t.isRoleTask && !isQaIssueType(t.type));
    const roleTasks = mine.filter((t) => t.isRoleTask);
    const inTesting = mine.filter((t) => t.status === 'In Testing' || t.status === 'Returned from Testing');
    const rftQueue = mine.filter((t) => isRftQueue(t.type, t.status));
    return {
      name,
      active,
      roleTasks,
      inTesting,
      rftQueue,
      overloaded: active.length > 2,
    };
  });
}

export function buildQaLoads(cfg: TeamConfig, tickets: Ticket[]): QaLoad[] {
  return cfg.team.qa.map((name) => {
    const mine = tickets.filter((t) => t.assignee === name);
    const active = mine.filter((t) => isQaActive(t.type, t.status) && !t.isRoleTask);
    const roleTasks = mine.filter((t) => t.isRoleTask);
    const returned = mine.filter((t) => t.status === 'Returned from Testing');
    return {
      name,
      active,
      roleTasks,
      returned,
      overloaded: active.length > 2,
    };
  });
}
