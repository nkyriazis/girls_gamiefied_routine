export type IconValue = 
  | string 
  | { type: 'emoji'; value: string }  // Unicode emoji character
  | { type: 'image'; value: string }  // Uploaded filename (auto-resolves to /uploads/)
  | { type: 'vector'; content: string };  // Legacy: inline SVG

export interface Task {
  id: string;
  title: string;
  durationSeconds: number;
  icon: IconValue; // Emoji, URL, SVG, or Object
  stars?: number;
  lateStars?: number; // Stars awarded if completed after time runs out (default: 0)
}

export interface Routine {
  id: string;
  title: string;
  tasks: Task[];
  themeColor: string;
  icon: IconValue;
  scheduleTime?: string; // HH:mm format (24h)
  cronExpression?: string;
}

export interface User {
  id: string;
  name: string;
  avatar: IconValue; // Emoji, URL, SVG, or Object
  color: string;
  grade?: SchoolGrade;
  problemReading?: ProblemReading;
  forgiveness?: Forgiveness;
  stars: number;
  available: number; // stars minus those promised in pending outgoing gifts: what she can spend, give or lose now
  routines: Routine[];
}

export type FlowAction = 
  | { type: 'routine'; userId: string; routineId: string }
  | { type: 'flow'; flowId: string };

export interface AlarmProps {
  sound?: string | { type: 'upload'; value: string };
  title?: string;
  message?: string;
  icon?: string;
  dismissText?: string;
}

export type FlowStep = 
  | { type: 'alarm'; props: AlarmProps }
  | { type: 'routine'; routineId: string }
  | { type: 'parallel'; actions: FlowAction[] };

export interface Flow {
  id: string;
  steps: FlowStep[];
}

// A flow that is running (server state). `steps` is copied from the config at
// start, so a config edit can't change a run halfway.
export interface FlowRun {
  id: string;
  flowId: string;
  steps: FlowStep[];
  stepIndex: number; // current step: an alarm waits for dismissal, a parallel step for its routines and flows
  parentRunId?: string; // set when started by a parallel step of another run
  startedAt: string;
  stepStartedAt?: string; // when it entered the current step (runs started before it was recorded: startedAt)
  // While it waits at an alarm, the kids the alarm is for: those of the routines its next steps
  // start, through sub-flows, up to the next alarm, in config order; empty: everyone.
  // Computed for clients (db.ts flowRunsView), not stored.
  userIds?: string[];
}

// A routine on screen for a user (server state), at most one per user.
export interface RoutineRun {
  id: string; // the RoutineExecution id
  userId: string;
  routineId: string; // routine assignment id (User.routines[].id)
  taskIndex: number;
  taskStartedAt: string;
  finishedAt?: string; // all tasks done; the reward shows until a client closes it
  flowRunId?: string; // the flow run waiting for this routine
  totalStars?: number; // stars earned so far (from the execution; not stored on the run)
}

// What starting a routine assignment, a flow or 'alarm' answers (POST /api/hooks/push, «Ξεκίνα τώρα»).
// A kid already in a routine keeps it: skipped, with the run on screen (runningId, a RoutineRun id).
export type TriggerResult =
  | { success: true; skipped: true; type: 'assignment'; id: string; runningId: string }
  | { success: true; type: 'assignment' | 'flow'; id: string };

export interface Reward {
  id: string;
  title: string;
  cost: number;
  icon: IconValue;
}

export interface Spending {
  id: string;
  userId: string;
  rewardId: string;
  cost: number;
  createdAt: string;
  status: 'pending' | 'done' | 'revoked';
  resolvedAt?: string; // when a parent gave it or revoked it (absent on purchases resolved before #34)
}

export interface StarTransfer {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  resolvedAt?: string;
}

// Chores and Bonus Activities System
export type ChoreCategory = 'chore' | 'bonus';

export interface Chore {
  id: string;
  title: string;
  icon: IconValue;
  defaultStars: number;
  availabilityCron: string; // Cron expression for when chore becomes available (e.g., "0 8 * * *" for 8am daily)
  expirationHours: number; // Hours after availability when chore expires
  eligibleUsers?: string[]; // Optional: restrict to specific user IDs. If omitted, all users can claim.
  category?: ChoreCategory; // 'chore' for household tasks (default), 'bonus' for school/outside achievements
}

