// Raw Jira issue → canonical Ticket.
// Centralizes field extraction (sprint, SP, QA estimate, release date, links, etc.).

import type { JiraIssue } from '../jira/client.ts';
import type { Ticket, JiraStatus, IssueTypeName } from '../model/types.ts';
import { FIELD } from '../jira/fields.ts';
import { bucketOf } from './workflow.ts';
import { isRoleTask } from './roles.ts';
import { daysInCurrentStatus } from './age.ts';

function num(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function name(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  return (o.displayName as string) ?? (o.name as string) ?? null;
}

export function extractSprintIds(fieldValue: unknown): number[] {
  if (!Array.isArray(fieldValue)) return [];
  return fieldValue
    .map((entry) => {
      if (typeof entry === 'object' && entry && 'id' in entry) {
        return Number((entry as { id: unknown }).id);
      }
      // Legacy stringified form: com.atlassian.greenhopper...[id=20579,...]
      if (typeof entry === 'string') {
        const m = entry.match(/id=(\d+)/);
        if (m && m[1]) return Number(m[1]);
      }
      return NaN;
    })
    .filter((n) => !Number.isNaN(n));
}

export function extractBlockedBy(issuelinks: unknown): string[] {
  if (!Array.isArray(issuelinks)) return [];
  const out: string[] = [];
  for (const link of issuelinks) {
    if (!link || typeof link !== 'object') continue;
    const l = link as Record<string, any>;
    const type = l.type?.name ?? '';
    // "Blocks" linktype: inward="is blocked by", outward="blocks"
    if (type === 'Blocks' && l.inwardIssue?.key) {
      out.push(l.inwardIssue.key as string);
    }
    // Some instances name it differently
    if (/blocks/i.test(type) && l.inwardIssue?.key && !out.includes(l.inwardIssue.key)) {
      out.push(l.inwardIssue.key as string);
    }
  }
  return out;
}

export function extractBlocks(issuelinks: unknown): string[] {
  if (!Array.isArray(issuelinks)) return [];
  const out: string[] = [];
  for (const link of issuelinks) {
    if (!link || typeof link !== 'object') continue;
    const l = link as Record<string, any>;
    const type = l.type?.name ?? '';
    if (type === 'Blocks' && l.outwardIssue?.key) {
      out.push(l.outwardIssue.key as string);
    }
  }
  return out;
}

export function enrichIssue(issue: JiraIssue, nowISO?: string): Ticket {
  const f = issue.fields;
  const status = (f.status?.name as JiraStatus) ?? 'Dev Backlog';
  const type = (f.issuetype?.name as IssueTypeName) ?? 'Task';
  const summary = (f.summary as string) ?? '';
  const sprintIds = extractSprintIds(f[FIELD.sprint]);
  const subtaskKeys = Array.isArray(f.subtasks)
    ? (f.subtasks.map((s: any) => s?.key).filter(Boolean) as string[])
    : [];

  return {
    key: issue.key,
    summary,
    type,
    status,
    bucket: bucketOf(status),
    assignee: name(f.assignee),
    reporter: name(f.reporter),
    storyPoints: num(f[FIELD.storyPoints]),
    qaEstimate: num(f[FIELD.qaEstimate]),
    aqaEstimate: num(f[FIELD.aqaEstimate]),
    releaseDate: (f[FIELD.releaseDate] as string) ?? null,
    dueDate: (f[FIELD.dueDate] as string) ?? (f.duedate as string) ?? null,
    priority: (f.priority?.name as string) ?? 'Medium',
    updated: (f.updated as string) ?? new Date().toISOString(),
    created: (f.created as string) ?? new Date().toISOString(),
    daysInStatus: daysInCurrentStatus(issue, status, nowISO),
    parentKey: (f.parent?.key as string) ?? null,
    subtaskKeys,
    blockedByKeys: extractBlockedBy(f.issuelinks),
    blocksKeys: extractBlocks(f.issuelinks),
    epicLinkKey: (f[FIELD.epicLink] as string) ?? null,
    sprintIds,
    isRoleTask: isRoleTask(type, summary),
    goalIndex: null,   // filled later in goals.ts
    ruleHits: [],      // filled later in rules.ts
  };
}
