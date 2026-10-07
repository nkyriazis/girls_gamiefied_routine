// Equal groups: n boxes, packs or rows with k in each (Γ΄ κεφ. 4–5 «Πολλαπλασιασμός,
// προπαίδεια»). Sometimes first the story without k: can we answer yet?
import type { ProblemStep } from '../../../../shared/types.ts';
import { count, extra, fmt, HowMany, howMany, known, PEOPLE, rng, sought, the, thing, type Family, type Person, type Rng, type Thing } from '../../lib.ts';

type Mark = (s: string) => string;
const id: Mark = s => s;

interface Setting {
  cont: Thing;      // the group: κουτί, σειρά
  item: Thing;      // what is in it
  k: [number, number];
  n: [number, number];
  open: (p: Person, groups: string) => string;  // "Ο Νίκος αγόρασε [4 κουτιά] με μολύβια."
  ask: (p: Person) => string;                    // "πόσα μολύβια αγόρασε"
  noise: (r: Rng, x: Mark) => string;
}

const SETTINGS: Setting[] = [
  {
    cont: thing('κουτί', 'κουτιά', 'n'), item: thing('μολύβι', 'μολύβια', 'n'), k: [6, 10], n: [2, 9],
    open: (p, g) => `${p.Nom} αγόρασε ${g} με μολύβια για την τάξη.`,
    ask: () => 'πόσα μολύβια αγόρασε',
    noise: (r, x) => `Κάθε κουτί κοστίζει ${x(`${r.int(2, 5)} ευρώ`)}.`,
  },
  {
    cont: thing('θήκη', 'θήκες', 'f'), item: thing('αυγό', 'αυγά', 'n'), k: [6, 6], n: [3, 9],
    open: (p, g) => `Ο παππούς ${p.gen} έφερε από το χωριό ${g} με αυγά.`,
    ask: () => 'πόσα αυγά έφερε ο παππούς',
    noise: (r, x) => `Το χωριό είναι ${x(`${r.step(20, 90, 10)} χιλιόμετρα`)} μακριά.`,
  },
  {
    cont: thing('σειρά', 'σειρές', 'f'), item: thing('καρέκλα', 'καρέκλες', 'f'), k: [6, 10], n: [4, 10],
    open: (_p, g) => `Για τη σχολική γιορτή, ο διευθυντής βάζει τις καρέκλες στην αυλή σε ${g}.`,
    ask: () => 'πόσες καρέκλες βάζει συνολικά',
    noise: (r, x) => `Η γιορτή αρχίζει στις ${x(`${r.int(10, 12)} το πρωί`)}.`,
  },
  {
    cont: thing('φύλλο', 'φύλλα', 'n'), item: thing('αυτοκόλλητο', 'αυτοκόλλητα', 'n'), k: [5, 9], n: [3, 8],
    open: (p, g) => `${p.Nom} πήρε δώρο ${g} με αυτοκόλλητα.`,
    ask: () => 'πόσα αυτοκόλλητα πήρε',
    noise: (r, x) => `Το άλμπουμ της έχει ${x(`${r.int(20, 40)} σελίδες`)}.`,
  },
  {
    cont: thing('κούτα', 'κούτες', 'f'), item: thing('χυμός', 'χυμοί', 'm', 'χυμούς'), k: [6, 10], n: [3, 7],
    open: (_p, g) => `Για την εκδρομή, η δασκάλα αγόρασε ${g} με χυμούς.`,
    ask: () => 'πόσους χυμούς αγόρασε',
    noise: (r, x) => `Το λεωφορείο φεύγει στις ${x(`${r.int(8, 9)} το πρωί`)}.`,
  },
  {
    cont: thing('ράφι', 'ράφια', 'n'), item: thing('βιβλίο', 'βιβλία', 'n'), k: [7, 10], n: [3, 6],
    open: (_p, g) => `Η βιβλιοθήκη της τάξης έχει ${g} γεμάτα βιβλία.`,
    ask: () => 'πόσα βιβλία έχει η βιβλιοθήκη',
    noise: (r, x) => `Στην τάξη είναι ${x(`${r.int(18, 25)} παιδιά`)}.`,
  },
];

