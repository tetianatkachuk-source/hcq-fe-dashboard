// Deterministic verdict (🟢/🟡/🔴) + forecast line for Velocity card.
// Where the prompt says "Claude decides tone" — we pin down rules.

import type { Goal, ReportData, VelocityMetrics, Verdict } from '../model/types.ts';

export function verdictFromGoals(goals: Goal[], velocity: VelocityMetrics, sprintDayN: number, totalDays: number): Verdict {
  const goalsBlocked = goals.some((g) => g.blockerKeys.length > 2);
  const anyGoalMissing = goals.some((g) => g.kind === 'missing');
  // expected % progress by day (simple linear)
  const expectedPct = Math.round(Math.min(1, sprintDayN / Math.max(totalDays, 1)) * 100);
  const actualPct = velocity.devTotal > 0 ? Math.round((velocity.devDone / velocity.devTotal) * 100) : 0;
  const behind = expectedPct - actualPct;

  if (goalsBlocked || anyGoalMissing || behind > 20) return 'off-track';
  if (behind > 10 || goals.some((g) => g.blockerKeys.length > 0)) return 'at-risk';
  return 'on-track';
}

export function verdictEmoji(v: Verdict): string {
  switch (v) {
    case 'on-track': return '🟢 У графіку';
    case 'at-risk': return '🟡 На грані';
    case 'off-track': return '🔴 Ризик невиконання';
  }
}

export function verdictSummaryLine(goals: Goal[]): string {
  return goals
    .map((g) => {
      if (g.kind === 'missing') return `G${g.index + 1} — не знайдено у спринті`;
      if (g.bucket === 'done') return `G${g.index + 1} done`;
      if (g.bucket === 'blocked' || g.bucket === 'onhold') return `G${g.index + 1} заблокована`;
      if (g.donePct >= 75) return `G${g.index + 1} на фініші (${g.donePct}%)`;
      if (g.donePct > 0) return `G${g.index + 1} у роботі (${g.donePct}%)`;
      return `G${g.index + 1} ще не стартувала`;
    })
    .join(', ');
}

export function velocityForecast(goals: Goal[], velocity: VelocityMetrics, sprintDayN: number, totalDays: number): string {
  const expected = Math.round((sprintDayN / Math.max(totalDays, 1)) * (velocity.devTotal || 0));
  const tempo = velocity.devDone >= expected ? 'Темп ок' : 'Темп нижче очікуваного';
  const goalTags = goals.map((g) => {
    const n = `G${g.index + 1}`;
    if (g.kind === 'missing') return `${n} ?`;
    if (g.bucket === 'done') return `${n} ✅`;
    if (g.blockerKeys.length > 0) return `${n} risk`;
    if (g.donePct >= 75) return `${n} realistic`;
    return `${n} in-progress`;
  });
  return `${tempo}, ${goalTags.join(', ')}.`;
}

export function buildQuestions(data: Omit<ReportData, 'questions' | 'smActions'>): string[] {
  const out: string[] = [];
  // Collect all rule hits prioritized by severity
  const danger = data.tickets.flatMap((t) => t.ruleHits.filter((r) => r.severity === 'danger').map((r) => ({ t, r })));
  const warn = data.tickets.flatMap((t) => t.ruleHits.filter((r) => r.severity === 'warn').map((r) => ({ t, r })));

  for (const { t, r } of [...danger, ...warn]) {
    if (out.length >= 5) break;
    const mention = t.assignee ? `@${t.assignee}` : '@health-coaching_team';
    const line = `${mention} — ${t.key}: ${r.message}`;
    if (!out.includes(line)) out.push(line);
  }
  return out;
}

export function buildSmActions(data: Omit<ReportData, 'questions' | 'smActions'>): string[] {
  const out: string[] = [];
  if (data.verdict === 'off-track') {
    out.push('Escalation: verdict off-track — обговорити з PO scope-cut або перенесення цілей.');
  }
  if (data.releasePressure.length > 0) {
    out.push(`Release pressure: ${data.releasePressure.length} таск(и) з RD ≤ 2 дн — синк з PO про пріоритет.`);
  }
  if (data.bugsNoProgress.length > 0) {
    out.push(`Пінгнути репортерів: ${data.bugsNoProgress.map((g) => g.reporter).slice(0, 3).join(', ')} — забрати баги через bug-bot.`);
  }
  const urStale = data.tickets.filter((t) => t.ruleHits.some((r) => r.rule === 1));
  if (urStale.length > 0) {
    out.push(`Пінгнути reviewers: ${urStale.slice(0, 3).map((t) => t.key).join(', ')} — UR > 4 дн.`);
  }
  const rftQ = data.tickets.filter((t) => t.bucket === 'rft');
  if (rftQ.length > 0) {
    out.push(`QA pickup: ${rftQ.slice(0, 3).map((t) => t.key).join(', ')} — черга на тест.`);
  }
  return out.slice(0, 5);
}
