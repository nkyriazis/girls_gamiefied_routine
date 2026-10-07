// n things (sometimes made on two days) packed k to a box: full boxes, left over,
// boxes needed (Ε΄ Επαναληπτικό 2, 1ο πρόβλημα: 684 και 536 σοκολατάκια σε κουτιά των 20;
// κεφ. 2.12 «Η διαίρεση στους φυσικούς αριθμούς»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, count, extra, fmt, howMany, HowMany, known, sought, the, thing, type Family, type Rng, type Thing } from '../../lib.ts';

interface Box {
  t: Thing;
  full: string;  // "γεμάτα" / "γεμάτες"
  last: string;  // "το τελευταίο κουτί" / "την τελευταία θήκη"
  each: string;  // "που καθένα χωράει" / "που καθεμιά χωράει"
}
const box = (one: string, many: string, g: 'n' | 'f', last: string): Box => ({
  t: thing(one, many, g), full: g === 'n' ? 'γεμάτα' : 'γεμάτες', last, each: g === 'n' ? 'που καθένα χωράει' : 'που καθεμιά χωράει',
});

interface Setting {
  title: string[];
  item: Thing;
  box: Box;
  sizes: number[];
  /** A single lot, or two days, each a known phrase. */
  one: (n: string, noise: string) => string;
  two: (a: string, b: string, noise: string) => string;
  /** "Θέλει να τα συσκευάσει": who packs them */
  packs: string;
  noise: (r: Rng) => string;
  lot: [number, number];
}

const DAYS = [['τη Δευτέρα', 'την Τρίτη'], ['την Τετάρτη', 'την Πέμπτη'], ['την Παρασκευή', 'το Σάββατο'], ['τη μια ημέρα', 'την άλλη']];

const SETTINGS: Setting[] = [
  {
    title: ['Τα σοκολατάκια', 'Το εργαστήριο ζαχαροπλαστικής'],
    item: thing('σοκολατάκι', 'σοκολατάκια', 'n'), box: box('κουτί', 'κουτιά', 'n', 'το τελευταίο κουτί'), sizes: [12, 16, 20, 24, 25],
    one: (n, noise) => `Ένα εργαστήριο ζαχαροπλαστικής, ${noise}, έφτιαξε ${n}.`,
    two: (a, b, noise) => `Ένα εργαστήριο ζαχαροπλαστικής, ${noise}, έφτιαξε ${a} και ${b}.`,
    packs: 'Θέλει να τα συσκευάσει',
    noise: r => extra(`που έχει ${r.int(3, 9)} υπαλλήλους`), lot: [180, 990],
  },
  {
    title: ['Τα αυγά του πτηνοτροφείου', 'Οι αυγοθήκες'],
    item: thing('αυγό', 'αυγά', 'n'), box: box('θήκη', 'θήκες', 'f', 'την τελευταία θήκη'), sizes: [6, 10, 12, 30],
    one: (n, noise) => `Σε ένα πτηνοτροφείο, ${noise}, μάζεψαν σήμερα ${n}.`,
    two: (a, b, noise) => `Σε ένα πτηνοτροφείο, ${noise}, μάζεψαν ${a} και ${b}.`,
    packs: 'Θέλουν να τα βάλουν',
    noise: r => extra(`που έχει ${r.int(3, 8)} κοτέτσια`), lot: [240, 980],
  },
  {
    title: ['Τα κουλουράκια', 'Ο φούρνος της γειτονιάς'],
    item: thing('κουλουράκι', 'κουλουράκια', 'n'), box: box('σακουλάκι', 'σακουλάκια', 'n', 'το τελευταίο σακουλάκι'), sizes: [8, 10, 12, 15],
    one: (n, noise) => `Ο φούρνος της γειτονιάς, ${noise}, έψησε για το Πάσχα ${n}.`,
    two: (a, b, noise) => `Ο φούρνος της γειτονιάς, ${noise}, έψησε για το Πάσχα ${a} και ${b}.`,
    packs: 'Θέλει να τα συσκευάσει',
    noise: r => extra(`που ανοίγει στις ${r.int(5, 7)} το πρωί`), lot: [150, 700],
  },
  {
    title: ['Οι κονσέρβες', 'Το κονσερβοποιείο'],
    item: thing('κονσέρβα', 'κονσέρβες', 'f'), box: box('κιβώτιο', 'κιβώτια', 'n', 'το τελευταίο κιβώτιο'), sizes: [6, 12, 20, 24],
    one: (n, noise) => `Ένα κονσερβοποιείο, ${noise}, γέμισε σε μία βάρδια ${n}.`,
    two: (a, b, noise) => `Ένα κονσερβοποιείο, ${noise}, γέμισε ${a} και ${b}.`,
    packs: 'Θέλει να τις βάλει',
    noise: r => extra(`με ${r.int(25, 80)} εργάτες`), lot: [400, 2400],
  },
  {
    title: ['Το μέλι', 'Τα βάζα με το μέλι'],
    item: thing('βάζο μέλι', 'βάζα μέλι', 'n'), box: box('κιβώτιο', 'κιβώτια', 'n', 'το τελευταίο κιβώτιο'), sizes: [6, 8, 12, 15],
    one: (n, noise) => `Ένας μελισσοκόμος, ${noise}, γέμισε φέτος ${n}.`,
    two: (a, b, noise) => `Ένας μελισσοκόμος, ${noise}, γέμισε ${a} και ${b}.`,
    packs: 'Θέλει να τα βάλει',
    noise: r => extra(`που έχει ${r.int(30, 90)} κυψέλες`), lot: [60, 260],
  },
  {
    title: ['Η μετακόμιση της βιβλιοθήκης', 'Οι κούτες με τα βιβλία'],
    item: thing('βιβλίο', 'βιβλία', 'n'), box: box('κούτα', 'κούτες', 'f', 'την τελευταία κούτα'), sizes: [20, 25, 30, 40],
    one: (n, noise) => `Η δημοτική βιβλιοθήκη, ${noise}, μετακομίζει. Οι υπάλληλοι πρέπει να μεταφέρουν ${n}.`,
    two: (a, b, noise) => `Η δημοτική βιβλιοθήκη, ${noise}, μετακομίζει. Οι υπάλληλοι κατέβασαν από τα ράφια ${a} και ${b}.`,
    packs: 'Θέλουν να τα βάλουν',
    noise: r => extra(`που είναι ανοιχτή ${r.int(5, 6)} ημέρες την εβδομάδα`), lot: [350, 1900],
  },
];

