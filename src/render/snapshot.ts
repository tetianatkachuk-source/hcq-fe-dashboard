// Full HTML document assembler. `variant` controls palette + icon overrides.

import type { ReportData, TeamConfig } from '../model/types.ts';
import { styleSheet } from './html/styles.ts';
import { escapeHtml } from './html/escape.ts';
import {
  renderActiveDev,
  renderBanner,
  renderBlockers,
  renderBugs,
  renderGoals,
  renderQa,
  renderQuestions,
  renderReleasePressure,
  renderRfd,
  renderSubtasks,
  renderVelocity,
} from './html/sections.ts';

export function renderSnapshot(data: ReportData, cfg: TeamConfig): string {
  const title =
    data.variant === 'pulse'
      ? `Sprint Pulse | HCQ FE | ${data.generatedAt.slice(0, 10)}`
      : `Daily Scrum | HCQ FE | ${data.generatedAt.slice(0, 10)}`;
  const sub = `Sprint ${data.sprint.id} · day ${data.sprint.dayN}/${data.sprint.totalDays}`;

  const baseUrl = cfg.sprintBaseUrl;

  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${styleSheet(data.variant)}</style>
</head>
<body>
<h1>${data.variant === 'pulse' ? '📋 Sprint Pulse' : '📋 Daily Scrum'} <span class="sub">HCQ FE · ${escapeHtml(data.generatedAt.slice(0, 10))} · ${escapeHtml(sub)}</span></h1>
${renderBanner(data)}
${renderReleasePressure(data, baseUrl)}
${renderGoals(data, baseUrl)}
${renderActiveDev(data, baseUrl)}
${renderQa(data, baseUrl)}
${renderRfd(data, baseUrl)}
${renderSubtasks(data, baseUrl)}
${renderBlockers(data, baseUrl)}
${renderBugs(data, baseUrl)}
${renderVelocity(data)}
${renderQuestions(data)}
<p class="hint">Generated ${escapeHtml(data.generatedAt)} · <a href="../index.html">← всі звіти</a> · <a href="../live/">live dashboard</a></p>
</body>
</html>`;
}
