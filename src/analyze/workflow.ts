// Status classification — dual-track workflow from daily-scrum-prompt-v2.md §🔀 Воркфлоу статусів.
// Dev tickets: Dev Backlog → To Do → In Progress → Under Review → Reviewed → Ready for Testing → In Testing → Done → Accepted
// QA tickets (issuetype QA_task/AQA): Dev Backlog → To Do → In Progress → Done → Accepted

import type { IssueTypeName, JiraStatus, StatusBucket } from '../model/types.ts';

const QA_ISSUE_TYPES = new Set<IssueTypeName>(['QA_task', 'AQA']);

export function isQaIssueType(t: IssueTypeName): boolean {
  return QA_ISSUE_TYPES.has(t);
}

export function bucketOf(status: JiraStatus): StatusBucket {
  switch (status) {
    case 'Dev Backlog':
    case 'To Do':
    case 'Open':
      return 'todo';
    case 'In Progress':
      return 'progress';
    case 'Under Review':
    case 'Reviewed':
      return 'review';
    case 'Ready for Testing':
      return 'rft';
    case 'In Testing':
    case 'Returned from Testing':
      return 'testing';
    case 'Ready for Deploy':
      return 'rfd';
    case 'Done':
    case 'Accepted':
      return 'done';
    case 'On hold':
      return 'onhold';
    case 'Blocked':
      return 'blocked';
    default:
      return 'todo';
  }
}

// Active-progress per prompt: In Progress, UR, Reviewed, RFT, In Testing, RFD.
// Excludes Done, On hold, Blocked, Backlog.
export function isActiveProgress(status: JiraStatus): boolean {
  const b = bucketOf(status);
  return b === 'progress' || b === 'review' || b === 'rft' || b === 'testing' || b === 'rfd';
}

export function isDone(status: JiraStatus): boolean {
  return bucketOf(status) === 'done';
}

export function isOnHoldOrBlocked(status: JiraStatus): boolean {
  const b = bucketOf(status);
  return b === 'onhold' || b === 'blocked';
}

// QA-active = dev-tasks in testing OR qa-tasks in progress (issuetype = QA_task/AQA)
export function isQaActive(type: IssueTypeName, status: JiraStatus): boolean {
  const b = bucketOf(status);
  if (isQaIssueType(type) && b === 'progress') return true;
  if (!isQaIssueType(type) && b === 'testing') return true;
  return false;
}

// Dev-tickets that are waiting in QA queue (Ready for Testing, not a QA issuetype itself)
export function isRftQueue(type: IssueTypeName, status: JiraStatus): boolean {
  return !isQaIssueType(type) && bucketOf(status) === 'rft';
}
