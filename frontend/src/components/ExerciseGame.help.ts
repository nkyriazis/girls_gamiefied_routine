import type { Exercise } from '@shared/types';
import type { Tour } from '../help/tour';
import { answerSteps } from './exercises/answers.help';

// The owl in the group game: whose turn it is, and how to answer this question.

export const gameTour = (type: Exercise['type'] | undefined): Tour => ({
  id: `game-${type ?? 'question'}`,
  steps: [
    { el: 'game.turn', title: 'Ποιο παιδί παίζει;', text: 'Φωτίζεται το παιδί που απαντάει τώρα. Παίζετε με τη σειρά.', side: 'bottom' },
    { el: 'game.progress', title: 'Γύροι', text: 'Σε ποιο γύρο και σε ποια ερώτηση είστε.', side: 'bottom' },
    { el: 'game.question', title: 'Η ερώτηση', text: 'Διάβασέ την προσεκτικά.', side: 'right' },
    { el: 'game.answer', title: 'Η απάντηση', text: 'Εδώ απαντάει το παιδί που έχει σειρά. Σωστή απάντηση, αστέρια!', side: 'left' },
    ...answerSteps(type),
    { el: 'game.exit', title: 'Έξοδος', text: 'Με την Έξοδο σταματάει το παιχνίδι για όλα τα παιδιά.', side: 'bottom' },
  ],
});

export const gameResultsTour = (): Tour => ({
  id: 'game-results',
  steps: [
    { el: 'game.scores', title: 'Τα αποτελέσματα', text: 'Πόσα αστέρια κέρδισε κάθε παιδί. Μπαίνουν κατευθείαν στα αστέρια σας!', side: 'bottom' },
    { el: 'game.finish', title: 'Τέλος', text: 'Πατήστε εδώ για να γυρίσετε στην αρχική οθόνη.', side: 'top', demo: 'tap' },
  ],
});
