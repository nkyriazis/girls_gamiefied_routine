// A small table told in the story (votes, points, books read by each class), and a
// question that needs only some of its numbers (Γ΄ κεφ. 12 «Προβλήματα», 1 «Δημοτικές εκλογές»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { extra, fmt, known, people, sought, type Family, type Rng } from '../../lib.ts';

interface Entry { nom: string; acc: string; name: string } // name: the option for "who has most"
type Mark = (s: string) => string;

interface Setting {
  title: string;
  range: [number, number];
  entries: (r: Rng) => Entry[];
  intro: string;
  /** The table's rows, to be told in one sentence: the first with its verb, the rest after commas.
   * Each row is marked whole, its name too, so a sentence painted whole but the unneeded rows is right (#50). */
  rows: (es: Entry[], vs: string[]) => string[];
  unit: string;            // for the number rows: ψήφους, παιδιά, πόντους, βιβλία
  diff: (a: Entry, b: Entry) => string;  // the question, without ";"
  sum: (a: Entry, b: Entry) => string;
  more: (c: Entry) => string;            // "Πόσες περισσότερες από τη Ζωή"
  most: string;                          // "Ποιος πήρε τις περισσότερες ψήφους;"
  noise: (r: Rng, x: Mark) => string;
}

const list = (xs: string[]) => xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} και ${xs[xs.length - 1]}`;
const Cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const TEAMS: Entry[] = [
  { nom: 'οι Αετοί', acc: 'τους Αετούς', name: 'Οι Αετοί' },
  { nom: 'τα Δελφίνια', acc: 'τα Δελφίνια', name: 'Τα Δελφίνια' },
  { nom: 'οι Γλάροι', acc: 'τους Γλάρους', name: 'Οι Γλάροι' },
  { nom: 'τα Λιοντάρια', acc: 'τα Λιοντάρια', name: 'Τα Λιοντάρια' },
  { nom: 'οι Κένταυροι', acc: 'τους Κενταύρους', name: 'Οι Κένταυροι' },
];
const CLASSES: Entry[] = [
  { nom: 'η Α΄ τάξη', acc: 'την Α΄ τάξη', name: 'Η Α΄ τάξη' },
  { nom: 'η Β΄ τάξη', acc: 'τη Β΄ τάξη', name: 'Η Β΄ τάξη' },
  { nom: 'η Γ΄ τάξη', acc: 'τη Γ΄ τάξη', name: 'Η Γ΄ τάξη' },
  { nom: 'η Δ΄ τάξη', acc: 'τη Δ΄ τάξη', name: 'Η Δ΄ τάξη' },
  { nom: 'η Ε΄ τάξη', acc: 'την Ε΄ τάξη', name: 'Η Ε΄ τάξη' },
  { nom: 'η ΣΤ΄ τάξη', acc: 'τη ΣΤ΄ τάξη', name: 'Η ΣΤ΄ τάξη' },
];
const PARTIES: Entry[] = [
  { nom: 'η «Αναγέννηση»', acc: 'την «Αναγέννηση»', name: 'Η «Αναγέννηση»' },
  { nom: 'το «Πράσινο περιβάλλον»', acc: 'το «Πράσινο περιβάλλον»', name: 'Το «Πράσινο περιβάλλον»' },
  { nom: 'η «Αλλαγή στην κοινότητα»', acc: 'την «Αλλαγή στην κοινότητα»', name: 'Η «Αλλαγή στην κοινότητα»' },
  { nom: 'η «Νέα πνοή»', acc: 'τη «Νέα πνοή»', name: 'Η «Νέα πνοή»' },
];
// For the trip vote, nom/acc are the "για ..." phrase and name is where they go
const PLACES: Entry[] = [
  { nom: 'για τη θάλασσα', acc: 'για τη θάλασσα', name: 'Στη θάλασσα' },
  { nom: 'για το βουνό', acc: 'για το βουνό', name: 'Στο βουνό' },
  { nom: 'για το μουσείο', acc: 'για το μουσείο', name: 'Στο μουσείο' },
  { nom: 'για τον ζωολογικό κήπο', acc: 'για τον ζωολογικό κήπο', name: 'Στον ζωολογικό κήπο' },
  { nom: 'για το πλανητάριο', acc: 'για το πλανητάριο', name: 'Στο πλανητάριο' },
];

const SETTINGS: Setting[] = [
  {
    title: 'Οι μαθητικές εκλογές', range: [25, 160],
    entries: r => people(r, 4).map(p => ({ nom: p.nom, acc: p.acc, name: p.Nom })),
    intro: 'Στις εκλογές για το μαθητικό συμβούλιο ψήφισαν όλα τα παιδιά του σχολείου.',
    rows: (es, vs) => [`${Cap(es[0].nom)} πήρε ${vs[0]}`, ...es.slice(1).map((e, i) => `${e.nom} ${vs[i + 1]}`)],
    unit: 'ψήφους',
    diff: (a, b) => `Πόσες περισσότερες ψήφους πήρε ${a.nom} από ${b.acc}`,
    sum: (a, b) => `Πόσες ψήφους πήραν μαζί ${a.nom} και ${b.nom}`,
    more: c => `Πόσες περισσότερες από ${c.acc}`,
    most: 'Ποιος πήρε τις περισσότερες ψήφους;',
    noise: (r, x) => `Η ψηφοφορία κράτησε ${x(`${r.int(2, 3)} ώρες`)}.`,
  },
  {
    title: 'Πού θα πάμε εκδρομή;', range: [12, 95],
    entries: () => PLACES,
    intro: 'Τα παιδιά του σχολείου ψήφισαν πού θα πάνε εκδρομή.',
    rows: (es, vs) => [`${Cap(es[0].nom)} ψήφισαν ${vs[0]}`, ...es.slice(1).map((e, i) => `${e.nom} ${vs[i + 1]}`)],
    unit: 'παιδιά',
    diff: (a, b) => `Πόσα περισσότερα παιδιά ψήφισαν ${a.nom} από ό,τι ${b.nom}`,
    sum: (a, b) => `Πόσα παιδιά ψήφισαν ${a.nom} ή ${b.nom}`,
    more: c => `Πόσα περισσότερα είναι από όσα ψήφισαν ${c.nom}`,
    most: 'Πού θα πάνε τελικά εκδρομή;',
    noise: (r, x) => `Η εκδρομή θα γίνει σε ${x(`${r.int(10, 30)} μέρες`)}.`,
  },
  {
    title: 'Το τουρνουά μπάσκετ', range: [80, 320],
    entries: () => TEAMS,
    intro: 'Στο σχολικό τουρνουά μπάσκετ μετρήσαμε τους πόντους κάθε ομάδας.',
    rows: (es, vs) => [`${Cap(es[0].nom)} έβαλαν ${vs[0]}`, ...es.slice(1).map((e, i) => `${e.nom} ${vs[i + 1]}`)],
    unit: 'πόντους',
    diff: (a, b) => `Πόσους περισσότερους πόντους έβαλαν ${a.nom} από ${b.acc}`,
    sum: (a, b) => `Πόσους πόντους έβαλαν μαζί ${a.nom} και ${b.nom}`,
    more: c => `Πόσους περισσότερους από ${c.acc}`,
    most: 'Ποια ομάδα έβαλε τους περισσότερους πόντους;',
    noise: (r, x) => `Κάθε ομάδα έπαιξε ${x(`${r.int(4, 6)} αγώνες`)}.`,
  },
  {
    title: 'Ο διαγωνισμός ανάγνωσης', range: [20, 160],
    entries: () => CLASSES,
    intro: 'Στον διαγωνισμό ανάγνωσης του σχολείου μετρήσαμε τα βιβλία που διάβασε κάθε τάξη.',
    rows: (es, vs) => [`${Cap(es[0].nom)} διάβασε ${vs[0]}`, ...es.slice(1).map((e, i) => `${e.nom} ${vs[i + 1]}`)],
    unit: 'βιβλία',
    diff: (a, b) => `Πόσα περισσότερα βιβλία διάβασε ${a.nom} από ${b.acc}`,
    sum: (a, b) => `Πόσα βιβλία διάβασαν μαζί ${a.nom} και ${b.nom}`,
    more: c => `Πόσα περισσότερα από ${c.acc}`,
    most: 'Ποια τάξη διάβασε τα περισσότερα βιβλία;',
    noise: (r, x) => `Ο διαγωνισμός κράτησε ${x(`${r.int(2, 4)} μήνες`)}.`,
  },
  {
    title: 'Δημοτικές εκλογές', range: [50, 380],
    entries: () => PARTIES,
    intro: 'Αυτά είναι τα αποτελέσματα των δημοτικών εκλογών στο εκλογικό τμήμα του χωριού.',
    rows: (es, vs) => [`${Cap(es[0].nom)} πήρε ${vs[0]}`, ...es.slice(1).map((e, i) => `${e.nom} ${vs[i + 1]}`)],
    unit: 'ψήφους',
    diff: (a, b) => `Πόσες περισσότερες ψήφους πήρε ${a.nom} από ${b.acc}`,
    sum: (a, b) => `Πόσες ψήφους πήραν μαζί ${a.nom} και ${b.nom}`,
    more: c => `Πόσες περισσότερες από ${c.acc}`,
    most: 'Ποιος συνδυασμός βγήκε πρώτος;',
    noise: (r, x) => `Τα λευκά ψηφοδέλτια ήταν ${x(String(r.int(12, 45)))}.`,
  },
];

export const tableReading: Family = {
  id: 'table-reading',
  grade: 3,
  unit: 2,
  source: 'Μαθηματικά Γ΄, κεφ. 12 «Προβλήματα», 1 «Δημοτικές εκλογές»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const kind = r.pick(['diff', 'sum', 'two'] as const);
    const size = kind === 'two' ? 4 : r.int(3, 4);
    const pool = s.entries(r);
    if (pool.length < size) return null;
    const es = r.sample(pool, size);
    // Different values, so that "who has most" and the comparisons are clear
    const vs = es.map(() => r.int(...s.range));
    if (new Set(vs).size !== vs.length) return null;
    const unitOf = (v: number) => `${fmt(v)} ${s.unit}`;

    // Which entries the question uses
    const idx = r.shuffle(es.map((_e, i) => i));
    let [ia, ib] = idx;
    if (vs[ia] < vs[ib]) [ia, ib] = [ib, ia];
    const ic = idx[2];
    const a = es[ia], bb = es[ib], c = es[ic];
    const A = vs[ia], B = vs[ib], C = vs[ic];
    if (kind === 'diff' && A - B < 3) return null;
    if (kind === 'two' && A + B - C < 3) return null;
    const used = kind === 'two' ? [ia, ib, ic] : [ia, ib];
    const rows = s.rows(es, vs.map(unitOf)).map((row, i) => (used.includes(i) ? known(row) : extra(row)));
    const question = kind === 'diff'
      ? `${sought(s.diff(a, bb))};`
      : kind === 'sum'
        ? `${sought(s.sum(a, bb))};`
        : `${sought(s.sum(a, bb))}; ${sought(s.more(c))};`;
    const noise = s.noise(r, extra);
    const table = `${list(rows)}.`;
    const story = r.pick([
      () => `${s.intro} ${table} ${noise} ${question}`,
      () => `${s.intro} ${noise} ${table} ${question}`,
    ])();

    const steps: ProblemStep[] = [b.tag(undefined, 'Δεν χρειαζόμαστε όλους τους αριθμούς. Ποιους ρωτάει η ερώτηση;')];
    const maxI = vs.indexOf(Math.max(...vs));
    if (r.chance(0.35)) {
      steps.push(b.choice('read', s.most, es[maxI].name, es.filter((_e, i) => i !== maxI).slice(0, 3).map(e => e.name),
        'Ψάχνουμε τον μεγαλύτερο αριθμό.'));
    }
    const pick = used.map(i => fmt(vs[i]));
    if (r.chance(0.5)) {
      const others = es.map((_e, i) => i).filter(i => !used.includes(i));
      const wrongPair = [...used.slice(0, -1), others[0]].map(i => fmt(vs[i]));
      steps.push(b.choice('plan', 'Ποιους αριθμούς χρειαζόμαστε;', list(pick),
        [list(vs.map(fmt)), list(wrongPair)].filter(o => o !== list(pick)),
        'Κοιτάμε ποιους ονομάζει η ερώτηση.'));
    }
    if (kind === 'diff') {
      steps.push(b.numbers('solve', 'Λύνουμε.', [{ label: `${fmt(A)} − ${fmt(B)} =`, answer: A - B, unit: s.unit }]));
      steps.push(b.choice('check', 'Πώς ελέγχουμε;', `${fmt(B)} + ${fmt(A - B)} = ${fmt(A)}`,
        [`${fmt(A)} + ${fmt(B)} = ${fmt(A + B)}`, `${fmt(A)} + ${fmt(A - B)} = ${fmt(A + A - B)}`],
        'Στον μικρότερο αριθμό προσθέτουμε τη διαφορά. Πρέπει να βρούμε τον μεγαλύτερο.'));
    } else if (kind === 'sum') {
      steps.push(b.numbers('solve', 'Λύνουμε.', [{ label: r.chance(0.5) ? `${fmt(A)} + ${fmt(B)} =` : 'Μαζί', answer: A + B, unit: s.unit }]));
      steps.push(b.choice('check', 'Πώς ελέγχουμε;', `${fmt(A + B)} − ${fmt(B)} = ${fmt(A)}`,
        [`${fmt(A)} − ${fmt(B)} = ${fmt(A - B)}`, `${fmt(A + B)} + ${fmt(B)} = ${fmt(A + 2 * B)}`],
        'Αν από το άθροισμα βγάλουμε τον έναν αριθμό, μένει ο άλλος.'));
    } else {
      steps.push(b.numbers('solve', 'Λύνουμε βήμα βήμα.', [
        { label: `Μαζί: ${fmt(A)} + ${fmt(B)} =`, answer: A + B, unit: s.unit },
        { label: `Διαφορά: ${fmt(A + B)} − ${fmt(C)} =`, answer: A + B - C, unit: s.unit },
      ], 'Πρώτα βρίσκουμε το άθροισμα και μετά το συγκρίνουμε με τον τρίτο αριθμό.'));
      steps.push(b.choice('check', 'Πώς ελέγχουμε τη δεύτερη απάντηση;', `${fmt(C)} + ${fmt(A + B - C)} = ${fmt(A + B)}`,
        [`${fmt(A)} + ${fmt(B)} + ${fmt(C)} = ${fmt(A + B + C)}`, `${fmt(A + B)} + ${fmt(C)} = ${fmt(A + B + C)}`],
        'Στον τρίτο αριθμό προσθέτουμε τη διαφορά. Πρέπει να βρούμε το άθροισμα.'));
    }
    return { title: s.title, story, steps };
  },
};
