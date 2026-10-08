// 2-digit × 1-digit, split into tens and ones: 4 × 23 = 4 × 20 + 4 × 3 (Γ΄ κεφ. 11
// «Πολλαπλασιασμός διψήφιου με μονοψήφιο αριθμό»). Sometimes an estimate first.
import type { ProblemStep } from '../../../../shared/types.ts';
import { count, extra, fmt, known, PEOPLE, sought, thing, type Family, type Person, type Rng, type Thing } from '../../lib.ts';

interface Setting {
  group: Thing;          // what there are n of
  unit: string;          // the unit of the answer, for the rows
  k: [number, number];
  n: [number, number];
  /** The sentences: n groups (marked), k in each (marked), the question (marked). */
  groups: (p: Person, g: string) => string;
  each: (k: string) => string;
  ask: (p: Person) => string;
  noise: (r: Rng) => string;
  /** The sentence with k can open the story. */
  eachFirst?: boolean;
}

const SETTINGS: Setting[] = [
  {
    group: thing('άτομο', 'άτομα', 'n'), unit: 'ευρώ', k: [12, 19], n: [3, 6],
    groups: (p, g) => `Η οικογένεια ${p.gen} είναι ${g} και πηγαίνει στο θέατρο.`,
    each: k => `Ένα εισιτήριο κοστίζει ${k}.`,
    ask: () => 'Πόσα ευρώ θα πληρώσουν για τα εισιτήρια', eachFirst: true,
    noise: r => `Η παράσταση αρχίζει στις ${extra(`${r.int(6, 8)} το απόγευμα`)}.`,
  },
  {
    group: thing('μέρα', 'μέρες', 'f'), unit: 'σελίδες', k: [11, 25], n: [3, 7],
    groups: (p, g) => `${p.Nom} θέλει να διαβάσει ένα βιβλίο σε ${g}.`,
    each: k => `Κάθε μέρα διαβάζει ${k}.`,
    ask: () => 'Πόσες σελίδες θα έχει διαβάσει στο τέλος',
    noise: r => `Το βιβλίο έχει ${extra(`${r.int(8, 14)} κεφάλαια`)}.`,
  },
  {
    group: thing('τελάρο', 'τελάρα', 'n'), unit: 'κιλά', k: [12, 19], n: [3, 9],
    groups: (_p, g) => `Ο κύριος Στάθης γέμισε ${g} με ντομάτες από τον κήπο του.`,
    each: k => `Κάθε τελάρο ζυγίζει ${k}.`,
    ask: () => 'Πόσα κιλά ντομάτες μάζεψε', eachFirst: true,
    noise: r => `Στον κήπο έχει και ${extra(`${r.int(3, 9)} λεμονιές`)}.`,
  },
  {
    group: thing('λεωφορείο', 'λεωφορεία', 'n'), unit: 'παιδιά', k: [41, 55], n: [2, 4],
    groups: (_p, g) => `Για την εκδρομή, το σχολείο νοίκιασε ${g}.`,
    each: k => `Κάθε λεωφορείο έχει ${k} για τα παιδιά.`,
    ask: () => 'Πόσα παιδιά χωράνε στα λεωφορεία', eachFirst: true,
    noise: r => `Η εκδρομή είναι σε ${extra(`${r.int(5, 20)} μέρες`)}.`,
  },
  {
    group: thing('πακέτο', 'πακέτα', 'n'), unit: 'μπισκότα', k: [12, 24], n: [3, 8],
    groups: (p, g) => `${p.Nom} αγόρασε ${g} μπισκότα για το πάρτι της τάξης.`,
    each: k => `Κάθε πακέτο έχει ${k}.`,
    ask: () => 'Πόσα μπισκότα αγόρασε', eachFirst: true,
    noise: r => `Στο πάρτι θα έρθουν ${extra(`${r.int(18, 25)} παιδιά`)}.`,
  },
  {
    group: thing('κουτί', 'κουτιά', 'n'), unit: 'κραγιόνια', k: [12, 24], n: [2, 6],
    groups: (_p, g) => `Η δασκάλα άνοιξε ${g} με κραγιόνια για τη ζωγραφική.`,
    each: k => `Σε κάθε κουτί υπάρχουν ${k}.`,
    ask: () => 'Πόσα κραγιόνια έχουν τα παιδιά', eachFirst: true,
    noise: r => `Στην τάξη είναι ${extra(`${r.int(18, 25)} παιδιά`)}.`,
  },
];

// The "k" phrase with its unit, in the case each sentence needs
const KPHRASE: Record<string, (k: number) => string> = {
  ευρώ: k => `${k} ευρώ`,
  σελίδες: k => `${k} σελίδες`,
  κιλά: k => `${k} κιλά`,
  παιδιά: k => `${k} θέσεις`,
  μπισκότα: k => `${k} μπισκότα`,
  κραγιόνια: k => `${k} κραγιόνια`,
};

