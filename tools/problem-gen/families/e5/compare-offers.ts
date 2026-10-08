// Two offers for the same thing: a pack of 6 for 9 € or a pack of 4 for 7 €. Compare the
// cost of the same quantity (a common multiple of the pack sizes): which is cheaper and by
// how much (Ε΄ κεφ. 2.10 «Πολλαπλάσια και διαιρέτες» και 2.9 «Ο πολλαπλασιασμός»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, extra, fmt, known, people, sought, thing, type Family, type Rng, type Thing } from '../../lib.ts';

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

interface Setting {
  title: string[];
  item: Thing;
  pack: string;   // "πακέτο", "κουτί"
  packs: string;  // "πακέτα"
  sizes: number[];
  /** Price of one, in cents: the pack prices are rounded to whole euros */
  cents: [number, number];
  noise: (r: Rng) => string;
}

const SETTINGS: Setting[] = [
  {
    title: ['Τα γιαούρτια', 'Στο σούπερ μάρκετ'], item: thing('γιαούρτι', 'γιαούρτια', 'n'), pack: 'πακέτο', packs: 'πακέτα',
    sizes: [2, 3, 4, 6, 8], cents: [70, 160], noise: r => `Τα γιαούρτια λήγουν σε ${extra(`${r.int(10, 25)} ημέρες`)}.`,
  },
  {
    title: ['Τα τετράδια', 'Στο βιβλιοπωλείο'], item: thing('τετράδιο', 'τετράδια', 'n'), pack: 'πακέτο', packs: 'πακέτα',
    sizes: [3, 4, 5, 6, 10], cents: [90, 250], noise: r => `Κάθε τετράδιο έχει ${extra(`${r.step(40, 100, 10)} φύλλα`)}.`,
  },
  {
    title: ['Τα μπαλάκια του τένις', 'Στο αθλητικό κατάστημα'], item: thing('μπαλάκι', 'μπαλάκια', 'n'), pack: 'κουτί', packs: 'κουτιά',
    sizes: [3, 4, 6], cents: [120, 250], noise: r => `Ο σύλλογος έχει ${extra(`${r.int(3, 8)} γήπεδα`)}.`,
  },
  {
    title: ['Οι μπαταρίες', 'Μπαταρίες για τα τηλεχειριστήρια'], item: thing('μπαταρία', 'μπαταρίες', 'f'), pack: 'πακέτο', packs: 'πακέτα',
    sizes: [2, 4, 6, 8, 10], cents: [80, 200], noise: r => `Στο σπίτι υπάρχουν ${extra(`${r.int(3, 6)} τηλεχειριστήρια`)}.`,
  },
  {
    title: ['Οι χυμοί', 'Χυμοί για την εκδρομή'], item: thing('χυμός', 'χυμοί', 'm', 'χυμούς'), pack: 'πακέτο', packs: 'πακέτα',
    sizes: [3, 4, 6, 8, 10], cents: [60, 140], noise: r => `Η εκδρομή θα κρατήσει ${extra(`${r.int(5, 9)} ώρες`)}.`,
  },
  {
    title: ['Οι μαρκαδόροι', 'Για το εργαστήρι ζωγραφικής'], item: thing('μαρκαδόρος', 'μαρκαδόροι', 'm', 'μαρκαδόρους'), pack: 'κουτί', packs: 'κουτιά',
    sizes: [6, 8, 10, 12, 18, 24], cents: [40, 110], noise: r => `Στο εργαστήρι ζωγραφίζουν ${extra(`${r.int(12, 25)} παιδιά`)}.`,
  },
];

