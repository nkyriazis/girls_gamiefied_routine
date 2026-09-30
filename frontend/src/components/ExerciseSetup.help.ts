import type { Tour } from '../help/tour';

// The owl on the group game's setup.

export const gameSetupTour = (): Tour => ({
  id: 'game-setup',
  steps: [
    { el: 'game.players', title: 'Ποιοι παίζουν;', text: 'Πατήστε όσες θα παίξετε μαζί.', side: 'bottom', demo: 'tap' },
    { el: 'game.subjects', title: 'Τι θα παίξετε;', text: 'Διαλέξτε μαθήματα: Μαθηματικά, Γλώσσα…', side: 'bottom' },
    { el: 'game.length', title: 'Πόσο θα κρατήσει;', text: 'Πόσοι γύροι και πόσες ερωτήσεις σε κάθε γύρο.', side: 'top' },
    { el: 'game.start', title: 'Πάμε!', text: 'Όταν είστε έτοιμες, πατήστε εδώ.', side: 'top', demo: 'tap' },
  ],
});
