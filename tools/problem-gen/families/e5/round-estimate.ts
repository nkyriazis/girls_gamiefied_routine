// Estimate a sum or a difference of large numbers by rounding, then compute it exactly and
// compare (Ε΄ κεφ. 1.7 «Στρογγυλοποίηση στους φυσικούς αριθμούς»: «Η Αγγελική υπολόγισε ότι
// το άθροισμα 5.134 + 6.237 είναι περίπου 11.000»).
import { extra, fmt, known, people, sought, type Family, type Person } from '../../lib.ts';
import type { ProblemStep } from '../../../../shared/types.ts';

interface Setting {
  title: string;
  a: [number, number];
  b: [number, number];
  /** The two numbers in a sentence; a and b are already marked. */
  intro: (a: string, b: string, p: Person, q: Person) => string;
  a1: (n: string) => string; // "1.234 κουτάκια"
  noise: (n: () => number) => string;
  sum: string;
  diff: (p: Person) => string;
  exact: string;
  unit: string;
}

const SETTINGS: Setting[] = [
  {
    title: 'Η ανακύκλωση', a: [1_500, 9_800], b: [1_500, 9_800], unit: 'κουτάκια',
    intro: (a, b, p, q) => `Στον διαγωνισμό ανακύκλωσης, το σχολείο ${p.gen} μάζεψε ${a} και το σχολείο ${q.gen} ${b}.`,
    a1: n => `${n} κουτάκια αλουμινίου`,
    noise: n => `Ο διαγωνισμός κράτησε ${n()} εβδομάδες`,
    sum: 'Περίπου πόσα κουτάκια μάζεψαν τα δύο σχολεία μαζί', diff: p => `Περίπου πόσα περισσότερα κουτάκια μάζεψε το σχολείο ${p.gen}`,
    exact: 'Πόσα ακριβώς',
  },
  {
    title: 'Η συναυλία', a: [12_000, 48_000], b: [12_000, 48_000], unit: 'θεατές',
    intro: (a, b) => `Σε μια συναυλία στο στάδιο ήρθαν ${a} την πρώτη βραδιά και ${b} τη δεύτερη.`,
    a1: n => `${n} θεατές`,
    noise: n => `Κάθε βραδιά η συναυλία κράτησε ${2 + (n() % 3)} ώρες`,
    sum: 'Περίπου πόσοι θεατές ήρθαν και τις δύο βραδιές', diff: () => 'Περίπου πόσοι περισσότεροι θεατές ήρθαν την πρώτη βραδιά',
    exact: 'Πόσοι ακριβώς',
  },
  {
    title: 'Τα χιλιόμετρα του φορτηγού', a: [3_000, 9_800], b: [3_000, 9_800], unit: 'χιλιόμετρα',
    intro: (a, b, p) => `Ο πατέρας ${p.gen} οδηγεί φορτηγό. Τον Μάρτιο ταξίδεψε ${a} και τον Απρίλιο ${b}.`,
    a1: n => `${n} χιλιόμετρα`,
    noise: n => `Μεταφέρει φρούτα σε ${n()} πόλεις`,
    sum: 'Περίπου πόσα χιλιόμετρα ταξίδεψε και τους δύο μήνες', diff: () => 'Περίπου πόσα περισσότερα χιλιόμετρα ταξίδεψε τον Μάρτιο',
    exact: 'Πόσα ακριβώς',
  },
  {
    title: 'Οι δύο πόλεις', a: [12_000, 95_000], b: [12_000, 95_000], unit: 'κάτοικοι',
    intro: (a, b) => `Μια πόλη έχει ${a} και μια γειτονική της πόλη ${b}.`,
    a1: n => `${n} κατοίκους`,
    noise: n => `Οι δύο πόλεις απέχουν ${n() * 4} χιλιόμετρα`,
    sum: 'Περίπου πόσους κατοίκους έχουν οι δύο πόλεις μαζί', diff: () => 'Περίπου πόσους περισσότερους κατοίκους έχει η πρώτη πόλη',
    exact: 'Πόσους ακριβώς',
  },
  {
    title: 'Οι βιβλιοθήκες', a: [8_000, 38_000], b: [1_200, 6_000], unit: 'βιβλία',
    intro: (a, b, p) => `Η δημοτική βιβλιοθήκη έχει ${a} και η βιβλιοθήκη του σχολείου ${p.gen} ${b}.`,
    a1: n => `${n} βιβλία`,
    noise: n => `Η βιβλιοθήκη του σχολείου είναι ανοιχτή ${Math.min(5, n())} ημέρες την εβδομάδα`,
    sum: 'Περίπου πόσα βιβλία έχουν οι δύο βιβλιοθήκες μαζί', diff: () => 'Περίπου πόσα περισσότερα βιβλία έχει η δημοτική βιβλιοθήκη',
    exact: 'Πόσα ακριβώς',
  },
];