export const equalGroups: Family = {
  id: 'equal-groups',
  grade: 3,
  unit: 1,
  source: 'Μαθηματικά Γ΄, κεφ. 4 και 5 «Πολλαπλασιασμός, προπαίδεια (Ι) και (ΙΙ)»',
  make(r, b) {
    const p = r.pick(PEOPLE);
    const s = r.pick(SETTINGS);
    const n = r.int(...s.n);
    const k = r.int(...s.k);
    const total = n * k;
    const { cont, item } = s;
    const noiseAt = r.int(0, 1_000_000);
    // The same story twice: with marks, and plain (for the step without k)
    const tell = r.int(0, 2);
    const noiseFor = (x: Mark) => s.noise(rng(noiseAt), x).replace('Το άλμπουμ της', `Το άλμπουμ ${p.his}`);
    const build = (K: Mark, S: Mark, X: Mark, withK: boolean) => {
      const open = s.open(p, K(count(n, cont, true)));
      const each = [
        `Κάθε ${cont.one} έχει ${K(count(k, item, true))}.`,
        `Σε κάθε ${cont.one} χωράνε ${K(count(k, item))}.`,
      ];
      const ask = s.ask(p);
      const Ask = ask[0].toUpperCase() + ask.slice(1);
      if (tell === 0) return [open, withK ? each[0] : '', noiseFor(X), `${S(Ask)};`].filter(Boolean).join(' ');
      if (tell === 1) return [withK ? each[1] : '', open, noiseFor(X), `${S(Ask)};`].filter(Boolean).join(' ');
      return withK
        ? `${open} ${noiseFor(X)} Αν κάθε ${cont.one} έχει ${K(count(k, item, true))}, ${S(ask)};`
        : `${open} ${noiseFor(X)} ${Ask};`;
    };
    const story = build(known, sought, extra, true);

    const steps: ProblemStep[] = [];
    const missing = r.chance(0.35);
    if (missing) {
      steps.push(b.choice('read', 'Μπορούμε να απαντήσουμε;', `Όχι, δεν λέει ${howMany(item)} έχει κάθε ${cont.one}`,
        [`Ναι, είναι ${count(n, item)}, όσ${cont.g === 'n' ? 'α' : cont.g === 'f' ? 'ες' : 'οι'} και ${the(cont, false)} ${cont.many}`,
          `Ναι, αρκεί να μετρήσουμε ${cont.g === 'n' ? 'τα' : 'τις'} ${cont.many}`],
        `Ξέρουμε ${howMany(cont)} ${cont.manyAcc} είναι. Ξέρουμε και τι έχει ${cont.g === 'n' ? 'το καθένα' : 'η καθεμία'};`,
        build(id, id, id, false)));
    }
    steps.push(b.tag(missing ? 'Τώρα η ιστορία έχει όλα όσα χρειαζόμαστε. Τι ξέρουμε και τι ψάχνουμε;' : undefined,
      `Χρειαζόμαστε ${howMany(cont)} ${cont.manyAcc} είναι και ${howMany(item)} ${item.manyAcc} έχει ${cont.g === 'n' ? 'το καθένα' : 'η καθεμία'}.`));
    if (!missing || r.chance(0.5)) {
      steps.push(b.choice('plan', 'Ποια πράξη μας βοηθά;', `${n} × ${k}`,
        [`${n} + ${k}`, `${k} − ${n}`, `${n} × ${k} + ${n}`].slice(0, r.int(2, 3)),
        `${cont.g === 'n' ? 'Όλα τα' : 'Όλες οι'} ${cont.many} έχουν τον ίδιο αριθμό: αυτό είναι πολλαπλασιασμός.`));
    }
    steps.push(b.numbers('solve', 'Λύνουμε.', [
      { label: r.chance(0.5) ? `${n} × ${k} =` : 'Όλα μαζί', answer: total, unit: item.manyAcc },
    ], `Μετράμε ανά ${k}: ${Array.from({ length: Math.min(n, 4) }, (_x, i) => fmt((i + 1) * k)).join(', ')}${n > 4 ? ', …' : ''}`));
    steps.push(n <= 5
      ? b.choice('check', 'Πώς ελέγχουμε;', `${Array(n).fill(k).join(' + ')} = ${fmt(total)}`,
        // one group too many, as many terms as the right one and one more
        [`${n} + ${k} = ${n + k}`, `${Array(n + 1).fill(k).join(' + ')} = ${fmt(k * (n + 1))}`],
        `Προσθέτουμε ${n} φορές το ${k}.`)
      : b.choice('check', 'Πώς ελέγχουμε;', `${k} × ${n} = ${fmt(total)}`,
        [`${n} + ${k} = ${n + k}`, `${k} × ${n + 1} = ${fmt(k * (n + 1))}`],
        `Αλλάζουμε τη σειρά: ${k} φορές το ${n} κάνει το ίδιο.`));
    return { title: r.pick(['Ίσες ομάδες', 'Πόσα όλα μαζί;', `${cont.g === 'n' ? 'Τα' : 'Οι'} ${cont.many}`, 'Η προπαίδεια']), story, steps };
  },
};
