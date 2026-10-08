// Two-step problems (three operations in a chain) where the plan is put in order first:
// each step needs the result of the one before it, so the order is unique
// (Γ΄ κεφ. 19 «Προβλήματα» 2 «Η συναυλία»: ο Φώτης με 3 φίλους του, τα εισιτήρια).
import type { ProblemStep } from '../../../../shared/types.ts';
import { extra, known, PEOPLE, sought, type Builder, type Draft, type Family, type Person, type Rng } from '../../lib.ts';

interface Chain {
  story: string;
  title: string;
  plan: string[];
  // op: the row's calculation; a number a row above asks for is named («${note} − το κόστος =»), never written
  rows: { op: string; name: string; answer: number; unit?: string }[];
  check: { right: string; wrong: string[]; hint: string };
}

const NOTES = [10, 20, 50, 100];
const noteFor = (r: Rng, cost: number) => { const fits = NOTES.filter(x => x > cost); return r.chance(0.75) ? fits[0] : fits[Math.min(1, fits.length - 1)]; };

// 1. Tickets for a kid and friends, then the change
function tickets(r: Rng, p: Person): Chain | null {
  const place = r.pick([
    { go: 'στον κινηματογράφο', what: 'Το εισιτήριο', price: [5, 8] },
    { go: 'στο κουκλοθέατρο', what: 'Το εισιτήριο', price: [4, 7] },
    { go: 'στο μουσείο', what: 'Το εισιτήριο', price: [3, 6] },
    { go: 'στο ενυδρείο', what: 'Το εισιτήριο', price: [6, 9] },
    { go: 'στην πισίνα', what: 'Η είσοδος', price: [3, 5] },
  ]);
  const friends = r.int(2, 5);
  const n = friends + 1;
  const price = r.int(place.price[0], place.price[1]);
  const cost = n * price;
  const note = noteFor(r, cost);
  const change = note - cost;
  const who = p.female ? `τις ${friends} φίλες της` : `τους ${friends} φίλους του`;
  const noise = r.pick([
    `Ξεκινούν από το σπίτι στις ${extra(`${r.int(4, 6)} το απόγευμα`)}.`,
    `Φτάνουν εκεί με το λεωφορείο σε ${extra(`${r.int(10, 25)} λεπτά`)}.`,
    `Εκείνη την ώρα είναι εκεί και άλλα ${extra(`${r.int(20, 60)} παιδιά`)}.`,
  ]);
  return {
    title: r.pick(['Όλη η παρέα', 'Τα εισιτήρια', 'Έξοδος με φίλους']),
    story: `${p.Nom} πηγαίνει ${place.go} με ${known(who)}. ${place.what} κοστίζει ${known(`${price} ευρώ`)} για κάθε παιδί. ${noise} `
      + `Πληρώνει για όλους με ${known(`${note} ευρώ`)}. ${sought('Πόσα ρέστα θα πάρει')};`,
    plan: ['Βρίσκουμε πόσα είναι όλα τα παιδιά.', 'Βρίσκουμε πόσο πληρώνουν όλα τα παιδιά.', 'Βρίσκουμε πόσα ρέστα θα πάρει.'],
    rows: [
      { op: `${friends} + 1 =`, name: 'Παιδιά', answer: n, unit: 'παιδιά' },
      { op: `Τα παιδιά × ${price} =`, name: 'Πληρώνουν', answer: cost, unit: 'ευρώ' },
      { op: `${note} − το κόστος =`, name: 'Ρέστα', answer: change, unit: 'ευρώ' },
    ],
    check: {
      right: `${cost} + ${change} = ${note}`,
      wrong: [`${note} − ${friends * price} = ${note - friends * price}`, `${note} + ${change} = ${note + change}`],
      hint: `Όσα πλήρωσαν μαζί με τα ρέστα πρέπει να κάνουν ${note} ευρώ.`,
    },
  };
}

