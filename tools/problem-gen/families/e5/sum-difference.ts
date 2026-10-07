// Two quantities with a known total and a known difference: take the difference away, halve,
// then add it back (Ε΄ κεφ. 1.3, στρατηγική «Παρουσιάζω το πρόβλημα» με σχέδιο).
import { extra, fmt, known, people, sought, STRATEGY, type Family, type Person } from '../../lib.ts';
import type { ProblemStep } from '../../../../shared/types.ts';

interface Setting {
  title: string;
  total: [number, number];
  diff: [number, number];
  step: number;
  unit: string;
  /** The two, bigger first: names for the rows ("Ε1", "Ε2") */
  names: (p: Person, q: Person) => [string, string];
  together: (p: Person, q: Person, t: string) => string;   // "Τα δύο τμήματα έχουν μαζί 52 μαθητές"
  more: (p: Person, q: Person, d: string) => string;       // "Το Ε1 έχει 4 μαθητές περισσότερους από το Ε2"
  less: (p: Person, q: Person, d: string) => string;       // "Το Ε2 έχει 4 μαθητές λιγότερους από το Ε1"
  ask: (p: Person, q: Person) => string;
  noise: (n: number) => string;
  equal: string; // "ίσα", agreeing with the unit: "θα είχαν τον ίδιο αριθμό"
}

const SETTINGS: Setting[] = [
  {
    title: 'Τα δύο τμήματα', total: [38, 52], diff: [1, 6], step: 1, unit: 'μαθητές',
    names: () => ['Ε1', 'Ε2'],
    together: (_p, _q, t) => `Στα δύο τμήματα της Ε΄ τάξης ενός σχολείου φοιτούν ${t}`,
    more: (_p, _q, d) => `Το Ε1 έχει ${d} μαθητές περισσότερους από το Ε2`,
    less: (_p, _q, d) => `Το Ε2 έχει ${d} μαθητές λιγότερους από το Ε1`,
    ask: () => 'Πόσους μαθητές έχει κάθε τμήμα',
    noise: n => `Το σχολείο έχει ${n + 6} τμήματα σε όλες τις τάξεις`,
    equal: 'Τα τμήματα θα είχαν τον ίδιο αριθμό μαθητών',
  },
  {
    title: 'Τα γραμματόσημα', total: [150, 900], diff: [12, 95], step: 1, unit: 'γραμματόσημα',
    names: (p, q) => [p.Nom, q.Nom],
    together: (p, q, t) => `${p.Nom} και ${q.nom} έχουν μαζί ${t}`,
    more: (p, q, d) => `${p.Nom} έχει ${d} γραμματόσημα περισσότερα από ${q.acc}`,
    less: (p, q, d) => `${q.Nom} έχει ${d} γραμματόσημα λιγότερα από ${p.acc}`,
    ask: (p, q) => `Πόσα γραμματόσημα έχει ${each(p, q)}`,
    noise: n => `Τα φυλάνε σε ${Math.min(n, 5)} άλμπουμ`,
    equal: 'Θα είχαν τον ίδιο αριθμό γραμματοσήμων',
  },
  {
    title: 'Τα δύο χωριά', total: [1_200, 9_800], diff: [100, 900], step: 10, unit: 'κάτοικοι',
    names: () => ['Το παραθαλάσσιο χωριό', 'Το ορεινό χωριό'],
    together: (_p, _q, t) => `Δύο γειτονικά χωριά έχουν μαζί ${t}`,
    more: (_p, _q, d) => `Το παραθαλάσσιο χωριό έχει ${d} κατοίκους περισσότερους από το ορεινό`,
    less: (_p, _q, d) => `Το ορεινό χωριό έχει ${d} κατοίκους λιγότερους από το παραθαλάσσιο`,
    ask: () => 'Πόσους κατοίκους έχει κάθε χωριό',
    noise: n => `Τα δύο χωριά απέχουν ${n + 3} χιλιόμετρα`,
    equal: 'Τα χωριά θα είχαν τον ίδιο αριθμό κατοίκων',
  },
  {
    title: 'Τα δύο φορτηγά', total: [9_000, 24_000], diff: [400, 3_000], step: 100, unit: 'κιλά',
    names: () => ['Το μεγάλο φορτηγό', 'Το μικρό φορτηγό'],
    together: (_p, _q, t) => `Δύο φορτηγά μεταφέρουν μαζί ${t} πορτοκάλια`,
    more: (_p, _q, d) => `Το μεγάλο φορτηγό μεταφέρει ${d} κιλά περισσότερα από το μικρό`,
    less: (_p, _q, d) => `Το μικρό φορτηγό μεταφέρει ${d} κιλά λιγότερα από το μεγάλο`,
    ask: () => 'Πόσα κιλά μεταφέρει κάθε φορτηγό',
    noise: n => `Ξεκίνησαν από το Άργος στις ${Math.max(5, Math.min(n, 7))} το πρωί`,
    equal: 'Τα φορτηγά θα μετέφεραν τα ίδια κιλά',
  },
  {
    title: 'Η έκθεση ζωγραφικής', total: [1_000, 6_000], diff: [100, 800], step: 2, unit: 'επισκέπτες',
    names: () => ['Την Κυριακή', 'Το Σάββατο'],
    together: (_p, _q, t) => `Σε μια έκθεση ζωγραφικής ήρθαν το Σάββατο και την Κυριακή ${t}`,
    more: (_p, _q, d) => `Την Κυριακή ήρθαν ${d} επισκέπτες περισσότεροι από το Σάββατο`,
    less: (_p, _q, d) => `Το Σάββατο ήρθαν ${d} επισκέπτες λιγότεροι από την Κυριακή`,
    ask: () => 'Πόσοι επισκέπτες ήρθαν κάθε ημέρα',
    noise: n => `Η έκθεση έχει ${n * 5 + 20} πίνακες`,
    equal: 'Θα είχαν έρθει οι ίδιοι επισκέπτες και τις δύο ημέρες',
  },
  {
    title: 'Οι οικονομίες', total: [80, 480], diff: [6, 60], step: 1, unit: '€',
    names: (p, q) => [p.Nom, q.Nom],
    together: (p, q, t) => `${p.Nom} και ${q.nom} έχουν μαζέψει μαζί ${t}`,
    more: (p, q, d) => `${p.Nom} έχει ${d} € περισσότερα από ${q.acc}`,
    less: (p, q, d) => `${q.Nom} έχει ${d} € λιγότερα από ${p.acc}`,
    ask: (p, q) => `Πόσα € έχει ${each(p, q)}`,
    noise: n => `Τα μαζεύουν εδώ και ${Math.min(n, 4)} χρόνια`,
    equal: 'Θα είχαν τα ίδια χρήματα',
  },
];

