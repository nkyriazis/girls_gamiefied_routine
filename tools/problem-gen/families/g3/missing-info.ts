// A number is missing: the story first comes without one number it needs, and the child
// says what is missing; then the whole story comes, to read, solve and check
// (Γ΄ κεφ. 19 «Προβλήματα» 4: «Διατύπωσε μια ερώτηση για αυτό το πρόβλημα»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { BOYS, count, extra, fmt, GIRLS, HowMany, known, PEOPLE, sought, thing, type Builder, type Draft, type Family, type Person, type Rng, type Thing, type Wording } from '../../lib.ts';

// What each kind of problem gives: the story with and without the number, what is missing,
// and the operation that solves it
interface Parts {
  title: string;
  full: string;
  cut: string;
  missing: string;
  wrongs: Wording[];
  row: { op: string; name: string; answer: number; unit?: string; opUnit?: string };
  check?: { right: string; wrong: string[] };
}

const some = (t: Thing) => (t.g === 'n' ? 'μερικά' : t.g === 'f' ? 'μερικές' : 'μερικούς');
const one = (t: Thing) => (t.g === 'n' ? 'ένα' : t.g === 'f' ? 'μία' : 'ένας');
const more = (t: Thing) => (t.g === 'n' ? 'περισσότερα' : t.g === 'f' ? 'περισσότερες' : 'περισσότερους');

const BUYS = [
  { t: thing('τετράδιο', 'τετράδια', 'n'), p: [2, 4], why: 'για το σχολείο' },
  { t: thing('μαρκαδόρος', 'μαρκαδόροι', 'm', 'μαρκαδόρους'), p: [2, 3], why: 'για τη ζωγραφική' },
  { t: thing('τριαντάφυλλο', 'τριαντάφυλλα', 'n'), p: [2, 4], why: 'για τη γιορτή της μαμάς' },
  { t: thing('μπαλόνι', 'μπαλόνια', 'n'), p: [2, 3], why: 'για ένα πάρτι' },
  { t: thing('κάρτα', 'κάρτες', 'f'), p: [2, 3], why: 'για τα Χριστούγεννα' },
];

function buy(r: Rng, p: Person): Parts {
  const { t, p: pr, why } = r.pick(BUYS);
  const n = r.int(3, 9), price = r.int(pr[0], pr[1]), cost = n * price;
  const noise = r.pick([
    `Είχε μαζί ${p.his} ${extra(`${cost + r.int(3, 15)} ευρώ`)}.`,
    `Πήγε στο μαγαζί στις ${extra(`${r.int(9, 11)} το πρωί`)}.`,
    `Το μαγαζί είχε ${extra(count(r.int(30, 80), t, true))}.`,
  ]);
  const each = `Κάθε ${t.one} κοστίζει`;
  if (r.chance(0.5)) {
    // The count is missing
    return {
      title: 'Τι λείπει;',
      cut: `${p.Nom} αγόρασε ${some(t)} ${t.manyAcc} ${why}. ${each} ${price} ευρώ. Πόσα ευρώ πλήρωσε;`,
      full: `${p.Nom} αγόρασε ${known(count(n, t, true))} ${why}. ${each} ${known(`${price} ευρώ`)}. ${noise} ${sought('Πόσα ευρώ πλήρωσε')};`,
      missing: `${HowMany(t)} ${t.manyAcc} αγόρασε`,
      wrongs: [`Πόσο κοστίζει ${one(t)} ${t.one}`, [`Πόσα χρήματα είχε μαζί ${p.his}`, 'Πόσα χρήματα είχε'], ['Σε ποιο μαγαζί πήγε να ψωνίσει', 'Σε ποιο μαγαζί πήγε']],
      row: { op: `${n} × ${price} =`, name: 'Πλήρωσε', answer: cost, unit: 'ευρώ' },
      check: { right: `${fmt(cost)} : ${n} = ${price}`, wrong: [`${fmt(cost)} + ${n} = ${fmt(cost + n)}`, `${n} + ${price} = ${n + price}`] },
    };
  }
  // The price is missing
  return {
    title: 'Ποιος αριθμός λείπει;',
    cut: `${p.Nom} αγόρασε ${count(n, t, true)} ${why}. Πόσα ευρώ πλήρωσε;`,
    full: `${p.Nom} αγόρασε ${known(count(n, t, true))} ${why}. ${each} ${known(`${price} ευρώ`)}. ${noise} ${sought('Πόσα ευρώ πλήρωσε')};`,
    missing: `Πόσο κοστίζει ${one(t)} ${t.one}`,
    wrongs: [`${HowMany(t)} ${t.manyAcc} αγόρασε`, [`Πόσα χρήματα είχε μαζί ${p.his}`, 'Πόσα χρήματα είχε'], ['Τι ώρα πήγε στο μαγαζί το πρωί', 'Τι ώρα πήγε στο μαγαζί']],
    row: { op: `${n} × ${price} =`, name: 'Πλήρωσε', answer: cost, unit: 'ευρώ' },
    check: { right: `${fmt(cost)} : ${n} = ${price}`, wrong: [`${fmt(cost)} + ${n} = ${fmt(cost + n)}`, `${n} + ${price} = ${n + price}`] },
  };
}

