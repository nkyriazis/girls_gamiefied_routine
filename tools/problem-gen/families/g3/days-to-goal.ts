// Have a, need b, gather c every day or week: how many days or weeks? What is missing is
// divided by c, and a remainder means one more day (Γ΄ κεφ. 18 «Διαιρέσεις» και κεφ. 10).
import type { ProblemStep } from '../../../../shared/types.ts';
import { extra, fmt, known, PEOPLE, sought, type Family, type Person, type Rng } from '../../lib.ts';

interface Period {
  HowMany: string; // "Σε πόσες εβδομάδες"
  many: string; // "εβδομάδες"
  oneMore: string; // "μία εβδομάδα ακόμη"
  times: string; // "Όσες εβδομάδες"
}
const WEEKS: Period = { HowMany: 'Σε πόσες εβδομάδες', many: 'εβδομάδες', oneMore: 'μία εβδομάδα ακόμη', times: 'Όσες εβδομάδες' };
const SATURDAYS: Period = { HowMany: 'Σε πόσα Σάββατα', many: 'Σάββατα', oneMore: 'ένα Σάββατο ακόμη', times: 'Όσα Σάββατα' };
const DAYS: Period = { HowMany: 'Σε πόσες μέρες', many: 'μέρες', oneMore: 'μία μέρα ακόμη', times: 'Όσες μέρες' };
const AFTERNOONS: Period = { HowMany: 'Σε πόσα απογεύματα', many: 'απογεύματα', oneMore: 'ένα απόγευμα ακόμη', times: 'Όσα απογεύματα' };
const SUNDAYS: Period = { HowMany: 'Σε πόσες Κυριακές', many: 'Κυριακές', oneMore: 'μία Κυριακή ακόμη', times: 'Όσες Κυριακές' };

interface N { a: number; b: number; c: number; need: number }
interface Setting {
  title: string;
  unit: string; // "ευρώ", "αυτοκόλλητα"
  period: (r: Rng) => Period;
  // per-period amount and the goal
  numbers: (r: Rng) => { c: number; q: number; b: (need: number) => number | null };
  story: (p: Person, n: N, per: Period, noise: string, given: boolean, r: Rng) => string;
  // after q periods: "θα της λείπουν ακόμη 4 ευρώ"
  still: (p: Person, rest: number) => string;
  noise: (r: Rng, p: Person) => string;
  given?: boolean; // can tell what is missing directly (then what she has is extra)
}

const ITEMS = [
  { what: 'ένα ποδήλατο', min: 90, max: 160 }, { what: 'μια κιθάρα', min: 60, max: 120 },
  { what: 'ένα σκέιτμπορντ', min: 40, max: 80 }, { what: 'ένα ζευγάρι πατίνια', min: 40, max: 80 },
  { what: 'ένα επιτραπέζιο παιχνίδι', min: 25, max: 50 },
];

