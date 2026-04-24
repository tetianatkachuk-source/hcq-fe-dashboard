import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { TeamConfig } from './model/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadTeamConfig(): TeamConfig {
  const p = resolve(__dirname, '../config/team.json');
  const raw = readFileSync(p, 'utf8');
  const parsed = JSON.parse(raw) as TeamConfig;
  // env overrides
  if (process.env.CLOUD_ID) parsed.cloudId = process.env.CLOUD_ID;
  if (process.env.SPRINT_ID) parsed.sprintId = Number(process.env.SPRINT_ID);
  return parsed;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export interface JiraAuth {
  email: string;
  token: string;
  cloudId: string;
  baseUrl: string;
}

export function loadJiraAuth(cfg: TeamConfig): JiraAuth {
  return {
    email: requireEnv('JIRA_EMAIL'),
    token: requireEnv('JIRA_API_TOKEN'),
    cloudId: cfg.cloudId,
    baseUrl: cfg.sprintBaseUrl,
  };
}
