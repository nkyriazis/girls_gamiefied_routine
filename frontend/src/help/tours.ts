import type { ProblemStep } from '@shared/types';

// What the owl says, screen by screen. A tour is a list of steps, each pointing at a
// widget by its selector (none: a note in the middle of the screen). Steps whose widget
// isn't on screen are left out, so one tour fits every state of its screen.

export interface HelpStep {
  el?: string;
  title: string;
  text: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** A finger shows how: a tap on the widget, or a drag across its first line */
  demo?: 'tap' | 'swipe';
}

export interface Tour {
  /** Remembered once played; per kid where the screen is hers */
  id: string;
  /** Which screen's help wins when several are open: the one on top */
  layer: number;
  steps: HelpStep[];
  /** Said only the first time (before and after the tour's own steps), remembered on its own */
  intro?: { id: string; steps: HelpStep[]; after?: HelpStep[] };
}

export const LAYER = { dashboard: 0, panel: 1, player: 2, step: 3 } as const;

const OWL = { el: '.help-btn', title: 'Είμαι πάντα εδώ', text: 'Όποτε δεν ξέρεις τι να κάνεις, πάτα την κουκουβάγια και θα σου δείξω.' };

export const dashboardTour = (): Tour => ({
  id: 'dashboard',
  layer: LAYER.dashboard,
  steps: [
    { title: 'Γεια σου! 🦉', text: 'Είμαι η κουκουβάγια-βοηθός. Έλα να σου δείξω τι κάνει κάθε κουμπί.' },
    { el: '.clock-container', title: 'Η ώρα', text: 'Η ώρα και η μέρα. Όταν είναι ώρα για ρουτίνα, εμφανίζεται εδώ.' },
    { el: '.dock-item', title: 'Η δική σου γωνιά', text: 'Πάτα τη φωτογραφία σου: βλέπεις τα αστέρια σου, κερδίζεις κι άλλα και τα ξοδεύεις σε ανταμοιβές.', side: 'top', demo: 'tap' },
    { el: '.daily-exercises-fab', title: 'Ασκήσεις της ημέρας', text: 'Οι σημερινές ασκήσεις όλων. Ο αριθμός λέει πόσες περιμένουν.', side: 'left' },
    { el: '.chores-fab', title: 'Δουλειές', text: 'Δουλειές του σπιτιού. Αναλαμβάνεις μία, την κάνεις και παίρνεις αστέρια.', side: 'left' },
    { el: '.bonus-fab', title: 'Έξτρα', text: 'Έξτρα δραστηριότητες, για ακόμα περισσότερα αστέρια.', side: 'left' },
    { el: '.exercise-fab', title: 'Παιχνίδι για όλους', text: 'Ασκήσεις που παίζετε μαζί, όλοι μπροστά στην οθόνη.', side: 'left' },
    OWL,
  ],
});

export const routineTour = (): Tour => ({
  id: 'routine',
  layer: LAYER.dashboard,
  steps: [
    { el: '.inline-player .timeline-compact', title: 'Η ρουτίνα σου', text: 'Κάθε τελεία είναι μια δουλειά της ρουτίνας. Η φωτεινή είναι αυτή που κάνεις τώρα.' },
    { el: '.inline-player .active-task-container', title: 'Τι κάνεις τώρα', text: 'Αυτή είναι η δουλειά σου. Το ρολόι μετράει πόσος χρόνος μένει.' },
    { el: '.inline-player .btn-done', title: 'Έτοιμη;', text: 'Μόλις την τελειώσεις, πάτα εδώ. Όσο πιο γρήγορα, τόσο περισσότερα αστέρια!', side: 'top', demo: 'tap' },
    { el: '.global-alarm-container .btn-dismiss-global', title: 'Ξυπνητήρι', text: 'Πάτα εδώ για να το σταματήσεις.', side: 'top', demo: 'tap' },
    OWL,
  ],
});

