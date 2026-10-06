import type { Forgiveness, ProblemStep } from '@shared/types';
import type { HelpStep, Tour } from '../../help/tour';

// The owl in a word problem: what the step on screen asks of her, on her rung, and the
// first time (per kid) the frame around it: the phases, the story, hints, the stars and
// «Έλεγχος», said for her rung on the forgiveness ladder (shared/forgiveness.ts).

export type ProblemHelpKind = 'tag' | 'paint' | 'paint-all' | Exclude<ProblemStep['kind'], 'tag' | 'paint'>;

const BRUSHES: HelpStep = { el: 'problem.brushes', title: 'Δύο πινέλα', text: '🟢 για ό,τι ξέρουμε από την ιστορία, 🟡 για ό,τι ψάχνουμε. Διάλεξε ένα.', side: 'top',
  say: 'Δύο πινέλα. Το πράσινο για ό,τι ξέρουμε από την ιστορία, το κίτρινο για ό,τι ψάχνουμε. Διάλεξε ένα.' };

const KIND: Record<ProblemHelpKind, HelpStep[]> = {
  tag: [
    BRUSHES,
    { el: 'problem.phrase', title: 'Βάψε τις φράσεις', text: 'Πάτα μια φράση για να τη βάψεις. Ξαναπάτα τη, και σβήνει. Ό,τι δεν χρειάζεται, το αφήνεις άβαφο.', demo: 'tap' },
  ],
  paint: [
    BRUSHES,
    { el: 'problem.paint', title: 'Βάψε με το δάχτυλο', text: 'Σύρε το δάχτυλο πάνω στις λέξεις, σαν μαρκαδόρο. Δεν πειράζει αν βάψεις μια λέξη παραπάνω. Ξανά πάνω τους, και σβήνουν.', demo: 'swipe' },
  ],
  'paint-all': [
    { el: 'problem.brushes', title: 'Τρία πινέλα', text: '🟢 ό,τι ξέρουμε και χρειαζόμαστε, 🟡 ό,τι ψάχνουμε, ⚪ ό,τι λέει η ιστορία αλλά δεν χρειάζεται.', side: 'top',
      say: 'Τρία πινέλα. Το πράσινο για ό,τι ξέρουμε και χρειαζόμαστε, το κίτρινο για ό,τι ψάχνουμε, και το λευκό για ό,τι λέει η ιστορία αλλά δεν χρειάζεται.' },
    { el: 'problem.paint', title: 'Βάψε με το δάχτυλο', text: 'Σύρε το δάχτυλο πάνω στις λέξεις, σαν μαρκαδόρο. Ξανά πάνω τους, και σβήνουν.', demo: 'swipe' },
    { el: 'problem.brush-extra', title: 'Το λευκό πινέλο', text: 'Μερικοί αριθμοί είναι παγίδες! Βρες τους και βάψ’ τους λευκούς.', side: 'top', demo: 'tap' },
  ],
  calc: [
    { el: 'calc.build', title: 'Η πράξη σου', text: 'Πάτα ένα κουτάκι για να το γεμίσεις: λάμπει γαλάζιο. Με τον Έλεγχο σου λέω τι βρήκες, και το αποτέλεσμα γίνεται κι αυτό αριθμός για την επόμενη πράξη.', side: 'bottom', demo: 'tap' },
    { el: 'calc.chips', title: 'Οι αριθμοί σου', text: 'Οι αριθμοί της ιστορίας. Πάτα έναν για να τον βάλεις στην πράξη.', side: 'top', demo: 'tap' },
    { el: 'calc.pad', title: 'Πράξη και αποτέλεσμα', text: 'Διάλεξε πράξη και γράψε το αποτέλεσμα. Το ⌫ σβήνει, το C αδειάζει το γαλάζιο κουτάκι.', side: 'top',
      say: 'Πράξη και αποτέλεσμα. Διάλεξε πράξη και γράψε το αποτέλεσμα. Το βελάκι πίσω σβήνει, και το σι αδειάζει το γαλάζιο κουτάκι.' },
    { el: 'calc.lines', title: 'Όσα βρήκες', text: 'Οι πράξεις σου μένουν εδώ, με το τι βρήκες σε κάθε πράξη. Οι πράσινες σε φέρνουν πιο κοντά στην απάντηση.', side: 'bottom' },
  ],
  choice: [
    { el: 'problem.choices', title: 'Διάλεξε', text: 'Πάτα την απάντηση που ταιριάζει και μετά Έλεγχο.', side: 'left', demo: 'tap' },
  ],
  numbers: [
    { el: 'problem.numbers', title: 'Συμπλήρωσε', text: 'Πάτα ένα κουτάκι και γράψε τον αριθμό.', side: 'left', demo: 'tap' },
    { el: 'problem.keypad', title: 'Τα πλήκτρα', text: 'Με το ⌫ σβήνεις, με το C αδειάζεις το κουτάκι, με το ↵ πας στο επόμενο.', side: 'top',
      say: 'Τα πλήκτρα. Με το βελάκι πίσω σβήνεις, με το σι αδειάζεις το κουτάκι, και με το γυριστό βελάκι πας στο επόμενο κουτάκι.' },
  ],
  order: [
    { el: 'problem.order', title: 'Βάλε σειρά', text: 'Πάτα τα βήματα με τη σειρά που γίνονται. Πάτα ένα με αριθμό για να το πάρεις πίσω.', side: 'left', demo: 'tap' },
  ],
};

