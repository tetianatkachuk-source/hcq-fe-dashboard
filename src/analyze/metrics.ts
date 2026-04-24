// 7 velocity KPI tiles (daily-scrum-prompt-v2.md §📌 Velocity KPI-плитки + patch-qa-total).
// All 7 are mandatory, incl. QA Total.

import type { Ticket, VelocityMetrics } from '../model/types.ts';
import { bucketOf, isQaIssueType } from './workflow.ts';

export function computeVelocity(tickets: Ticket[]): VelocityMetrics {
  let devDone = 0;
  let devActive = 0;
  let devOnHold = 0;
  let qaDone = 0;
  let qaActive = 0;
  let qaTotal = 0;
  let qaInRft = 0;
  let qaOnHold = 0;

  for (const t of tickets) {
    const sp = t.storyPoints ?? 0;
    const qa = t.qaEstimate ?? 0;
    const b = t.bucket;

    // DEV SP — include ALL dev-workflow tickets (exclude pure QA_task/AQA which have no SP anyway)
    // For QA Total we only sum tickets where qa estimate is present.
    if (!isQaIssueType(t.type)) {
      if (b === 'done') devDone += sp;
      else if (b === 'onhold' || b === 'blocked') devOnHold += sp;
      else if (b === 'progress' || b === 'review' || b === 'rft' || b === 'testing' || b === 'rfd') {
        devActive += sp;
      }
    }

    // QA estimate accounting
    if (qa > 0) {
      qaTotal += qa;
      if (b === 'done') qaDone += qa;
      if (b === 'onhold' || b === 'blocked') qaOnHold += qa;
      if (b === 'rft' && !isQaIssueType(t.type)) qaInRft += qa;
      // QA Active = dev tickets in testing OR qa-type tickets in progress
      if (
        (!isQaIssueType(t.type) && b === 'testing') ||
        (isQaIssueType(t.type) && b === 'progress')
      ) {
        qaActive += qa;
      }
    }
  }

  const devTotal = devDone + devActive + devOnHold;
  const qaDonePct = qaTotal > 0 ? Math.round((qaDone / qaTotal) * 100) : 0;

  return {
    devDone,
    devActive,
    devOnHold,
    devTotal,
    qaDone,
    qaActive,
    qaTotal,
    qaDonePct,
    qaInRft,
    qaOnHold,
    forecast: '', // populated by forecast.ts when goals+velocity known
  };
}