export type ChoreInstanceStatus = 'available' | 'claimed' | 'attempted' | 'confirmed' | 'rejected' | 'expired';

export interface ChoreInstance {
  id: string;
  choreId: string;
  status: ChoreInstanceStatus;
  availableAt: string; // ISO timestamp when chore became available
  expiresAt: string; // ISO timestamp when chore expires
  claimedBy?: string; // User ID who claimed this chore
  claimedAt?: string; // ISO timestamp
  attemptedAt?: string; // ISO timestamp when user marked as done
  confirmedAt?: string; // ISO timestamp when parent confirmed
  rejectedAt?: string; // ISO timestamp when parent rejected
  starsAwarded?: number; // Stars awarded (can differ from defaultStars)
}

// Enriched chore with instance for frontend display
export interface ChoreWithInstance extends Chore {
  instance?: ChoreInstance;
}

// --- School Exercises System ---

export interface ExerciseCategoryDef {
  id: string;
  label: string;
  icon?: IconValue;
}

export type ExerciseCategory = string; // Will reference ExerciseCategoryDef.id

export interface BaseExercise {
  id: string;
  type: string;
  category: ExerciseCategory;
  title: string;
  body?: string;
  figure?: IconValue;
  stars: number;
  userIds?: string[]; // If set, only these users can play this exercise
  template?: boolean;
  generatorParams?: any;
  source?: string; // where in the textbooks it comes from: «Μαθηματικά Γ΄, κεφ. 4: Πολλαπλασιασμός, προπαίδεια (Ι)»
}

export interface MultipleChoiceExercise extends BaseExercise {
  type: 'multiple-choice';
  question: string;
  options: string[];
  correctIndex: number;
}

export interface MatchPairsExercise extends BaseExercise {
  type: 'match-pairs';
  pairs: { left: string; right: string }[];
}

export interface OrderingExercise extends BaseExercise {
  type: 'ordering';
  items: { id: string; content: string }[]; // ordered sequence
}

export interface TrueFalseExercise extends BaseExercise {
  type: 'true-false';
  question: string;
  correctValue: boolean;
}

export interface FillBlankExercise extends BaseExercise {
  type: 'fill-blank';
  textWithGaps: string; // e.g., "The capital of France is {0}."
  options: string[]; // word bank
  correctAnswers: string[]; // values for gaps
}

export interface NumberInputExercise extends BaseExercise {
  type: 'number-input';
  question: string;
  correctValue: number;
}

// A word problem solved in steps, as the Ε' book teaches it (ch. 1.3): tell what we
// know from what we seek, plan, solve, check. Each step is checked on its own.
//
// The story marks the phrases the "tag" step asks about: [25 ευρώ|known],
// [Πόσα μπαλόνια|sought], [γενέθλιά του|extra] (in the story, but not needed).
export type ProblemRole = 'known' | 'sought' | 'extra';
export type ProblemPhase = 'read' | 'plan' | 'solve' | 'check';

interface ProblemStepBase {
  phase: ProblemPhase;
  prompt: string;
  hint?: string; // shown after a wrong try
  story?: string; // replaces the story while this step is on screen (e.g. without its numbers)
}

// Tap the marked phrases of the story as "known" or "sought"; untapped means not needed.
// Answer: one role per marked phrase, in story order.
export interface ProblemTagStep extends ProblemStepBase { kind: 'tag' }

// Answer: the index of the chosen option.
export interface ProblemChoiceStep extends ProblemStepBase {
  kind: 'choice';
  options: string[];
  correctIndex: number;
}

// One number per row, e.g. "Μπάλες βόλεϊ και ποδοσφαίρου: 200 − 80 =" [120].
// Answer: the numbers, in row order.
export interface ProblemNumbersStep extends ProblemStepBase {
  kind: 'numbers';
  rows: { label: string; answer: number; unit?: string }[];
}

// Put the items in order; `items` is the correct order. Answer: the items as ordered.
export interface ProblemOrderStep extends ProblemStepBase {
  kind: 'order';
  items: string[];
}

// Paint the story freehand, word by word: nothing is marked on screen. `targets` are the
// story's marked phrases, in order, as words of storyWords(story) (shared/problems.ts):
// the core words a painting must cover and the phrase's whole span.
// Answer: { known, sought, extra? } word indexes (extra: the unneeded ones, on "paint-all").
// Wrong: target indexes, -1 = too much. On "marked" it plays as a tag step. A tag step
// plays as paint on the painting rungs, its targets derived from the marks.
export interface ProblemPaintStep extends ProblemStepBase {
  kind: 'paint';
  targets: { role: ProblemRole; words: number[]; span: [number, number]; need?: number }[];
}

