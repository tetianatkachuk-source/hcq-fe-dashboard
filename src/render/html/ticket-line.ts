// Re-usable inline ticket rendering (link + icon + chip + SP + badges).
// Keeps same look across Active-Dev, QA, RFD, Blockers sections.

import type { ReportData, Ticket } from '../../model/types.ts';
import { escapeHtml, h } from './escape.ts';
import { iconFor } from './icons.ts';
import { goalBadge, qaBadge, rdChip, spBadge, staleBadge, statusChip } from './chips.ts';
import { bucketOf } from '../../analyze/workflow.ts';

export function ticketLink(t: Ticket, baseUrl: string, variant: ReportData['variant']): string {
  const url = `${baseUrl}/browse/${t.key}`;
  return `<a href="${url}" target="_blank" rel="noopener">${iconFor(t.type, variant)} <code>${t.key}</code></a>`;
}

export interface TicketLineOpts {
  baseUrl: string;
  variant: ReportData['variant'];
  byKey: Map<string, Ticket>;
  showGoalBadge?: boolean;
  showAssignee?: boolean;
}

export function ticketLine(t: Ticket, opts: TicketLineOpts): string {
  // Inline badges: bug-alert (open story bugs in subtasks), sec-alert (security),
  // rft-alert (RFT/RFD marker), wait-badge (stale days), updated-badge (last-updated date).
  const subs = t.subtaskKeys
    .map((k) => opts.byKey.get(k))
    .filter((s): s is Ticket => !!s);
  const openStoryBugs = subs.filter((s) => s.type === 'story bug' && bucketOf(s.status) !== 'done');
  const openSecurity = subs.filter((s) => s.type === 'Security Sub Task' && bucketOf(s.status) !== 'done');

  const bugAlert = openStoryBugs.length > 0
    ? `<span class="bug-alert">⛔ story bugs: ${openStoryBugs.map((s) => s.key).join(', ')}</span>`
    : '';
  const secAlert = openSecurity.length > 0
    ? `<span class="sec-alert">🛡 security: ${openSecurity.map((s) => s.key).join(', ')}</span>`
    : '';
  const rftAlert = t.bucket === 'rft'
    ? `<span class="rft-alert">🧪 RFT: чекає QA pickup</span>`
    : t.bucket === 'rfd'
      ? `<span class="rft-alert">🚀 RFD: релізимо?</span>`
      : '';
  const waitBadge =
    (t.bucket === 'rft' || t.bucket === 'review') && t.daysInStatus >= 3
      ? `<span class="wait-badge">⏳ ${t.status} ≥${t.daysInStatus} дн.${t.daysInStatus >= 5 ? ' 🚨' : ''}</span>`
      : '';
  const updatedBadge = `<span class="updated-badge">🕒 ${t.updated.slice(0, 10)}</span>`;

  return h(
    '<div class="t">',
    ticketLink(t, opts.baseUrl, opts.variant),
    ' ',
    statusChip(t.status),
    ' ',
    opts.showGoalBadge !== false && t.goalIndex !== null ? goalBadge(t.goalIndex) + ' ' : '',
    spBadge(t.storyPoints),
    qaBadge(t.qaEstimate),
    t.releaseDate ? ' ' + rdChip(t.releaseDate) : '',
    ' — ',
    escapeHtml(t.summary),
    opts.showAssignee && t.assignee ? ` <span class="hint">@${escapeHtml(t.assignee)}</span>` : '',
    bugAlert,
    secAlert,
    rftAlert,
    waitBadge,
    staleBadge(t.daysInStatus),
    ' ',
    updatedBadge,
    '</div>',
  );
}