export const storeTour = (userId: string): Tour => ({
  id: `store@${userId}`,
  layer: LAYER.panel,
  steps: [
    { el: '.store-card .user-balance', title: 'Τα αστέρια σου', text: 'Τόσα αστέρια έχεις μαζέψει.', side: 'bottom' },
    { el: '.store-card .earn-section', title: 'Κέρδισε αστέρια', text: 'Οι ασκήσεις σου για σήμερα. Πάτα μία για να ξεκινήσεις.', side: 'right' },
    { el: '.store-card .extra-btn', title: 'Κι άλλο πρόβλημα', text: 'Τελείωσες τις σημερινές; Εδώ ζητάς κι άλλο πρόβλημα, για κι άλλα αστέρια. Αν έχεις αρχίσει ένα, εδώ το συνεχίζεις.', side: 'top', demo: 'tap' },
    { el: '.store-card .rewards-grid', title: 'Ανταμοιβές', text: 'Πάτα μια ανταμοιβή για να την πάρεις με τα αστέρια σου. Οι γκρίζες θέλουν περισσότερα αστέρια.', side: 'left' },
    { el: '.store-card .transfer-btn', title: 'Δώσε αστέρια', text: 'Μπορείς να χαρίσεις αστέρια στην αδερφή σου. Ένας γονιός το εγκρίνει.', side: 'bottom' },
    { el: '.store-card .activity-toggle-btn', title: 'Δραστηριότητα', text: 'Τι έχεις πάρει και τι περιμένει έγκριση.', side: 'bottom' },
    { el: '.store-card > .close-btn', title: 'Κλείσιμο', text: 'Από εδώ γυρνάς στην αρχική οθόνη.', side: 'top' },
  ],
});

export const choresTour = (bonus: boolean): Tour => ({
  id: bonus ? 'bonus' : 'chores',
  layer: LAYER.panel,
  steps: [
    { el: '.chores-drawer .chore-card', title: bonus ? 'Μια δραστηριότητα' : 'Μια δουλειά', text: 'Εδώ βλέπεις πόσα αστέρια δίνει και πόσος χρόνος μένει.', side: 'left' },
    { el: '.chores-drawer .user-claim-btn', title: 'Ποια θα την κάνει;', text: 'Πάτα το όνομά σου για να την αναλάβεις.', side: 'left', demo: 'tap' },
    { el: '.chores-drawer .done-btn', title: 'Την έκανα!', text: 'Όταν την τελειώσεις, πάτα εδώ. Ένας γονιός θα το δει και θα σου δώσει τα αστέρια.', side: 'left', demo: 'tap' },
    { el: '.chores-drawer .empty-state', title: 'Τίποτα ακόμα', text: 'Δεν υπάρχει κάτι τώρα. Κοίτα ξανά αργότερα!', side: 'left' },
  ],
});

export const exercisesTour = (): Tour => ({
  id: 'exercises',
  layer: LAYER.panel,
  steps: [
    { el: '.exercises-drawer .user-header', title: 'Οι ασκήσεις σου', text: 'Κάθε παιδί έχει τις δικές του ασκήσεις για σήμερα.', side: 'left' },
    { el: '.exercises-drawer .assignment-card', title: 'Μια άσκηση', text: 'Πάτα την για να την ξεκινήσεις. Δεξιά βλέπεις πόσα αστέρια δίνει.', side: 'left', demo: 'tap' },
    { el: '.exercises-drawer .extra-btn', title: 'Κι άλλο πρόβλημα', text: 'Τελείωσες; Ζήτα κι άλλο πρόβλημα, για κι άλλα αστέρια.', side: 'left' },
  ],
});

