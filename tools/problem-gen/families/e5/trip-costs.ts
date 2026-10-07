// A trip's costs: fuel, tolls, tickets per person and per trip, nights. Multi-step totals
// with multiplication; what is left of a budget; the share of each (Ε΄ κεφ. 2.8 και 2.9:
// πρόσθεση, αφαίρεση και πολλαπλασιασμός στους φυσικούς αριθμούς).
import type { ProblemStep } from '../../../../shared/types.ts';
import { extra, fmt, known, people, sought, type Family, type Person, type Rng, type Wording } from '../../lib.ts';

// ops: the row's calculation as she reads it, naming a row above by what it is («μία διαδρομή × 2»);
// eq: the same in numbers, for rowsHint, when ops names a row
interface Cost { label: string; ops: string; eq?: string; value: number }
interface Plan {
  /** The sentences with the prices (every number marked) */
  text: string;
  costs: Cost[];
  /** Does the number of travellers matter? */
  perPerson: boolean;
  /** A total with one thing forgotten, what was forgotten, and wrong explanations */
  slip: { value: number; what: string; others: Wording[] };
}

interface Setting {
  title: string[];
  where: string; // "στη Νάξο"
  plan: (r: Rng, n: number) => Plan;
  noise: (r: Rng) => string;
}

const SETTINGS: Setting[] = [
  {
    title: ['Το ταξίδι στη Νάξο', 'Με το πλοίο'], where: 'στη Νάξο με το αυτοκίνητο',
    plan: (r, n) => {
      const t = r.int(25, 45), car = r.step(60, 120, 5);
      return {
        text: `Το εισιτήριο του πλοίου κοστίζει ${known(`${t} € το άτομο`)} και για το αυτοκίνητο ${known(`${car} €`)}, ${known('για κάθε διαδρομή')}. Θα ταξιδέψουν με το πλοίο ${known('και στο πήγαινε και στο έλα')}.`,
        costs: [
          { label: 'Εισιτήρια ατόμων, μία διαδρομή', ops: `${n} × ${t}`, value: n * t },
          { label: 'Αυτοκίνητο και άτομα, μία διαδρομή', ops: `τα εισιτήρια + ${car}`, eq: `${fmt(n * t)} + ${car}`, value: n * t + car },
          { label: 'Πήγαινε και έλα', ops: 'μία διαδρομή × 2', eq: `${fmt(n * t + car)} × 2`, value: 2 * (n * t + car) },
        ],
        perPerson: true,
        slip: { value: n * t + car, what: 'Την επιστροφή', others: [['Το αυτοκίνητο', 'Το αμάξι'], 'Ένα άτομο'] },
      };
    },
    noise: r => `Το ταξίδι με το πλοίο κρατά ${extra(`${r.int(4, 7)} ώρες`)}.`,
  },
  {
    title: ['Το τριήμερο στο χωριό', 'Στο χωριό με το αυτοκίνητο'], where: 'για ένα τριήμερο στο χωριό με το αυτοκίνητο',
    plan: r => {
      const fuel = r.step(50, 120, 5), toll = r.int(4, 15), night = r.step(50, 110, 5);
      return {
        text: `Η βενζίνη θα κοστίσει ${known(`${fuel} €`)}, τα διόδια ${known(`${toll} € για κάθε διαδρομή`)}, ${known('στο πήγαινε και στο έλα')}. Το δωμάτιο στον ξενώνα κοστίζει ${known(`${night} € τη νύχτα`)} για όλη την οικογένεια, και θα μείνουν ${known('2 νύχτες')}.`,
        costs: [
          { label: 'Διόδια', ops: `${toll} × 2`, value: toll * 2 },
          { label: 'Ξενώνας', ops: `${night} × 2`, value: night * 2 },
          { label: 'Όλα μαζί', ops: `${fuel} + διόδια + ξενώνας`, eq: `${fuel} + ${toll * 2} + ${night * 2}`, value: fuel + toll * 2 + night * 2 },
        ],
        perPerson: false,
        slip: { value: fuel + toll + night * 2, what: 'Τα διόδια της επιστροφής', others: [['Τη βενζίνη του γυρισμού', 'Τη βενζίνη ως εκεί', 'Τη βενζίνη για την επιστροφή'], ['Τη δεύτερη νύχτα στο ξενοδοχείο', 'Τη δεύτερη νύχτα στον ξενώνα', 'Τη δεύτερη νύχτα εκεί']] },
      };
    },
    noise: r => `Το χωριό απέχει ${extra(`${r.int(150, 320)} χιλιόμετρα`)}.`,
  },
  {
    title: ['Το λούνα παρκ', 'Μια μέρα στο πάρκο ψυχαγωγίας'], where: 'σε ένα πάρκο ψυχαγωγίας',
    plan: (r, n) => {
      const entry = r.int(18, 35), park = r.int(5, 12), fuel = r.step(20, 50, 5);
      return {
        text: `Η είσοδος κοστίζει ${known(`${entry} € το άτομο`)} και το πάρκινγκ ${known(`${park} €`)} για όλη την ημέρα. Για βενζίνη θα δώσουν ${known(`${fuel} €`)}.`,
        costs: [
          { label: 'Είσοδοι', ops: `${n} × ${entry}`, value: n * entry },
          { label: 'Όλα μαζί', ops: `οι είσοδοι + ${park} + ${fuel}`, eq: `${fmt(n * entry)} + ${park} + ${fuel}`, value: n * entry + park + fuel },
        ],
        perPerson: true,
        slip: { value: (n - 1) * entry + park + fuel, what: 'Την είσοδο ενός ατόμου', others: [['Το πάρκινγκ του αυτοκινήτου', 'Το πάρκινγκ τους'], ['Τη βενζίνη ως εκεί', 'Τη βενζίνη για τη διαδρομή']] },
      };
    },
    noise: r => `Το πάρκο έχει ${extra(`${r.int(25, 60)} παιχνίδια`)}.`,
  },
  {
    title: ['Με το τρένο στη Θεσσαλονίκη', 'Το ταξίδι με το τρένο'], where: 'με το τρένο στη Θεσσαλονίκη',
    plan: (r, n) => {
      const t = r.int(20, 45), mus = r.int(5, 12);
      return {
        text: `Το εισιτήριο του τρένου κοστίζει ${known(`${t} € το άτομο`)} ${known('για κάθε διαδρομή')}, και θα γυρίσουν πάλι με το τρένο. Εκεί θα επισκεφτούν ένα μουσείο με εισιτήριο ${known(`${mus} € το άτομο`)}.`,
        costs: [
          { label: 'Τρένο για ένα άτομο, πήγαινε και έλα', ops: `${t} × 2`, value: t * 2 },
          { label: 'Τρένο για όλους', ops: `${n} × το τρένο του ενός`, eq: `${n} × ${t * 2}`, value: n * t * 2 },
          { label: 'Μουσείο για όλους', ops: `${n} × ${mus}`, value: n * mus },
          { label: 'Όλα μαζί', ops: 'τρένο + μουσείο', eq: `${fmt(n * t * 2)} + ${fmt(n * mus)}`, value: n * t * 2 + n * mus },
        ],
        perPerson: true,
        slip: { value: n * t + n * mus, what: 'Τα εισιτήρια του γυρισμού', others: [['Τα εισιτήρια του μουσείου', 'Το μουσείο για όλους'], 'Ένα άτομο στο μουσείο'] },
      };
    },
    noise: r => `Το τρένο φεύγει ${extra(`στις ${r.int(6, 9)} το πρωί`)}.`,
  },
  {
    title: ['Στο χιονοδρομικό κέντρο', 'Σκι στο βουνό'], where: 'στο χιονοδρομικό κέντρο',
    plan: (r, n) => {
      const pass = r.int(15, 35), days = r.int(2, 3), fuel = r.step(30, 80, 5);
      return {
        text: `Η κάρτα για τους αναβατήρες κοστίζει ${known(`${pass} € την ημέρα για κάθε άτομο`)} και θα κάνουν σκι ${known(`${days} ημέρες`)}. Η βενζίνη θα κοστίσει ${known(`${fuel} €`)}.`,
        costs: [
          { label: 'Κάρτες για μία ημέρα', ops: `${n} × ${pass}`, value: n * pass },
          { label: `Κάρτες για ${days} ημέρες`, ops: `μία ημέρα × ${days}`, eq: `${fmt(n * pass)} × ${days}`, value: n * pass * days },
          { label: 'Όλα μαζί', ops: `οι κάρτες + ${fuel}`, eq: `${fmt(n * pass * days)} + ${fuel}`, value: n * pass * days + fuel },
        ],
        perPerson: true,
        slip: { value: n * pass + fuel, what: `Ότι κάνουν σκι ${days} ημέρες`, others: [['Τη βενζίνη του ταξιδιού', 'Τη βενζίνη ως εκεί'], 'Το πάσο ενός ατόμου'] },
      };
    },
    noise: r => `Το βουνό έχει ύψος ${extra(`${fmt(r.step(1700, 2400, 10))} μέτρα`)}.`,
  },
];

