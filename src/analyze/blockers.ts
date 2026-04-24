import type { Blocker, Ticket } from '../model/types.ts';

const UR_STALE = 4; // rule 1 echo

export function buildBlockers(tickets: Ticket[]): Blocker[] {
  const out: Blocker[] = [];
  const byKey = new Map(tickets.map((t) => [t.key, t]));

  for (const t of tickets) {
    // Jira link "is blocked by"
    for (const blockerKey of t.blockedByKeys) {
      const dep = byKey.get(blockerKey);
      if (!dep || dep.bucket === 'done') continue;
      const crossTeam = !blockerKey.startsWith(t.key.split('-')[0]! + '-');
      out.push({
        key: t.key,
        summary: t.summary,
        status: t.status,
        assignee: t.assignee,
        reason: crossTeam ? 'cross_team' : 'is_blocked_by',
        blockerKey,
        note: `blocked by ${blockerKey}${crossTeam ? ' (cross-team)' : ''}`,
      });
    }

    // On hold / Blocked tickets (already flagged via rule 8 but bubble up as blocker too)
    if (t.bucket === 'onhold' && t.daysInStatus >= 2) {
      out.push({
        key: t.key,
        summary: t.summary,
        status: t.status,
        assignee: t.assignee,
        reason: 'on_hold',
        blockerKey: null,
        note: `On hold ${t.daysInStatus} дн.`,
      });
    }

    // Under Review stale (rule 1 → visible risk)
    if (t.status === 'Under Review' && t.daysInStatus > UR_STALE) {
      out.push({
        key: t.key,
        summary: t.summary,
        status: t.status,
        assignee: t.assignee,
        reason: 'under_review_stale',
        blockerKey: null,
        note: `UR ${t.daysInStatus} дн. без апруву`,
      });
    }

    // Due date overdue
    if (t.dueDate && t.bucket !== 'done') {
      const due = new Date(t.dueDate);
      if (due.getTime() < Date.now()) {
        out.push({
          key: t.key,
          summary: t.summary,
          status: t.status,
          assignee: t.assignee,
          reason: 'due_overdue',
          blockerKey: null,
          note: `due ${t.dueDate.slice(0, 10)} прострочено`,
        });
      }
    }
  }

  return out;
}
