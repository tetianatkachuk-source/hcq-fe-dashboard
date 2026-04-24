// All report sections in one file for brevity — each returns an HTML string.

import type { ReportData, Ticket } from '../../model/types.ts';
import { escapeHtml, h } from './escape.ts';
import { goalBadge, priorityChip, qaBadge, rdChip, spBadge, statusChip } from './chips.ts';
import { ticketLine, ticketLink } from './ticket-line.ts';
import { verdictEmoji } from '../../analyze/forecast.ts';

function hint(text: string): string {
  return `<p class="section-hint">${escapeHtml(text)}</p>`;
}

export function renderBanner(data: ReportData): string {
  const cls =
    data.verdict === 'on-track' ? 'verdict ok' :
    data.verdict === 'off-track' ? 'verdict bad' : 'verdict';
  return `<div class="banner">
  <span class="${cls}">${escapeHtml(verdictEmoji(data.verdict))}</span>
  <p class="pulse-summary">${escapeHtml(data.verdictSummary)}</p>
</div>`;
}

export function renderReleasePressure(data: ReportData, baseUrl: string): string {
  if (data.releasePressure.length === 0) return '';
  const rows = data.releasePressure.map((t) => ticketLine(t, {
    baseUrl, variant: data.variant, byKey: new Map(data.tickets.map((x) => [x.key, x])),
    showAssignee: true,
  })).join('');
  return `<div class="card rp">
  <h2>🚨 Release Pressure</h2>
  ${hint('Таски з release date ≤ 2 дні, які ще не у QA-флоу. Треба рішення: пушимо сьогодні чи рухаємо RD.')}
  ${rows}
</div>`;
}

export function renderGoals(data: ReportData, baseUrl: string): string {
  const byKey = new Map(data.tickets.map((t) => [t.key, t]));
  const items = data.goals.map((g) => {
    if (g.kind === 'missing') {
      return `<div class="t">${goalBadge(g.index)} <em>${escapeHtml(g.summary)}</em> <span class="chip todo">не знайдено у спринті</span></div>`;
    }
    const header = h(
      goalBadge(g.index),
      ' <strong>',
      escapeHtml(g.summary),
      '</strong> ',
      statusChip(g.status),
      ` <span class="hint">${g.donePct}% · ${g.spDone}/${g.spTotal} SP · ${g.qaDone}/${g.qaTotal} QA</span>`,
    );

    // If Done — compact one-liner
    if (g.bucket === 'done') {
      return `<div class="t">${header} <span class="chip done">Done</span></div>`;
    }

    // If many blockers — point to blockers section
    if (g.blockerKeys.length >= 3) {
      return `<div class="t">${header}
  <div class="note warn">⚠️ Блокери (${g.blockerKeys.length}): див. секцію «Блокери».</div>
</div>`;
    }

    // otherwise list child tickets
    const children = g.childTickets
      .slice(0, 6)
      .map((c) => ticketLine(c, { baseUrl, variant: data.variant, byKey }))
      .join('');
    const extra = g.childTickets.length > 6 ? `<div class="note">...ще ${g.childTickets.length - 6} тасок у цілі.</div>` : '';
    const blockerLine = g.blockerKeys.length > 0
      ? `<div class="note warn">⚠️ Блокери: ${g.blockerKeys.join(', ')}</div>`
      : '';
    return `<div class="t">${header}</div>
${children}${extra}${blockerLine}`;
  }).join('');

  return `<div class="card">
  <h2>🏴 Sprint Goals</h2>
  ${hint('Чотири цілі спринту зі Sprint review таски. Прогрес % — SP Done / SP Total серед тасок цілі.')}
  ${items}
</div>`;
}

export function renderActiveDev(data: ReportData, baseUrl: string): string {
  const byKey = new Map(data.tickets.map((t) => [t.key, t]));
  const groups = data.devs.map((d) => {
    if (d.active.length === 0 && d.roleTasks.length === 0) {
      return `<h3>${escapeHtml(d.name)} <span class="person-meta">— немає активних</span></h3>`;
    }
    const meta = [`${d.active.length} активних`, d.overloaded ? '⚠️ перевантаж.' : '', d.roleTasks.length ? `${d.roleTasks.length} role` : '']
      .filter(Boolean).join(' · ');
    const activeRows = d.active.map((t) => ticketLine(t, { baseUrl, variant: data.variant, byKey })).join('');
    const roleRows = d.roleTasks.length > 0
      ? `<div class="note">Role: ${d.roleTasks.map((t) => `${t.key} (${t.summary})`).join(', ')}</div>`
      : '';
    return `<h3>${escapeHtml(d.name)} <span class="person-meta">— ${meta}</span></h3>
${activeRows}${roleRows}`;
  }).join('');

  return `<div class="card">
  <h2>🔄 Активні задачі по розробниках</h2>
  ${hint('Те, що зараз у роботі у dev-команди. Поруч із тікетом — інлайн-бейджі: story bugs, security, RFT/RFD. Ролеві таски не рахуються у ліміт.')}
  ${groups}
</div>`;
}