// 2. At the market: kilos × price, plus one more thing, then what is left
function market(r: Rng): Chain | null {
  const g = r.pick([
    { Nom: 'Η μαμά', his: 'της' }, { Nom: 'Ο μπαμπάς', his: 'του' }, { Nom: 'Η γιαγιά', his: 'της' }, { Nom: 'Ο παππούς', his: 'του' },
  ]);
  const fruit = r.pick([
    { what: 'πορτοκάλια', the: 'τα πορτοκάλια', p: [1, 2] }, { what: 'ντομάτες', the: 'οι ντομάτες', p: [2, 3] },
    { what: 'κεράσια', the: 'τα κεράσια', p: [4, 7] }, { what: 'μήλα', the: 'τα μήλα', p: [2, 3] },
    { what: 'φράουλες', the: 'οι φράουλες', p: [3, 5] }, { what: 'πατάτες', the: 'οι πατάτες', p: [1, 2] },
  ]);
  const other = r.pick([
    { what: 'ένα καρπούζι', p: [3, 6] }, { what: 'ένα μάτσο λουλούδια', p: [3, 6] },
    { what: 'μια θήκη αυγά', p: [3, 4] }, { what: 'ένα βάζο μέλι', p: [6, 10] },
  ]);
  const kg = r.int(2, 6);
  const pp = r.int(fruit.p[0], fruit.p[1]);
  const po = r.int(other.p[0], other.p[1]);
  const c1 = kg * pp;
  const tot = c1 + po;
  const have = noteFor(r, tot);
  const left = have - tot;
  const noise = r.pick([
    `Η λαϊκή έχει ${extra(`${r.int(30, 80)} πάγκους`)}.`,
    `Γύρισε σπίτι στις ${extra(`${r.int(10, 11)} το πρωί`)}.`,
    `Το σπίτι ${g.his} είναι ${extra(`${r.int(2, 5)} στενά`)} από τη λαϊκή.`,
  ]);
  return {
    title: r.pick(['Στη λαϊκή', 'Τα ψώνια', 'Τι έμεινε;']),
    story: `${g.Nom} πήγε στη λαϊκή με ${known(`${have} ευρώ`)}. Αγόρασε ${known(`${kg} κιλά ${fruit.what}`)}, που έκαναν ${known(`${pp} ευρώ`)} το κιλό, `
      + `και ${other.what} για ${known(`${po} ευρώ`)}. ${noise} ${sought(`Πόσα ευρώ ${g.his} έμειναν`)};`,
    plan: [`Βρίσκουμε πόσο κόστισαν ${fruit.the}.`, 'Βρίσκουμε πόσο κόστισαν όλα τα ψώνια.', 'Βρίσκουμε πόσα ευρώ έμειναν.'],
    rows: [
      { op: `${kg} × ${pp} =`, name: `Κόστισαν ${fruit.the}`, answer: c1, unit: 'ευρώ' },
      { op: `Όσα κόστισαν ${fruit.the} + ${po} =`, name: 'Κόστισαν όλα', answer: tot, unit: 'ευρώ' },
      { op: `${have} − όσα κόστισαν όλα =`, name: 'Έμειναν', answer: left, unit: 'ευρώ' },
    ],
    check: {
      right: `${tot} + ${left} = ${have}`,
      // the price of a kilo taken for the cost of the fruit
      wrong: [`${have} − ${pp} − ${po} = ${have - pp - po}`, `${have} + ${left} = ${have + left}`],
      hint: `Όσα ξόδεψε μαζί με όσα έμειναν πρέπει να κάνουν ${have} ευρώ.`,
    },
  };
}

// 3. A book: k pages a day for d days, then x more, and what is left
function pages(r: Rng, p: Person): Chain | null {
  const k = r.int(4, 10), d = r.int(3, 9), x = r.int(12, 40);
  const r1 = k * d, read = r1 + x;
  const total = read + r.int(15, 120);
  if (total > 300) return null;
  const book = r.pick(['ένα βιβλίο με παραμύθια', 'ένα μυθιστόρημα περιπέτειας', 'ένα βιβλίο για τα ζώα', 'ένα βιβλίο με γρίφους']);
  const noise = r.pick([
    `Το βιβλίο έχει ${extra(`${r.int(8, 16)} κεφάλαια`)}.`,
    `Το δανείστηκε για ${extra(`${r.int(2, 4)} εβδομάδες`)}.`,
    `Στο εξώφυλλο έχει ${extra(`${r.int(3, 7)} ζώα`)}.`,
  ]);
  return {
    title: r.pick(['Το βιβλίο', 'Πόσο έμεινε;', 'Διαβάζω']),
    story: `${p.Nom} διαβάζει ${book}, που έχει ${known(`${total} σελίδες`)}. Διάβασε ${known(`${k} σελίδες`)} την ημέρα για ${known(`${d} μέρες`)} `
      + `και την Κυριακή άλλες ${known(`${x} σελίδες`)}. ${noise} ${sought('Πόσες σελίδες έχει ακόμη να διαβάσει')};`,
    plan: [`Βρίσκουμε πόσες σελίδες διάβασε τις ${d} μέρες.`, 'Βρίσκουμε πόσες σελίδες διάβασε συνολικά.', 'Βρίσκουμε πόσες σελίδες μένουν.'],
    rows: [
      { op: `${k} × ${d} =`, name: `Σελίδες στις ${d} μέρες`, answer: r1, unit: 'σελίδες' },
      { op: `Όσες διάβασε τις ${d} μέρες + ${x} =`, name: 'Σελίδες συνολικά', answer: read, unit: 'σελίδες' },
      { op: `${total} − όσες διάβασε =`, name: 'Σελίδες που μένουν', answer: total - read, unit: 'σελίδες' },
    ],
    check: {
      right: `${read} + ${total - read} = ${total}`,
      // one day's pages taken for the pages of every day
      wrong: [`${total} − ${k} − ${x} = ${total - k - x}`, `${total} + ${read} = ${total + read}`],
      hint: 'Όσες διάβασε μαζί με όσες μένουν πρέπει να κάνουν όλο το βιβλίο.',
    },
  };
}