export const exerciseTour = (userId: string): Tour => ({
  id: `exercise@${userId}`,
  layer: LAYER.player,
  steps: [
    { el: '.assignment-ask', title: 'Η ερώτηση', text: 'Διάβασε προσεκτικά τι σε ρωτάει.', side: 'right' },
    { el: '.assignment-renderer', title: 'Η απάντησή σου', text: 'Εδώ απαντάς. Αν κάνεις λάθος, ξαναδοκιμάζεις!', side: 'left' },
    { el: '.assignment-reward', title: 'Το έπαθλο', text: 'Τόσα αστέρια κερδίζεις με τη σωστή απάντηση.', side: 'bottom' },
    { el: '.exit-game-btn', title: 'Έξοδος', text: 'Θες να σταματήσεις; Πάτα εδώ. Η άσκηση σε περιμένει για αργότερα.', side: 'bottom' },
  ],
});

export const gameSetupTour = (): Tour => ({
  id: 'game-setup',
  layer: LAYER.panel,
  steps: [
    { el: '.setup-card .players-grid', title: 'Ποιοι παίζουν;', text: 'Πατήστε όσες θα παίξετε μαζί.', side: 'bottom', demo: 'tap' },
    { el: '.setup-card .categories-chips', title: 'Τι θα παίξετε;', text: 'Διαλέξτε μαθήματα: Μαθηματικά, Γλώσσα…', side: 'bottom' },
    { el: '.setup-card .settings-row', title: 'Πόσο θα κρατήσει;', text: 'Πόσοι γύροι και πόσες ερωτήσεις σε κάθε γύρο.', side: 'top' },
    { el: '.setup-card .start-game-btn', title: 'Πάμε!', text: 'Όταν είστε έτοιμες, πατήστε εδώ.', side: 'top', demo: 'tap' },
  ],
});

export const gameTour = (): Tour => ({
  id: 'game',
  layer: LAYER.player,
  steps: [
    { el: '.game-container .players-scores', title: 'Ποια παίζει;', text: 'Η φωτεινή είναι αυτή που απαντάει τώρα. Παίζετε με τη σειρά.', side: 'bottom' },
    { el: '.game-container .game-progress', title: 'Γύροι', text: 'Σε ποιο γύρο και σε ποια ερώτηση είστε.', side: 'bottom' },
    { el: '.game-container .exercise-content', title: 'Η ερώτηση', text: 'Διάβασέ την προσεκτικά.', side: 'right' },
    { el: '.game-container .renderer-container', title: 'Η απάντηση', text: 'Εδώ απαντάς. Η σωστή απάντηση φέρνει αστέρια.', side: 'left' },
  ],
});

// A problem: the frame once per kid, around what the step on screen asks of her.
export type ProblemHelpKind = 'tag' | 'paint' | 'paint-all' | Exclude<ProblemStep['kind'], 'tag' | 'paint'>;