// Work it out her own way: pick two numbers she has, an operation, and the result. The
// step carries the story's quantities and how they relate (out = a op b), so every
// calculation can be read back: what it found, or that it means nothing here.
// Answer: { lines: [{ x, op, y, result }] }, the lines that find the answer; or, as it
// happens, a calculation she got wrong: { lines (hers so far), slip: { x, op, y, result } }.
export interface ProblemCalcStep extends ProblemStepBase {
  kind: 'calc';
  quantities: { id: string; value: number; label: string; unit?: string }[];
  relations: { out: string; op: '+' | '−' | '×' | ':'; a: string; b: string }[];
  given: string[]; // what the story says
  sought: string;
}

export type ProblemStep = ProblemTagStep | ProblemChoiceStep | ProblemNumbersStep | ProblemOrderStep | ProblemPaintStep | ProblemCalcStep;

export interface ProblemExercise extends BaseExercise {
  type: 'problem';
  story: string;
  steps: ProblemStep[];
}

// The answer to one step of a problem assignment.
export interface ProblemStepAnswer {
  step: number;
  value: unknown;
}

export type Exercise =
  | MultipleChoiceExercise
  | MatchPairsExercise
  | OrderingExercise
  | TrueFalseExercise
  | FillBlankExercise
  | NumberInputExercise
  | ProblemExercise;

export type ExerciseAnswerStatus = 'correct' | 'incorrect';

export interface ExerciseAnswer {
  exerciseId: string;
  status: ExerciseAnswerStatus;
  answeredAt: string;
  earnedStars: number;
}

// --- Daily Exercise Assignments (per-user, chore-like) ---

export type ExerciseAssignmentStatus = 'pending' | 'completed';

export interface ExerciseAssignment {
  id: string;
  userId: string;
  exerciseId: string;
  date: string; // Local date (YYYY-MM-DD) the assignment belongs to
  status: ExerciseAssignmentStatus;
  attempts: number;
  assignedAt: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
  starsAwarded?: number;
  stepIndex?: number; // problems: the step on screen (the ones before it are solved)
  mistakes?: number[]; // problems: wrong tries per step
  extra?: boolean; // a problem the kid asked for, on top of the daily set
}

// Enriched assignment with the exercise definition for frontend display
export interface ExerciseAssignmentWithExercise extends ExerciseAssignment {
  exercise?: Exercise;
  revision?: boolean; // from a lower grade's pool, as revision (#49): her card says «Επανάληψη»
}

export interface ExerciseSession {
  id: string;
  playerIds: string[];
  categories: string[];
  totalRounds: number;
  currentRound: number;
  questionsPerRound: number;
  currentQuestionIndex: number;
  exerciseIds: string[]; // pre-drawn for the session
  answers: Record<string, ExerciseAnswer[]>; // keyed by userId
  startedAt: string;
  completedAt?: string;
  totalStarsEarned: Record<string, number>; // keyed by userId
  dismissedAt?: string; // a finished game closed with «Επιστροφή»: kept, no longer on the screens
}

// --- Runtime history (persisted in the backend database) ---

export interface RoutineExecution {
  id: string;
  userId: string;
  routineId: string;
  startedAt: string;
  totalStars: number;
  completedAt?: string;
}

export interface TaskExecution {
  id: string;
  executionId: string;
  taskId: string;
  duration: number; // seconds
  isOnTime: boolean;
  completedAt: string;
}

export interface ActionLog {
  id: string;
  timestamp: string;
  type: string;
  details: unknown;
}

// A help tour played on the kids' screens, so the owl stops offering it. The id names the
// tour, and ends in "@<userId>" for a tour of a kid's own screen ("store@u2"). Not history:
// it isn't part of the state snapshot.
export interface HelpSeen {
  id: string;
  seenAt: string;
}

// Full runtime state, in the shape of the legacy state.json. Used by the admin
// state editor and by the one-time import from state.json.
export interface StateSnapshot {
  userStars: Record<string, number>;
  routineExecutions: RoutineExecution[];
  taskExecutions: TaskExecution[];
  spendings: Spending[];
  starTransfers: StarTransfer[];
  choreInstances: ChoreInstance[];
  exerciseSessions: ExerciseSession[];
  exerciseAssignments: ExerciseAssignment[];
}

