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
  stars: number;
  routines: Routine[];
}

// The user fields embedded in API responses (config user + live balance).
export type UserSummary = Pick<User, 'id' | 'name' | 'avatar' | 'color' | 'stars'>;

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
  user?: UserSummary;
  reward?: Reward;
}

export interface StarTransfer {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  resolvedAt?: string;
  fromUser?: UserSummary;
  toUser?: UserSummary;
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

export type Exercise =
  | MultipleChoiceExercise
  | MatchPairsExercise
  | OrderingExercise
  | TrueFalseExercise
  | FillBlankExercise
  | NumberInputExercise;

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
}

// Enriched assignment with the exercise definition for frontend display
export interface ExerciseAssignmentWithExercise extends ExerciseAssignment {
  exercise?: Exercise;
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

export interface ConfigUser {
  id: string;
  name: string;
  avatar: IconValue;
  color: string;
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
  settings: { timezone: string };
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

export interface AppState {
  config: DataConfig; // the live data.json
  configError: { message: string; errors: unknown[] } | null; // an invalid edit on disk; the last valid config stays live
  users: User[]; // config users with their balance and assigned routines
  spendings: Spending[];
  starTransfers: StarTransfer[];
  choreInstances: ChoreInstance[]; // open ones, plus ones closed in the last 24h
  exerciseSessions: ExerciseSession[]; // active group games
  exerciseAssignments: ExerciseAssignmentWithExercise[]; // today's
  flowRuns: FlowRun[];
  routineRuns: RoutineRun[];
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
  | { type: 'CHORE_EXPIRED'; payload: ChoreEventPayload };

export type ServerMessage = { type: 'STATE'; payload: AppState } | { type: 'HEARTBEAT' } | ServerEvent;
