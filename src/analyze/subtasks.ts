// Sub-task analysis per daily-scrum-prompt-v2.md §Story bugs & sub-tasks.
// Output: SubtaskRow[] — sub-task that actively blocks its parent.

import type { IssueTypeName, SubtaskRow, Ticket } from '../model/types.ts';
import { isDone } from './workflow.ts';

const IGNORE_WHILE_NOT_RFD = /run analytics tool/i;

// Design subtasks live under Design web / UI/UX parents and aren't dev-blockers.
const DESIGN_PARENT_TYPES = new Set<IssueTypeName>(['Design web', 'UI/UX task']);

export function buildSubtaskRows(tickets: Ticket[]): SubtaskRow[] {
  const byKey = new Map(tickets.map((t) => [t.key, t]));
  const rows: SubtaskRow[] = [];

  for (const sub of tickets) {
    // Only non-done subtasks / security / story bugs (fix #4: Done already filtered here)
    if (isDone(sub.status)) continue;
    if (sub.type !== 'Sub-task' && sub.type !== 'story bug' && sub.type !== 'Security Sub Task') continue;
    if (!sub.parentKey) continue;
    const parent = byKey.get(sub.parentKey);
    if (!parent) continue;
    // Fix #1: skip web design subtasks — they aren't part of the dev/QA flow
    if (DESIGN_PARENT_TYPES.has(parent.type)) continue;
    // Fix #4: also skip when parent is already Done/Accepted — nothing to escalate
    if (parent.bucket === 'done') continue;

    // "Run Analytics Tool" — ignore until parent reaches RFD
    if (IGNORE_WHILE_NOT_RFD.test(sub.summary) && parent.bucket !== 'rfd') continue;

    // Filter: which combinations actually matter?
    // (Done parents already filtered above by fix #4.)
    const parentLate =
      parent.bucket === 'rft' ||
      parent.bucket === 'testing' ||
      parent.bucket === 'rfd';
    const isStoryBug = sub.type === 'story bug';
    const isSecurity = sub.type === 'Security Sub Task';
    const isTestCases = /\[test cases\]/i.test(sub.summary);

    let priority: SubtaskRow['priority'];
    if (isStoryBug && parentLate) priority = 'close-first';
    else if (isSecurity && ['review', 'rft', 'testing', 'rfd'].includes(parent.bucket)) priority = 'close-first';
    else if (isTestCases && ['rft', 'testing'].includes(parent.bucket)) priority = 'close-first';
    else if (parentLate) priority = 'after-parent';
    else priority = 'info';

    // Skip purely informational ones — only report rows that matter
    if (priority === 'info') continue;

    rows.push({
      subtaskKey: sub.key,
      subtaskSummary: sub.summary,
      subtaskType: sub.type,
      subtaskStatus: sub.status,
      parentKey: parent.key,
      parentStatus: parent.status,
      parentBucket: parent.bucket,
      parentGoalIndex: parent.goalIndex,
      priority,
    });
  }

  // Sort: close-first → after-parent; then by parent key
  rows.sort((a, b) => {
    const pr = (x: SubtaskRow) => (x.priority === 'close-first' ? 0 : 1);
    if (pr(a) !== pr(b)) return pr(a) - pr(b);
    return a.parentKey.localeCompare(b.parentKey);
  });

  return rows;
}
