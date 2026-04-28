import type { JiraStatus, StatusBucket } from '../../model/types.ts';
import { escapeHtml } from './escape.ts';
import { bucketOf } from '../../analyze/workflow.ts';

const CHIP_CLASS: Record<StatusBucket, string> = {
  todo: 'chip todo',
  progress: 'chip progress',
  review: 'chip review',
  rft: 'chip testing',
  testing: 'chip testing',
  rfd: 'chip rfd',
  done: 'chip done',
  onhold: 'chip onhold',
  blocked: 'chip blocked',
};

export function statusChip(status: JiraStatus): string {
  const cls = CHIP_CLASS[bucketOf(status)] ?? 'chip todo';
  return `<span class="${cls}">${escapeHtml(status)}</span>`;
}

export function goalBadge(index: 0 | 1 | 2 | 3): string {
  return `<span class="g g${index + 1}">G${index + 1}</span>`;
}

export function spBadge(sp: number | null): string {
  if (!sp || sp <= 0) return '';
  return `<span class="sp">${sp} SP</span>`;
}

export function qaBadge(qa: number | null): string {
  if (!qa || qa <= 0) return '';
  return `<span class="sp">${qa} QA</span>`;
}

// Stale-days badge. Only shows for active-progress statuses — for To Do / Backlog
// the time is meaningless (ticket may sit in backlog for the whole sprint).
export function staleBadge(days: number, threshold = 3, status?: JiraStatus): string {
  if (days < threshold) return '';
  if (status) {
    const b = bucketOf(status);
    // Hide for backlog / done / on-hold flavours — only render on active progress.
    if (b === 'todo' || b === 'done' || b === 'onhold' || b === 'blocked') return '';
  }
  const hot = days >= 7 ? ' hot' : '';
  return `<span class="stale${hot}">⏳ ${days} дн.</span>`;
}

export function roleBadge(): string {
  return `<span class="role">role</span>`;
}

export function priorityChip(priority: string): string {
  if (priority === 'Highest' || priority === 'High') {
    return `<span class="chip prio-high">${escapeHtml(priority)}</span>`;
  }
  return `<span class="chip todo">${escapeHtml(priority)}</span>`;
}

// Release-date chip with severity based on proximity
export function rdChip(isoDate: string | null, now = new Date()): string {
  if (!isoDate) return '';
  const rd = new Date(isoDate);
  const diffDays = Math.ceil((rd.getTime() - now.getTime()) / 86_400_000);
  const label = isoDate.slice(0, 10);
  if (diffDays < 0) return `<span class="chip rd-crit">RD ${label} (${-diffDays}д тому)</span>`;
  if (diffDays <= 2) return `<span class="chip rd-crit">RD ${label} (${diffDays}д)</span>`;
  if (diffDays <= 5) return `<span class="chip rd-warn">RD ${label}</span>`;
  return `<span class="chip rd">RD ${label}</span>`;
}
