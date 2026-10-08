// n chairs, trees or tiles in equal rows: which row lengths work (the divisors of n),
// how many ways, which arrangement is impossible (Ε΄ κεφ. 2.10 «Πολλαπλάσια και διαιρέτες»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, count, extra, fmt, known, people, sought, thing, type Family, type Rng, type Thing } from '../../lib.ts';

const divisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter(d => n % d === 0);
const list = (xs: number[]) => (xs.length === 1 ? fmt(xs[0]) : `${xs.slice(0, -1).map(fmt).join(', ')} και ${fmt(xs[xs.length - 1])}`);

interface Setting {
  title: string[];
  item: Thing;
  /** "ίσες σειρές" of chairs, or "ίσες σειρές" of trees: what a row is called in the answers */
  sizes: number[];
  /** The opening: who arranges how many, in a known phrase, and a noise phrase */
  open: (r: Rng, n: string) => string;
  /** "θέλει να τις βάλει" */
  put: string;
}

const NS = [24, 30, 36, 40, 42, 48, 54, 56, 60, 64, 72, 80, 84, 90, 96, 100, 108, 120, 126, 144];

const SETTINGS: Setting[] = [
  {
    title: ['Οι καρέκλες της γιορτής', 'Η αίθουσα εκδηλώσεων'],
    item: thing('καρέκλα', 'καρέκλες', 'f'), sizes: NS.filter(n => n >= 36),
    open: (r, n) => { const [p] = people(r, 1); return `Για τη γιορτή ${extra(r.pick(['της 28ης Οκτωβρίου', 'της 25ης Μαρτίου', 'της 17ης Νοεμβρίου']))}, ${p.nom} και οι συμμαθητές ${p.his} έφεραν στην αίθουσα ${n}.`; },
    put: 'Θέλουν να τις βάλουν',
  },
  {
    title: ['Ο λεμονόκηπος', 'Φυτεύουμε λεμονιές'],
    item: thing('λεμονιά', 'λεμονιές', 'f'), sizes: NS,
    open: (r, n) => `Ένας αγρότης αγόρασε ${n} για το χωράφι του, ${extra(`που έχει έκταση ${r.int(3, 9)} στρέμματα`)}.`,
    put: 'Θέλει να τις φυτέψει',
  },
  {
    title: ['Η γυμναστική επίδειξη', 'Στο προαύλιο'],
    item: thing('μαθητής', 'μαθητές', 'm', 'μαθητές'), sizes: NS.filter(n => n >= 40),
    open: (r, n) => `Στη γυμναστική επίδειξη του σχολείου, ${extra(`που θα κρατήσει ${r.int(15, 40)} λεπτά`)}, θα πάρουν μέρος ${n}.`,
    put: 'Ο γυμναστής θέλει να τους βάλει',
  },
  {
    title: ['Τα κεκάκια', 'Το μεγάλο ταψί'],
    item: thing('κεκάκι', 'κεκάκια', 'n'), sizes: NS.filter(n => n <= 72),
    open: (r, n) => { const [p] = people(r, 1); return `${p.Nom} έψησε ${n} για τη γιορτή του σχολείου· ${extra(`ψήθηκαν σε ${r.int(20, 35)} λεπτά`)}.`; },
    put: 'Θέλει να τα βάλει στο ταψί',
  },
  {
    title: ['Τα πλακάκια', 'Η βεράντα'],
    item: thing('πλακάκι', 'πλακάκια', 'n'), sizes: NS,
    open: (r, n) => `Ένας τεχνίτης έχει ${n}, ${extra(`που κοστίζουν ${r.int(2, 9)} € το καθένα`)}, για ένα ορθογώνιο κομμάτι της βεράντας.`,
    put: 'Θέλει να τα βάλει',
  },
  {
    title: ['Ο χώρος στάθμευσης', 'Το νέο πάρκινγκ'],
    item: thing('θέση', 'θέσεις', 'f'), sizes: NS.filter(n => n >= 48),
    open: (r, n) => `Ο δήμος φτιάχνει έναν χώρο στάθμευσης με ${n}, ${extra(`που θα είναι ανοιχτός από τις ${r.int(6, 8)} το πρωί`)}.`,
    put: 'Θέλει να τις χωρίσει',
  },
];

