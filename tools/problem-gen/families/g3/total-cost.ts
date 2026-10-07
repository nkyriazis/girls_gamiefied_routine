// What 2 or 3 things cost together, and sometimes: is the money enough, and how much is
// left or missing (Γ΄ κεφ. 2 «Προσθέσεις διψήφιων και τριψήφιων αριθμών»).
import { extra, fmt, known, PEOPLE, sought, workHint, type Family, type Person, type Rng } from '../../lib.ts';
import type { ProblemStep } from '../../../../shared/types.ts';

// nom: "η κασετίνα" (subject of κοστίζει), acc: "μια κασετίνα" (what one buys)
interface Item { nom: string; acc: string; min: number; max: number; pl?: boolean }
interface Setting {
  place: string;
  why: (p: Person) => string; // "για το σχολείο"
  items: Item[];
  noise: (r: Rng, p: Person) => string;
}

const SETTINGS: Setting[] = [
  {
    place: 'στο βιβλιοπωλείο',
    why: () => 'για το σχολείο',
    items: [
      { nom: 'η κασετίνα', acc: 'μια κασετίνα', min: 6, max: 15 },
      { nom: 'η σχολική τσάντα', acc: 'μια σχολική τσάντα', min: 25, max: 60 },
      { nom: 'το κουτί με τις ξυλομπογιές', acc: 'ένα κουτί ξυλομπογιές', min: 4, max: 12 },
      { nom: 'το λεξικό', acc: 'ένα λεξικό', min: 10, max: 25 },
      { nom: 'τα πέντε τετράδια', acc: 'πέντε τετράδια', min: 5, max: 9, pl: true },
    ],
    noise: r => `Το βιβλιοπωλείο ανοίγει στις ${extra(`${r.int(8, 9)} το πρωί`)}.`,
  },
  {
    place: 'στο αθλητικό κατάστημα',
    why: p => `για την προπόνησή ${p.his}`,
    items: [
      { nom: 'η μπάλα', acc: 'μια μπάλα', min: 12, max: 30 },
      { nom: 'τα αθλητικά παπούτσια', acc: 'ένα ζευγάρι αθλητικά παπούτσια', min: 35, max: 70, pl: true },
      { nom: 'η φόρμα', acc: 'μια φόρμα', min: 20, max: 40 },
      { nom: 'το παγούρι', acc: 'ένα παγούρι', min: 5, max: 12 },
      { nom: 'η τσάντα για το γυμναστήριο', acc: 'μια τσάντα για το γυμναστήριο', min: 15, max: 30 },
    ],
    noise: r => `Η προπόνηση αρχίζει στις ${extra(`${r.int(5, 7)} το απόγευμα`)}.`,
  },
  {
    place: 'στο κατάστημα παιχνιδιών',
    why: p => `για τα γενέθλια ${p.female ? 'της φίλης της' : 'του φίλου του'}`,
    items: [
      { nom: 'το παζλ', acc: 'ένα παζλ', min: 9, max: 25 },
      { nom: 'η κούκλα', acc: 'μια κούκλα', min: 12, max: 30 },
      { nom: 'το επιτραπέζιο', acc: 'ένα επιτραπέζιο', min: 15, max: 35 },
      { nom: 'η κάρτα με τις ευχές', acc: 'μια κάρτα με ευχές', min: 2, max: 5 },
      { nom: 'το χαρτί περιτυλίγματος', acc: 'χαρτί περιτυλίγματος', min: 2, max: 4 },
    ],
    noise: (r, p) => `${p.female ? 'Η φίλη της' : 'Ο φίλος του'} θα γίνει ${extra(`${r.int(8, 9)} χρονών`)}.`,
  },
  {
    place: 'στο σούπερ μάρκετ',
    why: () => 'για το πάρτι της τάξης',
    items: [
      { nom: 'οι χυμοί', acc: 'χυμούς', min: 6, max: 14, pl: true },
      { nom: 'τα πατατάκια', acc: 'πατατάκια', min: 4, max: 10, pl: true },
      { nom: 'τα ποτήρια', acc: 'χάρτινα ποτήρια', min: 2, max: 5, pl: true },
      { nom: 'η τούρτα', acc: 'μια τούρτα', min: 18, max: 35 },
      { nom: 'τα μπαλόνια', acc: 'μπαλόνια', min: 3, max: 8, pl: true },
    ],
    noise: r => `Στην τάξη είναι ${extra(`${r.int(18, 25)} παιδιά`)}.`,
  },
  {
    place: 'στο κατάστημα με τα ποδήλατα',
    why: p => `για το ποδήλατό ${p.his}`,
    items: [
      { nom: 'το κράνος', acc: 'ένα κράνος', min: 20, max: 45 },
      { nom: 'το κουδούνι', acc: 'ένα κουδούνι', min: 3, max: 8 },
      { nom: 'τα φωτάκια', acc: 'φωτάκια', min: 8, max: 16, pl: true },
      { nom: 'η κλειδαριά', acc: 'μια κλειδαριά', min: 10, max: 22 },
      { nom: 'το καλαθάκι', acc: 'ένα καλαθάκι', min: 12, max: 25 },
    ],
    noise: r => `Το ποδήλατο έχει ${extra(`${r.int(6, 21)} ταχύτητες`)}.`,
  },
];

