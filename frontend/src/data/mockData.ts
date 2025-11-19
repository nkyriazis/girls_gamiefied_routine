export interface Task {
  id: string;
  title: string;
  durationSeconds: number;
  icon: string; // Emoji for now, or path to asset
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

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Ηλέκτρα',
    avatar: '🦄',
    color: 'var(--color-accent)',
    stars: 1250,
    routines: [
      {
        id: 'r1',
        title: 'Πρωινή Ρουτίνα',
        themeColor: 'var(--color-primary)',
        scheduleTime: '07:00',
        tasks: [
          { id: 't1', title: 'Πλύσιμο Δοντιών', durationSeconds: 120, icon: '🪥' },
          { id: 't2', title: 'Πλύσιμο Προσώπου', durationSeconds: 60, icon: '🧼' },
          { id: 't3', title: 'Ντύσιμο', durationSeconds: 300, icon: '👗' },
          { id: 't4', title: 'Πρωινό', durationSeconds: 600, icon: '🥞' },
        ]
      },
      {
        id: 'r2',
        title: 'Βραδινή Ρουτίνα',
        themeColor: 'var(--color-secondary)',
        scheduleTime: '20:00',
        tasks: [
          { id: 't5', title: 'Πιτζάμες', durationSeconds: 180, icon: '👚' },
          { id: 't6', title: 'Πλύσιμο Δοντιών', durationSeconds: 120, icon: '🪥' },
          { id: 't7', title: 'Παραμύθι', durationSeconds: 600, icon: '📖' },
        ]
      }
    ]
  },
  {
    id: 'u2',
    name: 'Ιφιγένεια',
    avatar: '🦊',
    color: 'var(--color-secondary)',
    stars: 850,
    routines: [
      {
        id: 'r1',
        title: 'Πρωινή Ρουτίνα',
        themeColor: 'var(--color-primary)',
        scheduleTime: '07:30',
        tasks: [
          { id: 't1', title: 'Πλύσιμο Δοντιών', durationSeconds: 120, icon: '🪥' },
          { id: 't3', title: 'Ντύσιμο', durationSeconds: 300, icon: '👗' },
          { id: 't4', title: 'Πρωινό', durationSeconds: 600, icon: '🥞' },
        ]
      }
    ]
  }
];