export const packRoundUp: Family = {
  id: 'pack-round-up',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, Επαναληπτικό 2, 1ο πρόβλημα; κεφ. 2.12 «Η διαίρεση στους φυσικούς αριθμούς»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const k = r.pick(s.sizes);
    const twoDays = r.chance(0.55);
    const x = r.int(...s.lot), y = r.int(...s.lot);
    const n = twoDays ? x + y : r.int(s.lot[0], 2 * s.lot[1]);
    const q = Math.floor(n / k), rest = n % k;
    if (rest === 0 || q < 8 || q > 300) return null;
    const { item, box: bx } = s;
    const [d1, d2] = r.pick(DAYS);
    const opening = twoDays
      ? s.two(known(`${d1} ${count(x, item, true)}`), known(`${d2} ${fmt(y)}`), s.noise(r))
      : s.one(known(count(n, item, true)), s.noise(r));
    const into = `${s.packs} σε ${bx.t.many} ${bx.each} ${known(count(k, item, true))}.`;

    // What we ask: the boxes needed; the full boxes and what is left; how many more fill the last one
    const ask = r.pick(['need', 'full', 'more'] as const);
    const question = ask === 'need'
      ? sought(`${HowMany(bx.t)} ${bx.t.many} θα χρειαστ${s.packs.startsWith('Θέλουν') ? 'ούν' : 'εί'}`)
      : ask === 'full'
        ? `${sought(`${HowMany(bx.t)} ${bx.t.many} θα γεμίσουν`)} και ${sought(`${howMany(item, false)} ${item.many} θα περισσέψουν`)}`
        : sought(`${HowMany(item, false)} ${item.many} ακόμα χρειάζονται, για να γεμίσει και ${lastNom(bx)}`);
    const story = `${opening} ${into} ${question};`;

    const steps: ProblemStep[] = [
      b.tag(undefined, `Χρειαζόμαστε ${item.g === 'f' ? 'πόσες είναι όλες' : 'πόσα είναι όλα'}${twoDays ? ' μαζί' : ''} και ${item.g === 'f' ? 'πόσες' : 'πόσα'} χωράει ${oneBox(bx)}. Τα υπόλοιπα δεν αλλάζουν την απάντηση.`),
    ];
    const all = twoDays ? `${fmt(x)} + ${fmt(y)} = ${fmt(n)}. ` : '';
    if (twoDays && r.chance(0.4)) {
      steps.push(b.order('plan', 'Βάζουμε σε σειρά το σχέδιό μας.', [
        `Βρίσκω ${howManyAll(item)} είναι ${item.g === 'f' ? 'όλες' : 'όλα'} μαζί`,
        `Διαιρώ με το ${k}`,
        'Κοιτάζω το πηλίκο και το υπόλοιπο',
        'Απαντώ σε αυτό που ρωτάει το πρόβλημα',
      ], 'Πρώτα όλα μαζί, μετά η διαίρεση.'));
    } else if (r.chance(0.5)) {
      steps.push(b.choice('plan', `Με ποια πράξη βρίσκουμε ${howMany2(bx)} ${bx.t.many} γεμίζουν;`,
        `Κάνω ${fmt(n)} : ${k}`,
        [`Κάνω ${fmt(n)} × ${k}`, `Κάνω ${fmt(n)} − ${k}`, ...(twoDays ? [`Κάνω ${fmt(x)} : ${k}`] : [])],
        `Σε κάθε ${bx.t.one} μπαίνουν ${k}: πόσες φορές χωράει το ${k} στο ${fmt(n)};`));
    }

    const rows = [
      ...(twoDays ? [{ label: `${cap2(item.many)} και τις δύο ημέρες: ${fmt(x)} + ${fmt(y)} =`, answer: n }] : []),
      { label: r.chance(0.5) ? `${cap(bx.full)} ${bx.t.many} (${fmt(n)} : ${k}, το πηλίκο)` : `${cap(bx.full)} ${bx.t.many}`, answer: q },
      { label: `${cap2(item.many)} που περισσεύουν`, answer: rest },
    ];
    if (ask === 'need') {
      steps.push(b.numbers('solve', 'Λύνουμε.', rows, `${all}${k} × ${q} = ${fmt(k * q)}.`));
      steps.push(b.choice('solve', `${HowMany(bx.t)} ${bx.t.many} χρειάζονται;`, count(q + 1, bx.t),
        [count(q, bx.t), count(q + 2, bx.t), count(rest, bx.t)].filter((o, i, a) => o !== count(q + 1, bx.t) && a.indexOf(o) === i),
        `${cap(item.g === 'f' ? 'όσες' : 'όσα')} περισσεύουν δεν μπορούν να μείνουν έξω: θέλουν κι ${item.g === 'f' ? 'αυτές' : 'αυτά'} ${oneBox(bx)}.`));
    } else if (ask === 'full') {
      steps.push(b.numbers('solve', 'Λύνουμε.', rows, `${all}${k} × ${q} = ${fmt(k * q)}.`));
    } else {
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        ...rows,
        { label: r.chance(0.5) ? `Λείπουν από ${lastAcc(bx)}: ${k} − ${rest} =` : `Λείπουν από ${lastAcc(bx)}`, answer: k - rest, unit: item.many },
      ], `${all}${k} × ${q} = ${fmt(k * q)}. ${cap2(lastNom(bx))} έχει μόνο ${rest}.`));
    }

    if (r.chance(0.5)) {
      steps.push(b.numbers('check', 'Αναστοχαζόμαστε: βγαίνουν πάλι όλα;', [{ label: `${k} × ${q} + ${rest} =`, answer: n }],
        'Δ = δ × π + υ: διαιρέτης επί πηλίκο, συν το υπόλοιπο.'));
    } else {
      steps.push(b.choice('check', 'Πώς ελέγχουμε τη διαίρεση;', `${k} × ${q} + ${rest} = ${fmt(n)}`,
        [`${k} × ${q} = ${fmt(n)}`, `${k} × ${q} − ${rest} = ${fmt(k * q - rest)}`, `${fmt(n)} + ${k} = ${fmt(n + k)}`].filter(o => o !== `${k} × ${q} + ${rest} = ${fmt(n)}`),
        'Το υπόλοιπο δεν το ξεχνάμε.'));
    }
    return { title: r.pick(s.title), story, steps };
  },
};

const cap2 = (s: string) => s[0].toUpperCase() + s.slice(1);
const oneBox = (bx: Box) => (bx.t.g === 'f' ? `μία ${bx.t.one}` : `ένα ${bx.t.one}`);
const lastNom = (bx: Box) => bx.last.replace(/^την /, 'η ').replace(/^τη /, 'η ');
const lastAcc = (bx: Box) => bx.last;
const howManyAll = (t: Thing) => (t.g === 'f' ? `πόσες ${t.many}` : `πόσα ${t.many}`);
const howMany2 = (bx: Box) => (bx.t.g === 'f' ? 'πόσες' : 'πόσα');
