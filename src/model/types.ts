// Canonical domain model for the HCQ FE dashboard.
// Single source of truth — used by snapshot renderer, live dashboard client, and analyzers.

export type IssueTypeName =
  | 'Task'
  | 'Bug'
  | 'Story'
  | 'story bug'
  | 'Sub-task'
  | 'QA_task'
  | 'AQA'
  | 'Security'
  | 'Security Sub Task'
  | 'A/B_test'
  | 'Epic'
  | 'Sprint review'
  | 'Design web'
  | 'UI/UX task'
  | 'Analytics'
  | 'Research'
  | 'Technical debt'
  | 'Feature'
  | 'Hypothesis'
  | 'Web Hypothesis'
  | 'Documentation'
  | 'Incident'
  | 'Localization task'
  | 'Monetization task'
  | string;

// Full list — see daily-scrum-prompt-v2.md §🔀 Воркфлоу статусів
export type JiraStatus =
  | 'Dev Backlog'
  | 'To Do'
  | 'Open'
  | 'In Progress'
  | 'Under Review'
  | 'Reviewed'
  | 'Ready for Testing'
  | 'In Testing'
  | 'Returned from Testing'
  | 'Ready for Deploy'
  | 'Done'
  | 'Accepted'
  | 'On hold'
  | 'Blocked'
  | string;

export type StatusBucket =
  | 'todo'        // Dev Backlog / To Do / Open
  | 'progress'    // In Progress
  | 'review'      // Under Review / Reviewed
  | 'rft'         // Ready for Testing
  | 'testing'     // In Testing / Returned from Testing
  | 'rfd'         // Ready for Deploy
  | 'done'        // Done / Accepted
  | 'onhold'      // On hold
  | 'blocked';    // Blocked

export type ReportVariant = 'daily' | 'pulse';

export interface SprintInfo {
  id: number;
  name: string;
  dayN: number;
  totalDays: number;
  startDate: string; // ISO
  endDate: string;   // ISO
}

export interface TicketLink {
  key: string;
  summary: string;
  status: JiraStatus;
  project: string;
  type?: IssueTypeName;
}

export interface Ticket {
  key: string;
  summary: string;
  type: IssueTypeName;
  status: JiraStatus;
  bucket: StatusBucket;
  assignee: string | null;
  reporter: string | null;
  storyPoints: number | null;      // customfield_10004
  qaEstimate: number | null;       // customfield_11258
  aqaEstimate: number | null;      // customfield_21711
  releaseDate: string | null;      // customfield_11263 (ISO)
  dueDate: string | null;          // customfield_10015 or duedate
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest' | string;
  updated: string;                 // ISO
  created: string;                 // ISO
  daysInStatus: number;            // working days since last transition to current status
  parentKey: string | null;
  subtaskKeys: string[];
  blockedByKeys: string[];
  blocksKeys: string[];
  epicLinkKey: string | null;
  sprintIds: number[];
  isRoleTask: boolean;             // Security Champion / Watchman / QA Watchman — excluded from overload limit
  goalIndex: 0 | 1 | 2 | 3 | null; // which Sprint Goal this ticket belongs to (G1..G4)
  ruleHits: RuleHit[];
}

export interface RuleHit {
  rule: number;                    // 1..10 from daily-scrum-prompt-v2.md §✅ Правила валідації
  severity: 'info' | 'warn' | 'danger';
  message: string;                 // short display string
  slackMessage?: string;           // optional standup-ready formulation
}

export type GoalKind = 'task' | 'epic' | 'missing';

export interface Goal {
  index: 0 | 1 | 2 | 3;
  rawValue: string;                // raw value from customfield_13974..13977
  kind: GoalKind;
  key: string | null;              // resolved ticket key (Task or Epic)
  summary: string;
  status: JiraStatus;
  bucket: StatusBucket;
  childTickets: Ticket[];          // sprint-scoped children (for epic) or [self] (for task)
  spDone: number;
  spTotal: number;
  qaDone: number;
  qaTotal: number;
  donePct: number;                 // 0..100
  blockerKeys: string[];
  note?: string;
}

export interface DevLoad {
  name: string;
  active: Ticket[];                // active-progress status
  roleTasks: Ticket[];             // role tasks separately — not counted towards limit
  inTesting: Ticket[];             // dev-tickets currently with QA
  rftQueue: Ticket[];              // dev-tickets waiting for QA pickup
  overloaded: boolean;             // active.length > 2 (excluding role tasks)
}

export interface QaLoad {
  name: string;
  active: Ticket[];                // QA-tasks In Progress + dev-tasks In Testing
  roleTasks: Ticket[];             // QA Watchman
  returned: Ticket[];              // Returned from Testing
  overloaded: boolean;
}

export interface Blocker {
  key: string;
  summary: string;
  status: JiraStatus;
  assignee: string | null;
  reason: 'is_blocked_by' | 'on_hold' | 'under_review_stale' | 'cross_team' | 'due_overdue';
  blockerKey: string | null;       // related blocker ticket key if any
  note: string;
}

export interface SubtaskRow {
  subtaskKey: string;
  subtaskSummary: string;
  subtaskType: IssueTypeName;
  subtaskStatus: JiraStatus;
  parentKey: string;
  parentStatus: JiraStatus;
  parentBucket: StatusBucket;
  parentGoalIndex: 0 | 1 | 2 | 3 | null;
  priority: 'close-first' | 'after-parent' | 'info';
}

export interface BugGroup {
  reporter: string;
  bugs: Array<{
    key: string;
    summary: string;
    priority: string;
    daysInBacklog: number;
  }>;
}

export interface VelocityMetrics {
  devDone: number;
  devActive: number;
  devOnHold: number;
  devTotal: number;
  qaDone: number;
  qaActive: number;
  qaTotal: number;
  qaDonePct: number;               // 0..100
  qaInRft: number;                 // QA estimate sum in RFT (for 'pulse' hint)
  qaOnHold: number;                // QA estimate sum in On hold / Blocked
  forecast: string;                // 1-line deterministic verdict
}

export type Verdict = 'on-track' | 'at-risk' | 'off-track';

export interface WindowDelta {
  fromDate: string;                // ISO (inclusive)
  toDate: string;                  // ISO (inclusive)
  workingDays: number;
  transitions: Array<{
    key: string;
    fromStatus: JiraStatus;
    toStatus: JiraStatus;
    at: string;                    // ISO
  }>;
  spClosedInWindow: number;
  qaClosedInWindow: number;
}

export interface ReportData {
  generatedAt: string;
  variant: ReportVariant;
  sprint: SprintInfo;
  verdict: Verdict;
  verdictSummary: string;          // 1-line goals status ("G1 done, G2 на фініші, ...")
  goals: Goal[];
  tickets: Ticket[];               // every in-sprint ticket, enriched
  devs: DevLoad[];
  qa: QaLoad[];
  blockers: Blocker[];
  subtasks: SubtaskRow[];
  bugsNoProgress: BugGroup[];
  readyForDeploy: Ticket[];
  releasePressure: Ticket[];       // tickets with RD ≤ 2 days AND status not in QA flow
  velocity: VelocityMetrics;
  questions: string[];             // top-5 for standup (@-tagged)
  smActions: string[];             // top-5 SM actions
  delta?: WindowDelta;             // 'pulse' variant only
}

export interface TeamConfig {
  cloudId: string;
  projectKey: string;
  beProject: string;
  sprintId: number;
  sprintBaseUrl: string;
  team: {
    pm: string;
    po: string;
    devs: string[];
    qa: string[];
  };
  slackTags: {
    team: string;
    devs: string;
    qa: string;
    po: string;
  };
}