export const twoDigitTimes: Family = {
  id: 'two-digit-times',
  grade: 3,
  chapter: '11',
  topic: 'Πολλαπλασιασμός',
  source: 'Μαθηματικά Γ΄, κεφ. 11 «Πολλαπλασιασμός διψήφιου με μονοψήφιο αριθμό»',
  make(r, b) {
    const p = r.pick(PEOPLE);
    const s = r.pick(SETTINGS);
    const n = r.int(...s.n);
    const k = r.int(...s.k);
    const ones = k % 10;
    const tens = k - ones;
    if (!ones) return null;
    const total = n * k;
    const G = known(count(n, s.group, true));
    const K = known(KPHRASE[s.unit](k));
    const noise = s.noise(r);
    const ask = `${sought(s.ask(p))};`;
    const story = r.pick([
      () => `${s.groups(p, G)} ${s.each(K)} ${noise} ${ask}`,
      () => `${noise} ${s.groups(p, G)} ${s.each(K)} ${ask}`,
      () => `${s.each(K)} ${s.groups(p, G)} ${noise} ${ask}`,
    ].filter((_t, i) => (i !== 2 || s.eachFirst) && (i !== 1 || s.unit !== 'σελίδες')))();

    const steps: ProblemStep[] = [b.tag(undefined, 'Χρειαζόμαστε πόσες φορές και πόσο κάθε φορά.')];
    const round = ones >= 5 ? tens + 10 : tens;
    const estimate = ones !== 5 && r.chance(0.45);
    if (estimate) {
      steps.push(b.choice('plan', 'Πριν λύσουμε, κάνουμε μια εκτίμηση. Περίπου πόσα θα είναι;', `Περίπου ${fmt(n * round)}`,
        [`Περίπου ${fmt(n + round)}`, `Περίπου ${fmt(round)}`, `Περίπου ${fmt(n * round * 10)}`],
        `Το ${k} είναι κοντά στο ${round}. Πόσο κάνει ${n} φορές το ${round};`));
    } else {
      steps.push(b.choice('plan', 'Ποια πράξη μας βοηθά;', `${n} × ${k}`,
        [`${n} + ${k}`, `${k} − ${n}`, `${n} × ${tens}`].slice(0, r.int(2, 3)),
        `Έχουμε ${n} φορές το ίδιο: ${k}.`));
    }
    steps.push(b.numbers('solve', `Χωρίζουμε το ${k} σε ${tens} και ${ones}.`, r.chance(0.5) ? [
      { label: `Οι δεκάδες: ${n} × ${tens} =`, answer: n * tens },
      { label: `Οι μονάδες: ${n} × ${ones} =`, answer: n * ones },
      { label: 'Όλα μαζί: οι δεκάδες + οι μονάδες =', answer: total, unit: s.unit },
    ] : [
      { label: `${n} × ${tens} =`, answer: n * tens },
      { label: `${n} × ${ones} =`, answer: n * ones },
      { label: `${n} × ${k} =`, answer: total, unit: s.unit },
    ], `${n} × ${tens} είναι ${n} φορές ${tens === 10 ? '1 δεκάδα' : `${tens / 10} δεκάδες`}. Στο τέλος προσθέτουμε τα δύο γινόμενα.`));
    steps.push(estimate
      // Statements about the answer, not «Ναι»/«Όχι» (#83): the right one, or what a slip would give
      ? b.choice('check', 'Γιατί ταιριάζει με την εκτίμηση;', `Είναι ${fmt(total)}, κοντά στο ${fmt(n * round)}`,
        [`Είναι ${fmt(n + k)}, όσο ${n} + ${k}`, `Είναι ${fmt(n * tens + ones)}, όσο ${n} × ${tens} + ${ones}`],
        'Αν βγήκε πολύ μακριά από την εκτίμηση, κάτι πήγε στραβά.')
      : n <= 4
        ? b.choice('check', 'Πώς ελέγχουμε;', `${Array(n).fill(k).join(' + ')} = ${fmt(total)}`,
          // The units added once, not n times; or one time fewer
          [`${Array(n).fill(tens).join(' + ')} + ${ones} = ${fmt(n * tens + ones)}`,
            n > 2 ? `${Array(n - 1).fill(k).join(' + ')} = ${fmt((n - 1) * k)}` : `${n} + ${k} = ${n + k}`],
          `Προσθέτουμε ${n} φορές το ${k}.`)
        : b.choice('check', 'Γιατί η απάντηση είναι λογική;',
          `Είναι ανάμεσα στο ${fmt(n * tens)} και στο ${fmt(n * (tens + 10))}`,
          [[`Είναι ακριβώς ${fmt(n * tens + ones)}, όσο ${n} × ${tens} + ${ones}`, `Είναι ${fmt(n * tens + ones)}, όσο ${n} × ${tens} + ${ones}`],
            [`Είναι ακριβώς ${fmt(n + k)}, όσο ${n} + ${k}`, `Είναι ${fmt(n + k)}, όσο ${n} + ${k}`]],
          `Το ${k} είναι ανάμεσα στο ${tens} και στο ${tens + 10}. Άρα και η απάντηση είναι ανάμεσα σε ${n} × ${tens} και ${n} × ${tens + 10}.`));
    return { title: r.pick(['Δεκάδες και μονάδες', 'Πολλές φορές το ίδιο', 'Πολλαπλασιάζουμε', 'Κομμάτι κομμάτι']), story, steps };
  },
};