// «Δείξε μου», on a step with a few wrong tries: on screen only then, so the owl explains it only then
const SHOW: HelpStep = { el: 'problem.show', title: 'Δείξε μου', text: 'Κόλλησες; Πάτα εδώ και σου δείχνω πώς λύνεται αυτό το βήμα.', side: 'top', demo: 'tap' };

// A tour whose steps changed gets a new edition, so the owl offers it again to a kid who
// played the old one (played tours are remembered by id). #52: tap a box, then fill it.
const EDITION: Partial<Record<ProblemHelpKind, number>> = { calc: 2, numbers: 2 };

// What mistakes cost, on each rung
const RUNG: Record<Forgiveness, { stars: string; check: string }> = {
  forgiving: {
    stars: 'Τόσα αστέρια κερδίζεις αν συνεχίσεις σωστά. Ένα βήμα με λάθη κοστίζει το πολύ ένα αστέρι, και ένα αστέρι το κερδίζεις πάντα.',
    check: 'Όταν τελειώσεις, πάτα Έλεγχος. Λάθος; Ξαναδοκιμάζεις όσες φορές θες, κι αν κολλήσεις, σου δείχνω πώς λύνεται.',
  },
  unforgiving: {
    stars: 'Τόσα αστέρια κερδίζεις αν συνεχίσεις σωστά. Ένα βήμα με λάθη κοστίζει το πολύ ένα αστέρι.',
    check: 'Όταν τελειώσεις, πάτα Έλεγχος. Σκέψου καλά: σε κάθε βήμα έχεις δύο προσπάθειες, και μετά σου δείχνω πώς λύνεται.',
  },
};

// The intro says what mistakes cost on her rung: its id names the rung, so the owl offers it
// again when a parent moves her (and once to everyone, for #48: the old intro was «problem»).
export const problemTour = (userId: string, kind: ProblemHelpKind, rung: Forgiveness = 'forgiving'): Tour => ({
  id: `problem-${kind}${EDITION[kind] ? `-${EDITION[kind]}` : ''}`,
  user: userId,
  steps: [...KIND[kind], SHOW],
  intro: {
    id: `problem-${rung}`,
    steps: [
      { id: 'hello', title: 'Ένα πρόβλημα! 🦉', text: 'Θα το λύσουμε βήμα βήμα, όπως στο βιβλίο. Έλα να σου δείξω.' },
      { el: 'problem.phases', title: 'Τέσσερα βήματα', text: 'Διαβάζω, Σχεδιάζω, Λύνω, Ελέγχω. Εδώ βλέπεις σε ποιο είσαι.', side: 'bottom' },
      { el: 'problem.story', title: 'Η ιστορία', text: 'Διάβασέ τη προσεκτικά, μέχρι το τέλος. Μένει εδώ σε όλα τα βήματα.', side: 'bottom' },
      { el: 'problem.prompt', title: 'Τι ζητάει το βήμα', text: 'Κάθε βήμα σου λέει εδώ τι να κάνεις.', side: 'bottom' },
    ],
    after: [
      { el: 'problem.hint', title: 'Συμβουλές', text: 'Αν κάτι δεν πάει καλά, εδώ σου λέω τι να κοιτάξεις.', side: 'top' },
      { el: 'exercise.stars', title: 'Τα αστέρια', text: RUNG[rung].stars, side: 'bottom' },
      { el: 'problem.check', title: 'Έλεγχος', text: RUNG[rung].check, side: 'top', demo: 'tap' },
    ],
  },
});
