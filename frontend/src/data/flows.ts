export interface FlowStep {
  type: 'alarm' | 'parallel';
  props?: any;
  actions?: { type: 'routine'; userId: string; routineId: string }[];
}

export interface Flow {
  id: string;
  triggerTime: string;
  steps: FlowStep[];
}

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