const TOYS = [
  { what: 'ένα παζλ', the: 'το παζλ', it: 'το', p: [8, 20], ex: (r: Rng) => `Το παζλ έχει ${extra(`${r.pick([200, 300, 500])} κομμάτια`)}.` },
  { what: 'ένα βιβλίο με ιστορίες', the: 'το βιβλίο', it: 'το', p: [6, 15], ex: (r: Rng) => `Το βιβλίο έχει ${extra(`${r.int(60, 180)} σελίδες`)}.` },
  { what: 'ένα κουτί μαρκαδόρους', the: 'το κουτί', it: 'το', p: [5, 12], ex: (r: Rng) => `Το κουτί έχει ${extra(`${r.pick([12, 18, 24])} μαρκαδόρους`)}.` },
  { what: 'ένα σετ με τουβλάκια', the: 'το σετ', it: 'το', p: [15, 40], ex: (r: Rng) => `Το σετ έχει ${extra(`${r.step(150, 500, 50)} τουβλάκια`)}.` },
  { what: 'μια μπάλα του μπάσκετ', the: 'η μπάλα', it: 'την', p: [10, 25], ex: (r: Rng) => `Στο μαγαζί είχε ${extra(`${r.int(6, 15)} μπάλες`)}.` },
];

function spend(r: Rng, p: Person): Parts {
  const toy = r.pick(TOYS);
  const cost = r.int(toy.p[0], toy.p[1]);
  const have = cost + r.int(4, 60);
  return {
    title: 'Τι λείπει;',
    cut: `${p.Nom} αγόρασε ${toy.what} που κόστιζε ${cost} ευρώ. Πόσα ευρώ ${p.his} έμειναν;`,
    full: `${p.Nom} είχε ${known(`${have} ευρώ`)} στον κουμπαρά. Αγόρασε ${toy.what} που κόστιζε ${known(`${cost} ευρώ`)}. ${toy.ex(r)} ${sought(`Πόσα ευρώ ${p.his} έμειναν`)};`,
    missing: 'Πόσα ευρώ είχε στην αρχή',
    wrongs: [`Πόσο κόστιζε ${toy.the}`, 'Πόσα ευρώ θα πάρει αύριο', `Από ποιο μαγαζί ${toy.it} αγόρασε`],
    row: { op: `${have} − ${cost} =`, name: 'Έμειναν', answer: have - cost, unit: 'ευρώ' },
    check: { right: `${cost} + ${have - cost} = ${have}`, wrong: [`${have} + ${cost} = ${have + cost}`, have - cost !== cost ? `${Math.max(cost, have - cost)} − ${Math.min(cost, have - cost)} = ${Math.abs(2 * cost - have)}` : `${have} + ${have - cost} = ${2 * have - cost}`] },
  };
}

const TREATS = [
  { t: thing('κουλουράκι', 'κουλουράκια', 'n'), made: 'έψησε', them: 'τα' },
  { t: thing('μανταρίνι', 'μανταρίνια', 'n'), made: 'μάζεψε', them: 'τα' },
  { t: thing('καραμέλα', 'καραμέλες', 'f'), made: 'αγόρασε', them: 'τις' },
  { t: thing('κάστανο', 'κάστανα', 'n'), made: 'έψησε', them: 'τα' },
];

