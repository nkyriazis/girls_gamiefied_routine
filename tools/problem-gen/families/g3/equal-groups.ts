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
  chapter: '5',
  topic: 'Πολλαπλασιασμός',
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
      // What is missing, not «Μπορούμε να απαντήσουμε;» (#83): its verdict is always «Όχι», alone beside two «Ναι».
      // The number of groups (the story gives it), or nothing, taking the groups for the things. Each in a
      // wording longer than the right one too, so that the right one isn't the longest every time (#50's place rule)
      steps.push(b.choice('read', 'Τι λείπει για να λυθεί;', `${HowMany(item)} ${item.manyAcc} έχει κάθε ${cont.one}`,
        [[`${HowMany(cont, false)} ${cont.many} είναι`, `${HowMany(cont, false)} ${cont.many} είναι συνολικά`,
          `${HowMany(cont, false)} ${cont.many} με ${item.manyAcc} υπάρχουν`, `${HowMany(cont, false)} ${cont.many} με ${item.manyAcc} είναι συνολικά`],
          [`Τίποτα: είναι ${count(n, item)}, όσ${cont.g === 'n' ? 'α' : cont.g === 'f' ? 'ες' : 'οι'} και ${the(cont, false)} ${cont.many}`,
            `Τίποτα: είναι ${count(n, item)}, όσ${cont.g === 'n' ? 'α' : cont.g === 'f' ? 'ες' : 'οι'} ${the(cont, false)} ${cont.many}`,
            `Τίποτα: είναι ${count(n, item)}, ${item.g === 'n' ? 'ένα' : item.g === 'f' ? 'μία' : 'ένας'} σε κάθε ${cont.one}`,
            `Τίποτα: είναι ${count(n, item)} συνολικά`, `Τίποτα: είναι ${count(n, item)}`]],
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
      // The count stops before the answer: «Μετράμε ανά 10, 4 φορές: 10, 20, 30, …»
    ], `Μετράμε ανά ${k}, ${n} φορές: ${Array.from({ length: Math.min(n - 1, 3) }, (_x, i) => fmt((i + 1) * k)).join(', ')}, …`));
    const sum = (m: number) => `${Array(m).fill(k).join(' + ')} = ${fmt(k * m)}`;
    steps.push(n <= 5
      // Every option a sum, as the hint says: a product among sums stands out by its form.
      // One group too few, or n + k when there are only two; and one group too many or, the other
      // length (so the right sum isn't always the middle one), two too few (n + k when n is 3)
      ? b.choice('check', 'Πώς ελέγχουμε;', sum(n),
        n > 2 ? [sum(n - 1), [sum(n + 1), n > 3 ? sum(n - 2) : `${n} + ${k} = ${n + k}`]] : [`${n} + ${k} = ${n + k}`, sum(n + 1)],
        `Προσθέτουμε ${n} φορές το ${k}.`)
      : b.choice('check', 'Πώς ελέγχουμε;', `${k} × ${n} = ${fmt(total)}`,
        [`${n} + ${k} = ${n + k}`, `${k} × ${n + 1} = ${fmt(k * (n + 1))}`],
        `Αλλάζουμε τη σειρά: ${k} φορές το ${n} κάνει το ίδιο.`));
    return { title: r.pick(['Ίσες ομάδες', 'Πόσα όλα μαζί;', `${cont.g === 'n' ? 'Τα' : 'Οι'} ${cont.many}`, 'Η προπαίδεια']), story, steps };
  },
};
