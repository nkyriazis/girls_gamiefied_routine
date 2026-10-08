// The books the daily exercises follow, one table for the server, the parents' page and
// tools/problem-gen (#71): per grade and subject, the chapters (maths) and lessons (language) in
// book order, each with the week the class is likely to start it.
//
// An item of the pools names its chapter or lesson by `id` (Exercise.chapter): the maths book's
// chapter number («12», «2.12»; word problems take the maths chapters), the language book's
// «unit.lesson» («2.3»; «2.0» is the unit's Λεξιλόγιο). A kid's set draws only from what her class
// has reached: everything up to her position in book order (ConfigUser.progress, set by a parent),
// or, unset, up to where the pace below puts the class today (paceAt). A lesson `pinned` to a
// holiday (Γ΄ unit 5) is outside that order: it is reached once its week has come.
//
// `start` is the Monday (month-day) of the week a chapter likely starts in, an estimate, not a
// plan: the school year's teaching days (11 September to 15 June, weekends, Christmas, Easter and
// the holidays of 2026–27 out) shared out in book order, by the teacher's books' hours where they
// give them:
//   - Μαθηματικά Γ΄ (10-0064): no hours given, so an even pace over the book's 59 chapters (21 and 39
//     have no entry here). Only the parent's setting makes it right for a class.
//   - Μαθηματικά Ε΄ (10-0213, p. 10): 2 hours a chapter, and 2 for each unit's Επαναληπτικό.
//   - Γλώσσα Γ΄ (10-0053): the hours of each unit, shared evenly by its lessons (the second volume
//     counts in the year, though none of its lessons is here); unit 5's lessons pinned to 28 October
//     and 17 November.
//   - Γλώσσα Ε΄ (10-0115): units 1–2 between the start and 28 October (unit 3 is the holiday's).
// A start is month-day only: the same table serves every year.

export type CurriculumGrade = 3 | 5;
export type Subject = 'maths' | 'language';
export const SUBJECTS: Subject[] = ['maths', 'language'];

export interface Chapter {
  id: string;
  unit: number;
  /** «MM-DD»: the Monday of the week the class likely starts it. */
  start: string;
  title: string;
  /** A holiday's lesson: reached once its week has come, wherever the class is in the book. */
  pinned?: true;
}

export interface Book {
  /** «Μαθηματικά Γ΄» */
  label: string;
  unitTitles?: Record<number, string>;
  chapters: Chapter[];
}

type Row = [id: string, unit: number, start: string, title: string, pinned?: true];
const rows = (list: Row[]): Chapter[] => list.map(([id, unit, start, title, pinned]) => ({ id, unit, start, title, ...(pinned ? { pinned } : {}) }));

