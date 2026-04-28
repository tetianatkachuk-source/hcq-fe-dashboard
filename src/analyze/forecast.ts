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

// Forecast: only return the team's potential closure capacity if we can compute it
// from current velocity. If the data is too thin (no Done SP yet, or sprint barely
// started), return '' so the rendered comment is omitted entirely.
export function velocityForecast(_goals: Goal[], velocity: VelocityMetrics, sprintDayN: number, totalDays: number): string {
  if (!velocity.devTotal || sprintDayN < 2) return '';
  const daysElapsed = Math.max(1, sprintDayN);
  const dailyRate = velocity.devDone / daysElapsed;
  const projected = Math.round(dailyRate * totalDays);
  if (projected <= 0) return '';
  return `Прогноз закриття за поточним темпом: ~${projected} SP / ${velocity.devTotal} SP у спринті.`;
}

export function buildQuestions(data: Omit<ReportData, 'questions' | 'smActions'>): string[] {
  const out: string[] = [];
  // Collect all rule hits prioritized by severity
  const danger = data.tickets.flatMap((t) => t.ruleHits.filter((r) => r.severity === 'danger').map((r) => ({ t, r })));
  const warn = data.tickets.flatMap((t) => t.ruleHits.filter((r) => r.severity === 'warn').map((r) => ({ t, r })));

  for (const { t, r } of [...danger, ...warn]) {
    if (out.length >= 5) break;
    // Fix #8: no @-tags — just plain names or a neutral team label.
    const mention = t.assignee ? t.assignee : 'Команда';
    const line = `${mention} — ${t.key}: ${r.message}`;
    if (!out.includes(line)) out.push(line);
  }
  return out;
}

// buildSmActions removed — section 🎬 SM Actions no longer rendered.
