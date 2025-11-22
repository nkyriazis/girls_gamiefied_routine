import type { Flow } from '@shared/types';

export const MOCK_FLOWS: Flow[] = [
  {
    id: 'morning-flow',
    triggerTime: '07:00',
    steps: [
      {
        type: 'alarm',
        props: { sound: 'melody' }
      },
      {
        type: 'parallel',
        actions: [
          { type: 'routine', userId: 'u1', routineId: 'r1' }, // Electra Morning
          { type: 'routine', userId: 'u2', routineId: 'r1' }  // Iphigenia Morning
        ]
      }
    ]
  }
];