// 4. An outing: what one child costs, then all the children, then the change
function outing(r: Rng): Chain | null {
  const lead = r.pick([
    { Nom: 'Η δασκάλα', self: 'Η ίδια' }, { Nom: 'Ο δάσκαλος', self: 'Ο ίδιος' },
    { Nom: 'Ο προπονητής', self: 'Ο ίδιος' }, { Nom: 'Η προπονήτρια', self: 'Η ίδια' },
  ]);
  const s = r.pick([
    { go: 'στον κινηματογράφο', a: 'εισιτήριο', ap: [5, 8], b: 'ποπκόρν', bp: [2, 4] },
    { go: 'στον ζωολογικό κήπο', a: 'εισιτήριο', ap: [6, 9], b: 'χυμό', bp: [1, 2] },
    { go: 'στο κολυμβητήριο', a: 'είσοδο', ap: [3, 5], b: 'σάντουιτς', bp: [2, 4] },
    { go: 'στο πλανητάριο', a: 'εισιτήριο', ap: [4, 7], b: 'αναμνηστικό', bp: [2, 3] },
  ]);
  const n = r.int(4, 9);
  const ap = r.int(s.ap[0], s.ap[1]), bp = r.int(s.bp[0], s.bp[1]);
  const per = ap + bp, tot = n * per;
  if (tot >= 100) return null;
  const note = noteFor(r, tot);
  const noise = r.pick([
    `Το λεωφορείο κάνει ${extra(`${r.int(15, 40)} λεπτά`)} για να φτάσει εκεί.`,
    `Φεύγουν από το σχολείο στις ${extra(`${r.int(9, 11)} το πρωί`)}.`,
    `Επιστρέφουν μετά από ${extra(`${r.int(3, 4)} ώρες`)}.`,
  ]);
  return {
    title: r.pick(['Η εκδρομή', 'Πόσα ρέστα;', 'Έξοδος με την ομάδα']),
    story: `${lead.Nom} πηγαίνει ${s.go} με ${known(`${n} παιδιά`)}. Για κάθε παιδί πληρώνει ${s.a} ${known(`${ap} ευρώ`)} και ${s.b} ${known(`${bp} ευρώ`)}. `
      + `${lead.self} μπαίνει δωρεάν. ${noise} Πληρώνει με ${known(`${note} ευρώ`)}. ${sought('Πόσα ρέστα θα πάρει')};`,
    plan: ['Βρίσκουμε πόσα πληρώνει για ένα παιδί.', 'Βρίσκουμε πόσα πληρώνει για όλα τα παιδιά.', 'Βρίσκουμε τα ρέστα.'],
    rows: [
      { op: `${ap} + ${bp} =`, name: 'Για ένα παιδί', answer: per, unit: 'ευρώ' },
      { op: `${n} × όσα για ένα παιδί =`, name: 'Για όλα τα παιδιά', answer: tot, unit: 'ευρώ' },
      { op: `${note} − το κόστος =`, name: 'Ρέστα', answer: note - tot, unit: 'ευρώ' },
    ],
    check: {
      right: `${tot} + ${note - tot} = ${note}`,
      wrong: [`${note} − ${ap} − ${bp} = ${note - ap - bp}`, `${n} × ${ap} + ${bp} = ${n * ap + bp}`],
      hint: 'Όσα πλήρωσε μαζί με τα ρέστα πρέπει να κάνουν όσα έδωσε.',
    },
  };
}

