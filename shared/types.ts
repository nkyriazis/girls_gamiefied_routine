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
  triggerTime: string;
  steps: FlowStep[];
}

export interface FlowInstance {
  flowId: string;
  flow: Flow;
  stepIndex: number;
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
  user?: User;
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
  fromUser?: User;
  toUser?: User;
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
