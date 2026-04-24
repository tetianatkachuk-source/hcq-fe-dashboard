// Live CLI: fetch → analyze → write docs/data/latest.json + archive.
// Same data shape as snapshot, just JSON. Consumed by web/app.ts.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadTeamConfig, loadJiraAuth } from '../config.ts';
import { JiraClient } from '../jira/client.ts';
import { buildReport } from '../analyze/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../..');
const dataDir = resolve(repoRoot, 'docs/data');
const archiveDir = resolve(dataDir, 'archive');

async function main(): Promise<void> {
  const cfg = loadTeamConfig();
  const auth = loadJiraAuth(cfg);
  const client = new JiraClient(auth);

  const dow = new Date().getDay();
  const variant = dow === 2 || dow === 4 ? 'pulse' : 'daily';
  const report = await buildReport(client, cfg, variant);

  mkdirSync(archiveDir, { recursive: true });
  const date = report.generatedAt.slice(0, 10);

  const latestPath = resolve(dataDir, 'latest.json');
  const archivePath = resolve(archiveDir, `${date}.json`);
  const json = JSON.stringify(report, null, 2);
  writeFileSync(latestPath, json, 'utf8');
  writeFileSync(archivePath, json, 'utf8');
  console.error(`[live] wrote ${latestPath} (${(json.length / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error('[live] FAILED:', err);
  process.exit(1);
});