export const compareOffers: Family = {
  id: 'compare-offers',
  grade: 5,
  chapter: '2.12',
  topic: 'Πολλαπλασιασμός',
  source: 'Μαθηματικά Ε΄, κεφ. 2.10 «Πολλαπλάσια και διαιρέτες» (κοινά πολλαπλάσια) και 2.9 «Ο πολλαπλασιασμός»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const it = s.item;
    const [a, c] = r.sample(s.sizes, 2).sort((x, y) => x - y);
    if (c % a === 0 && r.chance(0.7)) return null;
    const L = (a / gcd(a, c)) * c;
    if (L > 48) return null;
    // Both packs near the same price per item (the shop's usual price, give or take a little)
    const unit = r.int(...s.cents);
    const pa = Math.max(1, Math.round((a * unit * r.int(80, 120)) / 10_000));
    const pc = Math.max(1, Math.round((c * unit * r.int(80, 120)) / 10_000));
    const costA = (L / a) * pa, costC = (L / c) * pc;
    if (costA === costC || pc <= pa) return null;
    const cheaper = costA < costC ? 'a' : 'c';
    const diff = Math.abs(costA - costC);

    const asksN = r.chance(0.5);
    const mult = asksN && (r.chance(0.5) || L === c) ? 2 : 1;
    const N = L * mult;
    const [p, q] = people(r, 2);
    const offerA = `${s.pack} με ${a} ${it.manyAcc} για ${pa} €`;
    const offerC = `${s.pack} με ${c} ${it.manyAcc} για ${pc} €`;
    const frame = r.int(0, 2);
    const shops = frame === 0
      ? `Το κατάστημα Α πουλά ${known(offerA)} και το κατάστημα Β ${known(offerC)}.`
      : `Στο ίδιο ράφι υπάρχουν δύο συσκευασίες: ${known(offerA)} και ${known(offerC)}.`;
    // Who wants them, and how many (sometimes the kid must choose the quantity)
    const want = asksN
      ? `${p.Nom} θέλει να αγοράσει ${known(`${N} ${it.manyAcc}`)}.`
      : `${p.Nom} θέλει να αγοράσει ${it.manyAcc} και αναρωτιέται ποια συσκευασία συμφέρει.`;
    const claim = !asksN && frame === 2
      ? ` ${known(`${q.Nom} λέει ότι συμφέρει το ${s.pack} των ${a}, γιατί κοστίζει λιγότερο`)}.`
      : '';
    const cheaperIsA = cheaper === 'a';
    const question = asksN
      ? `${sought('Πόσα € θα πληρώσει με κάθε συσκευασία')} και ${sought('πόσα θα γλιτώσει με τη φθηνότερη')};`
      : `${claim ? `${sought('Έχει δίκιο')}; ` : ''}${sought('Ποια συσκευασία συμφέρει')};`;
    const story = `${want} ${frame === 2 ? shops.replace('Στο ίδιο ράφι', 'Στο ράφι') : shops} ${s.noise(r)}${claim} ${question}`;

    const A = `${cap(s.packs)} των ${a}`, C = `${cap(s.packs)} των ${c}`;
    const steps: ProblemStep[] = [
      b.tag(undefined, 'Ό,τι δεν αλλάζει τις τιμές δεν χρειάζεται.'),
    ];
    if (!asksN) {
      steps.push(b.choice('plan', 'Πώς συγκρίνουμε σωστά τις δύο συσκευασίες;',
        `Βρίσκω πόσο κοστίζουν ${L} ${it.many}`,
        [[`Συγκρίνω μόνο τις τιμές ${pa} € και ${pc} €`, `Συγκρίνω μόνο ${pa} € και ${pc} €`, `Συγκρίνω τις τιμές ${pa} € και ${pc} €`],
          [`Προσθέτω ${pa} + ${pc} = ${pa + pc}`, `Προσθέτω τις τιμές, ${pa} + ${pc} = ${pa + pc}`], [`Διαιρώ μόνο ${pc} : ${a}`, `Διαιρώ μόνο την τιμή, ${pc} : ${a}`]],
        `Οι συσκευασίες δεν έχουν ίδιο αριθμό από ${it.manyAcc}. Πρέπει να συγκρίνουμε την ίδια ποσότητα.`));
    }
    const ops = r.chance(0.5);
    steps.push(b.numbers('solve', asksN ? `Λύνουμε για ${N} ${it.manyAcc}.` : `Λύνουμε για ${L} ${it.manyAcc}.`, [
      { label: ops ? `${A}: ${N} : ${a} =` : A, answer: N / a, ...(N / a > 1 ? { unit: s.packs } : {}) },
      // (how many packs is the row above: named, not written)
      { label: ops ? `Κόστος: τα ${s.packs} × ${pa} =` : `Κόστος με τα ${s.packs} των ${a}`, answer: (N / a) * pa, unit: '€' },
      { label: ops ? `${C}: ${N} : ${c} =` : C, answer: N / c, ...(N / c > 1 ? { unit: s.packs } : {}) },
      { label: ops ? `Κόστος: τα ${s.packs} × ${pc} =` : `Κόστος με τα ${s.packs} των ${c}`, answer: (N / c) * pc, unit: '€' },
    ], `Πόσες φορές χωράει το ${a} στο ${N}; Τόσα ${s.packs} των ${a} χρειάζονται.`));
    const D = diff * mult;
    if (claim) {
      steps.push(b.choice('check', `Έχει δίκιο ${q.nom};`,
        `${cheaperIsA ? 'Ναι' : 'Όχι'}: ${L} ${it.many} κάνουν ${costA} €, όχι ${costC} €`,
        [cheaperIsA ? 'Όχι: συμφέρει πάντα η μεγαλύτερη συσκευασία' : 'Ναι: η φθηνότερη συσκευασία συμφέρει πάντα', 'Δεν μπορούμε να το ξέρουμε ακόμα'],
        'Συγκρίνουμε την ίδια ποσότητα, όχι τις τιμές των συσκευασιών.'));
    } else {
      steps.push(b.choice('solve', 'Ποια συσκευασία συμφέρει;', cheaperIsA ? `Το ${s.pack} των ${a}` : `Το ${s.pack} των ${c}`,
        [cheaperIsA ? `Το ${s.pack} των ${c}` : `Το ${s.pack} των ${a}`, 'Συμφέρουν το ίδιο'], 'Κοιτάμε τα δύο κόστη για την ίδια ποσότητα.'));
    }
    steps.push(b.numbers('check', asksN ? 'Πόσα € γλιτώνει με τη φθηνότερη;' : `Πόσο φθηνότερα βγαίνουν ${L} ${it.many} με αυτή;`, [{ label: `${Math.max(costA, costC) * mult} − ${Math.min(costA, costC) * mult} =`, answer: D, unit: '€' }],
      `Για ${N} ${it.manyAcc}.`));
    return { title: r.pick(s.title), story, steps };
  },
};

const fewer = (t: Thing) => (t.g === 'f' ? 'λιγότερες' : t.g === 'm' ? 'λιγότερους' : 'λιγότερα');