export function renderQa(data: ReportData, baseUrl: string): string {
  const byKey = new Map(data.tickets.map((t) => [t.key, t]));
  const groups = data.qa.map((q) => {
    const meta = [`${q.active.length} активних`, q.overloaded ? '⚠️ перевантаж.' : '', q.roleTasks.length ? 'QA Watchman' : ''].filter(Boolean).join(' · ');
    const rows = q.active.length === 0
      ? `<p class="note">Немає активного тесту.</p>`
      : q.active.map((t) => ticketLine(t, { baseUrl, variant: data.variant, byKey })).join('');
    const returned = q.returned.length > 0
      ? `<div class="note warn">Returned from Testing: ${q.returned.map((t) => t.key).join(', ')}</div>`
      : '';
    return `<h3>${escapeHtml(q.name)} <span class="person-meta">— ${meta}</span></h3>${rows}${returned}`;
  }).join('');

  const rftQueue = data.tickets.filter((t) => t.bucket === 'rft');
  const queueBlock = rftQueue.length === 0
    ? `<p class="note">Черга RFT порожня.</p>`
    : `<h3>Черга на QA (RFT)</h3>` +
      rftQueue.map((t) => ticketLine(t, { baseUrl, variant: data.variant, byKey, showAssignee: true })).join('');

  const missingQaEst = data.tickets.filter((t) =>
    !t.qaEstimate && t.bucket !== 'done' && t.type !== 'Sub-task' && t.type !== 'Security Sub Task'
  );
  const missingBlock = missingQaEst.length > 0
    ? `<div class="note warn">QA estimates не проставлені у: ${missingQaEst.slice(0, 10).map((t) => `${t.key} (${t.storyPoints ?? 0} SP)`).join(', ')}${missingQaEst.length > 10 ? ', ...' : ''}</div>`
    : '';

  return `<div class="card">
  <h2>🧪 QA команда — навантаження</h2>
  ${hint('Окремий зріз по QA: хто що тестує, черга RFT, QA estimates. Ролеві QA Watchman не рахуються у ліміт.')}
  ${groups}
  ${queueBlock}
  ${missingBlock}
</div>`;
}

export function renderRfd(data: ReportData, baseUrl: string): string {
  if (data.readyForDeploy.length === 0) return '';
  const byKey = new Map(data.tickets.map((t) => [t.key, t]));
  const rows = data.readyForDeploy.map((t) => ticketLine(t, { baseUrl, variant: data.variant, byKey, showAssignee: true })).join('');
  return `<div class="card">
  <h2>🚀 Ready for Deploy — релізимо?</h2>
  ${hint('Перед релізом — перевірити, що усі Security Sub Tasks закриті і Run Analytics Tool зроблено.')}
  ${rows}
</div>`;
}

