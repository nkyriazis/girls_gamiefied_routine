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

// Mini Exercises System - Educational games for earning stars
export type ExerciseType = 'spell-fill' | 'grammar-choice' | 'math-simple' | 'math-vertical';
export type ExerciseDifficulty = 'easy' | 'medium' | 'hard';

// Spell-fill: Fill in missing letter(s) in a word
export interface SpellFillExercise {
  type: 'spell-fill';
  word: string; // The complete word
  hiddenIndices: number[]; // Indices of letters to hide (0-based)
  hint?: string; // Optional hint
}

// Grammar-choice: Choose the correct option
export interface GrammarChoiceExercise {
  type: 'grammar-choice';
  question: string; // The question text
  options: string[]; // Array of options to choose from
  correctIndex: number; // Index of the correct answer (0-based)
}

// Math-simple: Simple arithmetic operation
export interface MathSimpleExercise {
  type: 'math-simple';
  operation: '+' | '-' | '*' | '/';
  num1: number;
  num2: number;
}

// Math-vertical: Vertical arithmetic operation (more visual, touch-friendly)
export interface MathVerticalExercise {
  type: 'math-vertical';
  operation: '+' | '-';
  num1: number;
  num2: number;
}

export type ExerciseContent = 
  | SpellFillExercise 
  | GrammarChoiceExercise 
  | MathSimpleExercise 
  | MathVerticalExercise;

export interface Exercise {
  id: string;
  title: string;
  icon: IconValue;
  difficulty: ExerciseDifficulty;
  stars: number; // Stars awarded for correct completion
  content: ExerciseContent;
  availabilityCron?: string; // Optional: when exercise becomes available
  eligibleUsers?: string[]; // Optional: restrict to specific users
}

export type ExerciseInstanceStatus = 'available' | 'active' | 'completed' | 'failed';

export interface ExerciseInstance {
  id: string;
  exerciseId: string;
  userId: string;
  status: ExerciseInstanceStatus;
  startedAt: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
  attempts: number; // Number of attempts made
  starsAwarded?: number; // Stars awarded (only if completed successfully)
}
