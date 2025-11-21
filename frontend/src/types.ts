export interface Task {
  id: string;
  title: string;
  durationSeconds: number;
  icon: string; // Emoji for now, or path to asset
  stars?: number;
}

export interface Routine {
  id: string;
  title: string;
  tasks: Task[];
  themeColor: string;
  scheduleTime?: string; // HH:mm format (24h)
}

export interface User {
  id: string;
  name: string;
  avatar: string; // Emoji or URL
  color: string;
  stars: number;
  routines: Routine[];
}