export const CURRICULUM: Record<CurriculumGrade, Record<Subject, Book>> = {
  3: {
    maths: {
      label: 'Μαθηματικά Γ΄',
      chapters: rows([
      // Ενότητα 1
      ['1', 1, '09-11', 'Αριθμοί μέχρι το 1.000'],
      ['2', 1, '09-14', 'Προσθέσεις διψήφιων και τριψήφιων αριθμών'],
      ['3', 1, '09-14', 'Γεωμετρικά σχήματα και στερεά σώματα'],
      ['4', 1, '09-21', 'Πολλαπλασιασμός, προπαίδεια (Ι)'],
      ['5', 1, '09-28', 'Πολλαπλασιασμός, προπαίδεια (ΙΙ)'],
      ['6', 1, '09-28', 'Πολλαπλασιασμός και διαίρεση'],
      ['7', 1, '10-05', 'Επαναληπτικό μάθημα'],
      // Ενότητα 2
      ['8', 2, '10-05', 'Μέτρηση μηκών με εκατοστά και χιλιοστά'],
      ['9', 2, '10-12', 'Στερεά σώματα - Αναπτύγματα'],
      ['10', 2, '10-19', 'Αφαιρέσεις διψήφιων και τριψήφιων αριθμών'],
      ['11', 2, '10-19', 'Πολλαπλασιασμός διψήφιου με μονοψήφιο αριθμό'],
      ['12', 2, '10-26', 'Προβλήματα'],
      ['13', 2, '11-02', 'Επαναληπτικό μάθημα'],
      // Ενότητα 3
      ['14', 3, '11-02', 'Αριθμοί μέχρι το 3.000'],
      ['15', 3, '11-09', 'Προσθέσεις και αφαιρέσεις τριψήφιων αριθμών'],
      ['16', 3, '11-09', 'Χαράξεις με διαβήτη και χάρακα. Ορθές γωνίες'],
      ['17', 3, '11-16', 'Πολλαπλασιασμοί'],
      ['18', 3, '11-23', 'Διαιρέσεις'],
      ['19', 3, '11-23', 'Προβλήματα'],
      ['20', 3, '11-30', 'Επαναληπτικό μάθημα'],
      // Ενότητα 4
      ['22', 4, '12-07', 'Εισαγωγή στα κλάσματα'],
      ['23', 4, '12-14', 'Οι κλασματικές μονάδες'],
      ['24', 4, '12-14', 'Οι κλασματικές μονάδες και οι απλοί κλασματικοί αριθμοί'],
      ['25', 4, '12-21', 'Ισοδύναμα κλάσματα'],
      ['26', 4, '01-11', 'Επαναληπτικό μάθημα'],
      // Ενότητα 5
      ['27', 5, '01-11', 'Προσθέσεις και αφαιρέσεις με τετραψήφιους αριθμούς'],
      ['28', 5, '01-18', 'Προς τον πολλαπλασιασμό (Ι)'],
      ['29', 5, '01-18', 'Προς τον πολλαπλασιασμό (ΙΙ)'],
      ['30', 5, '01-25', 'Ο αλγόριθμος του πολλαπλασιασμού'],
      ['31', 5, '01-25', 'Προβλήματα'],
      ['32', 5, '02-01', 'Επαναληπτικό μάθημα'],
      // Ενότητα 6
      ['33', 6, '02-08', 'Πολλαπλασιασμός και διαίρεση με το 10, το 100 και το 1.000'],
      ['34', 6, '02-08', 'Δεκαδικά κλάσματα'],
      ['35', 6, '02-15', 'Δεκαδικά κλάσματα και δεκαδικοί αριθμοί'],
      ['36', 6, '02-15', 'Δεκαδικοί αριθμοί'],
      ['37', 6, '02-22', 'Πρόσθεση και αφαίρεση με δεκαδικούς αριθμούς'],
      ['38', 6, '03-01', 'Επαναληπτικό μάθημα'],
      // Ενότητα 7
      ['40', 7, '03-08', 'Αριθμοί μέχρι το 7.000'],
      ['41', 7, '03-08', 'Μέτρηση μάζας'],
      ['42', 7, '03-15', 'Παζλ, πλακόστρωτα και μωσαϊκά'],
      ['43', 7, '03-22', 'Η συμμετρία'],
      ['44', 7, '03-29', 'Προβλήματα'],
      ['45', 7, '03-29', 'Επαναληπτικό μάθημα'],
      // Ενότητα 8
      ['46', 8, '04-05', 'Πολλαπλασιασμοί'],
      ['47', 8, '04-05', 'Διαιρέσεις'],
      ['48', 8, '04-12', 'Μοτίβα'],
      ['49', 8, '04-12', 'Μέτρηση του χρόνου'],
      ['50', 8, '04-19', 'Μέτρηση της επιφάνειας'],
      ['51', 8, '05-10', 'Προβλήματα'],
      ['52', 8, '05-10', 'Επαναληπτικό μάθημα'],
      // Ενότητα 9
      ['53', 9, '05-17', 'Αριθμοί μέχρι το 10.000'],
      ['54', 9, '05-17', 'Επαναληπτικό μάθημα στη γεωμετρία'],
      ['55', 9, '05-24', 'Διαιρέσεις (Ι)'],
      ['56', 9, '05-31', 'Διαιρέσεις (ΙΙ)'],
      ['57', 9, '05-31', 'Κλάσματα και δεκαδικοί'],
      ['58', 9, '06-07', 'Προβλήματα'],
      ['59', 9, '06-07', 'Επαναληπτικό μάθημα'],
      ]),
    },
    language: {
      label: 'Γλώσσα Γ΄',
      unitTitles: {
        1: 'Πάλι μαζί!', 2: 'Στο σπίτι και στη γειτονιά', 3: 'Στη γη και στη θάλασσα',
        4: 'Ο κόσμος γύρω μας', 5: 'Η πατρίδα μας γιορτάζει',
      },
      chapters: rows([
      ['1.1', 1, '09-14', 'Θαλασσινό σχολείο'],
      ['1.2', 1, '09-14', 'Επιστροφή στα θρανία!'],
      ['1.3', 1, '09-21', 'Το σχολείο ταξιδεύει στον χρόνο'],
      ['1.4', 1, '09-21', 'Δημοτικό Σχολείο Τρικάλων Ημαθίας'],
      ['1.5', 1, '09-28', 'Δεν είναι τρελοί οι δίδυμοι!'],
      ['1.6', 1, '09-28', 'Ένα αστείο περιστατικό'],
      ['1.0', 1, '10-05', 'Λεξιλόγιο'],
      ['2.1', 2, '10-05', 'Αγαπητό μου ημερολόγιο'],
      ['2.2', 2, '10-12', 'Η φίλη μας η Αργυρώ'],
      ['2.3', 2, '10-12', 'Τα παιδικά μου παιχνίδια'],
      ['2.4', 2, '10-19', 'Στη νέα μας γειτονιά'],
      ['2.0', 2, '10-26', 'Λεξιλόγιο'],
      ['3.1', 3, '10-26', 'Σπίτι με κήπον'],
      ['3.2', 3, '11-02', 'Γάτος από σπίτι ζητά νέα οικογένεια'],
      ['3.3', 3, '11-02', 'Οι ακροβάτες της θάλασσας'],
      ['3.4', 3, '11-09', 'Γη και θάλασσα'],
      ['3.5', 3, '11-09', 'Οι μικροί ταξιδιώτες ανεβαίνουν στο βουνό'],
      ['3.0', 3, '11-16', 'Λεξιλόγιο'],
      ['4.1', 4, '11-23', 'Πώς υιοθετήσαμε ένα κομμάτι γης'],
      ['4.2', 4, '11-23', 'Τα χαρτιά ανακυκλώνονται!'],
      ['4.3', 4, '11-30', 'Το τετράδιο ζωγραφικής'],
      ['4.0', 4, '12-07', 'Λεξιλόγιο'],
      ['5.1', 5, '10-26', 'Η σημαία', true],
      ['5.2', 5, '10-26', 'Στον πόλεμο του 1940', true],
      ['5.3', 5, '11-16', 'Για το Πολυτεχνείο', true],
      ]),
    },
  },
  5: {
    maths: {
      label: 'Μαθηματικά Ε΄',
      chapters: rows([
      // Ενότητα 1
      ['1.1', 1, '09-11', 'Υπενθύμιση - Α΄ μέρος'],
      ['1.2', 1, '09-14', 'Υπενθύμιση - Β΄ μέρος'],
      ['1.3', 1, '09-14', 'Πώς λύνουμε ένα πρόβλημα'],
      ['1.4', 1, '09-21', 'Οι φυσικοί αριθμοί'],
      ['1.5', 1, '09-28', 'Αξία θέσης ψηφίου στους φυσικούς αριθμούς'],
      ['1.6', 1, '09-28', 'Σύγκριση και διάταξη στους φυσικούς αριθμούς'],
      ['1.7', 1, '10-05', 'Στρογγυλοποίηση στους φυσικούς αριθμούς'],
      // Ενότητα 2
      ['2.8', 2, '10-12', 'Η πρόσθεση και η αφαίρεση στους φυσικούς αριθμούς'],
      ['2.9', 2, '10-12', 'Ο πολλαπλασιασμός στους φυσικούς αριθμούς'],
      ['2.10', 2, '10-19', 'Πολλαπλάσια και διαιρέτες'],
      ['2.11', 2, '10-26', 'Κριτήρια διαιρετότητας'],
      ['2.12', 2, '10-26', 'Η διαίρεση στους φυσικούς αριθμούς'],
      // Ενότητα 3
      ['3.13', 3, '11-09', 'Οι κλασματικοί αριθμοί'],
      ['3.14', 3, '11-09', 'Κλάσματα μεγαλύτερα της ακέραιης μονάδας'],
      ['3.15', 3, '11-16', 'Το κλάσμα ως πηλίκο διαίρεσης'],
      ['3.16', 3, '11-23', 'Ισοδυναμία κλασμάτων – Απλοποίηση κλασμάτων'],
      ['3.17', 3, '11-23', 'Σύγκριση και διάταξη κλασμάτων'],
      ['3.18', 3, '11-30', 'Πρόσθεση και αφαίρεση κλασμάτων'],
      ['3.19', 3, '11-30', 'Πολλαπλασιασμός φυσικού αριθμού ή κλάσματος με κλάσμα – Αντίστροφοι αριθμοί'],
      ['3.20', 3, '12-07', 'Διαίρεση κλασμάτων'],
      ['3.21', 3, '12-07', 'Αναγωγή στην κλασματική μονάδα'],
      // Ενότητα 4
      ['4.22', 4, '12-21', 'Συλλογή, οργάνωση και αναπαράσταση δεδομένων'],
      ['4.23', 4, '01-04', 'Χαρακτηριστικές τιμές δεδομένων – Μέση τιμή'],
      ['4.24', 4, '01-11', 'Πιθανότητες'],
      // Ενότητα 5
      ['5.25', 5, '01-18', 'Δεκαδικά κλάσματα – Δεκαδικοί αριθμοί'],
      ['5.26', 5, '01-25', 'Διάταξη δεκαδικών αριθμών – Αξία θέσης ψηφίου στους δεκαδικούς'],
      ['5.27', 5, '01-25', 'Η στρογγυλοποίηση στους δεκαδικούς αριθμούς'],
      ['5.28', 5, '02-01', 'Πρόσθεση και αφαίρεση με δεκαδικούς αριθμούς'],
      ['5.29', 5, '02-01', 'Ο πολλαπλασιασμός στους δεκαδικούς αριθμούς'],
      ['5.30', 5, '02-08', 'Η διαίρεση στους δεκαδικούς αριθμούς'],
      ['5.31', 5, '02-15', 'Η έννοια του ποσοστού'],
      ['5.32', 5, '02-15', 'Διαφορετικές εκφράσεις των αριθμών'],
      // Ενότητα 6
      ['6.33', 6, '02-22', 'Οι αρνητικοί αριθμοί'],
      ['6.34', 6, '03-01', 'Γεωμετρικά και αριθμητικά μοτίβα'],
      ['6.35', 6, '03-01', 'Ισότητες και ανισότητες'],
      // Ενότητα 7
      ['7.36', 7, '03-15', 'Μετράω και σχεδιάζω σε κλίμακες'],
      ['7.37', 7, '03-15', 'Προσανατολισμός στον χώρο'],
      ['7.38', 7, '03-22', 'Είδη γωνιών'],
      ['7.39', 7, '03-29', 'Μέτρηση γωνιών'],
      ['7.40', 7, '03-29', 'Είδη τριγώνων ως προς τις γωνίες'],
      ['7.41', 7, '04-05', 'Είδη τριγώνων ως προς τις πλευρές'],
      ['7.42', 7, '04-05', 'Καθετότητα - Ύψη τριγώνου'],
      ['7.43', 7, '04-12', 'Συμμετρία'],
      ['7.44', 7, '04-19', 'Κύκλος - Μήκος κύκλου'],
      // Ενότητα 8
      ['8.45', 8, '05-10', 'Μονάδες μέτρησης του μήκους'],
      ['8.46', 8, '05-10', 'Γεωμετρικά σχήματα – Η περίμετρος'],
      ['8.47', 8, '05-17', 'Μονάδες μέτρησης της επιφάνειας'],
      ['8.48', 8, '05-17', 'Εμβαδό τετραγώνου, ορθογωνίου και ορθογώνιου τριγώνου'],
      ['8.49', 8, '05-24', 'Γεωμετρικά στερεά – Ο όγκος'],
      ['8.50', 8, '05-31', 'Μονάδες μέτρησης του όγκου και της χωρητικότητας'],
      ['8.51', 8, '05-31', 'Μονάδες μέτρησης της μάζας'],
      ['8.52', 8, '06-07', 'Μονάδες μέτρησης του χρόνου'],
      ]),
    },
    language: {
      label: 'Γλώσσα Ε΄',
      unitTitles: {
        1: 'Ο φίλος μας το περιβάλλον', 2: 'Η ζωή στην πόλη', 3: '28η Οκτωβρίου',
        4: 'Τα ζώα που ζουν κοντά μας', 5: '17η Νοέμβρη', 6: 'Οι φίλοι μας, οι φίλες μας',
      },
      chapters: rows([
      ['1.1', 1, '09-11', 'Ο φίλος μας το δάσος'],
      ['1.2', 1, '09-14', 'Η φίλη μας η θάλασσα'],
      ['1.3', 1, '09-14', 'Ο φίλος μας ο άνεμος'],
      ['1.4', 1, '09-21', 'Τα λουλούδια που φυτρώνουν στο τσιμέντο'],
      ['1.5', 1, '09-21', 'Τα αγριόγιδα της βόρειας Πίνδου'],
      ['1.6', 1, '09-28', 'Πάρτι στη... λάσπη'],
      ['1.7', 1, '09-28', 'Μια ολόκληρη πόλη χρησιμοποιεί ποδήλατο'],
      ['2.1', 2, '10-05', 'Η γειτονιά της πόλης'],
      ['2.2', 2, '10-05', 'Πόλη και πολιτισμός'],
      ['2.3', 2, '10-05', 'Διαδρομές στην πόλη'],
      ['2.4', 2, '10-12', 'Υπόγειες διαδρομές'],
      ['2.5', 2, '10-12', 'Οροβίλ'],
      ['2.6', 2, '10-19', 'Ντίσνεϋλαντ'],
      ['2.7', 2, '10-19', 'Μια σύγχρονη τενεκεδούπολη'],
      ['2.8', 2, '10-19', 'Με το τραμ φανταστικές διαδρομές'],
      ]),
    },
  },
};

