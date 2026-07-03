import { Exercise } from '../../shared/types';

// ============================================================================
// Daily Exercise Pool
//
// Provides the per-user pool of school exercises used for daily assignments.
// The current implementation is a fixed, hardcoded pool per school grade,
// behind the ExercisePoolProvider interface so it can be swapped for a more
// generic source later (e.g. LLM-generated, imported worksheets, admin UI).
// ============================================================================

export interface ExercisePoolProvider {
  /** Full pool of exercises a given user may be assigned. */
  getPoolForUser(userId: string): Promise<Exercise[]>;
  /** Resolve a pool exercise by id (across all users). */
  getExerciseById(exerciseId: string): Promise<Exercise | undefined>;
}

// Which school grade each user attends (Greek primary school).
// NOTE: assumption — Ηλέκτρα (u1) = Δ' Δημοτικού (4th), Ιφιγένεια (u2) = Β' Δημοτικού (2nd).
// Swap the numbers here if it's the other way around.
export const USER_GRADES: Record<string, 2 | 4> = {
  u1: 4,
  u2: 2,
};

// How many exercises each child gets per day.
export const ASSIGNMENTS_PER_DAY = 3;

// ----------------------------------------------------------------------------
// Β' Δημοτικού (grade 2, ~7-8 y.o.)
// Curriculum anchors: πρόσθεση/αφαίρεση μέχρι το 100, προπαίδεια (2, 5, 10),
// σύγκριση αριθμών, μονάδες χρόνου/χρήματος — άρθρα, ορθογραφία, αντίθετα,
// αλφαβητική σειρά, δομή πρότασης.
// ----------------------------------------------------------------------------
const GRADE_2_POOL: Exercise[] = [
  // --- Μαθηματικά ---
  {
    id: 'g2-math-add-1',
    type: 'number-input',
    category: 'Μαθηματικά',
    title: 'Πρόσθεση',
    question: 'Πόσο κάνει 34 + 25;',
    correctValue: 59,
    stars: 1,
  },
  {
    id: 'g2-math-sub-1',
    type: 'number-input',
    category: 'Μαθηματικά',
    title: 'Αφαίρεση',
    question: 'Πόσο κάνει 52 − 17;',
    correctValue: 35,
    stars: 1,
  },
  {
    id: 'g2-math-mult-1',
    type: 'multiple-choice',
    category: 'Μαθηματικά',
    title: 'Προπαίδεια του 5',
    question: 'Πόσο κάνει 5 × 6;',
    options: ['25', '30', '35', '40'],
    correctIndex: 1,
    stars: 1,
  },
  {
    id: 'g2-math-mult-pairs-1',
    type: 'match-pairs',
    category: 'Μαθηματικά',
    title: 'Προπαίδεια του 2',
    body: 'Σύνδεσε κάθε πολλαπλασιασμό με το σωστό αποτέλεσμα.',
    pairs: [
      { left: '2 × 3', right: '6' },
      { left: '2 × 5', right: '10' },
      { left: '2 × 8', right: '16' },
      { left: '2 × 10', right: '20' },
    ],
    stars: 1,
  },
  {
    id: 'g2-math-order-1',
    type: 'ordering',
    category: 'Μαθηματικά',
    title: 'Βάλε τους αριθμούς στη σειρά',
    body: 'Από τον μικρότερο στον μεγαλύτερο.',
    items: [
      { id: '27', content: '27' },
      { id: '41', content: '41' },
      { id: '58', content: '58' },
      { id: '73', content: '73' },
      { id: '96', content: '96' },
    ],
    stars: 1,
  },
  {
    id: 'g2-math-tf-1',
    type: 'true-false',
    category: 'Μαθηματικά',
    title: 'Σύγκριση αριθμών',
    question: 'Το 48 είναι μεγαλύτερο από το 52.',
    correctValue: false,
    stars: 1,
  },
  {
    id: 'g2-math-time-1',
    type: 'multiple-choice',
    category: 'Μαθηματικά',
    title: 'Ο χρόνος',
    question: 'Πόσα λεπτά έχει μία ώρα;',
    options: ['30', '60', '100', '120'],
    correctIndex: 1,
    stars: 1,
  },
  {
    id: 'g2-math-money-1',
    type: 'number-input',
    category: 'Μαθηματικά',
    title: 'Τα χρήματα',
    question: 'Έχεις 2 κέρματα των 20 λεπτών και 1 κέρμα των 10 λεπτών. Πόσα λεπτά έχεις;',
    correctValue: 50,
    stars: 1,
  },
  {
    id: 'g2-math-pattern-1',
    type: 'multiple-choice',
    category: 'Μαθηματικά',
    title: 'Μοτίβα αριθμών',
    question: 'Ποιος αριθμός λείπει; 5, 10, 15, __, 25',
    options: ['16', '18', '20', '22'],
    correctIndex: 2,
    stars: 1,
  },
  // --- Γλώσσα ---
  {
    id: 'g2-lang-article-1',
    type: 'multiple-choice',
    category: 'Γλώσσα',
    title: 'Τα άρθρα',
    question: 'Ποιο άρθρο ταιριάζει; «___ θάλασσα»',
    options: ['Ο', 'Η', 'Το'],
    correctIndex: 1,
    stars: 1,
  },
  {
    id: 'g2-lang-punct-1',
    type: 'multiple-choice',
    category: 'Γλώσσα',
    title: 'Σημεία στίξης',
    question: 'Τι βάζουμε στο τέλος; «Πού πας__»',
    options: ['.', ';', '!'],
    correctIndex: 1,
    stars: 1,
  },
  {
    id: 'g2-lang-tf-1',
    type: 'true-false',
    category: 'Γλώσσα',
    title: 'Τα ρήματα',
    question: 'Η λέξη «παίζω» είναι ρήμα.',
    correctValue: true,
    stars: 1,
  },
  {
    id: 'g2-lang-opposites-1',
    type: 'match-pairs',
    category: 'Γλώσσα',
    title: 'Αντίθετα',
    body: 'Σύνδεσε κάθε λέξη με την αντίθετή της.',
    pairs: [
      { left: 'μεγάλος', right: 'μικρός' },
      { left: 'ψηλός', right: 'κοντός' },
      { left: 'γρήγορος', right: 'αργός' },
      { left: 'μέρα', right: 'νύχτα' },
    ],
    stars: 1,
  },
  {
    id: 'g2-lang-alpha-1',
    type: 'ordering',
    category: 'Γλώσσα',
    title: 'Αλφαβητική σειρά',
    body: 'Βάλε τις λέξεις σε αλφαβητική σειρά.',
    items: [
      { id: 'alepou', content: 'αλεπού' },
      { id: 'vatrachos', content: 'βάτραχος' },
      { id: 'gata', content: 'γάτα' },
      { id: 'delfini', content: 'δελφίνι' },
    ],
    stars: 1,
  },
  {
    id: 'g2-lang-spell-1',
    type: 'multiple-choice',
    category: 'Γλώσσα',
    title: 'Ορθογραφία',
    question: 'Ποια γραφή είναι η σωστή;',
    options: ['παιδί', 'πεδί', 'παιδή'],
    correctIndex: 0,
    stars: 1,
  },
  {
    id: 'g2-lang-fb-1',
    type: 'fill-blank',
    category: 'Γλώσσα',
    title: 'Συμπλήρωσε τη λέξη',
    textWithGaps: 'Το αγόρι {0} μπάλα στην {1}.',
    options: ['παίζει', 'αυλή', 'παίζη', 'αβλή'],
    correctAnswers: ['παίζει', 'αυλή'],
    stars: 1,
  },
  {
    id: 'g2-lang-sentence-1',
    type: 'ordering',
    category: 'Γλώσσα',
    title: 'Φτιάξε την πρόταση',
    body: 'Βάλε τις λέξεις στη σωστή σειρά.',
    items: [
      { id: 'i', content: 'Η' },
      { id: 'gata', content: 'γάτα' },
      { id: 'pinei', content: 'πίνει' },
      { id: 'gala', content: 'γάλα.' },
    ],
    stars: 1,
  },
  {
    id: 'g2-lang-tf-2',
    type: 'true-false',
    category: 'Γλώσσα',
    title: 'Το αλφάβητο',
    question: 'Μετά το γράμμα Κ έρχεται το Λ.',
    correctValue: true,
    stars: 1,
  },
];

