// How many more, how many fewer: the difference of two quantities, checked by adding it
// back (Γ΄ κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { count, extra, fmt, known, people, sought, thing, type Family, type Rng, type Thing } from '../../lib.ts';

interface Setting {
  t: Thing;
  min: number;
  max: number;
  /** "έχει", "μάζεψε": the verb in the singular and the plural, and after "να". */
  sg: string;
  pl: string;
  subj: string;
  /** "μαζεύουν κάρτες με ποδοσφαιριστές" */
  intro: string;
  noise: (r: Rng) => string;
}

// "περισσότερες κάρτες", "περισσότερους πόντους", "περισσότερα ευρώ"
const more = (t: Thing) => (t.g === 'n' ? 'περισσότερα' : t.g === 'f' ? 'περισσότερες' : 'περισσότερους');
const fewer = (t: Thing) => (t.g === 'n' ? 'λιγότερα' : t.g === 'f' ? 'λιγότερες' : 'λιγότερους');
const Many = (t: Thing) => (t.g === 'n' ? 'Πόσα' : t.g === 'f' ? 'Πόσες' : 'Πόσους');

const SETTINGS: Setting[] = [
  {
    t: thing('κάρτα', 'κάρτες', 'f'), min: 25, max: 300, sg: 'έχει', pl: 'έχουν', subj: 'μαζέψει',
    intro: 'μαζεύουν κάρτες με ποδοσφαιριστές',
    noise: r => `Ένα φακελάκι έχει ${extra(`${r.int(4, 6)} κάρτες`)}.`,
  },
  {
    t: thing('πόντος', 'πόντοι', 'm', 'πόντους'), min: 120, max: 990, sg: 'μάζεψε', pl: 'μάζεψαν', subj: 'μαζέψει',
    intro: 'παίζουν ένα ηλεκτρονικό παιχνίδι',
    noise: r => `Το παιχνίδι έχει ${extra(`${r.int(5, 12)} πίστες`)}.`,
  },
  {
    t: thing('σελίδα', 'σελίδες', 'f'), min: 40, max: 300, sg: 'διάβασε', pl: 'διάβασαν', subj: 'διαβάσει',
    intro: 'διαβάζουν βιβλία στις διακοπές',
    noise: r => `Οι διακοπές κράτησαν ${extra(`${r.int(10, 20)} μέρες`)}.`,
  },
  {
    t: thing('ευρώ', 'ευρώ', 'n'), min: 20, max: 250, sg: 'έχει', pl: 'έχουν', subj: 'μαζέψει',
    intro: 'μαζεύουν χρήματα στους κουμπαράδες τους',
    noise: r => `Θα ανοίξουν τους κουμπαράδες στις ${extra(`${r.int(2, 28)} Δεκεμβρίου`)}.`,
  },
  {
    t: thing('κοχύλι', 'κοχύλια', 'n'), min: 15, max: 95, sg: 'μάζεψε', pl: 'μάζεψαν', subj: 'μαζέψει',
    intro: 'μαζεύουν κοχύλια στην παραλία',
    noise: r => `Έμειναν στην παραλία ως τις ${extra(`${r.int(6, 7)} το απόγευμα`)}.`,
  },
  {
    t: thing('βόλος', 'βόλοι', 'm', 'βόλους'), min: 20, max: 120, sg: 'έχει', pl: 'έχουν', subj: 'μαζέψει',
    intro: 'παίζουν βόλους στην αυλή',
    noise: r => `Το διάλειμμα κρατά ${extra(`${r.int(15, 25)} λεπτά`)}.`,
  },
];