const SETTINGS: Setting[] = [
  {
    title: 'Ο κουμπαράς', unit: 'ευρώ', given: true,
    period: r => (r.chance(0.6) ? WEEKS : SATURDAYS),
    numbers: r => ({
      c: r.int(3, 10), q: r.int(3, 10), b: need => {
        const fits = ITEMS.filter(x => x.max >= need + 10);
        if (!fits.length) return null;
        const it = r.pick(fits);
        return r.int(Math.max(it.min, need + 10), it.max);
      },
    }),
    // After the sister, «θα έχει όσα χρειάζεται» could be hers: the question names whom it means
    story: (p, n, per, noise, given, r) => {
      const item = r.pick(ITEMS.filter(x => x.min <= n.b && n.b <= x.max));
      if (!item) return '';
      const every = per === WEEKS ? 'Κάθε εβδομάδα βάζει' : 'Κάθε Σάββατο βάζει';
      return given
        ? `${p.Nom} μαζεύει χρήματα για ${item.what}. Έχει ${extra(`${n.a} ευρώ`)} και ${p.his} λείπουν ακόμη ${known(`${n.need} ευρώ`)}. `
          + `${every} στον κουμπαρά ${known(`${n.c} ευρώ`)} από το χαρτζιλίκι ${p.his}. ${noise} ${sought(`${per.HowMany} θα έχει${/^Η αδερφή/.test(noise) ? ` ${p.nom}` : ''} όσα χρειάζεται`)};`
        : `${p.Nom} θέλει να αγοράσει ${item.what} που κοστίζει ${known(`${n.b} ευρώ`)}. Έχει ήδη στον κουμπαρά ${known(`${n.a} ευρώ`)}. `
          + `${every} ${known(`${n.c} ευρώ`)} ${r.pick(['από το χαρτζιλίκι', 'από τις οικονομίες'])} ${p.his}. ${noise} ${sought(`${per.HowMany} θα έχει${/^Η αδερφή/.test(noise) ? ` ${p.nom}` : ''} όσα χρειάζεται`)};`;
    },
    still: (p, rest) => (rest === 1 ? `θα ${p.his} λείπει ακόμη 1 ευρώ` : `θα ${p.his} λείπουν ακόμη ${rest} ευρώ`),
    noise: (r, p) => r.pick([
      `Ο κουμπαράς ${p.his} είναι ένα γουρουνάκι που χωράει ${extra(`${r.step(200, 500, 50)} νομίσματα`)}.`,
      `Το μαγαζί είναι ανοιχτό ${extra(`${r.int(5, 6)} μέρες`)} την εβδομάδα.`,
      `Η αδερφή ${p.his} είναι ${extra(`${r.int(4, 14)} χρονών`)}.`,
    ]),
  },
  {
    title: 'Το άλμπουμ', unit: 'αυτοκόλλητα',
    period: () => DAYS,
    numbers: r => ({ c: r.pick([4, 5, 6]), q: r.int(3, 10), b: need => r.step(Math.max(160, need + 60), 300, 20) }),
    // After the friend, «θα γεμίσει το άλμπουμ» could be the friend's doing: the question names her
    story: (p, n, per, noise) => `Το άλμπουμ ${p.gen} έχει θέσεις για ${known(`${n.b} αυτοκόλλητα`)}. Έχει ήδη κολλήσει ${known(`${n.a} αυτοκόλλητα`)}. `
      + `Κάθε μέρα ανοίγει ένα φακελάκι με ${known(`${n.c} αυτοκόλλητα`)}, όλα καινούργια. ${noise} ${sought(`${per.HowMany} θα γεμίσει${/^(?:Η φίλη|Ο φίλος)/.test(noise) ? ` ${p.nom}` : ''} το άλμπουμ`)};`,
    still: (_p, rest) => (rest === 1 ? 'θα λείπει ακόμη 1 αυτοκόλλητο' : `θα λείπουν ακόμη ${rest} αυτοκόλλητα`),
    noise: (r, p) => r.pick([
      `Το άλμπουμ έχει ${extra(`${r.int(20, 40)} σελίδες`)}.`,
      `Ένα φακελάκι κοστίζει ${extra(`${r.int(1, 2)} ευρώ`)}.`,
      `${p.female ? 'Η φίλη της' : 'Ο φίλος του'} έχει ${extra(`${r.int(15, 60)} διπλά`)} για ανταλλαγή.`,
    ]),
  },
  {
    title: 'Το παζλ', unit: 'κομμάτια',
    period: () => AFTERNOONS,
    numbers: r => ({ c: r.pick([20, 30, 40, 50]), q: r.int(3, 9), b: need => [300, 500, 1000].find(x => x >= need + 50) ?? null }),
    story: (p, n, per, noise) => `${p.Nom} φτιάχνει ένα παζλ με ${known(`${fmt(n.b)} κομμάτια`)}. Έχει βάλει ήδη ${known(`${n.a} κομμάτια`)}. `
      + `Κάθε απόγευμα βάζει ${known(`${n.c} κομμάτια`)} ακόμη. ${noise} ${sought(`${per.HowMany} θα τελειώσει το παζλ`)};`,
    still: (_p, rest) => (rest === 1 ? 'θα λείπει ακόμη 1 κομμάτι' : `θα λείπουν ακόμη ${rest} κομμάτια`),
    noise: r => r.pick([
      `Το κουτί του παζλ κόστισε ${extra(`${r.int(8, 20)} ευρώ`)}.`,
      `Όταν τελειώσει, το παζλ θα έχει πλάτος ${extra(`${r.step(50, 80, 10)} εκατοστά`)}.`,
      `Παίζει πάντα με το παζλ στις ${extra(`${r.int(5, 7)} το απόγευμα`)}.`,
    ]),
  },
  {
    title: 'Τα δέντρα του λόφου', unit: 'δέντρα',
    period: () => SUNDAYS,
    numbers: r => ({ c: r.pick([10, 20, 30, 40]), q: r.int(3, 9), b: need => r.step(need + 40, need + 200, 10) }),
    story: (_p, n, per, noise) => `Ο σύλλογος του χωριού θέλει να φυτέψει ${known(`${n.b} δέντρα`)} στον λόφο. Μέχρι τώρα έχουν φυτευτεί ${known(`${n.a} δέντρα`)}. `
      + `Κάθε Κυριακή οι εθελοντές φυτεύουν ${known(`${n.c} δέντρα`)}. ${noise} ${sought(`${per.HowMany} θα έχουν φυτευτεί όλα`)};`,
    still: (_p, rest) => (rest === 1 ? 'θα μένει ακόμη 1 δέντρο' : `θα μένουν ακόμη ${rest} δέντρα`),
    noise: r => r.pick([
      `Στον σύλλογο είναι γραμμένοι ${extra(`${r.int(40, 90)} εθελοντές`)}.`,
      `Ο λόφος απέχει ${extra(`${r.int(2, 6)} χιλιόμετρα`)} από το χωριό.`,
      `Κάθε δέντρο το ποτίζουν με ${extra(`${r.int(5, 10)} λίτρα`)} νερό.`,
    ]),
  },
  {
    title: 'Ο περίπατος', unit: 'χιλιόμετρα',
    period: () => DAYS,
    numbers: r => ({ c: r.int(3, 7), q: r.int(4, 10), b: need => need + r.step(10, 40, 5) }),
    story: (_p, n, per, noise) => `Ο παππούς θέλει να περπατήσει ${known(`${n.b} χιλιόμετρα`)} αυτόν τον μήνα. Έχει περπατήσει ήδη ${known(`${n.a} χιλιόμετρα`)}. `
      + `Κάθε μέρα περπατάει ${known(`${n.c} χιλιόμετρα`)}. ${noise} ${sought(`${per.HowMany} ακόμη θα φτάσει τον στόχο του`)};`,
    still: (_p, rest) => (rest === 1 ? 'θα μένει ακόμη 1 χιλιόμετρο' : `θα μένουν ακόμη ${rest} χιλιόμετρα`),
    noise: r => r.pick([
      `Είναι ${extra(`${r.int(65, 80)} χρονών`)}.`,
      `Ξεκινάει κάθε πρωί στις ${extra(`${r.int(7, 9)}`)}.`,
      `Παίρνει μαζί του ${extra(`${r.int(2, 3)} μπουκάλια`)} νερό.`,
    ]),
  },
];

