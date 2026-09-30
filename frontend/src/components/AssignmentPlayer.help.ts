import type { Exercise } from '@shared/types';
import type { Tour } from '../help/tour';
import { answerSteps } from './exercises/answers.help';

// The owl in the exercise player: how to answer this kind of exercise, and the first time,
// the frame around it. (A problem explains its own steps: ProblemPlayer.help.ts.)

export const exerciseTour = (userId: string, type: Exercise['type']): Tour => ({
  id: `exercise-${type}`,
  user: userId,
  steps: [
    { el: 'exercise.ask', title: 'Η ερώτηση', text: 'Διάβασε προσεκτικά τι σε ρωτάει.', side: 'right' },
    ...answerSteps(type),
  ],
  intro: {
    id: 'exercise',
    steps: [
      { el: 'exercise.stars', title: 'Το έπαθλο', text: 'Τόσα αστέρια κερδίζεις με τη σωστή απάντηση.', side: 'bottom' },
    ],
    after: [
      { el: 'exercise.answer', title: 'Λάθος; Δεν πειράζει', text: 'Αν κάνεις λάθος, ξαναδοκιμάζεις!', side: 'left' },
      { el: 'exercise.exit', title: 'Έξοδος', text: 'Θες να σταματήσεις; Πάτα εδώ. Η άσκηση σε περιμένει για αργότερα.', side: 'bottom' },
    ],
  },
});