// --- Config (data.json, as described by data.schema.json) ---

// Δημοτικό: 1 = Α' … 6 = ΣΤ'. Picks the daily exercise pool.
export type SchoolGrade = 1 | 2 | 3 | 4 | 5 | 6;

// How a kid reads a word problem, a ladder every problem plays on (its first step, tag
// or paint): "marked" taps pre-marked phrases; "paint" paints the story freehand, the
// unneeded facts greyed out for her once she's right; "paint-all" paints those too.
export type ProblemReading = 'marked' | 'paint' | 'paint-all';

// How much mistakes cost, a ladder too (shared/forgiveness.ts): "forgiving" lets her try
// again as often as she likes, "unforgiving" gives two tries a step.
export type Forgiveness = 'forgiving' | 'unforgiving';

export interface ConfigUser {
  id: string;
  name: string;
  avatar: IconValue;
  color: string;
  grade?: SchoolGrade;
  problemReading?: ProblemReading; // default "marked"
  forgiveness?: Forgiveness; // default "forgiving"
}

export interface ConfigTask {
  id: string;
  title: string;
  icon: IconValue;
  stars: number;
  lateStars?: number;
}

export interface ConfigRoutine {
  id: string;
  title: string;
  themeColor: string;
  icon: IconValue;
}

export interface RoutineTask {
  id: string;
  routineId: string;
  taskId: string;
  order: number;
  durationSeconds: number;
}

export interface RoutineAssignment {
  id: string;
  userId: string;
  routineId: string;
  themeColor?: string;
}

export interface Schedule {
  id: string;
  cron: string;
  type: 'routine' | 'flow';
  targetId: string;
}

export interface DataConfig {
  users: ConfigUser[];
  tasks: ConfigTask[];
  routines: ConfigRoutine[];
  routineTasks: RoutineTask[];
  routineAssignments: RoutineAssignment[];
  flows: Flow[];
  schedules: Schedule[];
  rewards: Reward[];
  chores?: Chore[];
  settings: { timezone: string; exercisesPerDay?: number; extraProblemsPerDay?: number; alarmMinutes?: number };
}

// --- Realtime protocol (backend -> frontend WebSocket messages) ---
//
// State: clients render AppState and nothing else. The server sends the whole
// of it on connect and again after every change, and clients replace what they
// have. There is no patching, so a client can't drift: the last STATE message
// it received is the truth.
//
// Events: one-off effects (chore toasts). They never carry state that isn't
// also in AppState.
//
// HEARTBEAT: sent every few seconds so a client can tell a dead link from a
// quiet one and reconnect.

// Which screen saved a config file, as POST /api/admin/{data,exercises}?source= names it and the action log
// (CONFIG_SAVED) records it: the Ρυθμίσεις forms, the Advanced JSON editor, that editor fixing a file that
// doesn't parse; 'api' for anything that names none (scripts, curl).
export type ConfigSaveSource = 'form' | 'advanced' | 'advanced-fix' | 'api';
export const CONFIG_SAVE_SOURCES: readonly ConfigSaveSource[] = ['form', 'advanced', 'advanced-fix', 'api'];

// What the server finds in data.json that data.schema.json can't see (backend/src/configChecks.ts). `path` is
// the field's JSON pointer in data.json, `id` the item's id, `message` what the parents' page says (Greek).
export type ConfigWarning = CronWarning | CheckWarning;

// A schedule's cron or a chore's availabilityCron that passes the schema (its characters) but that the
// scheduler (backend/src/cron.ts) can't read, such as «99 20 * * *» (#89); `error` is cron-parser's reason.
// The one kind a save is refused for when it brings one in.
export interface CronWarning {
  path: string;
  kind: 'schedule' | 'chore';
  id: string;
  cron: string;
  error: string;
  message: string;
}

