// Issue type → emoji icon. `🔹` for Task/A_B_test in `pulse` variant (per scrum-update-fe-prompt-draft v2 PO decision).

import type { IssueTypeName, ReportVariant } from '../../model/types.ts';

const BASE: Record<string, string> = {
  'Task': '✅',
  'Bug': '🪲',
  'Story': '📖',
  'story bug': '🐛',
  'Sub-task': '📋',
  'QA_task': '🧪',
  'AQA': '🤖',
  'Security': '🛡',
  'Security Sub Task': '🛡',
  'A/B_test': '🔬',
  'Epic': '🔖',
  'Design web': '🎨',
  'UI/UX task': '🎨',
  'Analytics': '📊',
  'Research': '🔎',
  'Technical debt': '🔧',
  'Feature': '⭐',
  'Hypothesis': '💡',
  'Web Hypothesis': '💡',
  'Documentation': '📄',
  'Incident': '🚨',
  'Sprint review': '🏁',
  'Localization task': '🌐',
  'Monetization task': '💰',
};

const PULSE_OVERRIDES: Record<string, string> = {
  'Task': '🔹',
  'A/B_test': '🔹',
};

export function iconFor(type: IssueTypeName, variant: ReportVariant = 'daily'): string {
  if (variant === 'pulse' && type in PULSE_OVERRIDES) return PULSE_OVERRIDES[type as keyof typeof PULSE_OVERRIDES]!;
  return BASE[type] ?? '📌';
}
