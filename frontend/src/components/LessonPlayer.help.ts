import type { Tour } from '../help/tour';

// The owl in a lesson (LessonPlayer.tsx): what the block on screen asks of her. One tour per kind of block, so the
// owl offers each the first time it comes; the frame (dots, ✕) in an intro, once.
export type LessonHelpKind = 'intro' | 'choose' | 'book' | 'move' | 'read' | 'question' | 'picture' | 'think' | 'find' | 'sort' | 'spot' | 'explain' | 'end';
export const LESSON_HELP_KINDS: LessonHelpKind[] = ['intro', 'choose', 'book', 'move', 'read', 'question', 'picture', 'think', 'find', 'sort', 'spot', 'explain', 'end'];

const STEPS: Record<LessonHelpKind, Tour['steps']> = {
  intro: [{ el: 'lesson.next', title: 'Ένα μάθημα', text: 'Θα το διαβάσεις σε μικρά κομμάτια. Μετά από κάθε κομμάτι, λίγες ερωτήσεις.', side: 'top' }],
  choose: [{ el: 'lesson.choose', title: 'Εσύ διαλέγεις', text: 'Θες να σου διαβάζω εγώ, ή να διαβάζεις μόνο σου; Και τα δύο είναι εντάξει.', side: 'top' }],
  book: [{ el: 'lesson.book', title: 'Το βιβλίο σου', text: 'Αυτές είναι οι σελίδες του βιβλίου. Πάτα τα βελάκια για να τις γυρίσεις.', side: 'top' }],
  move: [{ el: 'lesson.break', title: 'Κίνηση', text: 'Λίγη κίνηση βοηθάει το μυαλό. Μετά συνεχίζεις.', side: 'top' }],
  read: [
    { el: 'lesson.text', title: 'Διάβασε', text: 'Διάβασε προσεκτικά αυτό το κομμάτι. Είναι μικρό!', side: 'right' },
    { el: 'lesson.key', title: 'Το αστεράκι', text: 'Η πρόταση με το αστεράκι λέει το πιο σημαντικό.', side: 'right' },
    { el: 'lesson.listen', title: 'Άκου', text: 'Πάτα το μεγάφωνο και σου διαβάζω την πρόταση.', side: 'right' },
    { el: 'lesson.word', title: 'Δύσκολες λέξεις', text: 'Οι υπογραμμισμένες λέξεις είναι δύσκολες. Πάτα μία και σου λέω τι σημαίνει.', side: 'bottom', demo: 'tap' },
    { el: 'lesson.easy', title: 'Πιο απλά', text: 'Μια πρόταση σε μπερδεύει; Πάτα εδώ και σου την λέω πιο απλά.', side: 'left' },
    { el: 'lesson.next', title: 'Διάβασα', text: 'Όταν τελειώσεις, πάτα εδώ για τις ερωτήσεις.', side: 'top', demo: 'tap' },
  ],
  question: [
    { el: 'lesson.ask', title: 'Η ερώτηση', text: 'Η απάντηση είναι στο κείμενο αριστερά.', side: 'left' },
    { el: 'lesson.answer', title: 'Λάθος; Δεν πειράζει', text: 'Αν κάνεις λάθος, φωτίζεται η πρόταση με την απάντηση. Διάβασέ τη και δοκίμασε ξανά.', side: 'left' },
  ],
  picture: [
    { el: 'lesson.picture', title: 'Κοίτα την εικόνα', text: 'Αυτή η ερώτηση είναι για την εικόνα. Η απάντηση είναι εκεί: κοίτα την προσεκτικά.', side: 'right' },
    { el: 'lesson.answer', title: 'Λάθος; Δεν πειράζει', text: 'Αν κάνεις λάθος, κοίτα ξανά την εικόνα και δοκίμασε ξανά.', side: 'left' },
  ],
  think: [{ el: 'lesson.think', title: 'Σκέψου πρώτα', text: 'Βρες την απάντηση στο μυαλό σου. Μετά πάτα, και δες αν είναι εκεί.', side: 'left' }],
  find: [{ el: 'lesson.text', title: 'Βρες την πρόταση', text: 'Η απάντηση είναι μέσα στο κείμενο. Πάτα την πρόταση που τη λέει.', side: 'right' }],
  sort: [{ el: 'lesson.sort', title: 'Βάλε στη θέση τους', text: 'Για κάθε κάρτα, πάτα το βελάκι προς το κουτί που ταιριάζει. Μετά πάτα Έλεγχος.', side: 'left' }],
  spot: [{ el: 'lesson.spot', title: 'Βρες στην εικόνα', text: 'Κοίτα την εικόνα και πάτα το σωστό σημείο.', side: 'left' }],
  explain: [{ el: 'lesson.explain', title: 'Εξήγησέ το', text: 'Πες το σε κάποιον με δικά σου λόγια. Όταν το εξηγείς, το θυμάσαι καλύτερα!', side: 'left' }],
  end: [{ el: 'lesson.again', title: 'Ξανά', text: 'Θες να το ξαναπαίξεις; Τα αστέρια τα κέρδισες ήδη, αλλά το μάθημα μένει καλύτερα.', side: 'top' }],
};

export const lessonTour = (userId: string, kind: LessonHelpKind): Tour => ({
  id: `lesson-${kind}`,
  user: userId,
  steps: STEPS[kind],
  intro: {
    id: 'lesson-frame',
    steps: [
      { el: 'lesson.progress', title: 'Τα κομμάτια', text: 'Κάθε κύκλος είναι ένα κομμάτι. Το αστεράκι στο τέλος είναι η επανάληψη.', side: 'bottom' },
    ],
    after: [
      { el: 'lesson.exit', title: 'Έξοδος', text: 'Θες να σταματήσεις; Πάτα εδώ. Το μάθημα σε περιμένει εκεί που έμεινες.', side: 'bottom' },
    ],
  },
});