// The other checks (#104), warnings only: a save that brings one in goes through. `list` is the data.json
// list the item is in, `field` the field the problem is in, `value` that field's value. Kinds:
// - duplicate-id: a second item with an id already in its list, or a flow with an assignment's id (the two
//   share one namespace: schedules, pushes and «Ξεκίνα τώρα» name either);
// - missing-link: an id that names nothing (a kid, routine, task, assignment or flow);
// - blank: a kid's name or a title that is only spaces;
// - colour: neither a theme token (shared/themeColours.ts), a hex, a CSS colour function nor a named colour.
export interface CheckWarning {
  path: string;
  kind: 'duplicate-id' | 'missing-link' | 'blank' | 'colour';
  list: ConfigList;
  id: string;
  field: string;
  value: string;
  message: string;
}

/** The lists of data.json whose items have an id. */
export type ConfigList = 'users' | 'tasks' | 'routines' | 'routineTasks' | 'routineAssignments' | 'flows' | 'schedules' | 'rewards' | 'chores';

export interface AppState {
  config: DataConfig; // the live data.json
  // The versions of the live data.json (the one in `config`, read with it) and exercises.json: a short hash
  // of each file's text. A screen that saves a config file sends the version it edited (?version=), and the
  // server refuses a save over a newer one with a 409 (#33).
  configVersion: { data: string; exercises: string };
  // data.json or exercises.json is invalid on disk: the last valid version stays live, or, when the file
  // couldn't be read since the start (emptyFallback), an empty one. Saving is off until it is fixed.
  configError: { message: string; errors: unknown[]; file: string; emptyFallback: boolean } | null;
  // What the checks find in the live data.json (#89, #104): the file loaded and is live, but, until it is
  // fixed, an unreadable cron never fires, a duplicate kid shares another's stars, a link to nothing starts
  // nothing... Saving stays on.
  configWarnings: ConfigWarning[];
  users: User[]; // config users with their balance and assigned routines
  // STATE carries the current world, never the archive (#34). Purchases and gifts: every pending one,
  // whatever its age, those decided in the last HISTORY_DAYS (by resolvedAt, else createdAt), and, for
  // purchases, each kid's last LAST_REWARDS_GIVEN given whatever their age (her store lists them).
  // Newest first. They name kids and rewards by id (look them up in `users` and `config.rewards`).
  // Everything decided, of any age, is read a page at a time from GET /api/history (HistoryPage).
  spendings: Spending[];
  starTransfers: StarTransfer[];
  choreInstances: ChoreInstance[]; // open ones, plus ones closed in the last 24h
  exerciseSessions: ExerciseSession[]; // running group games, then those finished in the last 30 minutes and not closed
  exerciseAssignments: ExerciseAssignmentWithExercise[]; // today's
  flowRuns: FlowRun[];
  routineRuns: RoutineRun[];
  helpSeen: string[]; // help tours already played (see HelpSeen)
}

// STATE's window for decided purchases and gifts, in days, and how many rewards given per kid it keeps
// whatever their age. Anything added to AppState is bounded by time or count like this, never by how long
// the family has used the app (backend/test/stateSize.test.ts holds the budget).
export const HISTORY_DAYS = 30;
export const LAST_REWARDS_GIVEN = 10;

// What was decided (Ιστορικό), from GET /api/history?before=<next>&limit=<n>&userId=<kid>: purchases given
// or revoked, gifts approved, rejected or cancelled, chores confirmed or rejected (the database keeps those
// for 7 days), newest first by `at`, the time it was decided. `next` is the cursor of the following page,
// null on the last one.
export type HistoryEntry = { at: string } & (
  | { kind: 'spending'; spending: Spending }
  | { kind: 'transfer'; transfer: StarTransfer }
  | { kind: 'chore'; instance: ChoreInstance });

export interface HistoryPage {
  entries: HistoryEntry[];
  next: string | null;
}

export interface ChoreEventPayload {
  instanceId: string;
  choreId: string;
  choreTitle?: string;
  userId?: string;
}

export type ServerEvent =
  | { type: 'CHORE_CONFIRMED'; payload: ChoreEventPayload & { starsAwarded: number } }
  | { type: 'CHORE_REJECTED'; payload: ChoreEventPayload }
  | { type: 'CHORE_EXPIRED'; payload: ChoreEventPayload }
  // A parent ended a kid's routine from /parent (#63): her lane on the kids' screens says so.
  // Sent before the STATE without the run; routineId is the run's (as RoutineRun.routineId).
  | { type: 'ROUTINE_ENDED_BY_PARENT'; payload: { runId: string; userId: string; routineId: string } };

export type ServerMessage = { type: 'STATE'; payload: AppState } | { type: 'HEARTBEAT' } | ServerEvent;
