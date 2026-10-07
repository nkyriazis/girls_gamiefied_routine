// Money left after two purchases: X − a − b, with the amount left after the first one as a
// row of its own (Γ΄ κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών», «Το μαγαζί της τάξης»).
import { extra, fmt, known, PEOPLE, sought, type Family, type Person, type Rng } from '../../lib.ts';
import type { ProblemStep } from '../../../../shared/types.ts';

interface Item { acc: string; short: string; min: number; max: number; pl?: boolean }
interface Setting {
  place: string; // "στο βιβλιοπωλείο"
  items: Item[];
  noise: (r: Rng, p: Person) => string;
}

const SETTINGS: Setting[] = [
  {
    place: 'στο βιβλιοπωλείο',
    items: [
      { acc: 'ένα βιβλίο περιπέτειας', short: 'το βιβλίο', min: 8, max: 18 },
      { acc: 'μια κασετίνα', short: 'την κασετίνα', min: 6, max: 15 },
      { acc: 'ένα κουτί μαρκαδόρους', short: 'τους μαρκαδόρους', min: 5, max: 12 },
      { acc: 'ένα άλμπουμ ζωγραφικής', short: 'το άλμπουμ', min: 4, max: 9 },
      { acc: 'ένα ημερολόγιο', short: 'το ημερολόγιο', min: 5, max: 11 },
    ],
    noise: r => `Το βιβλιοπωλείο έχει ${extra(`${r.int(8, 20)} ράφια`)} με βιβλία.`,
  },
  {
    place: 'στο κατάστημα παιχνιδιών',
    items: [
      { acc: 'ένα παζλ', short: 'το παζλ', min: 9, max: 25 },
      { acc: 'μια κούκλα', short: 'την κούκλα', min: 12, max: 30 },
      { acc: 'ένα αυτοκινητάκι', short: 'το αυτοκινητάκι', min: 5, max: 14 },
      { acc: 'ένα επιτραπέζιο παιχνίδι', short: 'το επιτραπέζιο', min: 15, max: 35 },
      { acc: 'ένα γιογιό', short: 'το γιογιό', min: 3, max: 8 },
    ],
    noise: r => `Στη βιτρίνα υπάρχουν ${extra(`${r.int(15, 40)} παιχνίδια`)}.`,
  },
  {
    place: 'στο αθλητικό κατάστημα',
    items: [
      { acc: 'μια μπάλα μπάσκετ', short: 'την μπάλα', min: 12, max: 30 },
      { acc: 'ένα παγούρι', short: 'το παγούρι', min: 5, max: 12 },
      { acc: 'ένα σκοινάκι', short: 'το σκοινάκι', min: 4, max: 9 },
      { acc: 'μια φανέλα', short: 'τη φανέλα', min: 15, max: 35 },
      { acc: 'ένα ζευγάρι κάλτσες', short: 'τις κάλτσες', min: 4, max: 10 },
    ],
    noise: r => `Το κατάστημα κλείνει στις ${extra(`${r.int(8, 9)} το βράδυ`)}.`,
  },
  {
    place: 'στο ζαχαροπλαστείο',
    items: [
      { acc: 'μια τούρτα', short: 'την τούρτα', min: 18, max: 35 },
      { acc: 'ένα κουτί κουλουράκια', short: 'τα κουλουράκια', min: 6, max: 12 },
      { acc: 'ένα ταψί μπακλαβά', short: 'τον μπακλαβά', min: 15, max: 30 },
      { acc: 'ένα παγωτό κασάτο', short: 'το παγωτό', min: 4, max: 8 },
    ],
    noise: r => `Στη βιτρίνα υπάρχουν ${extra(`${r.int(20, 50)} είδη γλυκών`)}.`,
  },
  {
    place: 'στο λούνα παρκ',
    items: [
      { acc: 'ένα εισιτήριο για τα συγκρουόμενα', short: 'τα συγκρουόμενα', min: 4, max: 8 },
      { acc: 'ένα μαλλί της γριάς', short: 'το μαλλί της γριάς', min: 2, max: 4 },
      { acc: 'ένα εισιτήριο για τη ρόδα', short: 'τη ρόδα', min: 5, max: 9 },
      { acc: 'ένα λούτρινο αρκουδάκι', short: 'το αρκουδάκι', min: 8, max: 15 },
      { acc: 'ένα ποπ κορν', short: 'το ποπ κορν', min: 2, max: 5 },
    ],
    noise: r => `Το λούνα παρκ έχει ${extra(`${r.int(12, 30)} παιχνίδια`)}.`,
  },
];