export const daysToGoal: Family = {
  id: 'days-to-goal',
  grade: 3,
  unit: 3,
  source: 'Μαθηματικά Γ΄, κεφ. 18 «Διαιρέσεις» και κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const p = r.pick(PEOPLE);
    const per = s.period(r);
    const { c, q, b: goal } = s.numbers(r);
    const rest = r.chance(0.65) ? r.int(1, c - 1) : 0;
    const need = c * q + rest;
    const total = goal(need);
    if (total === null || total <= need) return null;
    const a = total - need;
    const given = !!s.given && r.chance(0.4);
    const story = s.story(p, { a, b: total, c, need }, per, s.noise(r, p), given, r);
    if (!story) return null;

    const steps: ProblemStep[] = [b.tag(undefined, given
      ? 'Χρειαζόμαστε όσα λείπουν και όσα βάζει κάθε φορά. Αφού ξέρουμε όσα λείπουν, όσα έχει ήδη δεν χρειάζονται.'
      : 'Χρειαζόμαστε τον στόχο, όσα υπάρχουν ήδη και όσα προστίθενται κάθε φορά.')];
    if (!given) {
      steps.push(b.numbers('solve', 'Πόσα λείπουν για τον στόχο;', [
        { label: r.chance(0.5) ? `${fmt(total)} − ${a} =` : 'Λείπουν', answer: need, unit: s.unit },
      ], 'Από τον στόχο βγάζουμε όσα υπάρχουν ήδη.'));
    }
    if (r.chance(0.5)) {
      steps.push(b.choice('plan', 'Ποια πράξη μας βοηθά τώρα;', `${need} : ${c}`,
        [`${need} − ${c}`, `${need} × ${c}`, ...(given ? [] : [`${fmt(total)} : ${c}`])],
        `Κάθε φορά μπαίνουν ${c} από τα ${need} που λείπουν. Πόσες φορές χωράει το ${c} στο ${need};`));
    }
    if (!rest) {
      steps.push(b.numbers('solve', 'Λύνουμε.', [r.chance(0.5) ? { label: `${need} : ${c} =`, answer: q, unit: per.many } : { label: cap(per.many), answer: q }],
        `Ποιος αριθμός επί ${c} κάνει ${need};`));
      steps.push(b.choice('check', 'Πώς ελέγχουμε;', `${q} × ${c} = ${need}`,
        [`${need} + ${c} = ${need + c}`, `${q} + ${c} = ${q + c}`], `${per.times} επί ${c} πρέπει να κάνουν ${need}.`));
    } else {
      steps.push(b.numbers('solve', `Μοιράζουμε τα ${need} ${s.unit} σε ομάδες των ${c}.`, [
        { label: `${cap(per.many)} με ${c} ${s.unit}`, answer: q, unit: per.many },
        { label: `${cap(s.unit)} που περισσεύουν`, answer: rest },
      ], c >= 10 ? `Μετράμε ανά ${c}: ${c}, ${2 * c}, ${3 * c}, … Πού σταματάμε, πριν ξεπεράσουμε το ${need};`
        : `Σκέψου την προπαίδεια του ${c}: ποιο γινόμενο φτάνει πιο κοντά στο ${need} χωρίς να το ξεπερνά;`));
      const wrongs = [`${q}, γιατί τόσες φορές χωράει το ${c} στο ${need}`];
      if (rest > 1 && rest !== q && rest !== q + 1) wrongs.push(`${rest}, όσα περισσεύουν στο τέλος`);
      else if (!given && Math.ceil(total / c) !== q + 1 && Math.ceil(total / c) !== q) wrongs.push(`${Math.ceil(total / c)}, όσες φορές χωράει το ${c} στο ${fmt(total)}`);
      if (wrongs.length < 2 && rest > 1 && q + rest !== q + 1) wrongs.push(`${q + rest}, γιατί προσθέτουμε και όσα περισσεύουν`);
      if (wrongs.length < 2) wrongs.push(`${need - c}, γιατί αφαιρούμε ${need} − ${c}`);
      steps.push(b.choice('check', `${per.HowMany} λοιπόν;`,
        `${q + 1}, ${per.oneMore} για όσα μένουν`, wrongs,
        `Αυτά που περισσεύουν χρειάζονται κι αυτά ${per.oneMore}.`));
    }
    return { title: r.pick([s.title, 'Ο στόχος', 'Πότε θα φτάσουμε;']), story, steps };
  },
};

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
