import type { Blocker, Ticket } from '../model/types.ts';

const UR_STALE = 4; // rule 1 echo

// Pre-fetched statuses for blockers that live OUTSIDE our sprint (typically cross-team
// like WEBBE-* dependencies). Pass an empty map when not available — the function will
// then include all cross-team blockers without status filtering.
export function buildBlockers(
  tickets: Ticket[],
  externalStatuses: Map<string, { status: string; bucket: string }> = new Map(),
): Blocker[] {
  const out: Blocker[] = [];
  const byKey = new Map(tickets.map((t) => [t.key, t]));

  for (const t of tickets) {
    // Jira link "is blocked by"
    for (const blockerKey of t.blockedByKeys) {
      const sameProjectPrefix = t.key.split('-')[0]! + '-';
      const crossTeam = !blockerKey.startsWith(sameProjectPrefix);

      // Local sprint dep — usually same-project, fast path.
      const dep = byKey.get(blockerKey);
      if (dep) {
        if (dep.bucket === 'done') continue;
      } else if (crossTeam) {
        // Cross-team / cross-project dep that isn't in our sprint — fall back to
        // the external status snapshot. If status is unknown, surface the blocker
        // anyway (it's safer to over-report than miss a real BE blocker).
        const ext = externalStatuses.get(blockerKey);
        if (ext && ext.bucket === 'done') continue;
      } else {
        // Same-project but not in our sprint snapshot — treat as resolved (it
        // was probably closed before sprint start).
        continue;
      }

      const ext = externalStatuses.get(blockerKey);
      const depStatus = dep?.status ?? ext?.status ?? '';
      const noteSuffix = crossTeam ? ' (cross-team)' : '';
      const statusSuffix = depStatus ? ` — ${depStatus}` : '';
      out.push({
        key: t.key,
        summary: t.summary,
        status: t.status,
        assignee: t.assignee,
        reason: crossTeam ? 'cross_team' : 'is_blocked_by',
        blockerKey,
        note: `blocked by ${blockerKey}${noteSuffix}${statusSuffix}`,
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