// 5. Savings: w a week for d weeks, plus a gift, then what is missing for a price
function savings(r: Rng, p: Person): Chain | null {
  const w = r.int(2, 10), d = r.int(3, 10), g = r.step(10, 40, 5);
  const s1 = w * d, tot = s1 + g;
  const item = r.pick([
    { what: 'ένα ποδήλατο', p: [80, 150] }, { what: 'ένα σκέιτμπορντ', p: [40, 80] }, { what: 'μια κιθάρα', p: [60, 120] },
    { what: 'ένα επιτραπέζιο παιχνίδι', p: [25, 50] }, { what: 'ένα πατίνι', p: [40, 90] },
  ]);
  const lo = Math.max(item.p[0], tot + 3);
  if (lo > item.p[1]) return null;
  const price = r.int(lo, item.p[1]);
  const giver = r.pick(['τη γιαγιά', 'τον παππού', 'τη νονά', 'τον νονό', 'τη θεία']);
  const noise = r.pick([
    `Έχει τον κουμπαρά ${p.his} εδώ και ${extra(`${r.int(2, 5)} χρόνια`)}.`,
    `Το μαγαζί είναι ανοιχτό ${extra(`${r.int(5, 6)} μέρες`)} την εβδομάδα.`,
    `Στη βιτρίνα υπάρχουν ${extra(`${r.int(3, 6)} χρώματα`)} για να διαλέξει.`,
  ]);
  return {
    title: r.pick(['Ο κουμπαράς', 'Οικονομίες', 'Πόσα λείπουν;']),
    story: `${p.Nom} έβαζε ${known(`${w} ευρώ`)} στον κουμπαρά κάθε εβδομάδα, για ${known(`${d} εβδομάδες`)}. Για τα γενέθλιά ${p.his} πήρε και από ${giver} ${p.his} ${known(`${g} ευρώ`)}. `
      + `Θέλει να αγοράσει ${item.what} που κοστίζει ${known(`${price} ευρώ`)}. ${noise} ${sought(giver.startsWith(p.female ? 'τη ' : 'τον ') ? `Πόσα ευρώ λείπουν ακόμη σ${p.acc}` : `Πόσα ευρώ ${p.his} λείπουν ακόμη`)};`,
    plan: [`Βρίσκουμε πόσα έβαλε στον κουμπαρά τις ${d} εβδομάδες.`, 'Βρίσκουμε πόσα έχει όλα μαζί.', 'Βρίσκουμε πόσα ευρώ λείπουν.'],
    rows: [
      { op: `${w} × ${d} =`, name: `Σε ${d} εβδομάδες`, answer: s1, unit: 'ευρώ' },
      { op: `Όσα έβαλε + ${g} =`, name: 'Όλα μαζί', answer: tot, unit: 'ευρώ' },
      { op: `${price} − όσα έχει =`, name: 'Λείπουν', answer: price - tot, unit: 'ευρώ' },
    ],
    check: {
      right: `${tot} + ${price - tot} = ${price}`,
      wrong: [`${price} − ${s1} = ${price - s1}`, `${price} + ${tot} = ${price + tot}`],
      hint: `Όσα έχει μαζί με όσα λείπουν πρέπει να κάνουν ${price} ευρώ.`,
    },
  };
}

export const orderThePlan: Family = {
  id: 'order-the-plan',
  grade: 3,
  chapter: '19',
  topic: 'Πρόσθεση',
  source: 'Μαθηματικά Γ΄, κεφ. 19 «Προβλήματα» 2 «Η συναυλία» και κεφ. 12 «Προβλήματα»',
  make(r, b): Draft | null {
    const p = r.pick(PEOPLE);
    const c = [() => tickets(r, p), () => market(r), () => pages(r, p), () => outing(r), () => savings(r, p)][r.int(0, 4)]();
    if (!c) return null;
    return { title: c.title, story: c.story, steps: build(r, b, c) };
  },
};

function build(r: Rng, b: Builder, c: Chain): ProblemStep[] {
  const ops = r.chance(0.5);
  const steps: ProblemStep[] = [
    b.tag(undefined, 'Ποιοι αριθμοί αλλάζουν την απάντηση; Τους άλλους τους αφήνουμε.'),
    b.order('plan', 'Βάζουμε τα βήματα της λύσης στη σειρά.', c.plan, 'Ποιο βήμα χρειάζεται το αποτέλεσμα ενός άλλου; Αυτό έρχεται μετά.'),
    b.numbers('solve', 'Λύνουμε, βήμα βήμα.', c.rows.map(x => ({ label: ops ? x.op : x.name, answer: x.answer, ...(x.unit ? { unit: x.unit } : {}) })),
      'Κάνουμε τα βήματα με τη σειρά που βρήκαμε. Κάθε αποτέλεσμα χρειάζεται στο επόμενο βήμα.'),
  ];
  if (r.chance(0.7)) steps.push(b.choice('check', 'Πώς ελέγχουμε;', c.check.right, c.check.wrong, c.check.hint));
  return steps;
}
