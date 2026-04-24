// Snapshot CLI: fetch → analyze → render → write docs/reports/{date}.html + update docs/index.html.
// Variant auto-selected: Tue/Thu → 'pulse', else 'daily'. Override via --variant.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadTeamConfig, loadJiraAuth } from '../config.ts';
import { JiraClient } from '../jira/client.ts';
import { buildReport } from '../analyze/index.ts';
import { renderSnapshot } from '../render/snapshot.ts';
import { renderIndexPage, scanSnapshots } from '../render/index-page.ts';
import type { ReportVariant } from '../model/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../..');
const docsDir = resolve(repoRoot, 'docs');
const reportsDir = resolve(docsDir, 'reports');

function parseArgs(): { variant: ReportVariant | 'auto'; dry: boolean } {
  const out = { variant: 'auto' as ReportVariant | 'auto', dry: false };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--variant' && process.argv[i + 1]) {
      const v = process.argv[++i];
      if (v === 'daily' || v === 'pulse') out.variant = v;
    } else if (a === '--dry') {
      out.dry = true;
    }
  }
  return out;
}

function autoVariant(): ReportVariant {
  const dow = new Date().getDay(); // 0 Sun, 2 Tue, 4 Thu
  return dow === 2 || dow === 4 ? 'pulse' : 'daily';
}

async function main(): Promise<void> {
  const { variant: v, dry } = parseArgs();
  const variant: ReportVariant = v === 'auto' ? autoVariant() : v;

  const cfg = loadTeamConfig();
  const auth = loadJiraAuth(cfg);
  const client = new JiraClient(auth);

  console.error(`[snapshot] variant=${variant} sprint=${cfg.sprintId}`);
  const report = await buildReport(client, cfg, variant);
  const html = renderSnapshot(report, cfg);

  const date = report.generatedAt.slice(0, 10);
  const fileName = variant === 'pulse' ? `${date}-pulse.html` : `${date}.html`;

  if (dry) {
    process.stdout.write(html);
    return;
  }

  mkdirSync(reportsDir, { recursive: true });
  const outPath = resolve(reportsDir, fileName);
  writeFileSync(outPath, html, 'utf8');
  console.error(`[snapshot] wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);

  // Regenerate index
  const entries = scanSnapshots(reportsDir);
  const indexHtml = renderIndexPage(entries);
  writeFileSync(resolve(docsDir, 'index.html'), indexHtml, 'utf8');
  console.error(`[snapshot] updated docs/index.html (${entries.length} entries)`);
}

main().catch((err) => {
  console.error('[snapshot] FAILED:', err);
  process.exit(1);
});