export const totalCost: Family = {
  id: 'total-cost',
  grade: 3,
  unit: 1,
  source: 'Μαθηματικά Γ΄, κεφ. 2 «Προσθέσεις διψήφιων και τριψήφιων αριθμών»',
  make(r, b) {
    const p = r.pick(PEOPLE);
    const s = r.pick(SETTINGS);
    const why = s.why(p);
    const n = r.chance(0.5) ? 3 : 2;
    const items = r.sample(s.items, n);
    const prices = items.map(i => r.int(i.min, i.max));
    const total = prices.reduce((x, y) => x + y, 0);
    if (total > 150) return null;
    const costs = (i: Item) => (i.pl ? 'κοστίζουν' : 'κοστίζει');
    const Cap = (x: string) => x[0].toUpperCase() + x.slice(1);
    const list = items.map(i => i.acc);
    const listed = n === 3 ? `${list[0]}, ${list[1]} και ${list[2]}` : `${list[0]} και ${list[1]}`;
    const priceLines = items.map((i, k) => `${Cap(i.nom)} ${costs(i)} ${known(`${prices[k]} ευρώ`)}.`).join(' ');

    // Money: none (just the total), enough, or not enough
    const mode = r.pick(['total', 'enough', 'short'] as const);
    const money = mode === 'enough' ? r.step(total + 2, total + 40, r.pick([5, 10])) : mode === 'short' ? r.step(Math.max(10, total - 30), total - 2, 5) : 0;
    if (mode === 'enough' && money < total + 2) return null;
    if (mode === 'short' && (money <= 0 || money > total - 2)) return null;
    const age = () => `Είναι ${extra(`${r.int(8, 9)} χρονών`)}.`;
    const noiseShort = r.chance(0.5) ? s.noise(r, p) : age();
    const moneyFull = mode === 'total' ? '' : ` ${p.Nom} έχει ${r.pick(['μαζί', 'στο πορτοφόλι'])} ${p.his} ${known(`${fmt(money)} ευρώ`)}.`;
    const moneyShort = mode === 'total' ? '' : ` Έχει ${r.pick(['μαζί', 'στο πορτοφόλι'])} ${p.his} ${known(`${fmt(money)} ευρώ`)}.`;
    const asks = [
      (who: string) => `${sought(`Πόσα ευρώ θα πληρώσει${who}`)};`, () => `${sought('Πόσο κοστίζουν όλα μαζί')};`,
      (who: string) => `${sought(`Πόσα ευρώ θα δώσει${who} στο ταμείο`)};`,
    ];
    const asking = mode === 'total' ? r.pick(asks) : () => `${sought(`Φτάνουν τα χρήματά ${p.his}`)}; ${sought('Πόσα ευρώ θα περισσέψουν ή πόσα θα λείπουν')};`;
    // A friend in the noise is a second subject: the question then names whom it means
    const ask = (noise: string) => asking(/^(?:Η φίλη|Ο φίλος)/.test(noise) ? ` ${p.nom}` : '');
    const lower = (x: string) => x[0].toLowerCase() + x.slice(1);

    const story = r.pick([
      () => `${p.Nom} θέλει να αγοράσει ${why} ${listed}. ${noiseShort} ${priceLines}${moneyFull} ${ask(noiseShort)}`,
      () => { const noise = s.noise(r, p); return `${Cap(s.place)}, ${p.nom} διαλέγει ${listed} ${why}.${moneyShort} ${priceLines} ${noise} ${ask(noise)}`; },
      () => { const noise = s.noise(r, p); return `${Cap(s.place)} της γειτονιάς ${lower(priceLines)} ${p.Nom} θέλει να αγοράσει ${n === 3 ? 'και τα τρία' : 'και τα δύο'} ${why}.${moneyShort} ${noise} ${ask(noise)}`; },
    ])();

    const sum = prices.map(x => String(x)).join(' + ');
    const steps: ProblemStep[] = [b.tag(undefined, mode === 'total'
      ? 'Χρειαζόμαστε τις τιμές όσων αγοράζει.'
      : 'Χρειαζόμαστε τις τιμές και πόσα χρήματα έχει.')];
    const forgot = prices[0] + prices[1];
    const [hi, lo] = prices[0] >= prices[1] ? [prices[0], prices[1]] : [prices[1], prices[0]];
    if (r.chance(0.5)) {
      // As many terms as the right one: an item forgotten, × for +, or straight to the change
      // (the money less the prices, never less the total: that is the next step's answer)
      steps.push(b.choice('plan', 'Ποια πράξη μας δίνει το κόστος;', sum,
        n === 3
          ? [`${prices[0]} + ${prices[1]}`, `${prices[0]} × ${prices[1]} + ${prices[2]}`, ...(mode === 'total' || money <= forgot ? [] : [`${fmt(money)} − ${prices[0]} − ${prices[1]}`])]
          : [...(hi > lo ? [`${hi} − ${lo}`] : []), `${prices[0]} × ${prices[1]}`, ...(mode === 'total' || money <= prices[0] ? [] : [`${fmt(money)} − ${prices[0]}`])],
        'Όταν αγοράζουμε πολλά πράγματα, πληρώνουμε όλες τις τιμές μαζί.'));
    }
    // The hint follows the digits: two one-digit prices make ten first, a one-digit one is added
    // to the units of the other, two two-digit ones split one of them (lib.ts, workHint)
    const hint = n === 3
      ? `Προσθέτουμε πρώτα δύο τιμές: ${prices[0]} + ${prices[1]} = ${forgot}. Μετά βάζουμε και την τρίτη.`
      : workHint(`${prices[0]} + ${prices[1]}`)!;
    if (mode === 'total') {
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        { label: r.chance(0.5) ? `${sum} =` : 'Όλα μαζί κοστίζουν', answer: total, unit: 'ευρώ' },
      ], hint));
      steps.push(r.chance(0.5)
        ? b.choice('check', 'Πώς ελέγχουμε;', `${[...prices].reverse().join(' + ')} = ${total}`,
          n === 3
            // An item forgotten, or a price counted twice in place of another: one of the two is as long as the right one
            ? [`${prices[0]} + ${prices[1]} = ${forgot}`, `${prices[2]} + ${prices[1]} + ${prices[1]} = ${prices[2] + 2 * prices[1]}`,
              `${prices[2]} + ${prices[0]} + ${prices[0]} = ${prices[2] + 2 * prices[0]}`].filter(o => !o.startsWith(`${[...prices].reverse().join(' + ')} =`))
            : [`${hi} − ${lo} = ${hi - lo}`, `${total} + ${prices[0]} = ${total + prices[0]}`],
          'Προσθέτουμε τις τιμές με άλλη σειρά. Πρέπει να βρούμε το ίδιο.')
        : b.choice('check', 'Είναι λογική η απάντηση;', 'Ναι, είναι περισσότερα από κάθε τιμή',
          [`Όχι, πρέπει να κοστίζουν ${Math.max(...prices)} ευρώ`, `Όχι, πρέπει να είναι κάτω από ${Math.max(...prices)} ευρώ`],
          'Αν πληρώνουμε πολλά πράγματα, το ποσό μεγαλώνει.'));
    } else {
      const diff = Math.abs(money - total);
      steps.push(b.numbers('solve', 'Βρίσκουμε πρώτα το κόστος.', [
        { label: r.chance(0.5) ? `${sum} =` : 'Όλα μαζί κοστίζουν', answer: total, unit: 'ευρώ' },
      ], hint));
      steps.push(b.choice('solve', `Φτάνουν τα ${fmt(money)} ευρώ;`,
        mode === 'enough' ? 'Ναι, και θα περισσέψουν' : 'Όχι, θα λείπουν χρήματα',
        [mode === 'enough' ? ['Όχι, θα λείπουν χρήματα', 'Όχι, θα λείπουν', 'Όχι, θα λείπουν μερικά ευρώ'] : ['Ναι, και θα περισσέψουν', 'Ναι, θα περισσέψουν', 'Ναι, και θα περισσέψουν κιόλας'],
          ['Ναι, ακριβώς όσα χρειάζονται', 'Ναι, ακριβώς τόσα', 'Ναι, ίσα ίσα']],
        `Συγκρίνουμε τα ${fmt(money)} ευρώ με τα ${total} ευρώ που κοστίζουν όλα.`));
      steps.push(b.numbers('solve', mode === 'enough' ? 'Πόσα ευρώ θα περισσέψουν;' : 'Πόσα ευρώ λείπουν;', [
        mode === 'enough'
          ? { label: `Περισσεύουν: ${fmt(money)} − ${total} =`, answer: diff, unit: 'ευρώ' }
          : { label: `Λείπουν: ${total} − ${fmt(money)} =`, answer: diff, unit: 'ευρώ' },
      ], mode === 'enough' ? 'Από όσα έχει, βγάζουμε όσα πληρώνει.' : `Πόσα ευρώ χρειάζονται ακόμα από τα ${fmt(money)} ως τα ${total};`));
    }
    return { title: r.pick(['Πόσο κοστίζουν;', 'Στο ταμείο', 'Ψώνια', 'Όλα μαζί']), story, steps };
  },
};