export const roundEstimate: Family = {
  id: 'round-estimate',
  grade: 5,
  chapter: '1.7',
  topic: 'Αριθμοί',
  source: 'Μαθηματικά Ε΄, κεφ. 1.7 «Στρογγυλοποίηση στους φυσικούς αριθμούς»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const [p, q, k] = people(r, 3);
    let a = r.int(...s.a), c = r.int(...s.b);
    const add = r.chance(0.5);
    if (!add && a < c) [a, c] = [c, a];
    const P = a >= 20_000 && c >= 20_000 && r.chance(0.5) ? 10_000 : 1_000;
    const place = P === 1_000 ? 'στις χιλιάδες' : 'στις δεκάδες χιλιάδες';
    const rnd = (n: number) => Math.round(n / P) * P;
    const ra = rnd(a), rc = rnd(c);
    const est = add ? ra + rc : ra - rc;
    const exact = add ? a + c : a - c;
    if (est <= 0 || exact <= 0 || ra === a || rc === c) return null;
    const op = add ? '+' : '−';

    // A claim to judge: the right estimate, or one a step off
    const claimTelling = r.chance(0.35);
    const claim = r.chance(0.5) ? est : est + (r.chance(0.5) || est - P <= 0 ? P : -P);
    const question = add ? s.sum : s.diff(p);
    const intro = s.intro(known(s.a1(fmt(a))), known(fmt(c)), p, q);
    const noise = `${extra(s.noise(() => r.int(3, 9)))}.`;
    // «Ο πατέρας της Σοφίας οδηγεί φορτηγό… Ο Στέλιος στρογγυλοποίησε…»: two subjects, so the claim's question names him
    const father = /^Ο πατέρας/.test(intro);
    const story = claimTelling
      ? `${intro} ${noise} ${k.Nom} στρογγυλοποίησε ${place} και ${known(`υπολόγισε ότι ${add ? 'μαζί είναι' : 'η διαφορά είναι'} περίπου ${fmt(claim)}`)}. ${sought(`Έχει δίκιο${father ? ` ${k.nom}` : ''}`)}; ${sought(add ? 'Ποιο είναι ακριβώς το άθροισμα' : 'Ποια είναι ακριβώς η διαφορά')};`
      : r.chance(0.5)
        ? `${intro} ${noise} ${sought(question)}, αν στρογγυλοποιήσουμε ${place}; ${sought(s.exact)};`
        : `${sought(question)}, αν στρογγυλοποιήσουμε ${place}; ${sought(s.exact)}; ${intro} ${noise}`;

    const rounding = b.numbers('plan', `Στρογγυλοποιούμε ${place}.`, [
      { label: `Το ${fmt(a)}`, answer: ra },
      { label: `Το ${fmt(c)}`, answer: rc },
      // (the rounded numbers are the rows above: named, not written)
      { label: r.chance(0.5) ? `Περίπου: ${op === '+' ? 'το άθροισμά' : 'η διαφορά'} τους` : 'Εκτίμηση', answer: est },
    ], `Κοιτάμε το ψηφίο δεξιά από ${P === 1_000 ? 'τις χιλιάδες (τις εκατοντάδες)' : 'τις δεκάδες χιλιάδες (τις χιλιάδες)'}: αν είναι 5 ή μεγαλύτερο, ανεβαίνουμε.`);
    const exactStep = b.numbers('solve', 'Υπολογίζουμε ακριβώς.', [
      { label: r.chance(0.5) ? `${fmt(a)} ${op} ${fmt(c)} =` : (add ? 'Ακριβώς μαζί' : 'Ακριβώς η διαφορά'), answer: exact, unit: s.unit },
    ], add ? 'Προσθέτουμε θέση προς θέση και προσέχουμε τα κρατούμενα.' : 'Αφαιρούμε θέση προς θέση και προσέχουμε τα δανεικά.');

    const steps: ProblemStep[] = [b.tag(undefined, 'Το «περίπου» και το «ακριβώς» είναι δύο ερωτήσεις. Ό,τι δεν αλλάζει τους αριθμούς δεν χρειάζεται.'), rounding];
    if (claimTelling) {
      const off = claim + (claim === est ? (r.chance(0.5) ? P : -P) : (claim > est ? P : -P));
      steps.push(claim === est
        ? b.choice('solve', `Έχει δίκιο ${k.nom};`, 'Ναι, είναι περίπου τόσο', [`Όχι, είναι περίπου ${fmt(off)}`, `Όχι, ακριβώς ${fmt(est)}`],
          `Συγκρίνουμε τη δική μας εκτίμηση με τη δική ${k.his}.`)
        : b.choice('solve', `Έχει δίκιο ${k.nom};`, `Όχι, είναι περίπου ${fmt(est)}`, ['Ναι, είναι περίπου τόσο', `Όχι, είναι περίπου ${fmt(off)}`],
          `Συγκρίνουμε τη δική μας εκτίμηση με τη δική ${k.his}.`));
    }
    steps.push(exactStep);
    const gap = Math.abs(exact - est);
    const wrongExact = exact + P * 10;
    steps.push(r.chance(0.5)
      ? b.numbers('check', 'Αναστοχαζόμαστε: πόσο απέχει η ακριβής απάντηση από την εκτίμηση;', [
        { label: exact >= est ? `${fmt(exact)} − ${fmt(est)} =` : `${fmt(est)} − ${fmt(exact)} =`, answer: gap },
      ], 'Από τον μεγαλύτερο αριθμό βγάζουμε τον μικρότερο. Μια μικρή διαφορά δείχνει ότι δεν κάναμε μεγάλο λάθος.')
      : b.choice('check', `Κάποιος βρήκε ακριβώς ${fmt(wrongExact)}. Πώς καταλαβαίνουμε αμέσως ότι έκανε λάθος;`,
        `Απέχει πολύ από το ${fmt(est)}`,
        [['Δεν φαίνεται χωρίς πράξη', 'Δεν φαίνεται αμέσως', 'Δεν φαίνεται χωρίς τις πράξεις'],
          [`Είναι μεγαλύτερο από το ${fmt(Math.min(a, c))}`, `Είναι πάνω από ${fmt(Math.min(a, c))}`, `Είναι μεγαλύτερο από ${fmt(Math.min(a, c))}`]],
        'Η εκτίμηση μας λέει περίπου πόσο πρέπει να βγει η ακριβής απάντηση.'));
    return { title: s.title, story, steps };
  },
};
