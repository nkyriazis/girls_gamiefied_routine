// A table of large numbers in the story (visitors per year, cars per month): add or compare
// two of its rows; the other rows are there but not needed (Ε΄ κεφ. 2.8, the visitors of
// the Acropolis Museum).
import { cap, extra, fmt, known, people, sought, type Family, type Person } from '../../lib.ts';
import type { ProblemStep } from '../../../../shared/types.ts';

// "2021" / "το 2021", "Ιούνιος" / "τον Ιούνιο"; w: how busy that period is (2020 had few visitors, August many)
interface Period { row: string; at: string; w: number }

const YEARS: Period[] = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].map(y => ({ row: String(y), at: `το ${y}`, w: y === 2020 ? 0.35 : y === 2021 ? 0.6 : 1 }));
const month = (row: string, acc: string, w: number): Period => ({ row, at: `τον ${acc}`, w });
const SUMMER: Period[] = [
  month('Μάιος', 'Μάιο', 0.55), month('Ιούνιος', 'Ιούνιο', 0.8), month('Ιούλιος', 'Ιούλιο', 1),
  month('Αύγουστος', 'Αύγουστο', 1), month('Σεπτέμβριος', 'Σεπτέμβριο', 0.75), month('Οκτώβριος', 'Οκτώβριο', 0.5),
];
const WINTER: Period[] = [
  month('Ιανουάριος', 'Ιανουάριο', 0.75), month('Φεβρουάριος', 'Φεβρουάριο', 0.75), month('Μάρτιος', 'Μάρτιο', 0.85),
  month('Απρίλιος', 'Απρίλιο', 0.9), month('Μάιος', 'Μάιο', 1), month('Ιούνιος', 'Ιούνιο', 1),
];

interface Setting {
  title: string;
  periods: Period[];
  range: [number, number];
  unit: string; // "επισκέπτες", for the answer rows
  /** Ways of opening the story with the table in it. */
  open: ((rows: string, p: Person) => string)[];
  /** One row as a phrase in a sentence: "245.301 επισκέπτες το 2019" (first) or "198.004 το 2020". */
  phrase: (n: string, at: string, first: boolean) => string;
  sum: (a: string, b: string) => string;
  diff: (big: string, small: string) => string;
  /** "Ποια χρονιά είχε περισσότερους επισκέπτες, το 2021 ή το 2023" */
  which: (a: string, b: string) => string;
  whichPrompt: string;
  label: (a: string, b: string) => string; // "Επισκέπτες το 2021 και το 2022"
  diffLabel: string;
}

