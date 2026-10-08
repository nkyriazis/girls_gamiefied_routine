// One X is worth k Y (a card for 3 stickers, a crate holds 6 bottles): how many Y for n X
// (multiplication), how many X for m Y (division, perhaps with some left over), or what a
// mix of both is worth (Γ΄ κεφ. 17 «Πολλαπλασιασμοί» και κεφ. 18 «Διαιρέσεις»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { count, extra, fmt, HowMany, known, PEOPLE, sought, thing, type Family, type Person, type Rng, type Thing } from '../../lib.ts';

interface Setting {
  title: string;
  X: Thing;
  Y: Thing;
  k: [number, number];
  rate: (k: string) => string; // the sentence with the rate, k already marked
  has: (p: Person, n: string) => string; // "Η Ζωή έχει 5 κάρτες."
  hasY: (p: Person, m: string) => string; // "Η Ζωή έχει 20 αυτοκόλλητα."
  hint: string; // for the tag step
  askY: (p: Person) => string; // how many Y for all her X
  askX: (p: Person) => string; // how many X for her Y
  mixAsk: string; // what everything is worth in Y
  noise: (r: Rng, p: Person) => string;
}

const SETTINGS: Setting[] = [
  {
    title: 'Κάρτες και αυτοκόλλητα',
    X: thing('κάρτα', 'κάρτες', 'f'), Y: thing('αυτοκόλλητο', 'αυτοκόλλητα', 'n'), k: [2, 6],
    rate: k => `Στο διάλειμμα τα παιδιά ανταλλάσσουν κάρτες με αυτοκόλλητα. Μία κάρτα αξίζει ${k}.`,
    has: (p, n) => `${p.Nom} έχει ${n}.`,
    hasY: (p, m) => `${p.Nom} έχει ${m}.`,
    hint: 'Χρειαζόμαστε πόσα αυτοκόλλητα αξίζει μία κάρτα και πόσα έχει.',
    askY: p => `Πόσα αυτοκόλλητα μπορεί να πάρει για όλες τις κάρτες ${p.his}`,
    askX: () => 'Πόσες κάρτες μπορεί να πάρει',
    mixAsk: 'Πόσα αυτοκόλλητα αξίζουν όλα μαζί',
    noise: (r, p) => r.pick([
      `Στο διάλειμμα παίζουν ${extra(`${r.int(12, 30)} παιδιά`)}.`,
      `Το άλμπουμ ${p.his} έχει ${extra(`${r.int(20, 40)} σελίδες`)}.`,
      `Το διάλειμμα κρατάει ${extra(`${r.pick([15, 20])} λεπτά`)}.`,
    ]),
  },
  {
    title: 'Τα νομίσματα του παιχνιδιού',
    X: thing('χρυσό νόμισμα', 'χρυσά νομίσματα', 'n'), Y: thing('ασημένιο νόμισμα', 'ασημένια νομίσματα', 'n'), k: [3, 9],
    rate: k => `Σε ένα επιτραπέζιο παιχνίδι, ένα χρυσό νόμισμα αξίζει όσο ${k}.`,
    has: (p, n) => `${p.Nom} έχει ${n}.`,
    hasY: (p, m) => `${p.Nom} έχει ${m}.`,
    hint: 'Χρειαζόμαστε πόσα ασημένια αξίζει ένα χρυσό νόμισμα και πόσα νομίσματα έχει.',
    askY: p => `Πόσα ασημένια νομίσματα αξίζουν τα χρυσά ${p.gen}`,
    askX: () => 'Πόσα χρυσά νομίσματα μπορεί να πάρει στη θέση τους',
    mixAsk: 'Πόσα ασημένια νομίσματα αξίζουν όλα μαζί',
    noise: r => r.pick([
      `Στο παιχνίδι παίζουν ${extra(`${r.int(2, 4)} παίκτες`)}.`,
      `Το ταμπλό έχει ${extra(`${r.int(30, 60)} κουτάκια`)}.`,
      `Το παιχνίδι κρατάει περίπου ${extra(`${r.pick([30, 40, 45])} λεπτά`)}.`,
    ]),
  },
  {
    title: 'Αστέρια και πόντοι',
    X: thing('αστέρι', 'αστέρια', 'n'), Y: thing('πόντος', 'πόντοι', 'm', 'πόντους'), k: [2, 9],
    rate: k => `Στο παιχνίδι της τάξης, κάθε αστέρι αξίζει ${k}.`,
    has: (p, n) => `${p.Nom} μάζεψε αυτή την εβδομάδα ${n}.`,
    hasY: (p, m) => `${p.Nom} μάζεψε αυτή την εβδομάδα ${m}.`,
    hint: 'Χρειαζόμαστε πόσους πόντους αξίζει ένα αστέρι και πόσα μάζεψε.',
    askY: () => 'Πόσους πόντους έχει',
    askX: p => `Πόσα αστέρια μπορεί να πάρει με τους πόντους ${p.his}`,
    mixAsk: 'Πόσους πόντους έχει όλους μαζί',
    noise: r => r.pick([
      `Στην τάξη είναι ${extra(`${r.int(18, 25)} παιδιά`)}.`,
      `Η εβδομάδα είχε ${extra(`${r.int(4, 5)} μέρες`)} σχολείο.`,
      `Ο πίνακας με τα αστέρια έχει ${extra(`${r.int(5, 8)} στήλες`)}.`,
    ]),
  },
  {
    title: 'Τα κιβώτια',
    X: thing('κιβώτιο', 'κιβώτια', 'n'), Y: thing('μπουκάλι χυμό', 'μπουκάλια χυμό', 'n'), k: [6, 12],
    rate: k => `Σε ένα κιβώτιο χωράνε ${k}.`,
    has: (_p, n) => `Το κυλικείο του σχολείου έχει ${n}.`,
    hasY: (_p, m) => `Στην αποθήκη του κυλικείου υπάρχουν ${m}.`,
    hint: 'Χρειαζόμαστε πόσα μπουκάλια χωράει ένα κιβώτιο και πόσα έχουμε.',
    askY: () => 'Πόσα μπουκάλια χυμό έχει το κυλικείο',
    askX: () => 'Πόσα κιβώτια γεμίζουν',
    mixAsk: 'Πόσα μπουκάλια χυμό έχει όλα μαζί',
    noise: r => r.pick([
      `Το κυλικείο ανοίγει στις ${extra(`${r.int(8, 9)} το πρωί`)}.`,
      `Σήμερα έχει και ${extra(`${r.int(20, 50)} τοστ`)}.`,
      `Στο σχολείο φοιτούν ${extra(`${r.int(150, 400)} μαθητές`)}.`,
    ]),
  },
  {
    title: 'Στο λούνα παρκ',
    X: thing('γύρος', 'γύροι', 'm', 'γύρους'), Y: thing('μάρκα', 'μάρκες', 'f'), k: [2, 5],
    rate: k => `Στο λούνα παρκ, για έναν γύρο στα συγκρουόμενα χρειάζονται ${k}.`,
    has: (p, n) => `${p.Nom} θέλει να κάνει ${n}.`,
    hasY: (p, m) => `${p.Nom} έχει ${m}.`,
    hint: 'Χρειαζόμαστε πόσες μάρκες χρειάζεται ένας γύρος και πόσες έχουμε ή θέλουμε.',
    askY: () => 'Πόσες μάρκες χρειάζεται',
    askX: () => 'Πόσους γύρους μπορεί να κάνει',
    mixAsk: 'Πόσες μάρκες είναι όλες μαζί',
    noise: r => r.pick([
      `Το λούνα παρκ έχει ${extra(`${r.int(8, 20)} παιχνίδια`)}.`,
      `Το λούνα παρκ κλείνει στις ${extra(`${r.int(10, 11)} το βράδυ`)}.`,
      `Κάθε γύρος κρατάει ${extra(`${r.int(3, 5)} λεπτά`)}.`,
    ]),
  },
];