// ----------------------------------------------------------------------------
// Δ' Δημοτικού (grade 4, ~9-10 y.o.)
// Curriculum anchors: πράξεις με μεγάλους αριθμούς, διαίρεση, κλάσματα,
// δεκαδικοί, γεωμετρία (περίμετρος) — χρόνοι ρημάτων, -ται/-τε, επίθετα,
// συνώνυμα, ορθογραφία, χρονική/αλφαβητική σειρά.
// ----------------------------------------------------------------------------
const GRADE_4_POOL: Exercise[] = [
  // --- Μαθηματικά ---
  {
    id: 'g4-math-add-1',
    type: 'number-input',
    category: 'Μαθηματικά',
    title: 'Πρόσθεση με κρατούμενο',
    question: 'Πόσο κάνει 348 + 275;',
    correctValue: 623,
    stars: 1,
  },
  {
    id: 'g4-math-sub-1',
    type: 'number-input',
    category: 'Μαθηματικά',
    title: 'Αφαίρεση με δανεικό',
    question: 'Πόσο κάνει 604 − 258;',
    correctValue: 346,
    stars: 1,
  },
  {
    id: 'g4-math-div-1',
    type: 'multiple-choice',
    category: 'Μαθηματικά',
    title: 'Διαίρεση',
    question: 'Πόσο κάνει 56 ÷ 8;',
    options: ['6', '7', '8', '9'],
    correctIndex: 1,
    stars: 1,
  },
  {
    id: 'g4-math-frac-1',
    type: 'multiple-choice',
    category: 'Μαθηματικά',
    title: 'Κλάσματα',
    question: 'Ποιο κλάσμα είναι το μεγαλύτερο;',
    options: ['1/2', '1/3', '1/4', '1/5'],
    correctIndex: 0,
    stars: 1,
  },
  {
    id: 'g4-math-frac-dec-1',
    type: 'match-pairs',
    category: 'Μαθηματικά',
    title: 'Κλάσματα και δεκαδικοί',
    body: 'Σύνδεσε κάθε κλάσμα με τον δεκαδικό του.',
    pairs: [
      { left: '1/2', right: '0,5' },
      { left: '1/4', right: '0,25' },
      { left: '3/4', right: '0,75' },
      { left: '1/10', right: '0,1' },
    ],
    stars: 1,
  },
  {
    id: 'g4-math-dec-order-1',
    type: 'ordering',
    category: 'Μαθηματικά',
    title: 'Δεκαδικοί στη σειρά',
    body: 'Από τον μικρότερο στον μεγαλύτερο.',
    items: [
      { id: 'a', content: '0,3' },
      { id: 'b', content: '0,45' },
      { id: 'c', content: '0,5' },
      { id: 'd', content: '1,2' },
    ],
    stars: 1,
  },
  {
    id: 'g4-math-geo-tf-1',
    type: 'true-false',
    category: 'Μαθηματικά',
    title: 'Γεωμετρία',
    question: 'Ένα τετράγωνο έχει 4 ίσες πλευρές.',
    correctValue: true,
    stars: 1,
  },
  {
    id: 'g4-math-perim-1',
    type: 'number-input',
    category: 'Μαθηματικά',
    title: 'Περίμετρος',
    question: 'Ένα ορθογώνιο έχει μήκος 9 εκ. και πλάτος 6 εκ. Πόσα εκατοστά είναι η περίμετρός του;',
    correctValue: 30,
    stars: 1,
  },
  {
    id: 'g4-math-time-1',
    type: 'number-input',
    category: 'Μαθηματικά',
    title: 'Μετατροπή χρόνου',
    question: 'Πόσα λεπτά είναι 2 ώρες και 15 λεπτά;',
    correctValue: 135,
    stars: 1,
  },
  // --- Γλώσσα ---
  {
    id: 'g4-lang-tense-1',
    type: 'multiple-choice',
    category: 'Γλώσσα',
    title: 'Χρόνοι ρημάτων',
    question: '«Χθες ___ στο σχολείο νωρίς.»',
    options: ['πηγαίνω', 'πήγα', 'θα πάω'],
    correctIndex: 1,
    stars: 1,
  },
  {
    id: 'g4-lang-tai-te-1',
    type: 'fill-blank',
    category: 'Γλώσσα',
    title: '-ται ή -τε;',
    textWithGaps: 'Ο Γιώργος ντύνε{0} γρήγορα. Εσείς ντύνεσ{1} αργά.',
    options: ['ται', 'τε'],
    correctAnswers: ['ται', 'τε'],
    stars: 1,
  },
  {
    id: 'g4-lang-adj-tf-1',
    type: 'true-false',
    category: 'Γλώσσα',
    title: 'Τα επίθετα',
    question: 'Η λέξη «όμορφος» είναι επίθετο.',
    correctValue: true,
    stars: 1,
  },
  {
    id: 'g4-lang-syn-1',
    type: 'match-pairs',
    category: 'Γλώσσα',
    title: 'Συνώνυμα',
    body: 'Σύνδεσε κάθε λέξη με το συνώνυμό της.',
    pairs: [
      { left: 'όμορφος', right: 'ωραίος' },
      { left: 'γρήγορος', right: 'ταχύς' },
      { left: 'χαρούμενος', right: 'εύθυμος' },
      { left: 'δυνατός', right: 'ισχυρός' },
    ],
    stars: 1,
  },
  {
    id: 'g4-lang-story-order-1',
    type: 'ordering',
    category: 'Γλώσσα',
    title: 'Χρονική σειρά',
    body: 'Βάλε τα γεγονότα στη σωστή σειρά.',
    items: [
      { id: 'a', content: 'Ξύπνησα το πρωί.' },
      { id: 'b', content: 'Ντύθηκα.' },
      { id: 'c', content: 'Πήρα το πρωινό μου.' },
      { id: 'd', content: 'Πήγα στο σχολείο.' },
    ],
    stars: 1,
  },
  {
    id: 'g4-lang-spell-1',
    type: 'multiple-choice',
    category: 'Γλώσσα',
    title: 'Ορθογραφία',
    question: '«Στο σχολείο κάνουμε ___ στις 10:00.»',
    options: ['διάλειμμα', 'διάλυμα', 'διάλειμα'],
    correctIndex: 0,
    stars: 1,
  },
  {
    id: 'g4-lang-fb-1',
    type: 'fill-blank',
    category: 'Γλώσσα',
    title: 'Συμπλήρωσε σωστά',
    textWithGaps: 'Τα παιδιά {0} στην αυλή και {1} πολύ.',
    options: ['παίζουν', 'χαίρονται', 'παίζων', 'χέροντε'],
    correctAnswers: ['παίζουν', 'χαίρονται'],
    stars: 1,
  },
  {
    id: 'g4-lang-tense-tf-1',
    type: 'true-false',
    category: 'Γλώσσα',
    title: 'Ο ενεστώτας',
    question: 'Ο ενεστώτας δείχνει κάτι που γίνεται τώρα.',
    correctValue: true,
    stars: 1,
  },
  {
    id: 'g4-lang-alpha-1',
    type: 'ordering',
    category: 'Γλώσσα',
    title: 'Αλφαβητική σειρά',
    body: 'Βάλε τις λέξεις σε αλφαβητική σειρά.',
    items: [
      { id: 'thalassa', content: 'θάλασσα' },
      { id: 'theatro', content: 'θέατρο' },
      { id: 'thirio', content: 'θηρίο' },
      { id: 'thoryvos', content: 'θόρυβος' },
    ],
    stars: 1,
  },
];

const POOLS_BY_GRADE: Record<number, Exercise[]> = {
  2: GRADE_2_POOL,
  4: GRADE_4_POOL,
};

class HardcodedPoolProvider implements ExercisePoolProvider {
  async getPoolForUser(userId: string): Promise<Exercise[]> {
    const grade = USER_GRADES[userId];
    if (!grade) return [];
    return POOLS_BY_GRADE[grade] || [];
  }

  async getExerciseById(exerciseId: string): Promise<Exercise | undefined> {
    for (const pool of Object.values(POOLS_BY_GRADE)) {
      const found = pool.find(e => e.id === exerciseId);
      if (found) return found;
    }
    return undefined;
  }
}

// The active provider. Swap this instance to change where exercises come from.
export const exercisePoolProvider: ExercisePoolProvider = new HardcodedPoolProvider();