const SETTINGS: Setting[] = [
  {
    title: 'Οι επισκέπτες του μουσείου', periods: YEARS, range: [120_000, 480_000], unit: 'επισκέπτες',
    open: [
      rows => `Ο πίνακας δείχνει πόσους επισκέπτες είχε ένα μουσείο κάθε χρονιά: ${rows}.`,
      rows => `Ένα μουσείο μετράει κάθε χρονιά τους επισκέπτες του. Είχε ${rows}.`,
      (rows, p) => `${p.Nom} βρήκε στο διαδίκτυο πόσους επισκέπτες είχε κάθε χρονιά το μουσείο της πόλης ${p.his}: ${rows}.`,
    ],
    phrase: (n, at, first) => first ? `${n} επισκέπτες ${at}` : `${n} ${at}`,
    sum: (a, b) => `Πόσους επισκέπτες είχε το μουσείο ${a} και ${b} μαζί`,
    diff: (big, small) => `Πόσους περισσότερους επισκέπτες είχε ${big} από ${small}`,
    which: (a, b) => `Ποια χρονιά είχε περισσότερους επισκέπτες, ${a} ή ${b}, και πόσους περισσότερους`,
    whichPrompt: 'Ποια χρονιά είχε περισσότερους επισκέπτες;',
    label: (a, b) => `Επισκέπτες ${a} και ${b}`, diffLabel: 'Περισσότεροι επισκέπτες'
  },
  {
    title: 'Τα διόδια', periods: SUMMER, range: [150_000, 460_000], unit: 'αυτοκίνητα',
    open: [
      rows => `Ο πίνακας δείχνει πόσα αυτοκίνητα πέρασαν από ένα σταθμό διοδίων κάθε μήνα: ${rows}.`,
      rows => `Σε ένα σταθμό διοδίων μετρούν τα αυτοκίνητα που περνούν. Πέρασαν ${rows}.`,
      (rows, p) => `Ο θείος ${p.gen} δουλεύει σε ένα σταθμό διοδίων. ${cap(p.his)} έδειξε πόσα αυτοκίνητα πέρασαν κάθε μήνα: ${rows}.`,
    ],
    phrase: (n, at, first) => first ? `${n} αυτοκίνητα ${at}` : `${n} ${at}`,
    sum: (a, b) => `Πόσα αυτοκίνητα πέρασαν ${a} και ${b} μαζί`,
    diff: (big, small) => `Πόσα περισσότερα αυτοκίνητα πέρασαν ${big} από ${small}`,
    which: (a, b) => `Ποιον μήνα πέρασαν περισσότερα αυτοκίνητα, ${a} ή ${b}, και πόσα περισσότερα`,
    whichPrompt: 'Ποιον μήνα πέρασαν περισσότερα αυτοκίνητα;',
    label: (a, b) => `Αυτοκίνητα ${a} και ${b}`, diffLabel: 'Περισσότερα αυτοκίνητα'
  },
  {
    title: 'Οι επιβάτες του λιμανιού', periods: SUMMER, range: [60_000, 320_000], unit: 'επιβάτες',
    open: [
      rows => `Ο πίνακας δείχνει πόσοι επιβάτες ταξίδεψαν από ένα λιμάνι κάθε μήνα: ${rows}.`,
      rows => `Από ένα λιμάνι των Κυκλάδων ταξίδεψαν ${rows}.`,
      (rows, p) => `${p.Nom} διάβασε στην εφημερίδα πόσοι επιβάτες ταξίδεψαν από το λιμάνι του νησιού ${p.his}: ${rows}.`,
    ],
    phrase: (n, at, first) => first ? `${n} επιβάτες ${at}` : `${n} ${at}`,
    sum: (a, b) => `Πόσοι επιβάτες ταξίδεψαν ${a} και ${b} μαζί`,
    diff: (big, small) => `Πόσοι περισσότεροι επιβάτες ταξίδεψαν ${big} από ${small}`,
    which: (a, b) => `Ποιον μήνα ταξίδεψαν περισσότεροι επιβάτες, ${a} ή ${b}, και πόσοι περισσότεροι`,
    whichPrompt: 'Ποιον μήνα ταξίδεψαν περισσότεροι επιβάτες;',
    label: (a, b) => `Επιβάτες ${a} και ${b}`, diffLabel: 'Περισσότεροι επιβάτες'
  },
  {
    title: 'Τα εισιτήρια του ζωολογικού κήπου', periods: YEARS, range: [80_000, 360_000], unit: 'εισιτήρια',
    open: [
      rows => `Ο πίνακας δείχνει πόσα εισιτήρια πούλησε ένας ζωολογικός κήπος κάθε χρονιά: ${rows}.`,
      rows => `Ένας ζωολογικός κήπος πούλησε ${rows}.`,
      (rows, p) => `${p.Nom} ρώτησε στο ταμείο του ζωολογικού κήπου πόσα εισιτήρια πουλήθηκαν κάθε χρονιά. ${cap(p.his)} είπαν: ${rows}.`,
    ],
    phrase: (n, at, first) => first ? `${n} εισιτήρια ${at}` : `${n} ${at}`,
    sum: (a, b) => `Πόσα εισιτήρια πουλήθηκαν ${a} και ${b} μαζί`,
    diff: (big, small) => `Πόσα περισσότερα εισιτήρια πουλήθηκαν ${big} από ${small}`,
    which: (a, b) => `Ποια χρονιά πουλήθηκαν περισσότερα εισιτήρια, ${a} ή ${b}, και πόσα περισσότερα`,
    whichPrompt: 'Ποια χρονιά πουλήθηκαν περισσότερα εισιτήρια;',
    label: (a, b) => `Εισιτήρια ${a} και ${b}`, diffLabel: 'Περισσότερα εισιτήρια'
  },
  {
    title: 'Το εργοστάσιο εμφιάλωσης', periods: WINTER, range: [200_000, 480_000], unit: 'μπουκάλια',
    open: [
      rows => `Ο πίνακας δείχνει πόσα μπουκάλια νερό γέμισε ένα εργοστάσιο εμφιάλωσης κάθε μήνα: ${rows}.`,
      rows => `Ένα εργοστάσιο εμφιάλωσης γέμισε ${rows}.`,
      (rows, p) => `Η τάξη ${p.gen} επισκέφτηκε ένα εργοστάσιο εμφιάλωσης. Εκεί τα παιδιά είδαν πόσα μπουκάλια νερό γέμισε κάθε μήνα: ${rows}.`,
    ],
    phrase: (n, at, first) => first ? `${n} μπουκάλια νερό ${at}` : `${n} ${at}`,
    sum: (a, b) => `Πόσα μπουκάλια γέμισε το εργοστάσιο ${a} και ${b} μαζί`,
    diff: (big, small) => `Πόσα περισσότερα μπουκάλια γέμισε ${big} από ${small}`,
    which: (a, b) => `Ποιον μήνα γέμισε περισσότερα μπουκάλια, ${a} ή ${b}, και πόσα περισσότερα`,
    whichPrompt: 'Ποιον μήνα γέμισε περισσότερα μπουκάλια;',
    label: (a, b) => `Μπουκάλια ${a} και ${b}`, diffLabel: 'Περισσότερα μπουκάλια'
  },
];