export const arrangeRows: Family = {
  id: 'arrange-rows',
  grade: 5,
  chapter: '2.10',
  topic: 'Διαίρεση',
  source: 'Μαθηματικά Ε΄, κεφ. 2.10 «Πολλαπλάσια και διαιρέτες»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const n = r.pick(s.sizes);
    const it = s.item;
    const ds = divisors(n);
    const inner = ds.filter(d => d > 1 && d < n);
    const ask = r.pick(['ways', 'range', 'impossible'] as const);
    const opening = s.open(r, known(count(n, it, true)));

    // "range": row lengths from lo to hi; at least two work and at least one doesn't
    const lo = r.int(3, 8), hi = lo + r.int(4, 8);
    const inRange = inner.filter(d => d >= lo && d <= hi);
    const notIn = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter(d => n % d !== 0);
    if (ask === 'range' && (inRange.length < 2 || inRange.length > 4 || !notIn.length)) return null;
    // "impossible": one length that doesn't divide, among ones that do
    const bad = r.pick(Array.from({ length: 12 }, (_, i) => i + 3).filter(d => n % d !== 0));
    const goods = r.sample(inner.filter(d => d >= 3 && d <= 20), 3);
    // A two-digit row length among them when the impossible one has two digits (its length mustn't tell)
    const twoDigit = inner.filter(d => d >= 10 && d <= 20 && !goods.includes(d));
    if (bad >= 10 && goods.length === 3 && goods.every(g => g < 10) && twoDigit.length) goods[0] = r.pick(twoDigit);
    if (ask === 'impossible' && goods.length < 3) return null;

    const rowWord = (d: number) => `σειρές των ${fmt(d)}`;
    const plural = /^Θέλουν/.test(s.put);
    const storyQ = ask === 'ways'
      ? `${s.put} σε ίσες σειρές, ${known(`με τουλάχιστον 2 σειρές και τουλάχιστον ${count(2, it, true)} σε κάθε σειρά`)}. `
        + `${sought(`Με πόσους διαφορετικούς τρόπους ${plural ? 'μπορούν να το κάνουν' : 'μπορεί να το κάνει'}`)};`
      : ask === 'range'
        ? `${s.put} σε ίσες σειρές, ${known(`με ${fmt(lo)} ως ${fmt(hi)} ${it.manyAcc} σε κάθε σειρά`)}, χωρίς να περισσέψει ${nobody(it)}. `
          + `${sought(`${howManyCap(it)} ${it.manyAcc} μπορεί να έχει κάθε σειρά`)};`
        : `${s.put} σε ίσες σειρές, χωρίς να περισσέψει ${nobody(it)}. ${plural ? 'Σκέφτηκαν' : 'Σκέφτηκε'} ${known(`σειρές με ${list([...goods, bad].sort((x, y) => x - y))} ${it.manyAcc}`)}. `
          + `${sought('Ποια από αυτές τις διατάξεις δεν γίνεται')};`;
    const story = `${opening} ${storyQ}`;

    const steps: ProblemStep[] = [
      b.tag(undefined, 'Ό,τι δεν αλλάζει τις σειρές δεν χρειάζεται.'),
    ];
    if (r.chance(0.6)) {
      steps.push(b.choice('plan', 'Τι ψάχνουμε στην ουσία;', `Τους διαιρέτες του ${fmt(n)}`,
        [[`Τα πολλαπλάσια του ${fmt(n)}`, `Πολλαπλάσια του ${fmt(n)}`, `Όλα τα πολλαπλάσια του ${fmt(n)}`], [`Το Ε.Κ.Π. του ${fmt(n)} και του ${fmt(r.pick(inner))}`],
          ['Αριθμούς που τελειώνουν σε 0 ή 5', 'Αριθμούς που λήγουν σε 0 ή 5', 'Όσους λήγουν σε 0 ή 5']],
        `Όλες οι σειρές έχουν τον ίδιο αριθμό και δεν περισσεύει ${nobody(it)}: το ${fmt(n)} πρέπει να διαιρείται ακριβώς με τον αριθμό κάθε σειράς.`));
    }
    if (ask === 'ways') {
      steps.push(b.numbers('solve', `Βρίσκουμε τους διαιρέτες του ${fmt(n)}.`, [
        { label: `Διαιρέτες του ${fmt(n)}, μαζί με το 1 και το ${fmt(n)}`, answer: ds.length },
        { label: r.chance(0.5) ? `Χωρίς το 1 και το ${fmt(n)}` : 'Τρόποι που γίνονται', answer: inner.length },
      ], `Ψάχνουμε ζευγάρια: 1 × ${fmt(n)}, 2 × ${fmt(n / 2)}, … Με 1 σε κάθε σειρά ή με όλ${it.g === 'f' ? 'ες' : it.g === 'm' ? 'ους' : 'α'} σε μία σειρά δεν έχουμε τουλάχιστον ${2} σε κάθε σειρά και ${2} σειρές.`));
      // (a number that isn't a divisor among them: as long as the right list)
      const stray = Array.from({ length: n - 2 }, (_, i) => i + 2).find(d => n % d !== 0)!;
      const withStray = [...inner, stray].sort((x, y) => x - y);
      const right = `${inner.length} τρόποι: ${list(inner)}`;
      const wrong = [`${ds.length} τρόποι: ${list(ds)}`, `${withStray.length} τρόποι: ${list(withStray)}`, `${inner.length - 1} τρόποι: ${list(inner.slice(0, -1))}`]
        .filter((o, i, a) => o !== right && a.indexOf(o) === i);
      steps.push(b.choice('check', `Αναστοχαζόμαστε: πόσοι τρόποι είναι, και ${howManyCap(it).toLowerCase()} ${it.manyAcc} έχει κάθε σειρά;`, right,
        wrong, `Το 1 και το ${fmt(n)} τα βγάζουμε. Οι 3 σειρές των 4 και οι 4 σειρές των 3 είναι διαφορετικοί τρόποι.`));
    } else if (ask === 'range') {
      const wrongA = [...inRange, notIn[0]].sort((x, y) => x - y);
      const wrongB = inRange.slice(0, -1);
      const wrongC = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter(d => d % 2 === 0);
      const right = list(inRange);
      // (one fewer only from three on: «10» beside «10 και 12» stands out; else the last swapped for one that doesn't divide)
      const wrongs = [list(wrongA), wrongB.length >= 2 ? list(wrongB) : list([...inRange.slice(0, -1), notIn[0]].sort((x, y) => x - y)), list(wrongC)].filter((o, i, a) => o !== right && a.indexOf(o) === i);
      steps.push(b.choice('solve', `Ποιοι αριθμοί από το ${fmt(lo)} ως το ${fmt(hi)} διαιρούν ακριβώς το ${fmt(n)};`, right, wrongs,
        `Δοκιμάζουμε έναν έναν: διαιρείται το ${fmt(n)} ακριβώς με το ${fmt(inRange[0])};`));
      steps.push(b.numbers('solve', 'Πόσες σειρές βγαίνουν κάθε φορά;',
        inRange.map(d => ({ label: r.chance(0.5) ? `Με ${fmt(d)} σε κάθε σειρά: ${fmt(n)} : ${fmt(d)} =` : `Με ${fmt(d)} σε κάθε σειρά`, answer: n / d, unit: 'σειρές', eq: `${fmt(n)} : ${fmt(d)}` }))));
      steps.push(b.numbers('check', 'Αναστοχαζόμαστε: βγαίνουν πάλι όλ' + (it.g === 'f' ? 'ες' : it.g === 'm' ? 'οι' : 'α') + ';',
        [{ label: `${fmt(inRange[0])} × ${fmt(n / inRange[0])} =`, answer: n }]));
    } else {
      const q = Math.floor(n / bad), rest = n % bad;
      steps.push(b.choice('solve', 'Ποια διάταξη δεν γίνεται;', `${cap(rowWord(bad))}`, goods.map(g => cap(rowWord(g))),
        `Διαιρείται το ${fmt(n)} ακριβώς με καθέναν από τους αριθμούς;`));
      steps.push(b.numbers('solve', 'Πόσες σειρές βγαίνουν με τις άλλες;',
        [...goods].sort((x, y) => x - y).map(d => ({ label: `Με ${fmt(d)} σε κάθε σειρά: ${fmt(n)} : ${fmt(d)} =`, answer: n / d, unit: 'σειρές' }))));
      steps.push(b.choice('check', `Γιατί δεν γίνονται ${rowWord(bad)};`, `Γιατί ${fmt(bad)} × ${fmt(q)} + ${fmt(rest)} = ${fmt(n)}`,
        [`Γιατί το ${fmt(bad)} είναι ${bad % 2 ? 'περιττός' : 'άρτιος'}`, `Γιατί ${fmt(bad)} σειρές δεν χωράνε`, `Γιατί ${fmt(n)} + ${fmt(bad)} = ${fmt(n + bad)}`],
        `Κάνουμε τη διαίρεση ${fmt(n)} : ${fmt(bad)} και κοιτάμε το υπόλοιπο.`));
    }
    return { title: r.pick(s.title), story, steps };
  },
};

const nobody = (t: Thing) => (t.g === 'f' ? 'καμία' : t.g === 'm' ? 'κανένας' : 'κανένα');
const howManyCap = (t: Thing) => (t.g === 'f' ? 'Πόσες' : t.g === 'm' ? 'Πόσους' : 'Πόσα');
