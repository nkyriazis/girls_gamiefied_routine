import type { Tour } from '../help/tour';

// The owl in the exercises drawer: every kid's exercises of the day.

export const exercisesTour = (): Tour => ({
  id: 'exercises',
  steps: [
    { el: 'exercises.kid', title: 'Οι ασκήσεις σου', text: 'Κάθε παιδί έχει τις δικές του ασκήσεις για σήμερα.', side: 'left' },
    { el: 'exercises.card', title: 'Μια άσκηση', text: 'Πάτα την για να την ξεκινήσεις. Δεξιά βλέπεις πόσα αστέρια δίνει.', side: 'left', demo: 'tap' },
    { el: 'exercises.more', title: 'Κι άλλο πρόβλημα', text: 'Τελείωσες; Ζήτα κι άλλο πρόβλημα, για κι άλλα αστέρια.', side: 'left' },
  ],
});