/**
 * What an item is about, for a parent to pick (#71 part 2). Word problems take the maths topics, by
 * their main operation. tools/problem-gen gives every item one, and its audit checks it is on this list.
 */
export const TOPICS: Record<Subject, readonly string[]> = {
  maths: ['Αριθμοί', 'Πρόσθεση', 'Αφαίρεση', 'Πολλαπλασιασμός', 'Διαίρεση', 'Μετρήσεις', 'Χρήματα', 'Γεωμετρία', 'Κλάσματα', 'Δεκαδικοί'],
  language: ['Μέρη του λόγου', 'Ουσιαστικά', 'Άρθρα', 'Επίθετα', 'Ρήματα', 'Επιρρήματα', 'Αριθμητικά', 'Ορθογραφία', 'Στίξη', 'Λεξιλόγιο'],
};

/** An item's difficulty, 1 (easy) to 3 (hard); a kid's ConfigUser.difficulty is the most she gets while there is enough. */
export type Difficulty = 1 | 2 | 3;

export const hasCurriculum = (grade?: number): grade is CurriculumGrade => grade === 3 || grade === 5;

/** The book an item's category follows: language for Γλώσσα, maths for the rest (Μαθηματικά, Προβλήματα). */
export const subjectOf = (category: string): Subject => (category === 'Γλώσσα' ? 'language' : 'maths');

