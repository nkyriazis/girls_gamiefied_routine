import type { Tour } from '../help/tour';

// The owl on a kid's own screen (from her avatar), and on its two popups.

export const storeTour = (userId: string): Tour => ({
  id: 'store',
  user: userId,
  steps: [
    { el: 'store.balance', title: 'Τα αστέρια σου', text: 'Τόσα αστέρια έχεις μαζέψει.', side: 'bottom' },
    { el: 'store.earn', title: 'Κέρδισε αστέρια', text: 'Οι ασκήσεις σου για σήμερα. Πάτα μία για να ξεκινήσεις.', side: 'right' },
    { el: 'exercises.more', title: 'Κι άλλο πρόβλημα', text: 'Τελείωσες τις σημερινές; Εδώ ζητάς κι άλλο πρόβλημα, για κι άλλα αστέρια. Αν έχεις αρχίσει ένα, εδώ το συνεχίζεις.', side: 'top', demo: 'tap' },
    { el: 'store.rewards', title: 'Ανταμοιβές', text: 'Πάτα μια ανταμοιβή για να την πάρεις με τα αστέρια σου. Οι γκρίζες θέλουν περισσότερα αστέρια.', side: 'left' },
    { el: 'store.give', title: 'Δώσε αστέρια', text: 'Μπορείς να χαρίσεις αστέρια στην αδερφή σου. Ένας γονιός το εγκρίνει.', side: 'bottom' },
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
    { el: 'transfer.to', title: 'Σε ποια;', text: 'Διάλεξε σε ποια θα δώσεις αστέρια.', side: 'bottom' },
    { el: 'transfer.amount', title: 'Πόσα;', text: 'Με το − και το + διαλέγεις πόσα. Δεν μπορείς να δώσεις περισσότερα από όσα έχεις.', side: 'bottom', say: 'Πόσα; Με το μείον και το συν διαλέγεις πόσα. Δεν μπορείς να δώσεις περισσότερα από όσα έχεις.' },
    { el: 'transfer.send', title: 'Στείλ’ τα!', text: 'Τα αστέρια φεύγουν όταν το εγκρίνει ένας γονιός.', side: 'top', demo: 'tap' },
  ],
});
