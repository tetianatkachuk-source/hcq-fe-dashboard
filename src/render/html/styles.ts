import type { ReportVariant } from '../../model/types.ts';

export function styleSheet(variant: ReportVariant): string {
  const cardBgDefault = variant === 'pulse' ? '#ffffff' : '#fcfdff';
  const accentDefault = '#64748b';
  return `
:root{
  --ink:#0f172a; --muted:#64748b; --border:#e4e7ec;
  --link:#2563eb; --risk:#dc2626; --accent:${accentDefault};
  --bg:#f5f6f8; --card-bg:${cardBgDefault};
}
*{ box-sizing:border-box; }
body{ margin:0; padding:24px; font:14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; background:var(--bg); color:var(--ink); }
h1{ font-size:22px; margin:0 0 6px; border-bottom:2px solid var(--border); padding-bottom:8px; }
h1 .sub{ font-size:13px; color:var(--muted); font-weight:400; margin-left:8px; }
h2{ font-size:15px; margin:0 0 2px; }
h3{ font-size:13.5px; margin:14px 0 4px; }
a{ color:var(--link); text-decoration:none; }
a:hover{ text-decoration:underline; }
.section-hint{ color:var(--muted); font-style:italic; font-size:12.5px; margin:2px 0 10px; }
.card{ background:var(--card-bg); border:1px solid var(--border); border-left:4px solid var(--accent);
       padding:14px 18px; margin:12px 0; border-radius:8px; box-shadow:0 1px 2px rgba(0,0,0,0.03); }
.card.risk{ border-left-color:var(--risk); }
.card.rp{ border-left-color:var(--risk); background:#fff7f7; }
.banner{ background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:12px 16px; margin:8px 0 16px; }
.banner .verdict{ display:inline-block; font-weight:600; padding:3px 10px; border-radius:6px; background:#fef3c7; color:#92400e; margin-right:10px; }
.banner .verdict.ok{ background:#dcfce7; color:#166534; }
.banner .verdict.bad{ background:#fee2e2; color:#991b1b; }
.banner .pulse-summary{ display:inline; font-size:13.5px; color:var(--ink); margin:0; }

/* Chips */
.chip{ display:inline-block; font-weight:500; font-size:11px; letter-spacing:0; text-transform:none;
       padding:2px 7px; border-radius:6px; margin:1px 2px 1px 0; }
.chip.todo{ background:#f1f5f9; color:#475569; }
.chip.progress{ background:#fff4e5; color:#9a6a2e; }
.chip.review{ background:#fef7e0; color:#8a6d1e; }
.chip.testing{ background:#e0ecfd; color:#3a5aa8; }
.chip.rfd{ background:#d7f1f4; color:#205f70; }
.chip.done{ background:#ddf4e2; color:#2e6b3b; }
.chip.onhold{ background:#e4e7ec; color:#3a4553; }
.chip.blocked,.chip.open{ background:#fbdada; color:#8a3030; font-weight:600; }
.chip.prio-high{ background:#fbdada; color:#8a3030; }
.chip.rd{ background:#e0ecfd; color:#3a5aa8; }
.chip.rd-warn{ background:#fdf0d9; color:#8a5a1c; }
.chip.rd-crit{ background:#fbdada; color:#8a3030; font-weight:600; }

/* Goal badges */
.g{ display:inline-block; padding:2px 7px; border-radius:4px; font-weight:700; font-size:11px; color:#fff; margin-right:6px; }
.g.g1{ background:#c2410c; }
.g.g2{ background:#2563eb; }
.g.g3{ background:#7c3aed; }
.g.g4{ background:#059669; }

.sp{ color:var(--muted); font-weight:600; font-size:12px; margin-left:6px; }
.role{ background:#eef2ff; color:#3730a3; font-size:11px; padding:2px 7px; border-radius:6px; margin:0 3px; }
.stale{ background:#fed7aa; color:#7c2d12; font-size:11px; padding:2px 7px; border-radius:6px; margin-left:6px; }
.stale.hot{ background:#fecaca; color:#7f1d1d; }
.delta-inline{ display:inline-block; font-size:12px; padding:1px 5px; border-radius:4px; background:#fff; border:1px solid var(--border); margin-left:6px; color:var(--muted); }

/* Task rows */
.t{ font-size:13.5px; margin:4px 0; line-height:1.6; }
.note{ color:var(--muted); font-size:12.5px; margin:6px 0 0 20px; }
.note.warn{ color:#9a6a2e; }
.note.danger{ color:var(--risk); }
.hint{ color:var(--muted); font-size:12.5px; }

/* KPI tiles */
.kpi-strip{ display:grid; grid-template-columns:repeat(auto-fit, minmax(135px, 1fr)); gap:10px; margin:10px 0 6px; }
.kpi{ background:#fff; border:1px solid var(--border); border-radius:7px; padding:8px 10px; }
.kpi .lbl{ font-size:10.5px; text-transform:uppercase; letter-spacing:0.02em; color:var(--muted); }
.kpi .val{ font-size:19px; font-weight:700; line-height:1.1; margin-top:3px; }
.kpi .sub{ font-size:10.5px; color:var(--muted); margin-top:3px; }
.kpi.green .val{ color:#15803d; }
.kpi.yellow .val{ color:#a16207; }
.kpi.red .val{ color:var(--risk); }

/* Tables */
table{ width:100%; border-collapse:collapse; margin:8px 0; font-size:13px; }
th,td{ padding:6px 8px; border:1px solid var(--border); text-align:left; vertical-align:top; }
th{ background:#f8fafc; font-weight:600; font-size:11.5px; }

.person-meta{ font-weight:400; color:var(--muted); font-size:12px; margin-left:6px; }
.goals-line{ display:flex; flex-wrap:wrap; gap:10px; }

/* Inline badge helpers (bug-alert, sec-alert, rft-alert, wait-badge, updated-badge) */
.bug-alert{ background:#fee2e2; color:#991b1b; padding:1px 6px; border-radius:4px; font-size:11px; margin-left:4px; }
.sec-alert{ background:#ede9fe; color:#5b21b6; padding:1px 6px; border-radius:4px; font-size:11px; margin-left:4px; }
.rft-alert{ background:#dbeafe; color:#1e40af; padding:1px 6px; border-radius:4px; font-size:11px; margin-left:4px; }
.wait-badge{ background:#fef3c7; color:#92400e; padding:1px 6px; border-radius:4px; font-size:11px; margin-left:4px; }
.updated-badge{ background:#f1f5f9; color:#475569; padding:1px 6px; border-radius:4px; font-size:10.5px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; margin-left:4px; }
`;
}