function share(r: Rng): Parts {
  const G = r.pick([{ Nom: 'Η γιαγιά', his: 'της' }, { Nom: 'Ο παππούς', his: 'του' }]);
  const { t, made, them } = r.pick(TREATS);
  const k = r.int(2, 6), each = r.int(3, 9), total = k * each;
  const noise = r.pick([
    `Είναι ${extra(`${r.int(62, 80)} χρονών`)}.`,
    `Ήταν ${extra(`${r.int(4, 6)} η ώρα`)} το απόγευμα.`,
    `${them === 'τις' ? 'Τις' : 'Τα'} έβαλε σε ${extra(`${r.int(2, 3)} πιάτα`)}.`,
  ]);
  return {
    title: 'Για τα εγγόνια',
    cut: `${G.Nom} ${made} ${count(total, t, true)} και ${them} μοίρασε εξίσου στα εγγόνια ${G.his}. ${HowMany(t)} ${t.manyAcc} πήρε το καθένα;`,
    full: `${G.Nom} ${made} ${known(count(total, t, true))} και ${them} μοίρασε εξίσου στα ${known(`${k} εγγόνια`)} ${G.his}. ${noise} ${sought(`${HowMany(t)} ${t.manyAcc} πήρε το καθένα`)};`,
    missing: `Πόσα εγγόνια έχει ${G.Nom === 'Η γιαγιά' ? 'η γιαγιά' : 'ο παππούς'}`,
    wrongs: [`${HowMany(t)} ${t.manyAcc} ${made}`, `Πόσων χρονών είναι ${G.Nom === 'Η γιαγιά' ? 'η γιαγιά' : 'ο παππούς'}`, ['Τι ώρα ήταν το απόγευμα', 'Τι ώρα ήταν']],
    row: { op: `${total} : ${k} =`, name: 'Πήρε το καθένα', answer: each, unit: t.manyAcc },
    check: { right: `${k} × ${each} = ${total}`, wrong: [`${each} + ${k} = ${each + k}`, `${total} + ${k} = ${total + k}`] },
  };
}

const RIDES = [
  { v: 'Ένα λεωφορείο', the: 'το λεωφορείο', at: 'Σε μια στάση', before: 'πριν από τη στάση', on: [25, 55], off: [8, 20], ex: (r: Rng) => `Το λεωφορείο έχει ${extra(`${r.int(50, 60)} θέσεις`)}.` },
  { v: 'Ένα τρένο', the: 'το τρένο', at: 'Στον σταθμό της Λάρισας', before: 'πριν φτάσει στη Λάρισα', on: [180, 420], off: [40, 160], ex: (r: Rng) => `Το τρένο έχει ${extra(`${r.int(5, 8)} βαγόνια`)}.` },
  { v: 'Ένα πλοίο', the: 'το πλοίο', at: 'Στο λιμάνι της Σύρου', before: 'πριν φτάσει στη Σύρο', on: [350, 900], off: [90, 300], ex: (r: Rng) => `Το ταξίδι κράτησε ${extra(`${r.int(3, 5)} ώρες`)}.` },
  { v: 'Ένα τραμ', the: 'το τραμ', at: 'Σε μια στάση', before: 'πριν από τη στάση', on: [60, 140], off: [15, 45], ex: (r: Rng) => `Το τραμ έχει ${extra(`${r.int(2, 3)} βαγόνια`)}.` },
];

function ride(r: Rng): Parts {
  const x = r.pick(RIDES);
  const on = r.int(x.on[0], x.on[1]), off = r.int(x.off[0], x.off[1]);
  return {
    title: 'Οι επιβάτες',
    cut: `${x.at} κατέβηκαν από ${x.the} ${off} επιβάτες και δεν ανέβηκε κανείς. Πόσοι επιβάτες έμειναν;`,
    full: `${x.v} είχε ${known(`${fmt(on)} επιβάτες`)}. ${x.at} κατέβηκαν ${known(`${off} επιβάτες`)} και δεν ανέβηκε κανείς. ${x.ex(r)} ${sought('Πόσοι επιβάτες έμειναν')};`,
    missing: 'Πόσοι επιβάτες ήταν στην αρχή',
    wrongs: [['Πόσοι επιβάτες κατέβηκαν τελικά', 'Πόσοι κατέβηκαν τελικά'], `Πόσες θέσεις έχει ${x.the}`, `Τι ώρα ξεκίνησε ${x.the}`],
    row: { op: `${fmt(on)} − ${off} =`, name: 'Έμειναν', answer: on - off, unit: 'επιβάτες' },
    check: { right: `${fmt(on - off)} + ${off} = ${fmt(on)}`, wrong: [`${fmt(on)} + ${off} = ${fmt(on + off)}`, `${off} + ${off} = ${2 * off}`] },
  };
}