/** The travellers: a family with the parents and siblings, or friends. */
function party(r: Rng, p: Person, friends: boolean): { subject: string; along: string; n: number; forgot: number } {
  if (friends) {
    const k = r.int(2, 5);
    const who = p.female ? `οι ${k} φίλες της` : `οι ${k} φίλοι του`;
    return { subject: `${p.Nom} και ${who} θα πάνε`, along: '', n: k + 1, forgot: k };
  }
  const sib = r.pick([
    { t: p.female ? 'τον μικρό αδερφό της' : 'τον μικρό αδερφό του', k: 1 },
    { t: p.female ? 'τη μικρή αδερφή της' : 'τη μικρή αδερφή του', k: 1 },
    { t: `τα ${2} αδέρφια ${p.his}`, k: 2 },
    { t: `τις ${2} αδερφές ${p.his}`, k: 2 },
    { t: `τα ${3} ξαδέρφια ${p.his}`, k: 3 },
  ]);
  return { subject: `${p.Nom} θα πάει`, along: `με τους γονείς ${p.his} και ${sib.t}`, n: 3 + sib.k, forgot: 2 + sib.k };
}

export const tripCosts: Family = {
  id: 'trip-costs',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, κεφ. 2.8 και 2.9 (πράξεις με φυσικούς αριθμούς), προβλήματα πολλών βημάτων',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const [p] = people(r, 1);
    const ask = r.pick(['total', 'left', 'share'] as const);
    const pt = party(r, p, ask === 'share');
    const pl = s.plan(r, pt.n);
    if (ask === 'share' && !pl.perPerson) return null;
    const total = pl.costs[pl.costs.length - 1].value;
    if (ask === 'share' && total % pt.n !== 0) return null;
    const budget = r.step(total + 20, total + 300, 50);

    // The travellers matter only when something is paid per person
    const mark = (t: string) => (/\d/.test(t) ? (pl.perPerson ? known(t) : extra(t)) : t);
    const intro = pt.along ? `${pt.subject} ${mark(pt.along)} ${s.where}.` : `${mark(pt.subject)} ${s.where}.`;
    const question = ask === 'total'
      ? sought('Πόσα € θα κοστίσει όλο το ταξίδι')
      : ask === 'left'
        ? `Οι γονείς έχουν βάλει στην άκρη ${known(`${fmt(budget)} €`)} για το ταξίδι. ${sought('Πόσα € θα τους περισσέψουν')}`
        : `Τα έξοδα θα τα μοιραστούν εξίσου. ${sought('Πόσα € θα πληρώσει ο καθένας')}`;
    const story = `${intro} ${pl.text} ${s.noise(r)} ${question};`;

    const steps: ProblemStep[] = [
      b.tag(undefined, pl.perPerson
        ? `Μετράμε όλους όσοι ταξιδεύουν: ${ask === 'share' ? `και ${p.acc}` : `και ${p.acc} και τους γονείς`}.`
        : 'Εδώ κάθε τιμή είναι για όλη την οικογένεια: μας νοιάζει πόσες φορές πληρώνεται.'),
    ];
    if (pl.perPerson && r.chance(0.6)) {
      const wrong = [pt.forgot, pt.n + 1, ...(ask === 'share' ? [] : [pt.n - 2])].filter((v, i, a) => v > 0 && v !== pt.n && a.indexOf(v) === i);
      steps.push(b.choice('plan', 'Πόσα άτομα ταξιδεύουν;', `${pt.n}`, wrong.map(String),
        ask === 'share' ? `Μην ξεχάσεις ${p.acc}.` : `Μετράμε ${p.acc}, τους δύο γονείς και όσους αναφέρει ακόμα.`));
    }
    const showOps = r.chance(0.6);
    const rows = pl.costs.map(c => ({ label: showOps ? `${c.label}: ${c.ops} =` : c.label, answer: c.value, unit: '€', eq: c.eq ?? c.ops }));
    if (ask === 'left') rows.push({ label: showOps ? `Περισσεύουν: ${fmt(budget)} − όλα μαζί =` : 'Περισσεύουν', answer: budget - total, unit: '€', eq: `${fmt(budget)} − ${fmt(total)}` });
    if (ask === 'share') rows.push({ label: showOps ? `Για τον καθένα: όλα μαζί : ${pt.n} =` : 'Για τον καθένα', answer: total / pt.n, unit: '€', eq: `${fmt(total)} : ${pt.n}` });
    steps.push(b.numbers('solve', 'Λύνουμε βήμα βήμα.', rows));

    if (ask === 'share') {
      steps.push(b.numbers('check', 'Αναστοχαζόμαστε: αν πληρώσουν όλοι το μερίδιό τους, βγαίνει το σύνολο;',
        [{ label: `${pt.n} × ${fmt(total / pt.n)} =`, answer: total }]));
    } else if (ask === 'left') {
      steps.push(b.choice('check', 'Αναστοχαζόμαστε: πώς ελέγχουμε την αφαίρεση;', `${fmt(total)} + ${fmt(budget - total)} = ${fmt(budget)}`,
        [`${fmt(budget)} + ${fmt(total)} = ${fmt(budget + total)}`, `${fmt(budget - total)} + ${fmt(budget - total)} = ${fmt(2 * (budget - total))}`], 'Ό,τι ξόδεψαν συν ό,τι περισσεύει κάνει όσα είχαν.'));
    } else {
      steps.push(b.choice('check', `Αναστοχαζόμαστε: κάποιος βρήκε ${fmt(pl.slip.value)} €. Τι ξέχασε;`, pl.slip.what, pl.slip.others,
        `Η διαφορά είναι ${fmt(total)} − ${fmt(pl.slip.value)} = ${fmt(total - pl.slip.value)} €. Σε ποιο ποσό αντιστοιχεί;`));
    }
    return { title: r.pick(s.title), story, steps };
  },
};
