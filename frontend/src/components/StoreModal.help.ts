import type { Tour } from '../help/tour';
import { EXTRA, REVISION, editionId } from './ExercisesDrawer.help';

// The owl on a kid's own screen (from her avatar), and on its two popups.

// With a revision card, or an extra problem she left, on screen: its own edition (see REVISION, EXTRA)
export const storeTour = (userId: string, revision = false, extra = false): Tour => ({
  id: editionId('store', revision, extra),
  user: userId,
  steps: [
    { el: 'store.balance', title: 'Τα αστέρια σου', text: 'Τόσα αστέρια έχεις μαζέψει.', side: 'bottom' },
    { el: 'store.earn', title: 'Κέρδισε αστέρια', text: 'Οι ασκήσεις σου για σήμερα. Πάτα μία για να ξεκινήσεις.', side: 'right' },
    ...(revision ? [REVISION] : []),
    ...(extra ? [EXTRA] : []),
    { el: 'exercises.more', title: 'Κι άλλο πρόβλημα', text: 'Τελείωσες τις σημερινές; Εδώ ζητάς κι άλλο πρόβλημα, για κι άλλα αστέρια. Αν κλείσεις ένα στη μέση, μένει εδώ για μετά.', side: 'top', demo: 'tap' },
    { el: 'store.rewards', title: 'Ανταμοιβές', text: 'Πάτα μια ανταμοιβή και μετά «Ναι» για να την πάρεις με τα αστέρια σου. Οι γκρίζες θέλουν περισσότερα αστέρια.', side: 'left' },
    { el: 'store.give', title: 'Δώσε αστέρια', text: 'Μπορείς να χαρίσεις αστέρια σε ένα άλλο παιδί. Ένας γονιός το εγκρίνει.', side: 'bottom' },
    { el: 'store.activity', title: 'Δραστηριότητα', text: 'Τι έχεις πάρει και τι περιμένει έγκριση.', side: 'bottom' },
    { el: 'store.close', title: 'Κλείσιμο', text: 'Από εδώ γυρνάς στην αρχική οθόνη.', side: 'top' },
  ],
});

export const activityTour = (userId: string): Tour => ({
  id: 'store-activity',
  user: userId,
  steps: [
    { el: 'activity.list', title: 'Τι έγινε με τα αστέρια σου', text: '⏳ περιμένει να το εγκρίνει ένας γονιός, ✅ το πήρες. Ένα δώρο που έστειλες μπορείς να το ακυρώσεις όσο περιμένει.', side: 'right',
      say: 'Τι έγινε με τα αστέρια σου. Η κλεψύδρα λέει ότι περιμένει να το εγκρίνει ένας γονιός, και το πράσινο τικ ότι το πήρες. Ένα δώρο που έστειλες μπορείς να το ακυρώσεις όσο περιμένει.' },
  ],
});

export const transferTour = (userId: string): Tour => ({
  id: 'store-transfer',
  user: userId,
  steps: [
    { el: 'transfer.to', title: 'Σε ποιο παιδί;', text: 'Διάλεξε σε ποιο παιδί θα δώσεις αστέρια.', side: 'bottom' },
    { el: 'transfer.amount', title: 'Πόσα;', text: 'Με το − και το + διαλέγεις πόσα. Δεν μπορείς να δώσεις περισσότερα από όσα έχεις.', side: 'bottom', say: 'Πόσα; Με το μείον και το συν διαλέγεις πόσα. Δεν μπορείς να δώσεις περισσότερα από όσα έχεις.' },
    { el: 'transfer.send', title: 'Στείλ’ τα!', text: 'Τα αστέρια φεύγουν όταν το εγκρίνει ένας γονιός.', side: 'top', demo: 'tap' },
  ],
});