/** "ο καθένας", or "η καθεμιά" when both are girls */
const each = (p: Person, q: Person) => (p.female && q.female ? 'η καθεμιά' : 'ο καθένας');

const withUnit = (s: Setting, n: number) => s.unit === '€' ? `${fmt(n)} €` : s.unit === 'κάτοικοι' ? `${fmt(n)} κατοίκους` : `${fmt(n)} ${s.unit}`;

export const sumDifference: Family = {
  id: 'sum-difference',
  grade: 5,
  unit: 1,
  source: 'Μαθηματικά Ε΄, κεφ. 1.3 «Πώς λύνουμε ένα πρόβλημα» (στρατηγική «Παρουσιάζω το πρόβλημα»)',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const [p, q] = people(r, 2);
    const d = r.step(s.diff[0], s.diff[1], s.step === 100 ? 100 : s.step === 10 ? 10 : 1);
    const T = r.step(s.total[0], s.total[1], s.step);
    if ((T - d) % 2 || T - d <= 2 * d) return null;
    const small = (T - d) / 2, big = small + d;
    const [bigName, smallName] = s.names(p, q);

    const more = r.chance(0.6);
    const rel = more ? s.more(p, q, fmt(d)) : s.less(p, q, fmt(d));
    const noise = extra(s.noise(r.int(2, 9)));
    const t = r.int(0, 2);
    // «Η Χαρά και ο Νίκος έχουν… Η Χαρά έχει…»: when the relation (about p) comes next, the sum
    // names the other first, so two sentences in a row don't open with one name
    const together = t === 0 && more ? s.together(q, p, known(withUnit(s, T))) : s.together(p, q, known(withUnit(s, T)));
    const story = t === 0
      ? `${together}. ${known(rel)}. ${noise}. ${sought(s.ask(p, q))};`
      : t === 1
        ? `${together}. ${noise}. Ξέρουμε ακόμα ότι ${known(rel.replace(/^(\S)/, c => c.toLowerCase()).replace(/^το /, 'το ').replace(/^την /, 'την '))}. ${sought(s.ask(p, q))};`
        : `${sought(s.ask(p, q))}, αν ${together.replace(/^(\S)/, c => c.toLowerCase())} και ${known(rel.replace(/^(\S)/, c => c.toLowerCase()))}; ${noise}.`;

    const show = r.chance(0.5);
    const steps: ProblemStep[] = [b.tag(undefined, 'Χρειαζόμαστε το σύνολο και τη διαφορά. Ό,τι δεν αλλάζει τους αριθμούς το αφήνουμε.')];
    if (r.chance(0.6)) {
      steps.push(b.choice('plan', 'Ποια στρατηγική μας βοηθά;',
        STRATEGY.draw,
        [[`Μοιράζω τα ${fmt(T)} στα δύο και τελείωσα`, `Μοιράζω τα ${fmt(T)} στα δύο`], [`Αφαιρώ ${fmt(T)} − ${fmt(d)} και τελείωσα`, `Αφαιρώ ${fmt(T)} − ${fmt(d)}`]],
        `Αν βγάλουμε τη διαφορά, ${['μαθητές', 'κάτοικοι', 'επισκέπτες'].includes(s.unit) ? 'οι' : 'τα'} ${withUnit(s, T - d).replace('κατοίκους', 'κάτοικοι')} που μένουν μοιράζονται στα δύο εξίσου.`));
    }
    steps.push(b.numbers('solve', 'Λύνουμε: βγάζουμε τη διαφορά, μοιράζουμε στα δύο, ξαναβάζουμε τη διαφορά.', [
      { label: show ? `${fmt(T)} − ${fmt(d)} =` : 'Χωρίς τη διαφορά', answer: T - d, unit: s.unit },
      { label: show ? `${smallName}: ${fmt(T - d)} : 2 =` : smallName, answer: small, unit: s.unit },
      { label: show ? `${bigName}: ${fmt(small)} + ${fmt(d)} =` : bigName, answer: big, unit: s.unit },
    ], `Χωρίς τη διαφορά, οι δύο λωρίδες είναι ίσες. ${s.equal}.`));
    steps.push(r.chance(0.5) || T % 2
      ? b.numbers('check', 'Αναστοχαζόμαστε: ισχύουν και τα δύο που λέει η ιστορία;', [
        { label: `${fmt(big)} + ${fmt(small)} =`, answer: T, unit: s.unit },
        { label: `${fmt(big)} − ${fmt(small)} =`, answer: d, unit: s.unit },
      ], 'Μαζί πρέπει να κάνουν το σύνολο, και η διαφορά τους να είναι αυτή της ιστορίας.')
      : b.choice('check', `Κάποιος απάντησε «${fmt(T / 2)} και ${fmt(T / 2)}». Γιατί είναι λάθος;`,
`Γιατί δεν έχουν διαφορά ${fmt(d)}`,
        [['Δεν είναι λάθος καθόλου', 'Δεν είναι λάθος', 'Δεν είναι λάθος, ισχύουν όλα'], [`Γιατί όλα μαζί δεν κάνουν ${fmt(T)}`, `Δεν κάνουν ${fmt(T)} μαζί`, `Γιατί μαζί δεν κάνουν ${fmt(T)}`]],
        `Ελέγχουμε και τα δύο: το σύνολο και τη διαφορά.`));
    return { title: s.title, story, steps };
  },
};