export const exchangeRate: Family = {
  id: 'exchange-rate',
  grade: 3,
  chapter: '18',
  topic: 'Πολλαπλασιασμός',
  source: 'Μαθηματικά Γ΄, κεφ. 17 «Πολλαπλασιασμοί» και κεφ. 18 «Διαιρέσεις»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const p = r.pick(PEOPLE);
    const k = r.int(...s.k);
    const { X, Y } = s;
    const rate = s.rate(known(count(k, Y, true)));
    const noise = s.noise(r, p);
    const dir = r.pick(['toY', 'toX', 'toX', 'mix'] as const);
    const steps: ProblemStep[] = [b.tag(undefined, s.hint)];
    const title = r.pick([s.title, 'Ανταλλαγές', 'Πόσα αξίζουν;']);

    if (dir === 'toY') {
      const n = r.int(3, k >= 10 ? 9 : 10);
      const story = `${rate} ${s.has(p, known(count(n, X, true)))} ${noise} ${sought(s.askY(p))};`;
      if (r.chance(0.6)) {
        steps.push(b.choice('plan', 'Ποια πράξη μας βοηθά;', `${n} × ${k}`, [`${n} + ${k}`, n > k ? `${n} − ${k}` : `${k} − ${n}`],
          `${cap(count(n, X))}: ${n} φορές από ${count(k, Y, true)}.`));
      }
      steps.push(b.numbers('solve', 'Λύνουμε.', [r.chance(0.5) ? { label: `${n} × ${k} =`, answer: n * k, unit: Y.many } : { label: cap(Y.many), answer: n * k }],
        k > 10 ? `${n} × 10 = ${n * 10} και ${n} × ${k - 10} = ${n * (k - 10)}.` : `Θυμήσου την προπαίδεια του ${k}.`));
      steps.push(b.choice('check', 'Πώς ελέγχουμε;', `${n * k} : ${k} = ${n}`, [`${n * k} + ${k} = ${n * k + k}`, `${n * k} − ${n} = ${n * k - n}`],
        `Αν μοιράσουμε ${the(Y)} ${n * k} ${Y.manyAcc} σε ομάδες των ${k}, πρέπει να βγουν ${n} ομάδες.`));
      return { title, story, steps };
    }

    if (dir === 'toX') {
      const q = r.int(3, k >= 10 ? 8 : 10);
      const rest = r.chance(0.5) ? r.int(1, k - 1) : 0;
      const m = q * k + rest;
      const story = `${rate} ${s.hasY(p, known(count(m, Y, true)))} ${noise} ${sought(s.askX(p))};${rest ? ` ${sought(`Θα περισσέψουν ${Y.many}`)};` : ''}`;
      if (r.chance(0.6)) {
        steps.push(b.choice('plan', 'Ποια πράξη μας βοηθά;', `${m} : ${k}`, [`${m} × ${k}`, `${m} − ${k}`],
          `Πόσες φορές χωράει το ${k} στο ${m};`));
      }
      if (!rest) {
        steps.push(b.numbers('solve', 'Λύνουμε.', [r.chance(0.5) ? { label: `${m} : ${k} =`, answer: q, unit: X.many } : { label: cap(X.many), answer: q }],
          `Ποιος αριθμός επί ${k} κάνει ${m};`));
        steps.push(b.choice('check', 'Πώς ελέγχουμε;', `${q} × ${k} = ${m}`, [`${q} + ${k} = ${q + k}`, `${m} + ${k} = ${m + k}`],
          'Η αντίστροφη πράξη της διαίρεσης είναι ο πολλαπλασιασμός.'));
      } else {
        steps.push(b.numbers('solve', `Μοιράζουμε ${the(Y)} ${m} ${Y.manyAcc} σε ομάδες των ${k}.`, [
          { label: cap(X.many), answer: q },
          { label: `${cap(Y.many)} που περισσεύουν`, answer: rest },
        ], `Σκέψου την προπαίδεια του ${k}: ποιο γινόμενο φτάνει πιο κοντά στο ${m} χωρίς να το ξεπερνά;`));
        steps.push(b.choice('check', 'Πώς ελέγχουμε;', `${q} × ${k} + ${rest} = ${m}`, [`${q} + ${k} + ${rest} = ${q + k + rest}`, `${q} × ${k} − ${rest} = ${q * k - rest}`],
          `${q} ομάδες των ${k}, μαζί με όσα περισσεύουν, πρέπει να κάνουν ${m}.`));
      }
      return { title, story, steps };
    }

    // A mix of both, counted in Y
    const n = r.int(2, k >= 10 ? 7 : 9), m = r.int(1, k - 1);
    if (m < 2 || s.title === 'Στο λούνα παρκ') return null; // "rides and tokens" don't add up
    const has = s.title === 'Τα κιβώτια'
      ? `Το κυλικείο έχει ${known(count(n, X, true))} γεμάτα και ${known(`${m} μπουκάλια`)} ακόμη.`
      : `${p.Nom} έχει ${known(count(n, X, true))} και ${known(count(m, Y, true))}.`;
    const story = `${rate} ${has} ${noise} ${sought(s.mixAsk)};`;
    steps.push(b.numbers('solve', 'Λύνουμε.', [
      r.chance(0.5) ? { label: `${n} × ${k} =`, answer: n * k, unit: Y.many } : { label: `${cap(Y.many)} για ${the(X)} ${n} ${X.manyAcc}`, answer: n * k },
      { label: `${cap(Y.many)} για ${the(X)} ${X.manyAcc} + ${m} =`, answer: n * k + m, unit: Y.many },
    ], s.title === 'Τα κιβώτια'
      ? 'Πρώτα βρίσκουμε πόσα μπουκάλια έχουν τα γεμάτα κιβώτια. Μετά προσθέτουμε τα μπουκάλια που είναι έξω από κιβώτια.'
      : `Πρώτα βρίσκουμε πόσ${Y.g === 'f' ? 'ες' : Y.g === 'm' ? 'ους' : 'α'} ${Y.manyAcc} αξίζουν ${the(X, false)} ${X.many}. Μετά προσθέτουμε ${the(Y)} ${Y.manyAcc} που υπάρχουν ήδη.`));
    steps.push(b.choice('check', 'Ποιο λάθος κάνει όποιος απαντήσει ' + fmt(n + m) + ';', 'Τα προσθέτει σαν να ήταν ίδια',
      [['Κανένα, αυτή είναι η σωστή απάντηση', 'Κανένα, είναι σωστή', 'Κανένα, είναι η σωστή απάντηση'], ['Μετράει μόνο το ένα είδος', 'Μετράει μόνο ένα είδος', 'Μετράει μόνο το ένα από τα δύο είδη']],
      `${cap(X.g === 'm' ? 'ένας' : X.g === 'f' ? 'μία' : 'ένα')} ${X.one} δεν είναι ${Y.g === 'm' ? 'ένας' : Y.g === 'f' ? 'μία' : 'ένα'} ${Y.one}.`));
    return { title, story, steps };
  },
};

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
const the = (t: Thing, acc = true) => (t.g === 'n' ? 'τα' : t.g === 'f' ? (acc ? 'τις' : 'οι') : acc ? 'τους' : 'οι');
