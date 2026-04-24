// 10 validation rules from daily-scrum-prompt-v2.md §✅ Правила валідації.
// Each rule inspects a ticket (with context) and appends RuleHits in-place.

import type { Ticket, RuleHit } from '../model/types.ts';
import { bucketOf, isActiveProgress, isDone } from './workflow.ts';

export interface RuleContext {
  all: Ticket[];
  byKey: Map<string, Ticket>;
  now: Date;
}

// Working-day thresholds from prompt (most are "робочих днів")
const UR_STALE_DAYS = 4;           // rule 1
const OVERLOAD_LIMIT = 2;          // rule 2 (excluding role tasks)
const REVIEWED_STALE_DAYS = 2;     // rule 3
const RFT_QUEUE_STALE_DAYS = 1;    // rule 5b
const IT_STALE_DAYS = 3;           // rule 5c
const ON_HOLD_NO_COMMENT_DAYS = 1; // rule 8

function push(t: Ticket, hit: RuleHit): void {
  t.ruleHits.push(hit);
}

export function applyRules(tickets: Ticket[]): void {
  const byKey = new Map(tickets.map((t) => [t.key, t]));
  const ctx: RuleContext = { all: tickets, byKey, now: new Date() };

  // Rule 2 relies on per-assignee grouping, compute upfront
  const activeByAssignee = new Map<string, Ticket[]>();
  for (const t of tickets) {
    if (!t.assignee) continue;
    if (!isActiveProgress(t.status)) continue;
    if (t.isRoleTask) continue;
    const arr = activeByAssignee.get(t.assignee) ?? [];
    arr.push(t);
    activeByAssignee.set(t.assignee, arr);
  }

  for (const t of tickets) {
    // Rule 1: Under Review > 4 working days without approve
    if (t.status === 'Under Review' && t.daysInStatus > UR_STALE_DAYS) {
      push(t, {
        rule: 1,
        severity: 'warn',
        message: `Under Review ${t.daysInStatus} дн. без апруву`,
      });
    }

    // Rule 3: Reviewed but no move to testing ≥ 2 working days
    if (t.status === 'Reviewed' && t.daysInStatus >= REVIEWED_STALE_DAYS) {
      push(t, {
        rule: 3,
        severity: 'warn',
        message: `Reviewed ${t.daysInStatus} дн. без переходу в RFT`,
      });
    }

    // Rule 5a: story bug not-Done while parent in testing pipeline
    if (t.type === 'story bug' && !isDone(t.status) && t.parentKey) {
      const parent = byKey.get(t.parentKey);
      if (parent && ['rft', 'testing', 'done'].includes(parent.bucket) && parent.bucket !== 'done') {
        push(parent, {
          rule: 5,
          severity: 'danger',
          message: `story bug ${t.key} відкритий — повернути parent в In Progress`,
          slackMessage: `⛔ До <${parent.key}> блокер: story bug <${t.key}> → повернути в In Progress`,
        });
      }
    }

    // Rule 5b: Ready for Testing hanging ≥ 1 working day (dev-ticket waiting for QA pickup)
    if (t.bucket === 'rft' && t.daysInStatus >= RFT_QUEUE_STALE_DAYS) {
      push(t, {
        rule: 5,
        severity: t.daysInStatus >= 3 ? 'danger' : 'warn',
        message: `RFT ≥ ${t.daysInStatus} дн. — pinguvat QA`,
      });
    }

    // Rule 5c: In Testing stuck > 3 working days
    if (t.status === 'In Testing' && t.daysInStatus > IT_STALE_DAYS) {
      push(t, {
        rule: 5,
        severity: 'warn',
        message: `In Testing ${t.daysInStatus} дн. без апдейту`,
      });
    }

    // Rule 6: is blocked by not-in-Done
    if (t.blockedByKeys.length > 0) {
      const liveBlockers = t.blockedByKeys
        .map((k) => byKey.get(k))
        .filter((b): b is Ticket => !!b && !isDone(b.status));
      if (liveBlockers.length > 0) {
        push(t, {
          rule: 6,
          severity: 'danger',
          message: `blocked by: ${liveBlockers.map((b) => b.key).join(', ')}`,
        });
      } else if (t.blockedByKeys.length > 0) {
        // cross-project blockers we didn't fetch — best-effort marker
        push(t, {
          rule: 6,
          severity: 'warn',
          message: `зв'язки blocked by: ${t.blockedByKeys.join(', ')} (cross-project)`,
        });
      }
    }

    // Rule 7: Due date overdue or within 2 working days
    if (t.dueDate && !isDone(t.status)) {
      const due = new Date(t.dueDate);
      const diffMs = due.getTime() - ctx.now.getTime();
      const diffDays = Math.ceil(diffMs / 86_400_000);
      if (diffDays < 0) {
        push(t, { rule: 7, severity: 'danger', message: `due date прострочено на ${-diffDays} дн.` });
      } else if (diffDays <= 2) {
        push(t, { rule: 7, severity: 'warn', message: `due date через ${diffDays} дн.` });
      }
    }

    // Rule 8: On hold / Blocked without comment ≥ 1 day
    if ((t.bucket === 'onhold' || t.bucket === 'blocked') && t.daysInStatus >= ON_HOLD_NO_COMMENT_DAYS) {
      push(t, {
        rule: 8,
        severity: 'warn',
        message: `${t.status} ${t.daysInStatus} дн. без апдейту`,
      });
    }

    // Rule 10: Ready for Deploy — winesti у "релізимо?"
    if (t.status === 'Ready for Deploy') {
      push(t, { rule: 10, severity: 'info', message: 'RFD: релізимо?' });
    }
  }

  // Rule 2: per-assignee overload (>2 active non-role tasks)
  for (const [assignee, arr] of activeByAssignee) {
    if (arr.length > OVERLOAD_LIMIT) {
      for (const t of arr) {
        push(t, {
          rule: 2,
          severity: 'warn',
          message: `перевантаження @${assignee}: ${arr.length} активних`,
        });
      }
    }
  }
}
