// Buy n items at p euros each, pay with a note, get change: n × p, then note − cost
// (Γ΄ κεφ. 11 «Πολλαπλασιασμός διψήφιου με μονοψήφιο αριθμό» και κεφ. 10 «Το μαγαζί της τάξης»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { count, extra, fmt, HowMany, known, PEOPLE, sought, thing, type Family, type Thing } from '../../lib.ts';

interface Item {
  t: Thing;
  price: [number, number];
  shop: string; // "στο βιβλιοπωλείο"
  // For "she and her 3 friends": where they go, and whether it is a treat ("κερνάει")
  go?: string;
  treat?: boolean;
}

const ITEMS: Item[] = [
  { t: thing('τετράδιο', 'τετράδια', 'n'), price: [2, 4], shop: 'στο βιβλιοπωλείο' },
  { t: thing('παγωτό', 'παγωτά', 'n'), price: [2, 4], shop: 'στο ζαχαροπλαστείο', go: 'στο ζαχαροπλαστείο', treat: true },
  { t: thing('εισιτήριο', 'εισιτήρια', 'n'), price: [5, 9], shop: 'στο ταμείο του κινηματογράφου', go: 'στον κινηματογράφο' },
  { t: thing('γλάστρα με βασιλικό', 'γλάστρες με βασιλικό', 'f'), price: [3, 6], shop: 'στο ανθοπωλείο' },
  { t: thing('μπάλα', 'μπάλες', 'f'), price: [8, 15], shop: 'στο αθλητικό κατάστημα' },
  { t: thing('βιβλίο', 'βιβλία', 'n'), price: [6, 12], shop: 'στο βιβλιοπωλείο' },
  { t: thing('κιλό κεράσια', 'κιλά κεράσια', 'n'), price: [4, 8], shop: 'στη λαϊκή αγορά' },
  { t: thing('τοστ', 'τοστ', 'n'), price: [2, 4], shop: 'στην καντίνα της παραλίας', go: 'στην καντίνα της παραλίας', treat: true },
  { t: thing('μπλουζάκι', 'μπλουζάκια', 'n'), price: [7, 14], shop: 'σε ένα κατάστημα με ρούχα' },
  { t: thing('μαρκαδόρος', 'μαρκαδόροι', 'm', 'μαρκαδόρους'), price: [2, 3], shop: 'στο χαρτοπωλείο' },
];

const NOTES = [10, 20, 50, 100];
const a = (t: Thing) => (t.g === 'n' ? 'ένα' : t.g === 'f' ? 'μια' : 'ένας');
const every = (t: Thing) => (t.g === 'n' ? 'όλα τα' : t.g === 'f' ? 'όλες οι' : 'όλοι οι');

