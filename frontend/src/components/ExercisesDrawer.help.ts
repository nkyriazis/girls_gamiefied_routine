import type { HelpStep, Tour } from '../help/tour';

// The owl in the exercises drawer: every kid's exercises of the day.

// «Επανάληψη» is on a card only when it comes from a lower grade's pool (#49). While one is
// on screen the tour is its own edition (`exercises-revision`, `store-revision`): the owl
// wiggles once, the first time the pill appears, and says the bubble where it can point at it.
export const REVISION: HelpStep = {
  el: 'exercises.revision', title: 'Επανάληψη', text: 'Μια άσκηση από την προηγούμενη τάξη, για να θυμάσαι όσα έμαθες.', side: 'bottom',
};

export const exercisesTour = (revision = false): Tour => ({
  id: revision ? 'exercises-revision' : 'exercises',
  steps: [
    { el: 'exercises.kid', title: 'Οι ασκήσεις σου', text: 'Κάθε παιδί έχει τις δικές του ασκήσεις για σήμερα.', side: 'left' },
    { el: 'exercises.card', title: 'Μια άσκηση', text: 'Πάτα την για να την ξεκινήσεις. Δεξιά βλέπεις πόσα αστέρια δίνει.', side: 'left', demo: 'tap' },
    ...(revision ? [REVISION] : []),
    { el: 'exercises.more', title: 'Κι άλλο πρόβλημα', text: 'Τελείωσες; Ζήτα κι άλλο πρόβλημα, για κι άλλα αστέρια.', side: 'left' },
  ],
});
