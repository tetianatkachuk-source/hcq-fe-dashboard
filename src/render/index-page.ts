// docs/index.html — lists all snapshots chronologically, points to live dashboard.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { escapeHtml } from './html/escape.ts';

interface SnapshotEntry {
  date: string;
  fileName: string;
  size: number;
  variant: 'daily' | 'pulse';
}

export function scanSnapshots(reportsDir: string): SnapshotEntry[] {
  let files: string[];
  try {
    files = readdirSync(reportsDir);
  } catch {
    return [];
  }
  const entries: SnapshotEntry[] = [];
  for (const name of files) {
    const m = name.match(/^(\d{4}-\d{2}-\d{2})(-pulse)?\.html$/);
    if (!m) continue;
    const full = join(reportsDir, name);
    const stat = statSync(full);
    entries.push({
      date: m[1]!,
      fileName: name,
      size: stat.size,
      variant: m[2] ? 'pulse' : 'daily',
    });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export function renderIndexPage(entries: SnapshotEntry[]): string {
  const rows = entries.map((e) => `<li>
    <a href="reports/${e.fileName}"><code>${e.date}</code></a>
    <span class="tag">${e.variant === 'pulse' ? 'Sprint Pulse' : 'Daily Scrum'}</span>
    <span class="size">${(e.size / 1024).toFixed(1)} KB</span>
  </li>`).join('');
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<title>HCQ FE — Scrum Reports Archive</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{ font:14px -apple-system,Segoe UI,Roboto,sans-serif; color:#0f172a; background:#f5f6f8; margin:0; padding:32px; max-width:900px; margin-inline:auto; }
h1{ font-size:22px; margin:0 0 4px; }
.sub{ color:#64748b; font-size:13px; margin-bottom:24px; }
.bar{ display:flex; gap:12px; margin-bottom:20px; }
.bar a{ display:inline-block; background:#2563eb; color:#fff; padding:8px 14px; border-radius:6px; text-decoration:none; font-size:13px; }
.bar a.ghost{ background:#fff; color:#2563eb; border:1px solid #2563eb; }
ul{ list-style:none; padding:0; margin:0; background:#fff; border:1px solid #e4e7ec; border-radius:8px; overflow:hidden; }
li{ display:flex; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid #e4e7ec; }
li:last-child{ border-bottom:0; }
li a{ color:#2563eb; text-decoration:none; font-weight:600; }
li code{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
.tag{ background:#e0ecfd; color:#3a5aa8; padding:2px 8px; border-radius:6px; font-size:11px; }
.size{ margin-left:auto; color:#64748b; font-size:12px; }
.empty{ padding:40px; text-align:center; color:#64748b; }
</style>
</head>
<body>
<h1>📋 HCQ FE — Scrum Reports</h1>
<p class="sub">Snapshot-архів + live-дашборд. Оновлюється GitHub Action по cron.</p>
<div class="bar">
  <a href="live/">⚡ Live Dashboard</a>
  <a class="ghost" href="data/latest.json">latest.json</a>
</div>
${entries.length === 0 ? '<div class="empty">Ще немає звітів — зачекай перший запуск workflow.</div>' : `<ul>${rows}</ul>`}
</body>
</html>`;
}
