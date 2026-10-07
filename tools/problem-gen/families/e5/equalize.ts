// "If Nikos gives her 39, they will have the same": work backwards from the end
// (Ε΄ Επαναληπτικό 2, 2ο πρόβλημα).
import { count, extra, fmt, HowMany, known, people, sought, thing, type Family } from '../../lib.ts';

const COLLECTIONS = [
  { t: thing('γραμματόσημο', 'γραμματόσημα', 'n'), of: 'γραμματοσήμων', noise: (n: number) => `από ${n} χώρες` },
  { t: thing('κάρτα', 'κάρτες', 'f'), of: 'καρτών', noise: (n: number) => `σε ${n} άλμπουμ` },
  { t: thing('βόλος', 'βόλοι', 'm', 'βόλους'), of: 'βόλων', noise: (n: number) => `σε ${n} σακουλάκια` },
  { t: thing('αυτοκόλλητο', 'αυτοκόλλητα', 'n'), of: 'αυτοκόλλητων', noise: (n: number) => `με ${n} διαφορετικά σχέδια` },
  { t: thing('κοχύλι', 'κοχύλια', 'n'), of: 'κοχυλιών', noise: (n: number) => `από ${n} παραλίες` },
  { t: thing('βιβλίο', 'βιβλία', 'n'), of: 'βιβλίων', noise: (n: number) => `σε ${n} ράφια` },
];

export const equalize: Family = {
  id: 'equalize-by-giving',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, Επαναληπτικό 2, 2ο πρόβλημα',
  make(r, b) {
    const [a, other] = people(r, 2);
    const { t, of, noise } = r.pick(COLLECTIONS);
    const has = r.int(120, 950);
    const give = r.int(12, 95);
    // Either the other gives to `a` (the other has more), or `a` gives to the other
    const toA = r.chance(0.6);
    const after = toA ? has + give : has - give;
    const otherHas = toA ? after + give : after - give;
    if (otherHas <= 0 || after <= 0) return null;
    const verb = toA
      ? `Αν ${other.nom} ${a.female ? 'της' : 'του'} δώσει ${fmt(give)} από ${t.g === 'f' ? 'τις δικές' : t.g === 'm' ? 'τους δικούς' : 'τα δικά'} ${other.his}`
      : `Αν ${a.nom} δώσει ${fmt(give)} ${t.manyAcc} σ${other.acc}`;
    const story = `${a.Nom} έχει στη συλλογή ${a.his} ${known(count(has, t, true))}, ${extra(noise(r.int(3, 15)))}. `
      + `${known(verb)}, ${known(`θα έχουν τον ίδιο αριθμό ${of}`)}. `
      + `${sought(`${HowMany(t)} ${t.manyAcc} έχει ${other.nom}`)};`;
    const steps = [
      b.tag(undefined, 'Το «θα έχουν τον ίδιο αριθμό» είναι κι αυτό κάτι που ξέρουμε.'),
      b.choice('plan', 'Ποια στρατηγική ταιριάζει;', 'Εργάζομαι αντίστροφα: από το τέλος',
        ['Αναζητώ ένα μοτίβο στους αριθμούς', `Προσθέτω ${fmt(has)} + ${fmt(give)} και τελειώνω εκεί`],
        'Ξέρουμε τι γίνεται στο τέλος. Από εκεί γυρίζουμε πίσω.'),
      b.numbers('solve', 'Πηγαίνουμε αντίστροφα.', [
        { label: `${a.Nom} μετά`, answer: after },
        { label: `${other.Nom} μετά`, answer: after },
        { label: `${other.Nom} πριν`, answer: otherHas },
      ], toA
        ? `${fmt(has)} + ${fmt(give)} = ${fmt(after)}. Τότε ${other.nom} έχει κι ${other.female ? 'αυτή' : 'αυτός'} ${fmt(after)}· πριν δώσει είχε ${fmt(give)} περισσότερα.`
        : `${fmt(has)} − ${fmt(give)} = ${fmt(after)}. Τότε ${other.nom} έχει κι ${other.female ? 'αυτή' : 'αυτός'} ${fmt(after)}· πριν πάρει είχε ${fmt(give)} λιγότερα.`),
      b.choice('check', 'Πώς ελέγχουμε;',
        toA ? `${fmt(otherHas)} − ${fmt(give)} = ${fmt(after)} και ${fmt(has)} + ${fmt(give)} = ${fmt(after)}`
          : `${fmt(otherHas)} + ${fmt(give)} = ${fmt(after)} και ${fmt(has)} − ${fmt(give)} = ${fmt(after)}`,
        // the giving the other way round (both sides, as the right one), the two added, their difference
        // (or, where that would go below zero, added to both)
        [toA && has > give ? `${fmt(otherHas)} + ${fmt(give)} = ${fmt(otherHas + give)} και ${fmt(has)} − ${fmt(give)} = ${fmt(has - give)}`
          : !toA && otherHas > give ? `${fmt(otherHas)} − ${fmt(give)} = ${fmt(otherHas - give)} και ${fmt(has)} + ${fmt(give)} = ${fmt(has + give)}`
            : `${fmt(otherHas)} + ${fmt(give)} = ${fmt(otherHas + give)} και ${fmt(has)} + ${fmt(give)} = ${fmt(has + give)}`,
        `${fmt(otherHas)} + ${fmt(has)} = ${fmt(otherHas + has)}`, `${fmt(Math.max(otherHas, has))} − ${fmt(Math.min(otherHas, has))} = ${fmt(Math.abs(otherHas - has))}, άρα λάθος`],
        'Ξαναπαίζουμε την ιστορία με την απάντησή μας: έχουν στο τέλος τον ίδιο αριθμό;'),
    ];
    return { title: r.pick([`Οι συλλογές`, 'Ίδιος αριθμός', 'Δώσε και πάρε']), story, steps };
  },
};
