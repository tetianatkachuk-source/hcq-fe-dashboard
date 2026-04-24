// Live dashboard client. Fetches latest.json, renders using shared templates,
// applies client-side filters (dev / goal / status) with URL sync.

import type { ReportData, StatusBucket } from '../src/model/types.ts';
import { renderSnapshot } from '../src/render/snapshot.ts';
import type { TeamConfig } from '../src/model/types.ts';

const BUCKETS: StatusBucket[] = ['progress', 'review', 'rft', 'testing', 'rfd', 'onhold', 'blocked', 'todo', 'done'];
const BUCKET_LABEL: Record<StatusBucket, string> = {
  progress: 'IP', review: 'UR', rft: 'RFT', testing: 'IT', rfd: 'RFD',
  onhold: 'OnHold', blocked: 'Blocked', todo: 'ToDo', done: 'Done',
};

interface FilterState {
  dev: string | null;
  goal: number | null; // 0..3
  buckets: Set<StatusBucket>;
}

function readUrlState(): FilterState {
  const u = new URL(window.location.href);
  const devRaw = u.searchParams.get('dev');
  const goalRaw = u.searchParams.get('goal');
  const statusRaw = u.searchParams.get('status');
  const buckets = new Set<StatusBucket>();
  if (statusRaw) {
    for (const b of statusRaw.split(',')) {
      if (BUCKETS.includes(b as StatusBucket)) buckets.add(b as StatusBucket);
    }
  }
  return {
    dev: devRaw,
    goal: goalRaw && /^[0-3]$/.test(goalRaw) ? Number(goalRaw) : null,
    buckets,
  };
}

function writeUrlState(s: FilterState): void {
  const u = new URL(window.location.href);
  s.dev ? u.searchParams.set('dev', s.dev) : u.searchParams.delete('dev');
  s.goal !== null ? u.searchParams.set('goal', String(s.goal)) : u.searchParams.delete('goal');
  s.buckets.size > 0
    ? u.searchParams.set('status', [...s.buckets].join(','))
    : u.searchParams.delete('status');
  history.replaceState(null, '', u.toString());
}

function applyFilters(report: ReportData, s: FilterState): ReportData {
  const passes = (t: ReportData['tickets'][number]): boolean => {
    if (s.dev && t.assignee !== s.dev) return false;
    if (s.goal !== null && t.goalIndex !== s.goal) return false;
    if (s.buckets.size > 0 && !s.buckets.has(t.bucket)) return false;
    return true;
  };
  const filtered = report.tickets.filter(passes);
  const keys = new Set(filtered.map((t) => t.key));
  return {
    ...report,
    tickets: filtered,
    devs: report.devs.map((d) => ({
      ...d,
      active: d.active.filter((t) => keys.has(t.key)),
      roleTasks: d.roleTasks.filter((t) => keys.has(t.key)),
      inTesting: d.inTesting.filter((t) => keys.has(t.key)),
      rftQueue: d.rftQueue.filter((t) => keys.has(t.key)),
    })),
    qa: report.qa.map((q) => ({
      ...q,
      active: q.active.filter((t) => keys.has(t.key)),
      roleTasks: q.roleTasks.filter((t) => keys.has(t.key)),
      returned: q.returned.filter((t) => keys.has(t.key)),
    })),
    readyForDeploy: report.readyForDeploy.filter((t) => keys.has(t.key)),
    releasePressure: report.releasePressure.filter((t) => keys.has(t.key)),
    subtasks: report.subtasks.filter((r) => keys.has(r.parentKey)),
    blockers: report.blockers.filter((b) => keys.has(b.key)),
  };
}

const TEAM_CFG: TeamConfig = {
  // Hardcoded at build time — only used by renderer for baseUrl. Actual data comes from latest.json.
  cloudId: '',
  projectKey: 'WEB',
  beProject: 'WEBBE',
  sprintId: 0,
  sprintBaseUrl: 'https://newsiteam.atlassian.net',
  team: { pm: '', po: '', devs: [], qa: [] },
  slackTags: { team: '', devs: '', qa: '', po: '' },
};

async function main(): Promise<void> {
  const res = await fetch('../data/latest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch latest.json: ${res.status}`);
  const report = (await res.json()) as ReportData;

  const meta = document.getElementById('meta')!;
  meta.textContent = `Sprint ${report.sprint.id} · day ${report.sprint.dayN}/${report.sprint.totalDays} · generated ${report.generatedAt}`;

  // populate dev dropdown
  const devSel = document.getElementById('f-dev') as HTMLSelectElement;
  for (const d of report.devs) {
    const o = document.createElement('option');
    o.value = d.name;
    o.textContent = d.name;
    devSel.appendChild(o);
  }
  // status buttons
  const statusBox = document.getElementById('f-status')!;
  for (const b of BUCKETS) {
    const btn = document.createElement('button');
    btn.dataset.bucket = b;
    btn.textContent = BUCKET_LABEL[b];
    statusBox.appendChild(btn);
  }

  let state = readUrlState();
  const goalSel = document.getElementById('f-goal') as HTMLSelectElement;
  devSel.value = state.dev ?? '';
  goalSel.value = state.goal !== null ? String(state.goal) : '';
  for (const btn of statusBox.querySelectorAll<HTMLButtonElement>('button')) {
    if (state.buckets.has(btn.dataset.bucket as StatusBucket)) btn.classList.add('on');
  }

  const rerender = (): void => {
    writeUrlState(state);
    const filtered = applyFilters(report, state);
    const html = renderSnapshot(filtered, TEAM_CFG);
    // Extract body content (strip doctype/head/style) — we only need inside-body bits
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    // Append the style block + body content
    const style = doc.querySelector('style');
    if (style) root.appendChild(style.cloneNode(true));
    for (const child of [...doc.body.children]) {
      root.appendChild(child.cloneNode(true));
    }
  };

  devSel.addEventListener('change', () => { state.dev = devSel.value || null; rerender(); });
  goalSel.addEventListener('change', () => { state.goal = goalSel.value === '' ? null : Number(goalSel.value); rerender(); });
  statusBox.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLButtonElement)) return;
    const b = t.dataset.bucket as StatusBucket;
    if (state.buckets.has(b)) { state.buckets.delete(b); t.classList.remove('on'); }
    else { state.buckets.add(b); t.classList.add('on'); }
    rerender();
  });

  rerender();
}

main().catch((err) => {
  const root = document.getElementById('root')!;
  root.innerHTML = `<div class="loading">❌ ${String(err)}</div>`;
});
