import type { HelpStep, Tour } from '../help/tour';

// The owl in the exercises drawer: every kid's exercises of the day.

// «Επανάληψη» is on a card only when it comes from a lower grade's pool (#49). While one is
// on screen the tour is its own edition (`exercises-revision`, `store-revision`): the owl
// wiggles once, the first time the pill appears, and says the bubble where it can point at it.
export const REVISION: HelpStep = {
  el: 'exercises.revision', title: 'Επανάληψη', text: 'Μια άσκηση από την προηγούμενη τάξη, για να θυμάσαι όσα έμαθες.', side: 'bottom',
};

// An extra problem left with ✕ is a card above «Κι άλλο πρόβλημα» (#67), on screen only while one
// waits: its own edition again (`exercises-extra`, `store-extra`, with revision `…-revision-extra`).
export const EXTRA: HelpStep = {
  el: 'exercises.extra', title: 'Για μετά', text: 'Ένα έξτρα πρόβλημα που άνοιξες. Πάτα το και συνεχίζεις από εκεί που έμεινες.', side: 'top',
};

/** The edition's id: the screen's own, then what is on screen that the plain one doesn't explain. */
export const editionId = (base: string, revision: boolean, extra: boolean) =>
  [base, revision && 'revision', extra && 'extra'].filter(Boolean).join('-');

export const exercisesTour = (revision = false, extra = false): Tour => ({
  id: editionId('exercises', revision, extra),
  steps: [
    { el: 'exercises.kid', title: 'Οι ασκήσεις σου', text: 'Κάθε παιδί έχει τις δικές του ασκήσεις για σήμερα.', side: 'left' },
    { el: 'exercises.card', title: 'Μια άσκηση', text: 'Πάτα την για να την ξεκινήσεις. Δεξιά βλέπεις πόσα αστέρια δίνει.', side: 'left', demo: 'tap' },
    ...(revision ? [REVISION] : []),
    ...(extra ? [EXTRA] : []),
    { el: 'exercises.more', title: 'Κι άλλο πρόβλημα', text: 'Τελείωσες; Ζήτα κι άλλο πρόβλημα, για κι άλλα αστέρια.', side: 'left' },
  ],
});