/** A month-day's place in the school year, September first: «09-11» before «06-15». */
const inYear = (monthDay: string) => ((Number(monthDay.slice(0, 2)) + 3) % 12) * 100 + Number(monthDay.slice(3, 5));

/** The chapters a class goes through in order: all but the pinned. */
const along = (book: Book) => book.chapters.filter(c => !c.pinned);

/** Where the pace puts the class on `date` (YYYY-MM-DD): the last chapter started by then, else the first. In summer, the last. */
export function paceAt(grade: CurriculumGrade, subject: Subject, date: string): string {
  const today = inYear(date.slice(5, 10));
  const list = along(CURRICULUM[grade][subject]);
  let at = list[0];
  for (const c of list) if (inYear(c.start) <= today) at = c;
  return at.id;
}

/** Whether `id` is a place a parent can set: a chapter of the book, not a pinned one. */
export const isPosition = (grade: CurriculumGrade, subject: Subject, id: string | undefined): id is string =>
  !!id && along(CURRICULUM[grade][subject]).some(c => c.id === id);

/** The class's place on `date`: the parent's, if it is one of the book's; else the pace's. */
export function positionOf(grade: CurriculumGrade, subject: Subject, chosen: string | undefined, date: string): { id: string; pace: boolean } {
  return isPosition(grade, subject, chosen) ? { id: chosen, pace: false } : { id: paceAt(grade, subject, date), pace: true };
}

/**
 * How far past the class an item's chapter is, at `position` on `date`: 0 when reached (up to the
 * position in book order, or a pinned lesson whose week has come), else how many chapters on. An item
 * with no chapter, or one this book doesn't have, counts as reached.
 */
export function chaptersAhead(grade: CurriculumGrade, subject: Subject, position: string, date: string): (chapter?: string) => number {
  const book = CURRICULUM[grade][subject];
  const list = along(book);
  const at = list.findIndex(c => c.id === position);
  const today = inYear(date.slice(5, 10));
  return chapter => {
    const c = book.chapters.find(x => x.id === chapter);
    if (!c) return 0;
    if (c.pinned) return inYear(c.start) <= today ? 0 : 1;
    return Math.max(0, list.indexOf(c) - at);
  };
}

/** «κεφ. 12» (maths), «ενότητα 2, μάθημα 3» or «ενότητα 1, Λεξιλόγιο» (language): a place in a word or two. */
export function placeLabel(subject: Subject, id: string): string {
  if (subject === 'maths') return `κεφ. ${id}`;
  const [unit, n] = id.split('.');
  return `ενότητα ${unit}, ${n === '0' ? 'Λεξιλόγιο' : `μάθημα ${n}`}`;
}
