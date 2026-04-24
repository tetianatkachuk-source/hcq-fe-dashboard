// Working-days (Mon-Fri, Europe/Kyiv) calculation + "days in current status" from changelog.

import type { JiraIssue } from '../jira/client.ts';

// Count working days between two ISO timestamps. Returns 0 if to < from.
export function workingDaysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  if (to.getTime() <= from.getTime()) return 0;
  let count = 0;
  const cursor = new Date(from);
  // Normalize to start-of-day UTC to avoid DST weirdness
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() < end.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dow = cursor.getUTCDay(); // 0 Sun, 6 Sat
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

// Finds the timestamp of the most recent transition into the CURRENT status.
// Falls back to `created` if no status change in history.
export function lastTransitionInto(
  issue: JiraIssue,
  currentStatus: string,
): string {
  const hist = issue.changelog?.histories ?? [];
  // histories are usually oldest → newest in REST API v3 response; walk from newest to oldest
  const ordered = [...hist].sort((a, b) => (a.created < b.created ? 1 : -1));
  for (const h of ordered) {
    const item = h.items.find((it) => it.field === 'status' && it.toString === currentStatus);
    if (item) return h.created;
  }
  return (issue.fields.created as string) ?? new Date().toISOString();
}

export function daysInCurrentStatus(issue: JiraIssue, currentStatus: string, nowISO?: string): number {
  const now = nowISO ?? new Date().toISOString();
  const since = lastTransitionInto(issue, currentStatus);
  return workingDaysBetween(since, now);
}
