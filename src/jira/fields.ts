// Custom field IDs — pulled from daily-scrum-prompt-v2.md §🔍 Джерела даних → ключові custom fields.
// If Jira admin changes the field ID, update here — every consumer should import from this file.

export const FIELD = {
  sprint: 'customfield_10007',          // Sprint (object with `goal`)
  storyPoints: 'customfield_10004',
  dueDate: 'customfield_10015',         // also available via top-level `duedate`
  qaEstimate: 'customfield_11258',
  aqaEstimate: 'customfield_21711',
  releaseDate: 'customfield_11263',
  // Sprint review task → Goal_1..Goal_4
  goal1: 'customfield_13974',
  goal2: 'customfield_13975',
  goal3: 'customfield_13976',
  goal4: 'customfield_13977',
  // Goal_1..Goal_4 Result (filled post-sprint)
  goal1Result: 'customfield_13944',
  goal2Result: 'customfield_13945',
  goal3Result: 'customfield_13946',
  goal4Result: 'customfield_13947',
  // FE-specific fields
  feGoal1: 'customfield_13466',
  feGoal2: 'customfield_13467',
  feGoal3: 'customfield_13468',
  feGoal4: 'customfield_13940',
  // BE-specific fields
  beGoal5: 'customfield_19510',
  beGoal6: 'customfield_19511',
  epicLink: 'customfield_10014',        // "Epic Link" — standard in Jira Software
} as const;

export const GOAL_FIELDS = [
  FIELD.goal1,
  FIELD.goal2,
  FIELD.goal3,
  FIELD.goal4,
] as const;

export const REQUIRED_FIELDS = [
  'summary',
  'status',
  'assignee',
  'reporter',
  'priority',
  'issuetype',
  'issuelinks',
  'subtasks',
  'parent',
  'duedate',
  'updated',
  'created',
  'labels',
  FIELD.sprint,
  FIELD.storyPoints,
  FIELD.qaEstimate,
  FIELD.aqaEstimate,
  FIELD.releaseDate,
  FIELD.dueDate,
  FIELD.epicLink,
] as const;