const HOARDS = [
  thing('χάντρα', 'χάντρες', 'f'), thing('βόλος', 'βόλοι', 'm', 'βόλους'), thing('αυτοκόλλητο', 'αυτοκόλλητα', 'n'),
  thing('κάρτα', 'κάρτες', 'f'), thing('κοχύλι', 'κοχύλια', 'n'),
];

function compare(r: Rng): Parts {
  const [A, B] = r.chance(0.5) ? [r.pick(GIRLS), r.pick(BOYS)] : [r.pick(BOYS), r.pick(GIRLS)];
  const t = r.pick(HOARDS);
  const x = r.int(12, 80), d = r.int(5, 30);
  const noise = r.pick([
    `${B.Nom} είναι ${extra(`${r.int(7, 11)} χρονών`)}.`,
    `${t.g === 'n' ? 'Τα' : t.g === 'f' ? 'Τις' : 'Τους'} φυλάνε σε ${extra(`${r.int(2, 4)} κουτιά`)}.`,
    `Στην τάξη τους είναι ${extra(`${r.int(18, 25)} παιδιά`)}.`,
  ]);
  return {
    title: 'Ποιος έχει περισσότερα;',
    cut: `${A.Nom} έχει ${d} ${t.manyAcc} ${more(t)} από ${B.acc}. ${HowMany(t)} ${t.manyAcc} έχει ${A.nom};`,
    full: `${B.Nom} έχει ${known(count(x, t, true))}. ${A.Nom} έχει ${known(`${d} ${t.manyAcc} ${more(t)}`)} από ${B.acc}. ${noise} ${sought(`${HowMany(t)} ${t.manyAcc} έχει ${A.nom}`)};`,
    missing: `${HowMany(t)} ${t.manyAcc} έχει ${B.nom}`,
    wrongs: [`${HowMany(t)} ${more(t)} έχει ${A.nom}`, `Πόσων χρονών είναι ${B.nom}`, `Πού φυλάνε ${t.g === 'n' ? 'τα' : t.g === 'f' ? 'τις' : 'τους'} ${t.manyAcc} τους`],
    row: { op: `${x} + ${d} =`, name: A.Nom, answer: x + d, unit: t.manyAcc, opUnit: t.many },
    check: { right: `${x + d} − ${x} = ${d}`, wrong: [`${x} − ${d} = ${x - d}`, `${x + d} + ${x} = ${2 * x + d}`] },
  };
}

export const missingInfo: Family = {
  id: 'missing-info',
  grade: 3,
  chapter: '19',
  topic: 'Αφαίρεση',
  source: 'Μαθηματικά Γ΄, κεφ. 19 «Προβλήματα» 4 (Διατύπωσε μια ερώτηση για αυτό το πρόβλημα)',
  make(r, b): Draft | null {
    const p = r.pick(PEOPLE);
    const parts = [() => buy(r, p), () => spend(r, p), () => share(r), () => ride(r), () => compare(r)][r.int(0, 4)]();
    return { title: parts.title, story: parts.full, steps: build(r, b, parts) };
  },
};

function build(r: Rng, b: Builder, x: Parts): ProblemStep[] {
  const steps: ProblemStep[] = [
    b.choice('read', r.pick(['Μπορούμε να απαντήσουμε; Τι μας λείπει;', 'Κάτι λείπει από την ιστορία. Τι χρειαζόμαστε ακόμη;']),
      x.missing, r.sample(x.wrongs, r.int(2, 3)),
      'Σκέψου ποια πράξη θα κάναμε. Ποιος αριθμός δεν υπάρχει στην ιστορία;', x.cut),
    b.tag('Τώρα η ιστορία είναι ολόκληρη. Τι ξέρουμε και τι ψάχνουμε;', 'Τον αριθμό που έλειπε τον ξέρουμε τώρα.'),
  ];
  const ops = r.chance(0.5);
  const unit = ops ? x.row.opUnit ?? x.row.unit : x.row.unit;
  steps.push(b.numbers('solve', 'Λύνουμε.', [{ label: ops ? x.row.op : x.row.name, answer: x.row.answer, eq: x.row.op.replace(/ =$/, ''), ...(unit ? { unit } : {}) }]));
  if (x.check && r.chance(0.6)) {
    steps.push(b.choice('check', 'Πώς ελέγχουμε;', x.check.right, x.check.wrong,
      'Ξεκινάμε από την απάντηση και κάνουμε την αντίθετη πράξη. Πρέπει να βρούμε έναν αριθμό της ιστορίας.'));
  }
  return steps;
}