const PROBLEM_KIND: Record<ProblemHelpKind, HelpStep[]> = {
  tag: [
    { el: '.tag-brushes', title: 'Δύο πινέλα', text: '🟢 για ό,τι ξέρουμε από την ιστορία, 🟡 για ό,τι ψάχνουμε. Διάλεξε ένα.', side: 'top' },
    { el: '.story-phrase.tappable', title: 'Βάψε τις φράσεις', text: 'Πάτα μια φράση για να τη βάψεις. Ξαναπάτα τη, και σβήνει. Ό,τι δεν χρειάζεται, το αφήνεις άβαφο.', demo: 'tap' },
  ],
  paint: [
    { el: '.tag-brushes', title: 'Δύο πινέλα', text: '🟢 για ό,τι ξέρουμε από την ιστορία, 🟡 για ό,τι ψάχνουμε. Διάλεξε ένα.', side: 'top' },
    { el: '.paint-words', title: 'Βάψε με το δάχτυλο', text: 'Σύρε το δάχτυλο πάνω στις λέξεις, σαν μαρκαδόρο. Δεν πειράζει αν βάψεις μια λέξη παραπάνω. Ξανά πάνω τους, και σβήνουν.', demo: 'swipe' },
  ],
  'paint-all': [
    { el: '.tag-brushes', title: 'Τρία πινέλα', text: '🟢 ό,τι ξέρουμε και χρειαζόμαστε, 🟡 ό,τι ψάχνουμε, ⚪ ό,τι λέει η ιστορία αλλά δεν χρειάζεται.', side: 'top' },
    { el: '.paint-words', title: 'Βάψε με το δάχτυλο', text: 'Σύρε το δάχτυλο πάνω στις λέξεις, σαν μαρκαδόρο. Ξανά πάνω τους, και σβήνουν.', demo: 'swipe' },
    { el: '.tag-brush.role-extra', title: 'Το λευκό πινέλο', text: 'Κάποιοι αριθμοί είναι παγίδες! Βρες τους και βάψ’ τους λευκούς.', side: 'top', demo: 'tap' },
  ],
  calc: [
    { el: '.calc-chips', title: 'Οι αριθμοί σου', text: 'Οι αριθμοί της ιστορίας. Πάτα έναν για να ξεκινήσεις μια πράξη.', side: 'top', demo: 'tap' },
    { el: '.calc-pad', title: 'Πράξη και αποτέλεσμα', text: 'Διάλεξε πράξη, πάτα τον δεύτερο αριθμό και γράψε το αποτέλεσμα με τα πλήκτρα.', side: 'top' },
    { el: '.calc-build', title: 'Η πράξη σου', text: 'Εδώ φτιάχνεται. Με τον Έλεγχο σου λέω τι βρήκες, και το αποτέλεσμα γίνεται κι αυτό αριθμός για την επόμενη πράξη.', side: 'bottom' },
  ],
  choice: [
    { el: '.choice-list', title: 'Διάλεξε', text: 'Πάτα την απάντηση που ταιριάζει και μετά Έλεγχο.', side: 'left', demo: 'tap' },
  ],
  numbers: [
    { el: '.numbers-rows', title: 'Συμπλήρωσε', text: 'Πάτα ένα κουτάκι και γράψε τον αριθμό.', side: 'left', demo: 'tap' },
    { el: '.numbers-pad', title: 'Τα πλήκτρα', text: 'Με το ⌫ σβήνεις, με το ↵ πας στο επόμενο κουτάκι.', side: 'top' },
  ],
  order: [
    { el: '.order-step', title: 'Βάλε σειρά', text: 'Πάτα τα βήματα με τη σειρά που γίνονται. Πάτα ένα με αριθμό για να το πάρεις πίσω.', side: 'left', demo: 'tap' },
  ],
};

const PROBLEM_INTRO: HelpStep[] = [
  { title: 'Ένα πρόβλημα! 🦉', text: 'Θα το λύσουμε βήμα βήμα, όπως στο βιβλίο. Έλα να σου δείξω.' },
  { el: '.problem-phases', title: 'Τέσσερα βήματα', text: 'Διαβάζω, Σχεδιάζω, Λύνω, Ελέγχω. Εδώ βλέπεις σε ποιο είσαι.', side: 'bottom' },
  { el: '.problem-story', title: 'Η ιστορία', text: 'Διάβασέ τη προσεκτικά, μέχρι το τέλος. Μένει εδώ σε όλα τα βήματα.', side: 'bottom' },
  { el: '.problem-prompt', title: 'Τι ζητάει το βήμα', text: 'Κάθε βήμα σου λέει εδώ τι να κάνεις.', side: 'bottom' },
];

const PROBLEM_END: HelpStep[] = [
  { el: '.problem-hint', title: 'Συμβουλές', text: 'Αν κάτι δεν πάει καλά, εδώ σου λέω τι να κοιτάξεις.', side: 'top' },
  { el: '.problem-check', title: 'Έλεγχος', text: 'Όταν είσαι έτοιμη, πάτα Έλεγχος. Τα λάθη δεν πειράζουν: ξαναδοκιμάζεις!', side: 'top', demo: 'tap' },
];

export const problemTour = (userId: string, kind: ProblemHelpKind): Tour => ({
  id: `problem-${kind}@${userId}`,
  layer: LAYER.step,
  steps: PROBLEM_KIND[kind],
  intro: { id: `problem@${userId}`, steps: PROBLEM_INTRO, after: PROBLEM_END },
});
