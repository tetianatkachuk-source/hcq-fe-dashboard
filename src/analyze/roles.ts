// Role tasks — excluded from overload limit per daily-scrum-prompt-v2.md §🛡 Ролеві таски.
// Match by issuetype (Security) or by summary prefix markers.

import type { IssueTypeName } from '../model/types.ts';

const ROLE_SUMMARY_PATTERNS = [
  /^security champion/i,
  /^🧐\s*watchman/i,
  /^dev watchman/i,
  /^🛟\s*qa watchman/i,
  /^qa watchman/i,
] as const;

const ROLE_ISSUE_TYPES = new Set<IssueTypeName>(['Security']);

export function isRoleTask(type: IssueTypeName, summary: string): boolean {
  if (ROLE_ISSUE_TYPES.has(type)) return true;
  const trimmed = summary.trim();
  return ROLE_SUMMARY_PATTERNS.some((re) => re.test(trimmed));
}
