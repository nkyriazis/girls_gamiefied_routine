// Twice as many, half as many (διπλάσιο, μισό), and both together (Γ΄ κεφ. 6
// «Πολλαπλασιασμός και διαίρεση», κεφ. 11 «Πολλαπλασιασμός διψήφιου με μονοψήφιο αριθμό»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { count, extra, fmt, known, people, sought, thing, type Family, type Person, type Rng, type Thing } from '../../lib.ts';

const g = (t: Thing, n: string, f: string, m: string) => (t.g === 'n' ? n : t.g === 'f' ? f : m);
const twice = (t: Thing) => g(t, 'διπλάσια', 'διπλάσιες', 'διπλάσιους');
const half = (t: Thing) => g(t, 'τα μισά', 'τις μισές', 'τους μισούς');
const asMany = (t: Thing) => g(t, 'όσα', 'όσες', 'όσους');
const Many = (t: Thing) => g(t, 'Πόσα', 'Πόσες', 'Πόσους');

interface Owned { t: Thing; verb: string; pl: string; min: number; max: number }
const OWNED: Owned[] = [
  { t: thing('κάρτα', 'κάρτες', 'f'), verb: 'έχει', pl: 'έχουν', min: 12, max: 200 },
  { t: thing('αυτοκόλλητο', 'αυτοκόλλητα', 'n'), verb: 'έχει', pl: 'έχουν', min: 12, max: 150 },
  { t: thing('βόλος', 'βόλοι', 'm', 'βόλους'), verb: 'έχει', pl: 'έχουν', min: 10, max: 80 },
  { t: thing('κοχύλι', 'κοχύλια', 'n'), verb: 'μάζεψε', pl: 'μάζεψαν', min: 10, max: 90 },
  { t: thing('πόντος', 'πόντοι', 'm', 'πόντους'), verb: 'μάζεψε', pl: 'μάζεψαν', min: 40, max: 400 },
];

interface Days { t: Thing; verb: string; min: number; max: number; where: string }
const DAYS: Days[] = [
  { t: thing('σελίδα', 'σελίδες', 'f'), verb: 'διάβασε', min: 12, max: 60, where: 'από ένα βιβλίο' },
  { t: thing('κάστανο', 'κάστανα', 'n'), verb: 'μάζεψε', min: 20, max: 120, where: 'στο δάσος' },
  { t: thing('άσκηση', 'ασκήσεις', 'f'), verb: 'έλυσε', min: 8, max: 30, where: 'στο βιβλίο των μαθηματικών' },
];

const PRICED = [
  { nom: 'το παζλ', min: 8, max: 30 }, { nom: 'το βιβλίο', min: 6, max: 24 }, { nom: 'η μπάλα', min: 10, max: 30 },
  { nom: 'η κασετίνα', min: 6, max: 16 }, { nom: 'το επιτραπέζιο', min: 14, max: 40 }, { nom: 'το σακίδιο', min: 16, max: 44 },
];

interface Setup {
  story: string;
  unit: string;
  // labels of the answer rows
  other: string; both: string;
  a: number; b: number; doubled: boolean;
  who: string; // "όσα έχει ο Νίκος", for the plan hint
}

function build(r: Rng, p: Person, q: Person, doubled: boolean): Setup | null {
  const kind = r.int(0, 3);
  const age = () => extra(`${r.int(8, 9)} χρονών`);
  if (kind <= 1) {
    const o = r.pick(OWNED);
    const t = o.t;
    const a = doubled ? r.int(o.min, Math.floor(o.max / 2)) : 2 * r.int(Math.ceil(o.min / 2), Math.floor(o.max / 2));
    const b = doubled ? 2 * a : a / 2;
    const rel = doubled
      ? known(`${twice(t)} ${t.manyAcc} από ${p.acc}`)
      : known(`${half(t)} ${t.manyAcc} από ${asMany(t)} ${o.verb === 'έχει' ? 'έχει' : o.verb} ${p.nom}`);
    const asks = `${sought(`${Many(t)} ${t.manyAcc} ${o.verb} ${q.nom}`)}; ${sought(`${Many(t)} ${t.manyAcc} ${o.pl} και οι δύο μαζί`)};`;
    const noise = r.pick([`Είναι και οι δύο ${age()}.`, `Κάθονται στο ίδιο θρανίο εδώ και ${extra(`${r.int(2, 8)} μήνες`)}.`]);
    const story = kind === 0
      ? `${p.Nom} ${o.verb} ${known(count(a, t, true))}. ${q.Nom} ${o.verb} ${rel}. ${noise} ${asks}`
      : `${q.Nom} ${o.verb} ${rel}. ${noise} ${p.Nom} ${o.verb} ${known(count(a, t, true))}. ${asks}`;
    return { story, unit: t.manyAcc, other: `${q.Nom} ${o.verb}`, both: 'Και οι δύο μαζί', a, b, doubled, who: `${asMany(t)} ${o.verb} ${p.nom}` };
  }
  if (kind === 2) {
    const d = r.pick(DAYS);
    const t = d.t;
    const a = doubled ? r.int(d.min, d.max) : 2 * r.int(Math.ceil(d.min / 2), Math.floor(d.max / 2));
    const b = doubled ? 2 * a : a / 2;
    const rel = doubled ? known(`${twice(t)} ${t.manyAcc}`) : known(half(t));
    const noise = r.pick([`${p.Nom} είναι ${age()}.`, `Ξυπνούσε κάθε μέρα στις ${extra(`${r.int(7, 9)} το πρωί`)}.`]);
    const story = `Το Σάββατο ${p.nom} ${d.verb} ${known(count(a, t, true))} ${d.where}. Την Κυριακή ${d.verb} ${rel}. ${noise} `
      + `${sought(`${Many(t)} ${t.manyAcc} ${d.verb} την Κυριακή`)}; ${sought(`${Many(t)} ${t.manyAcc} ${d.verb} και τις δύο μέρες`)};`;
    return { story, unit: t.manyAcc, other: 'Την Κυριακή', both: 'Και τις δύο μέρες', a, b, doubled, who: `${asMany(t)} το Σάββατο` };
  }
  const [x, y] = r.sample(PRICED, 2);
  const a = doubled ? r.int(x.min, Math.min(x.max, 25)) : 2 * r.int(Math.ceil(x.min / 2), Math.floor(x.max / 2));
  const b = doubled ? 2 * a : a / 2;
  if (b < 3 || b < y.min * 0.7 || b > y.max * 1.3) return null;
  const noise = r.pick([`Είναι ${age()}.`, `Το μαγαζί κλείνει στις ${extra(`${r.int(8, 9)} το βράδυ`)}.`]);
  const Cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  const story = `${Cap(x.nom)} κοστίζει ${known(`${fmt(a)} ευρώ`)}. ${Cap(y.nom)} κοστίζει ${known(doubled ? 'τα διπλάσια' : 'τα μισά')}. `
    + `${p.Nom} θέλει να τα αγοράσει και τα δύο. ${noise} `
    + `${sought(`Πόσο κοστίζει ${y.nom}`)}; ${sought('Πόσα ευρώ θα πληρώσει για όλα')};`;
  return { story, unit: 'ευρώ', other: `${Cap(y.nom)} κοστίζει`, both: 'Και τα δύο μαζί', a, b, doubled, who: `όσο ${x.nom}` };
}