export const buyAndChange: Family = {
  id: 'buy-and-change',
  grade: 3,
  unit: 2,
  source: 'Μαθηματικά Γ΄, κεφ. 11 «Πολλαπλασιασμός διψήφιου με μονοψήφιο αριθμό» και κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών»',
  make(r, b) {
    const p = r.pick(PEOPLE);
    const item = r.pick(ITEMS);
    const t = item.t;
    const trap = !!item.go && r.chance(0.6);
    const friends = r.int(2, 4);
    const n = trap ? friends + 1 : r.int(2, 9);
    const price = r.int(...item.price);
    const cost = n * price;
    if (cost >= 100) return null;
    const fits = NOTES.filter(x => x > cost);
    const note = r.chance(0.7) ? fits[0] : fits[Math.min(1, fits.length - 1)];
    const change = note - cost;

    const noise = r.pick([
      `Είναι ${extra(`${r.int(9, 11)} η ώρα`)} το πρωί.`,
      `Στην ουρά περιμένουν ακόμη ${extra(`${r.int(3, 8)} άνθρωποι`)}.`,
      `Το σπίτι ${p.his} είναι ${extra(`${r.int(2, 6)} στενά`)} πιο κάτω.`,
      `Η αδερφή ${p.his} είναι ${extra(`${r.int(4, 12)} χρονών`)}.`,
    ]);
    const paper = known(r.pick([`ένα χαρτονόμισμα των ${note} ευρώ`, `${note} ευρώ`]));
    const each = `${a(t)} ${t.one}`;
    const who = p.female ? `τις ${friends} φίλες της` : `τους ${friends} φίλους του`;
    const story = trap
      ? r.pick([
        () => `${p.Nom} πηγαίνει ${item.go} με ${known(who)} και πληρώνει από ${each} για όλα τα παιδιά. `
          + `${cap(each)} κοστίζει ${known(`${price} ευρώ`)}. ${noise} Δίνει ${paper}. ${sought('Πόσα ρέστα θα πάρει')};`,
        ...(item.treat ? [() => `${cap(item.shop)}, ${each} κοστίζει ${known(`${price} ευρώ`)}. ${p.Nom} κερνάει ${known(who)} από ${each} και παίρνει άλλο ένα για τον εαυτό ${p.his}. `
          + `${noise} Πληρώνει με ${paper}. ${sought('Πόσα ευρώ θα πάρει πίσω')};`] : []),
      ])()
      : r.pick([
        () => `${p.Nom} αγοράζει ${item.shop} ${known(count(n, t, true))}. Κάθε ${t.one} κοστίζει ${known(`${price} ευρώ`)}. ${noise} Πληρώνει με ${paper}. ${sought('Πόσα ρέστα θα πάρει')};`,
        () => `${cap(item.shop)}, ${each} κοστίζει ${known(`${price} ευρώ`)}. ${p.Nom} παίρνει ${known(count(n, t, true))} και δίνει ${paper}. ${noise} ${sought('Πόσα ευρώ θα πάρει πίσω')};`,
        () => `${p.Nom} έχει στο πορτοφόλι ${p.his} ${paper}. ${cap(item.shop)} αγοράζει ${known(count(n, t, true))}, που κοστίζουν ${known(`${price} ευρώ`)} ${t.g === 'n' ? 'το καθένα' : t.g === 'f' ? 'η καθεμία' : 'ο καθένας'}. ${noise} ${sought(`Πόσα ευρώ θα ${p.his} μείνουν`)};`,
      ])();

    const steps: ProblemStep[] = [
      b.tag(undefined, 'Χρειαζόμαστε πόσα αγοράζει, πόσο κάνει το καθένα και πόσα δίνει.'),
    ];
    if (trap) {
      steps.push(b.choice('plan', `${HowMany(t)} ${t.manyAcc} πληρώνει;`, String(n), [String(friends), String(n + 1)],
        `Μην ξεχάσεις ${p.female ? 'την ίδια' : 'τον ίδιο'} ${p.acc}!`));
    } else if (r.chance(0.5)) {
      steps.push(b.choice('plan', `Πώς βρίσκουμε πόσο κοστίζουν ${every(t)} ${t.many};`, `${n} × ${price}`,
        [`${n} + ${price}`, `${note} − ${price}`, `${note} − ${n}`],
        `${n} φορές από ${price} ευρώ.`));
    }
    const ops = r.chance(0.5);
    steps.push(b.numbers('solve', 'Λύνουμε.', [
      { label: ops ? `${n} × ${price} =` : 'Κοστίζουν όλα μαζί', answer: cost, unit: 'ευρώ' },
      { label: ops ? `${note} − ${cost} =` : 'Ρέστα', answer: change, unit: 'ευρώ' },
    ], `Πρώτα βρίσκουμε το κόστος: ${n} φορές από ${price} ευρώ. Μετά βγάζουμε το κόστος από τα ${note} ευρώ.`));
    steps.push(r.chance(0.5)
      ? b.choice('check', 'Πώς ελέγχουμε;', `${cost} + ${change} = ${note}`,
        [`${note} + ${change} = ${note + change}`, `${n} × ${change} = ${n * change}`],
        'Όσα κόστισαν μαζί με τα ρέστα πρέπει να κάνουν όσα έδωσε.')
      : b.choice('check', 'Είναι λογική η απάντηση;', `Ναι, είναι λιγότερα από τα ${note} ευρώ`,
        [`Όχι, τα ρέστα πρέπει να είναι ${note - price} ευρώ`, `Όχι, πρέπει να είναι πάνω από ${note} ευρώ`],
        `Αν αγόραζε μόνο ${t.g === 'm' ? `έναν ${t.one.replace(/ος$/, 'ο')}` : each}, θα έπαιρνε ${note - price} ευρώ ρέστα. Αγοράζει όμως ${n}.`));
    return { title: r.pick(['Τα ρέστα', 'Ψώνια', 'Στο ταμείο', trap ? 'Για όλη την παρέα' : 'Στο μαγαζί']), story, steps };
  },
};

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
