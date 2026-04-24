// "Bugs no progress" — issuetype = Bug | story bug in Dev Backlog/To Do without assignee,
// or with assignee but no activity > 5 days. Grouped by reporter.
// Per daily-scrum-prompt-v2.md §🐞 Bugs no progress.

import type { BugGroup, Ticket } from '../model/types.ts';
import { workingDaysBetween } from './age.ts';

const NO_PROGRESS_DAYS = 5;

export function buildBugGroups(tickets: Ticket[]): BugGroup[] {
  const now = new Date().toISOString();
  const stale = tickets.filter((t) => {
    if (t.type !== 'Bug' && t.type !== 'story bug') return false;
    if (t.bucket !== 'todo') return false;
    if (!t.assignee) return true;
    return workingDaysBetween(t.updated, now) >= NO_PROGRESS_DAYS;
  });

  const byReporter = new Map<string, BugGroup>();
  for (const t of stale) {
    const key = t.reporter ?? 'Unknown';
    if (!byReporter.has(key)) byReporter.set(key, { reporter: key, bugs: [] });
    byReporter.get(key)!.bugs.push({
      key: t.key,
      summary: t.summary,
      priority: t.priority,
      daysInBacklog: workingDaysBetween(t.updated, now),
    });
  }
  return [...byReporter.values()].sort((a, b) => b.bugs.length - a.bugs.length);
}
