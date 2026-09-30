import type { Tour } from '../help/tour';

// The owl in the chores drawer (and the bonus one, the same drawer).

export const choresTour = (bonus: boolean): Tour => ({
  id: bonus ? 'bonus' : 'chores',
  steps: [
    { el: 'chores.card', title: bonus ? 'Μια δραστηριότητα' : 'Μια δουλειά', text: 'Εδώ βλέπεις πόσα αστέρια δίνει και πόσος χρόνος μένει.', side: 'left' },
    { el: 'chores.claim', title: 'Ποια θα την κάνει;', text: 'Πάτα το όνομά σου για να την αναλάβεις.', side: 'left', demo: 'tap' },
    { el: 'chores.done', title: 'Την έκανα!', text: 'Όταν την τελειώσεις, πάτα εδώ. Ένας γονιός θα το δει και θα σου δώσει τα αστέρια.', side: 'left', demo: 'tap' },
    { el: 'chores.waiting', title: 'Περιμένει γονιό', text: 'Την έκανες! Τώρα ένας γονιός πρέπει να την επιβεβαιώσει για να πάρεις τα αστέρια.', side: 'left' },
    { el: 'chores.empty', title: 'Τίποτα ακόμα', text: 'Δεν υπάρχει κάτι τώρα. Κοίτα ξανά αργότερα!', side: 'left' },
  ],
});