const round10k = (n: number) => Math.round(n / 10_000) * 10_000;

export const bigTable: Family = {
  id: 'big-table',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, κεφ. 2.8 «Η πρόσθεση και η αφαίρεση στους φυσικούς αριθμούς» (οι επισκέπτες του Μουσείου της Ακρόπολης)',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const [p] = people(r, 1);
    const n = r.int(4, 5);
    const start = r.int(0, s.periods.length - n);
    const periods = s.periods.slice(start, start + n);
    const values = periods.map(q => Math.round(r.int(...s.range) * q.w));
    if (new Set(values.map(v => Math.floor(v / 1000))).size < n) return null;
    const [i, j] = r.sample([...Array(n).keys()], 2).sort((x, y) => x - y);
    const a = values[i], c = values[j];
    const kind = r.pick(['sum', 'diff', 'which'] as const);
    if (kind !== 'sum' && Math.abs(a - c) < 5_000) return null;
    const big = a > c ? i : j, small = a > c ? j : i;
    const hi = values[big], lo = values[small];

    const tellingAt = r.int(0, s.open.length - 1);
    const table = tellingAt === 1
      ? periods.map((q, k) => s.phrase(fmt(values[k]), q.at, k === 0))
      : periods.map((q, k) => `${q.row}: ${fmt(values[k])}`);
    const rows = table.map((t, k) => (k === i || k === j ? known(t) : extra(t))).join(', ');
    const question = kind === 'sum' ? s.sum(periods[i].at, periods[j].at)
      : kind === 'diff' ? s.diff(periods[big].at, periods[small].at)
        : s.which(periods[i].at, periods[j].at);
    const story = `${s.open[tellingAt](rows, p)} ${sought(question)};`;

    const sum = a + c;
    const diff = hi - lo;
    const named = r.chance(0.5);
    const steps: ProblemStep[] = [b.tag(undefined, 'Από τον πίνακα χρειαζόμαστε μόνο όσα ρωτάει η ερώτηση. Τα άλλα τα αφήνουμε.')];
    if (kind === 'sum') {
      if (r.chance(0.5)) {
        steps.push(b.choice('plan', 'Ποια πράξη κάνουμε;', `Πρόσθεση μόνο των δύο αριθμών: ${fmt(a)} + ${fmt(c)}`,
          ['Πρόσθεση όλων των αριθμών του πίνακα', `Αφαίρεση: ${fmt(Math.max(a, c))} − ${fmt(Math.min(a, c))}`],
          `Η ερώτηση λέει «μαζί» και ρωτάει μόνο για ${periods[i].at} και ${periods[j].at}.`));
      }
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        { label: named ? s.label(periods[i].at, periods[j].at) : `${fmt(a)} + ${fmt(c)} =`, answer: sum, unit: s.unit },
      ], 'Προσθέτουμε κάθε θέση με τη σειρά, από τις μονάδες προς τα αριστερά, και προσέχουμε τα κρατούμενα.'));
      steps.push(r.chance(0.5)
        ? b.numbers('check', 'Πώς ελέγχουμε; Από το άθροισμα βγάζουμε τον έναν προσθετέο.', [{ label: `${fmt(sum)} − ${fmt(c)} =`, answer: a }],
          `Αν βρούμε πάλι το ${fmt(a)}, η πρόσθεση είναι σωστή.`)
        : b.choice('check', 'Αναστοχαζόμαστε: είναι λογική η απάντηση;', `Ναι: περίπου ${fmt(round10k(a))} + ${fmt(round10k(c))} = ${fmt(round10k(a) + round10k(c))}`,
          [`Όχι: πρέπει να είναι περίπου ${fmt((round10k(a) + round10k(c)) * 10)}`, `Όχι: πρέπει να είναι λιγότερο από ${fmt(Math.max(a, c))}`],
          'Στρογγυλοποιούμε τους δύο αριθμούς στις δεκάδες χιλιάδες και τους προσθέτουμε με το μυαλό.'));
    } else {
      if (kind === 'which') {
        const top = values.indexOf(Math.max(...values));
        steps.push(b.choice('solve', s.whichPrompt, cap(periods[big].at), [cap(periods[small].at), ...(top !== i && top !== j ? [cap(periods[top].at)] : [])],
          'Συγκρίνουμε πρώτα τις εκατοντάδες χιλιάδες, μετά τις δεκάδες χιλιάδες, και ούτω καθεξής.'));
      } else if (r.chance(0.5)) {
        steps.push(b.choice('plan', 'Ποια πράξη κάνουμε;', `Αφαίρεση: ${fmt(hi)} − ${fmt(lo)}`,
          [`Πρόσθεση: ${fmt(hi)} + ${fmt(lo)}`, `Αφαίρεση: ${fmt(lo)} − ${fmt(hi)}`],
          'Για να βρούμε πόσο μεγαλύτερος είναι ένας αριθμός από έναν άλλον, κάνουμε αφαίρεση: από τον μεγαλύτερο βγάζουμε τον μικρότερο.'));
      }
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        { label: named ? s.diffLabel : `${fmt(hi)} − ${fmt(lo)} =`, answer: diff, unit: s.unit },
      ], `Από το ${fmt(hi)} αφαιρούμε το ${fmt(lo)}, θέση προς θέση, και προσέχουμε τα δανεικά.`));
      steps.push(r.chance(0.5)
        ? b.numbers('check', 'Πώς ελέγχουμε; Προσθέτουμε τη διαφορά στον μικρότερο αριθμό.', [{ label: `${fmt(diff)} + ${fmt(lo)} =`, answer: hi }],
          `Πρέπει να βρούμε τον μεγαλύτερο αριθμό, το ${fmt(hi)}.`)
        : b.choice('check', `Κάποιος απάντησε «${fmt(hi + lo)}». Τι έκανε λάθος;`, 'Πρόσθεσε αντί να αφαιρέσει',
          ['Τίποτα, είναι σωστό', `Πήρε λάθος ${s.periods === YEARS ? 'χρονιά' : 'μήνα'} από τον πίνακα`],
          `Το ${fmt(hi + lo)} είναι το άθροισμα των δύο αριθμών. Η ερώτηση όμως ζητάει τη διαφορά τους.`));
    }
    return { title: s.title, story, steps };
  },
};
