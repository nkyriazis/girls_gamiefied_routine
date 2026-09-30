// Money left after a purchase: X − Y (Γ΄ κεφ. 10 «Το μαγαζί της τάξης»).
import { extra, fmt, known, PEOPLE, sought, type Family } from '../../lib.ts';

const ITEMS = [
  'ένα αυτοκίνητο ράλι', 'ένα βιβλίο με παραμύθια', 'μια μπάλα ποδοσφαίρου', 'ένα επιτραπέζιο παιχνίδι',
  'ένα σακίδιο για το σχολείο', 'μια κούκλα', 'ένα παζλ', 'ένα ζευγάρι πατίνια', 'μια κασετίνα', 'ένα τηλεσκόπιο παιχνίδι',
];

export const change: Family = {
  id: 'change-left',
  grade: 3,
  unit: 2,
  source: 'Μαθηματικά Γ΄, κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών»',
  make(r, b) {
    const p = r.pick(PEOPLE);
    const item = r.pick(ITEMS);
    // Two-digit money early in the year, three-digit sometimes
    const big = r.chance(0.4);
    const have = big ? r.step(120, 900, 5) : r.int(35, 99);
    const cost = big ? r.int(35, have - 20) : r.int(12, have - 8);
    const left = have - cost;
    const noise = r.pick([
      `Το μαγαζί ανοίγει στις ${extra(`${r.int(8, 10)} το πρωί`)}.`,
      `Είναι ${extra(`${r.int(8, 9)} χρονών`)}.`,
      `Στο ράφι υπάρχουν ${extra(`${r.int(12, 40)} παιχνίδια`)}.`,
      `Το μαγαζί είναι ${extra(`${r.int(2, 6)} στενά`)} από το σπίτι ${p.his}.`,
    ]);
    const story = r.pick([
      () => `${p.Nom} έχει στον κουμπαρά ${p.his} ${known(`${fmt(have)} ευρώ`)}. Αγοράζει ${item} που κοστίζει ${known(`${fmt(cost)} ευρώ`)}. ${noise} ${sought(`Πόσα ευρώ θα ${p.his} περισσέψουν`)};`,
      () => `Στο μαγαζί της γειτονιάς, ${item} κοστίζει ${known(`${fmt(cost)} ευρώ`)}. ${p.Nom} πληρώνει με ${known(`${fmt(have)} ευρώ`)}. ${noise} ${sought('Πόσα ρέστα θα πάρει')};`,
      () => `${p.Nom} είχε ${known(`${fmt(have)} ευρώ`)} και ξόδεψε ${known(`${fmt(cost)} ευρώ`)} για ${item}. ${noise} ${sought(`Πόσα ευρώ ${p.his} έμειναν`)};`,
    ])();

    // Subtract the tens first, then the ones: 76 − 35: 76 − 30 = 46, 46 − 5 = 41
    const tens = cost - (cost % 10);
    const hint = cost % 10 && tens
      ? `Αφαιρούμε πρώτα ${fmt(tens)} και μετά ${cost % 10}: ${fmt(have)} − ${fmt(tens)} = ${fmt(have - tens)}, ${fmt(have - tens)} − ${cost % 10} = ${fmt(left)}.`
      : `Από όσα είχε, βγάζουμε όσα πλήρωσε.`;
    const plan = r.chance(0.6);
    const steps = [
      b.tag(undefined, 'Ποιοι αριθμοί αλλάζουν τα χρήματα που μένουν; Τους άλλους τους αφήνουμε.'),
      ...(plan ? [b.choice('plan', 'Ποια πράξη μας βοηθά;', `${fmt(have)} − ${fmt(cost)}`,
        [`${fmt(have)} + ${fmt(cost)}`, `${fmt(cost)} − ${fmt(have)}`, `${fmt(have)} × ${fmt(cost)}`].slice(0, r.int(2, 3)),
        'Από όσα έχει, φεύγουν όσα πληρώνει.')] : []),
      b.numbers('solve', 'Λύνουμε.', [{ label: plan ? `${fmt(have)} − ${fmt(cost)} =` : 'Μένουν', answer: left, unit: 'ευρώ' }], hint),
      r.chance(0.5)
        ? b.choice('check', 'Πώς ελέγχουμε;', `${fmt(cost)} + ${fmt(left)} = ${fmt(have)}`,
          [`${fmt(have)} + ${fmt(left)} = ${fmt(have + left)}`, `${fmt(left)} − ${fmt(cost)} = ${fmt(Math.abs(left - cost))}`],
          'Όσα πλήρωσε μαζί με όσα έμειναν πρέπει να κάνουν όσα είχε.')
        : b.choice('check', 'Είναι λογική η απάντηση;', `Ναι, γιατί τα ${fmt(left)} ευρώ είναι λιγότερα από τα ${fmt(have)} που είχε`,
          [`Όχι, πρέπει να είναι περισσότερα από ${fmt(have)} ευρώ`, `Όχι, πρέπει να είναι ${fmt(have + cost)} ευρώ`],
          `Αφού ξόδεψε χρήματα, ${p.his} μένουν λιγότερα από όσα είχε.`),
    ];
    return { title: r.pick(['Στο μαγαζί', 'Τα ρέστα', 'Ο κουμπαράς', 'Ψώνια']), story, steps };
  },
};
