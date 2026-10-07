// Division with a remainder, and what the remainder means: money left over, or one
// more car for the kids left (Γ΄ κεφ. 12 «Προβλήματα» 2 «Τα μπαλόνια»).
import { cap, count, extra, fmt, HowMany, known, PEOPLE, sought, the, thing, type Family } from '../../lib.ts';

const BUYS = [
  thing('μπαλόνι', 'μπαλόνια', 'n'), thing('σοκολάτα', 'σοκολάτες', 'f'), thing('τετράδιο', 'τετράδια', 'n'),
  thing('λουλούδι', 'λουλούδια', 'n'), thing('μαρκαδόρος', 'μαρκαδόροι', 'm', 'μαρκαδόρους'), thing('φακός', 'φακοί', 'm', 'φακούς'),
  thing('κορδέλα', 'κορδέλες', 'f'),
];
// The most one costs in a shop (the audit's story-check holds wider ranges); a flashlight up to 9 €
const MAX_PRICE: Record<string, number> = { μπαλόνι: 5, σοκολάτα: 4, τετράδιο: 4, λουλούδι: 5, μαρκαδόρος: 3, φακός: 9, κορδέλα: 5 };

const RIDES = [
  { vehicle: thing('αυτοκίνητο', 'αυτοκίνητα', 'n'), seats: [3, 4, 5], who: 'παιδιά', Who: 'Παιδιά', trip: 'πηγαίνουν εκδρομή στο δάσος', goal: 'για να πάνε όλα' },
  { vehicle: thing('βάρκα', 'βάρκες', 'f'), seats: [4, 5, 6], who: 'παιδιά', Who: 'Παιδιά', trip: 'κάνουν βόλτα στη λίμνη', goal: 'για να μπουν όλα' },
  { vehicle: thing('τραπέζι', 'τραπέζια', 'n'), seats: [4, 6, 8], who: 'καλεσμένοι', Who: 'Καλεσμένοι', trip: 'έρχονται σε ένα πάρτι', goal: 'για να καθίσουν όλοι' },
  { vehicle: thing('ταξί', 'ταξί', 'n'), seats: [3, 4], who: 'επιβάτες', Who: 'Επιβάτες', trip: 'φτάνουν στο αεροδρόμιο', goal: 'για να φύγουν όλοι' },
];

export const remainder: Family = {
  id: 'division-remainder',
  grade: 3,
  unit: 1,
  source: 'Μαθηματικά Γ΄, κεφ. 12 «Προβλήματα», 2 «Τα μπαλόνια»',
  make(r, b) {
    if (r.chance(0.55)) {
      // Money: how many can we buy, what is left
      const p = r.pick(PEOPLE);
      const t = r.pick(BUYS);
      const price = r.int(2, 9);
      if (price > MAX_PRICE[t.one]) return null;
      const n = r.int(3, 10);
      const rest = r.int(1, price - 1);
      const money = price * n + rest;
      // Enclitic accent: «τα γενέθλιά της», not «τα γενέθλια της»
      const story = `${p.Nom} θέλει να αγοράσει ${t.manyAcc} για ${r.pick(['τη γιορτή', 'τα γενέθλιά', 'το πάρτι'])} ${p.his}. `
        + `Στο μαγαζί «${r.pick(['Η φτήνια', 'Το αστέρι', 'Η γωνιά'])}» ${t.g === 'n' ? 'το' : t.g === 'f' ? 'η' : 'ο'} ${t.one} κοστίζει ${known(`${price} ευρώ`)}. `
        + `${p.Nom} έχει ${known(`${fmt(money)} ευρώ`)}. Το μαγαζί έχει ${extra(count(r.int(40, 90), t, true))} στο ράφι. `
        + `${sought(`${HowMany(t)} ${t.manyAcc} μπορεί να αγοράσει`)}; ${sought('Θα περισσέψουν χρήματα')};`;
      const steps = [
        b.tag(undefined, 'Όσα έχει το μαγαζί στο ράφι αλλάζουν όσα μπορεί να αγοράσει;'),
        b.choice('plan', 'Ποια πράξη μας βοηθά;', `${fmt(money)} : ${price}`,
          [`${fmt(money)} + ${price}`, `${fmt(money)} − ${price}`, `${fmt(money)} × ${price}`].slice(0, r.int(2, 3)),
          `Κάθε ${t.one} «τρώει» ${price} ευρώ από τα ${fmt(money)}. Πόσες φορές γίνεται αυτό;`),
        b.numbers('solve', 'Λύνουμε.', [
          { label: 'Μπορεί να αγοράσει', answer: n, unit: t.manyAcc },
          { label: 'Ευρώ που περισσεύουν', answer: rest },
        ], `${price} × ${n} = ${fmt(price * n)}. Πόσο μένει ως το ${fmt(money)};`),
        b.choice('check', 'Πώς ελέγχουμε ότι βρήκαμε σωστά;', `${n} × ${price} + ${rest} = ${fmt(money)}`,
          [`${n} + ${price} + ${rest} = ${n + price + rest}`, `${n} × ${price} − ${rest} = ${fmt(n * price - rest)}`],
          'Όσα αγόρασε επί την τιμή τους, μαζί με τα ρέστα, πρέπει να κάνουν όσα είχε.'),
      ];
      return { title: r.pick([`${cap(the(t, false))} ${t.many}`, 'Πόσα μπορώ να πάρω;', 'Στο μαγαζί']), story, steps };
    }

    // Seats: the kids left over still need one more
    const ride = r.pick(RIDES);
    const seats = r.pick(ride.seats);
    const full = r.int(3, 9);
    const left = r.int(1, seats - 1);
    const people = seats * full + left;
    const v = ride.vehicle;
    const kids = ride.who === 'παιδιά';
    const story = `${known(`${fmt(people)} ${ride.who}`)} ${ride.trip}. Σε κάθε ${v.one} χωράνε ${known(`${seats} ${ride.who}`)}. `
      + `Είναι ${extra(`${r.int(8, 11)} η ώρα`)} το πρωί. ${sought(`${HowMany(v, false)} ${v.many} χρειάζονται`)}, ${ride.goal};`;
    const steps = [
      b.tag(undefined, 'Η ώρα που ξεκινούν αλλάζει πόσα χρειάζονται;'),
      b.numbers('solve', `Μοιράζουμε ${fmt(people)} σε ομάδες των ${seats}.`, [
        { label: `Γεμάτα ${v.many}`, answer: full },
        { label: `${ride.Who} που περισσεύουν`, answer: left },
      ], `${seats} × ${full} = ${fmt(seats * full)}. Πόσοι μένουν ως το ${fmt(people)};`),
      b.choice('check', `${HowMany(v, false)} ${v.many} χρειάζονται λοιπόν;`, `${full + 1}, ${v.g === 'f' ? 'μία' : 'ένα'} ακόμα για ${kids ? 'όσα' : 'όσους'} περισσεύουν`,
        [`${full}, ${v.g === 'f' ? 'όσες' : 'όσα'} γεμίζουν· ${kids ? 'τα άλλα' : 'οι άλλοι'} περιμένουν`, `${left}, το υπόλοιπο της διαίρεσης`],
        left === 1 ? 'Και ένας που περισσεύει δεν μπορεί να μείνει πίσω.' : `Οι ${left} που περισσεύουν δεν μπορούν να μείνουν πίσω.`),
    ];
    return { title: r.pick(['Όλοι μαζί', 'Φτάνουν οι θέσεις;', `${cap(the(v, false))} ${v.many}`]), story, steps };
  },
};
