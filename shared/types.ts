export type IconValue = 
  | string 
  | { type: 'emoji'; value: string }
  | { type: 'image'; src: string }
  | { type: 'vector'; content: string };

export interface Task {
  id: string;
  title: string;
  durationSeconds: number;
  icon: IconValue; // Emoji, URL, SVG, or Object
  stars?: number;
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
  | { type: 'routine'; userId: string; routineId: string };

export type FlowStep = 
  | { type: 'alarm'; props: { sound: string } }
  | { type: 'routine'; routineId: string }
  | { type: 'parallel'; actions: FlowAction[] };

export interface Flow {
  id: string;
  triggerTime: string;
  steps: FlowStep[];
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
