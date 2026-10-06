import type { Exercise, Forgiveness } from '@shared/types';
import type { HelpStep, Tour } from '../help/tour';
import { answerSteps } from './exercises/answers.help';

// The owl in the exercise player: how to answer this kind of exercise, and the first time,
// the frame around it, with what a mistake costs on her rung (shared/forgiveness.ts). Its id
// names the rung, so the owl offers it again when a parent moves her. (A problem explains its
// own steps: ProblemPlayer.help.ts.)

const MISTAKES: Record<Forgiveness, { title: string; text: string }> = {
  forgiving: { title: 'Λάθος; Δεν πειράζει', text: 'Αν κάνεις λάθος, ξαναδοκιμάζεις, ή βλέπεις τη σωστή απάντηση.' },
  unforgiving: { title: 'Σκέψου πριν απαντήσεις', text: 'Στο Σωστό ή Λάθος έχεις μία προσπάθεια, στις άλλες ασκήσεις δύο. Μετά σου δείχνω τη σωστή απάντηση.' },
};

const SHOW: HelpStep = { el: 'exercise.show', title: 'Δείξε μου', text: 'Θες να δεις τη σωστή απάντηση; Πάτα εδώ.', side: 'top', demo: 'tap' };

// «Δείξε μου» is on screen only after a wrong try, on the forgiving rung (`stuck`). Then the tour
// is its own edition, `exercise-show` (one for every type): the owl wiggles once, when the button
// first appears, and says the new bubble where it can point at it (as `problem-show` does).
export const exerciseTour = (userId: string, type: Exercise['type'], rung: Forgiveness = 'forgiving', stuck = false): Tour => ({
  id: stuck ? 'exercise-show' : `exercise-${type}`,
  user: userId,
  steps: [
    { el: 'exercise.ask', title: 'Η ερώτηση', text: 'Διάβασε προσεκτικά τι σε ρωτάει.', side: 'right' },
    ...answerSteps(type),
    ...(stuck ? [SHOW] : []),
  ],
  intro: {
    id: `exercise-${rung}`,
    steps: [
      { el: 'exercise.stars', title: 'Το έπαθλο', text: 'Τόσα αστέρια κερδίζεις αν απαντήσεις σωστά με την πρώτη.', side: 'bottom' },
    ],
    after: [
      { el: 'exercise.answer', ...MISTAKES[rung], side: 'left' },
      { el: 'exercise.exit', title: 'Έξοδος', text: 'Θες να σταματήσεις; Πάτα εδώ. Η άσκηση σε περιμένει για αργότερα.', side: 'bottom' },
    ],
  },
});