export const compareDifference: Family = {
  id: 'compare-difference',
  grade: 3,
  unit: 2,
  source: 'Μαθηματικά Γ΄, κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών»',
  make(r, b) {
    const [p, q] = people(r, 2);
    const s = r.pick(SETTINGS);
    const t = s.t;
    const big = r.int(s.min + 8, s.max);
    const small = r.int(s.min, big - 5);
    const d = big - small;
    if (d < 4) return null;
    // p has more; the question asks either "more" or "fewer"
    const askMore = r.chance(0.5);
    const noise = s.noise(r);
    const has = (n: number) => known(count(n, t, true));
    const question = r.pick([
      () => askMore
        ? `${sought(`${Many(t)} ${more(t)} ${t.manyAcc} ${s.sg} ${p.nom} από ${q.acc}`)};`
        : `${sought(`${Many(t)} ${fewer(t)} ${t.manyAcc} ${s.sg} ${q.nom} από ${p.acc}`)};`,
      () => `${sought(`${Many(t)} ${t.manyAcc} ακόμα πρέπει να ${s.subj} ${q.nom} για να φτάσει ${p.acc}`)};`,
    ])();
    const both = `${p.Nom} και ${q.nom}`;
    const story = r.pick([
      () => `${p.Nom} ${s.sg} ${has(big)}. ${q.Nom} ${s.sg} ${has(small)}. ${noise} ${question}`,
      () => `${both} ${s.intro}. ${noise} ${p.Nom} ${s.sg} ${has(big)} και ${q.nom} ${has(small)}. ${question}`,
      () => `${q.Nom} ${s.sg} ${has(small)}, ενώ ${p.nom} ${has(big)}. ${noise} ${question}`,
      () => `${both} ${s.intro}. ${q.Nom} ${s.sg} ${has(small)}. ${noise} ${p.Nom} ${s.sg} ${has(big)}. ${question}`,
    ])();

    const steps: ProblemStep[] = [b.tag(undefined, `Χρειαζόμαστε μόνο πόσ${t.g === 'n' ? 'α' : t.g === 'f' ? 'ες' : 'ους'} ${t.manyAcc} ${s.sg} ο καθένας.`)];
    const style = r.int(0, 2);
    if (style === 0) {
      steps.push(b.choice('plan', `Ποιος ${s.sg} ${more(t)} ${t.manyAcc};`, p.Nom, [q.Nom, 'Το ίδιο και οι δύο'],
        `Συγκρίνουμε: ${fmt(big)} και ${fmt(small)}.`));
    }
    if (style !== 2) {
      steps.push(b.choice('plan', 'Ποια πράξη μας βοηθά;', `${fmt(big)} − ${fmt(small)}`,
        [`${fmt(big)} + ${fmt(small)}`, `${fmt(small)} − ${fmt(big)}`],
        'Η διαφορά βρίσκεται με αφαίρεση: από το μεγαλύτερο βγάζουμε το μικρότερο.'));
    }
    steps.push(b.numbers('solve', 'Λύνουμε.', [
      style === 2
        ? { label: `${fmt(big)} − ${fmt(small)} =`, answer: d, unit: t.manyAcc }
        : { label: 'Η διαφορά', answer: d, unit: t.manyAcc },
    ], small % 10 === 0 || small + 10 - (small % 10) >= big
      ? `Μετράμε από το ${fmt(small)} ως το ${fmt(big)}.`
      : `Μπορούμε να μετρήσουμε από το ${fmt(small)} ως το ${fmt(big)}: πρώτα ως το ${fmt(small + 10 - (small % 10))} και μετά ως το ${fmt(big)}.`));
    steps.push(b.choice('check', 'Πώς ελέγχουμε;', `${fmt(small)} + ${fmt(d)} = ${fmt(big)}`,
      [`${fmt(big)} + ${fmt(d)} = ${fmt(big + d)}`, `${fmt(small)} − ${fmt(Math.min(d, small))} = ${fmt(small - Math.min(d, small))}`],
      `Αν στα ${fmt(small)} βάλουμε τη διαφορά, πρέπει να βρούμε τα ${fmt(big)}.`));
    return { title: r.pick(['Ποιος έχει περισσότερα;', 'Η διαφορά', 'Πόσα περισσότερα;', 'Σύγκριση']), story, steps };
  },
};
