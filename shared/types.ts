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

// Chores System
export interface Chore {
  id: string;
  title: string;
  icon: IconValue;
  defaultStars: number;
  availabilityCron: string; // Cron expression for when chore becomes available (e.g., "0 8 * * *" for 8am daily)
  expirationHours: number; // Hours after availability when chore expires
  eligibleUsers?: string[]; // Optional: restrict to specific user IDs. If omitted, all users can claim.
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