export const twoPurchases: Family = {
  id: 'two-purchases',
  grade: 3,
  unit: 2,
  source: 'Μαθηματικά Γ΄, κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών» («Το μαγαζί της τάξης»)',
  make(r, b) {
    const p = r.pick(PEOPLE);
    const s = r.pick(SETTINGS);
    const [i1, i2] = r.sample(s.items, 2);
    const a = r.int(i1.min, i1.max);
    const c = r.int(i2.min, i2.max);
    const spent = a + c;
    const have = r.chance(0.3) ? r.step(spent + 10, 150, 10) : r.int(spent + 3, Math.min(99, spent + 40));
    if (have > 150 || have <= spent + 2) return null;
    const mid = have - a;
    const left = mid - c;

    const tale = r.int(0, 3);
    const past = tale > 0;
    const noise = r.pick([
      s.noise(r, p),
      `${p.Nom} είναι ${extra(`${r.int(8, 9)} χρονών`)}.`,
      `${past ? 'Ήταν' : 'Είναι'} ${extra(`${r.int(9, 11)} η ώρα`)} το πρωί.`,
    ]);
    const costs = (i: Item) => (i.pl ? 'κοστίζουν' : 'κοστίζει');
    const Place = s.place[0].toUpperCase() + s.place.slice(1);
    const story = [
      () => `${p.Nom} έχει ${known(`${fmt(have)} ευρώ`)} και πηγαίνει ${s.place}. Πρώτα αγοράζει ${i1.acc} που ${costs(i1)} ${known(`${a} ευρώ`)} και μετά ${i2.acc} που ${costs(i2)} ${known(`${c} ευρώ`)}. ${noise} ${sought(`Πόσα ευρώ ${p.his} μένουν`)};`,
      () => `${p.Nom} πήρε ${known(`${fmt(have)} ευρώ`)} δώρο για τη γιορτή ${p.his}. ${Place} ξόδεψε ${known(`${a} ευρώ`)} για ${i1.acc} και ${known(`${c} ευρώ`)} για ${i2.acc}. ${noise} ${sought(`Πόσα ευρώ ${p.his} έμειναν`)};`,
      () => `Στον κουμπαρά ${p.gen} υπήρχαν ${known(`${fmt(have)} ευρώ`)}. Τα πήρε μαζί ${p.his} ${s.place}. Εκεί πλήρωσε ${known(`${a} ευρώ`)} για ${i1.acc} και μετά άλλα ${known(`${c} ευρώ`)} για ${i2.acc}. ${noise} ${sought(`Πόσα ευρώ ${p.his} έμειναν`)};`,
      () => `${p.Nom} βγήκε βόλτα με ${known(`${fmt(have)} ευρώ`)} στην τσέπη. ${Place} αγόρασε ${i1.acc} με ${known(`${a} ευρώ`)} και ${i2.acc} με ${known(`${c} ευρώ`)}. ${noise} ${sought(`Πόσα ευρώ ${p.his} περίσσεψαν`)};`,
    ][tale]();

    const steps: ProblemStep[] = [b.tag(undefined, 'Ποιοι αριθμοί αλλάζουν τα χρήματα που μένουν; Τους άλλους τους αφήνουμε.')];
    const route = r.int(0, 2);
    if (route === 0) {
      // Subtract one purchase after the other
      steps.push(b.numbers('solve', 'Λύνουμε βήμα βήμα.', [
        { label: `Μετά την πρώτη αγορά: ${fmt(have)} − ${a} =`, answer: mid, unit: 'ευρώ' },
        { label: `Μετά τη δεύτερη αγορά: ${fmt(mid)} − ${c} =`, answer: left, unit: 'ευρώ' },
      ], `Από τα ${fmt(have)} ευρώ βγάζουμε πρώτα τα ${a} ευρώ και από ό,τι μείνει βγάζουμε τα ${c}.`));
    } else if (route === 1) {
      steps.push(b.choice('plan', 'Ποια πράξη μας δίνει την απάντηση;', `${fmt(have)} − ${a} − ${c}`,
        [`${fmt(have)} + ${a} + ${c}`, `${fmt(have)} − ${a} + ${c}`, `${fmt(have)} − ${a}`],
        'Και οι δύο αγορές βγάζουν χρήματα από όσα είχε.'));
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        { label: `Έμειναν μετά ${i1.short}`, answer: mid, unit: 'ευρώ' },
        { label: 'Έμειναν στο τέλος', answer: left, unit: 'ευρώ' },
      ], `Πρώτα ${fmt(have)} − ${a}. Από ό,τι μείνει, αφαιρούμε ${c}.`));
    } else {
      // Add the purchases first, then subtract
      steps.push(b.order('plan', 'Βάζουμε σε σειρά το σχέδιό μας.', [
        'Βρίσκουμε πόσα ξόδεψε συνολικά',
        `Τα αφαιρούμε από τα ${fmt(have)} ευρώ`,
        'Ελέγχουμε την απάντηση',
      ], 'Δεν μπορούμε να αφαιρέσουμε κάτι που δεν έχουμε βρει ακόμα.'));
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        { label: `Ξόδεψε: ${a} + ${c} =`, answer: spent, unit: 'ευρώ' },
        { label: `Έμειναν: ${fmt(have)} − ${spent} =`, answer: left, unit: 'ευρώ' },
      ], `Πρώτα προσθέτουμε τις δύο τιμές, μετά αφαιρούμε από τα ${fmt(have)}.`));
    }
    steps.push(r.chance(0.6)
      ? b.choice('check', 'Πώς ελέγχουμε;', `${spent} + ${left} = ${fmt(have)}`,
        [`${fmt(have)} + ${left} = ${fmt(have + left)}`, `${left} + ${a} = ${fmt(left + a)}`],
        'Όσα ξόδεψε μαζί με όσα έμειναν πρέπει να κάνουν όσα είχε στην αρχή.')
      : b.choice('check', 'Είναι λογική η απάντηση;', `Ναι, είναι λιγότερα από ${fmt(have)} ευρώ`,
        [`Όχι, πρέπει να είναι πάνω από ${fmt(have)} ευρώ`, `Όχι, πρέπει να είναι ${fmt(have + spent)}: όλα μαζί`],
        'Με κάθε αγορά τα χρήματα λιγοστεύουν.'));
    return { title: r.pick(['Δύο αγορές', 'Ψώνια', 'Τι έμεινε;', 'Βόλτα στα μαγαζιά']), story, steps };
  },
};