export function renderSubtasks(data: ReportData, baseUrl: string): string {
  if (data.subtasks.length === 0) return '';
  const rows = data.subtasks.map((r) => `<tr>
    <td><a href="${baseUrl}/browse/${r.subtaskKey}" target="_blank">${r.subtaskKey}</a> ${statusChip(r.subtaskStatus)} <span class="hint">${escapeHtml(r.subtaskSummary)}</span></td>
    <td><a href="${baseUrl}/browse/${r.parentKey}" target="_blank">${r.parentKey}</a> ${r.parentGoalIndex !== null ? goalBadge(r.parentGoalIndex) : ''}</td>
    <td>${statusChip(r.parentStatus)}</td>
    <td>${r.priority === 'close-first' ? '<span class="chip prio-high">🚨 close-first</span>' : '<span class="chip todo">after-parent</span>'}</td>
  </tr>`).join('');
  return `<div class="card">
  <h2>🔔 Subtasks — увага</h2>
  ${hint('Sub-tasks, які блокують перехід parent-таски: story bugs, security, test-cases.')}
  <table>
    <thead><tr><th>Sub-task</th><th>Parent</th><th>Parent status</th><th>Пріоритет</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
}

export function renderBlockers(data: ReportData, baseUrl: string): string {
  if (data.blockers.length === 0) return '';
  const rows = data.blockers.map((b) => `<div class="t">
    <a href="${baseUrl}/browse/${b.key}" target="_blank">${b.key}</a>
    ${statusChip(b.status)} — ${escapeHtml(b.note)}
    ${b.assignee ? ` <span class="hint">@${escapeHtml(b.assignee)}</span>` : ''}
  </div>`).join('');
  return `<div class="card risk">
  <h2>⚠️ Блокери та ризики</h2>
  ${hint('Jira-лінки is blocked by, cross-team залежності, stale Under Review, On hold > 2 днів, прострочені due dates.')}
  ${rows}
</div>`;
}

export function renderBugs(data: ReportData, baseUrl: string): string {
  if (data.bugsNoProgress.length === 0) return '';
  const groups = data.bugsNoProgress.map((g) => {
    const bugs = g.bugs.map((b) =>
      `<li><a href="${baseUrl}/browse/${b.key}" target="_blank">${b.key}</a> ${priorityChip(b.priority)} <span class="hint">${escapeHtml(b.summary)} (${b.daysInBacklog} дн.)</span></li>`
    ).join('');
    return `<h3>👤 ${escapeHtml(g.reporter)} <span class="person-meta">— ${g.bugs.length} баг(и) без руху</span></h3><ul>${bugs}</ul>`;
  }).join('');
  return `<div class="card">
  <h2>🐞 Bugs no progress</h2>
  ${hint('Bug-тікети без прогресу > 5 днів. Репортер — забирай у роботу через /bug-bot pick у #hcq-bug-bot.')}
  ${groups}
</div>`;
}

function kpi(lbl: string, val: string | number, sub: string, cls = ''): string {
  return `<div class="kpi ${cls}">
  <div class="lbl">${lbl}</div>
  <div class="val">${val}</div>
  <div class="sub">${sub}</div>
</div>`;
}

export function renderVelocity(data: ReportData): string {
  const v = data.velocity;
  const qaTotalSub = v.qaTotal > 0
    ? `~${v.qaDonePct}% QA done${v.qaInRft > 0 ? ` · RFT: ${v.qaInRft}` : ''}${v.qaOnHold > 0 ? ` · On hold: ${v.qaOnHold}` : ''}`
    : '';
  return `<div class="card">
  <h2>⚡ Velocity / Scope</h2>
  ${hint('Закриті SP / активні SP / заморожені. QA Total — весь QA scope (не лише done/active).')}
  <div class="kpi-strip">
    ${kpi('DEV Done', `${v.devDone} SP`, `${data.sprint.dayN}/${data.sprint.totalDays} day`, 'green')}
    ${kpi('DEV Active', `${v.devActive} SP`, 'IP/UR/RFT/IT/RFD', 'yellow')}
    ${kpi('DEV On Hold', `${v.devOnHold} SP`, 'on hold + blocked', 'red')}
    ${kpi('DEV Total', `${v.devTotal} SP`, 'сумарно у спринті')}
    ${kpi('QA Done', `${v.qaDone}`, 'QA estimates done', 'green')}
    ${kpi('QA Active', `${v.qaActive}`, 'In Testing + QA IP', 'yellow')}
    ${kpi('QA Total', `${v.qaTotal}`, qaTotalSub)}
  </div>
  <p class="hint">${escapeHtml(v.forecast)}</p>
</div>`;
}

export function renderQuestions(data: ReportData): string {
  if (data.questions.length === 0) return '';
  const items = data.questions.map((q, i) => `<li>${escapeHtml(q)}</li>`).join('');
  return `<div class="card">
  <h2>❓ Питання на стендап</h2>
  ${hint('Top-5 питань, які реально потребують обговорення на daily.')}
  <ol>${items}</ol>
</div>`;
}

export function renderSmActions(data: ReportData): string {
  if (data.smActions.length === 0) return '';
  const items = data.smActions.map((a) => `<li>${escapeHtml(a)}</li>`).join('');
  return `<div class="card">
  <h2>🎬 SM Actions</h2>
  ${hint('Дії Scrum Master після стендапу.')}
  <ol>${items}</ol>
</div>`;
}