export const doubleHalf: Family = {
  id: 'double-half',
  grade: 3,
  unit: 2,
  source: 'Μαθηματικά Γ΄, κεφ. 6 «Πολλαπλασιασμός και διαίρεση» και κεφ. 11 «Πολλαπλασιασμός διψήφιου με μονοψήφιο αριθμό»',
  make(r, b) {
    const [p, q] = people(r, 2);
    const doubled = r.chance(0.55);
    const s = build(r, p, q, doubled);
    if (!s) return null;
    const { a, b: other } = s;
    const sum = a + other;

    const steps: ProblemStep[] = [b.tag(undefined, 'Και η λέξη που δείχνει τη σχέση είναι κάτι που ξέρουμε!')];
    const plan = r.chance(0.7);
    if (plan) {
      steps.push(doubled
        ? b.choice('plan', 'Διπλάσιο σημαίνει 2 φορές. Ποια πράξη μας βοηθά;', `2 × ${fmt(a)}`,
          [`${fmt(a)} + 2`, `${fmt(a)} : 2`], `2 φορές ${s.who}.`)
        : b.choice('plan', 'Μισό σημαίνει χωρίζω σε 2 ίσα μέρη. Ποια πράξη μας βοηθά;', `${fmt(a)} : 2`,
          [`${fmt(a)} − 2`, `2 × ${fmt(a)}`], `Το μισό από ${s.who}.`));
    }
    const tens = a - (a % 10);
    const hint = doubled
      ? `2 × ${fmt(a)} είναι ${fmt(a)} + ${fmt(a)}. Μετά βρίσκουμε το άθροισμα των δύο.`
      : a < 100 && a % 10
        ? `${tens} : 2 = ${tens / 2} και ${a % 10} : 2 = ${(a % 10) / 2}. Μετά τα προσθέτουμε.`
        : `Ποιος αριθμός και ο ίδιος ξανά κάνει ${fmt(a)};`;
    steps.push(b.numbers('solve', 'Λύνουμε.', [
      { label: plan && r.chance(0.5) ? `${doubled ? `2 × ${fmt(a)}` : `${fmt(a)} : 2`} =` : s.other, answer: other, unit: s.unit },
      { label: r.chance(0.5) ? `${fmt(a)} + ${fmt(other)} =` : s.both, answer: sum, unit: s.unit },
    ], hint));
    steps.push(doubled
      ? b.choice('check', 'Πώς ελέγχουμε;', `${fmt(other)} : 2 = ${fmt(a)}`,
        [`${fmt(other)} + 2 = ${fmt(other + 2)}`, `${fmt(a)} + 2 = ${fmt(a + 2)}`],
        'Το μισό του διπλάσιου πρέπει να μας δώσει τον αριθμό από τον οποίο ξεκινήσαμε.')
      : b.choice('check', 'Πώς ελέγχουμε;', `${fmt(other)} + ${fmt(other)} = ${fmt(a)}`,
        [`${fmt(a)} + ${fmt(a)} = ${fmt(2 * a)}`, `${fmt(other)} + 2 = ${fmt(other + 2)}`],
        'Δύο φορές το μισό πρέπει να κάνει όλο.'));
    return { title: r.pick(['Διπλάσια και μισά', doubled ? 'Τα διπλάσια' : 'Τα μισά', 'Δύο φορές ή στη μέση;']), story: s.story, steps };
  },
};
