// Euclidean division in a story, Δ = δ × π + υ: find the quotient and the remainder, the
// dividend or the divisor, and check by multiplying back (Ε΄ κεφ. 2.12 «Η διαίρεση στους
// φυσικούς αριθμούς»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, count, extra, fmt, known, sought, the, thing, type Family, type Rng, type Thing } from '../../lib.ts';

interface Setting {
  title: string[];
  th: Thing;
  to: Thing;
  d: [number, number];
  q: [number, number];
  /** "Η δασκάλα, που ..., μοίρασε" (the giver with a noise phrase) */
  giver: (noise: string) => string;
  noise: (r: Rng) => string;
  /** "εξίσου σε 24 παιδιά" / "σε κάποια παιδιά" */
  into: (d: string) => string;
  someInto: string;
  /** Known: "κάθε παιδί πήρε 12 μολύβια" */
  each: (q: string) => string;
  /** Sought: "Πόσα μολύβια πήρε κάθε παιδί" */
  askEach: string;
  askTo: string;    // "Σε πόσα παιδιά τα μοίρασε"
  askAll: string;   // "Πόσα μολύβια είχε"
  eachLabel: string; // "Μολύβια για κάθε παιδί"
  toLabel: string;   // "Παιδιά"
}

const SETTINGS: Setting[] = [
  {
    title: ['Τα μολύβια της τάξης', 'Η μοιρασιά'], th: thing('μολύβι', 'μολύβια', 'n'), to: thing('παιδί', 'παιδιά', 'n'), d: [18, 28], q: [3, 12],
    giver: n => `Η δασκάλα, ${n}, μοίρασε`, noise: r => extra(`που διδάσκει ${r.int(6, 25)} χρόνια`),
    into: d => `εξίσου σε ${d}`, someInto: 'εξίσου σε κάποια παιδιά',
    each: q => `κάθε παιδί πήρε ${q}`, askEach: 'Πόσα μολύβια πήρε κάθε παιδί', askTo: 'Σε πόσα παιδιά τα μοίρασε', askAll: 'Πόσα μολύβια είχε',
    eachLabel: 'Μολύβια για κάθε παιδί', toLabel: 'Παιδιά',
  },
  {
    title: ['Τα ράφια της βιβλιοθήκης', 'Η βιβλιοθηκάριος'], th: thing('βιβλίο', 'βιβλία', 'n'), to: thing('ράφι', 'ράφια', 'n'), d: [8, 30], q: [20, 45],
    giver: n => `Η βιβλιοθηκάριος, ${n}, τακτοποίησε`, noise: r => extra(`που ανοίγει τη βιβλιοθήκη στις ${r.int(8, 10)} το πρωί`),
    into: d => `σε ${d}, τον ίδιο αριθμό σε καθένα`, someInto: 'σε κάποια ράφια, τον ίδιο αριθμό σε καθένα',
    each: q => `σε κάθε ράφι μπήκαν ${q}`, askEach: 'Πόσα βιβλία μπήκαν σε κάθε ράφι', askTo: 'Πόσα ράφια γέμισε', askAll: 'Πόσα βιβλία είχε',
    eachLabel: 'Βιβλία σε κάθε ράφι', toLabel: 'Ράφια',
  },
  {
    title: ['Τα καρύδια του παππού', 'Τα εγγόνια'], th: thing('καρύδι', 'καρύδια', 'n'), to: thing('εγγόνι', 'εγγόνια', 'n'), d: [3, 7], q: [15, 60],
    giver: n => `Ο παππούς, ${n}, μοίρασε`, noise: r => extra(`που είναι ${r.int(68, 88)} χρονών`),
    into: d => `εξίσου στα ${d} του`, someInto: 'εξίσου στα εγγόνια του',
    each: q => `κάθε εγγόνι πήρε ${q}`, askEach: 'Πόσα καρύδια πήρε κάθε εγγόνι', askTo: 'Πόσα εγγόνια έχει ο παππούς', askAll: 'Πόσα καρύδια είχε',
    eachLabel: 'Καρύδια για κάθε εγγόνι', toLabel: 'Εγγόνια',
  },
  {
    title: ['Ο μαραθώνιος', 'Οι σταθμοί με το νερό'], th: thing('μπουκάλι νερό', 'μπουκάλια νερό', 'n'), to: thing('σταθμός', 'σταθμοί', 'm', 'σταθμούς'), d: [6, 15], q: [40, 120],
    giver: n => `Η επιτροπή του αγώνα δρόμου, ${n}, μοίρασε`, noise: r => extra(`που έχει ${fmt(r.step(900, 4000, 10))} δρομείς`),
    into: d => `εξίσου σε ${d} στη διαδρομή`, someInto: 'εξίσου σε κάποιους σταθμούς στη διαδρομή',
    each: q => `κάθε σταθμός πήρε ${q}`, askEach: 'Πόσα μπουκάλια πήρε κάθε σταθμός', askTo: 'Σε πόσους σταθμούς τα μοίρασε', askAll: 'Πόσα μπουκάλια είχε',
    eachLabel: 'Μπουκάλια για κάθε σταθμό', toLabel: 'Σταθμοί',
  },
  {
    title: ['Οι πιατέλες με τα κουλουράκια', 'Ο ζαχαροπλάστης'], th: thing('κουλουράκι', 'κουλουράκια', 'n'), to: thing('πιατέλα', 'πιατέλες', 'f'), d: [12, 30], q: [12, 30],
    giver: n => `Ο ζαχαροπλάστης, ${n}, μοίρασε`, noise: r => extra(`που δουλεύει από τις ${r.int(5, 7)} το πρωί`),
    into: d => `εξίσου σε ${d}`, someInto: 'εξίσου σε κάποιες πιατέλες',
    each: q => `σε κάθε πιατέλα μπήκαν ${q}`, askEach: 'Πόσα κουλουράκια μπήκαν σε κάθε πιατέλα', askTo: 'Πόσες πιατέλες γέμισε', askAll: 'Πόσα κουλουράκια είχε',
    eachLabel: 'Κουλουράκια σε κάθε πιατέλα', toLabel: 'Πιατέλες',
  },
  {
    title: ['Οι βολβοί του κήπου', 'Τα παρτέρια'], th: thing('βολβός', 'βολβοί', 'm', 'βολβούς'), to: thing('παρτέρι', 'παρτέρια', 'n'), d: [5, 14], q: [12, 40],
    giver: n => `Η κηπουρός του δήμου, ${n}, φύτεψε`, noise: r => extra(`που φροντίζει ${r.int(3, 9)} πάρκα`),
    into: d => `εξίσου σε ${d}`, someInto: 'εξίσου σε κάποια παρτέρια',
    each: q => `σε κάθε παρτέρι φύτεψε ${q}`, askEach: 'Πόσους βολβούς φύτεψε σε κάθε παρτέρι', askTo: 'Σε πόσα παρτέρια τους φύτεψε', askAll: 'Πόσους βολβούς είχε',
    eachLabel: 'Βολβοί σε κάθε παρτέρι', toLabel: 'Παρτέρια',
  },
];

/** "περίσσεψαν 7 μολύβια" / "περίσσεψε 1 μολύβι" */
const left = (u: number, t: Thing) => (u === 1 ? `περίσσεψε 1 ${t.one}` : `περίσσεψαν ${count(u, t)}`);

export const divisionCheck: Family = {
  id: 'division-check',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, κεφ. 2.12 «Η διαίρεση στους φυσικούς αριθμούς» (Ευκλείδεια διαίρεση)',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const d = r.int(...s.d), q = r.int(...s.q), u = r.int(1, d - 1);
    const D = d * q + u;
    const find = r.pick(['qr', 'dividend', 'divisor'] as const);
    const giver = s.giver(s.noise(r));
    const all = count(D, s.th, true);
    let story: string;
    if (find === 'qr') {
      story = `${giver} ${known(all)} ${known(s.into(count(d, s.to, true)))}, και ${known('περίσσεψαν κάποια')}. `
        + `${sought(s.askEach)} και ${sought(`πόσ${s.th.g === 'f' ? 'ες' : s.th.g === 'm' ? 'οι' : 'α'} περίσσεψαν`)};`;
      if (s.th.g === 'm') story = story.replace('περίσσεψαν κάποια', 'περίσσεψαν κάποιοι');
    } else if (find === 'dividend') {
      story = `${giver} ${the(s.th)} ${s.th.manyAcc} που είχε ${known(s.into(count(d, s.to, true)))}: ${known(s.each(count(q, s.th, true)))} και ${known(left(u, s.th))}. `
        + `${sought(s.askAll)};`;
    } else {
      story = `${giver} ${known(all)} ${s.someInto}: ${known(s.each(count(q, s.th, true)))} και ${known(left(u, s.th))}. ${sought(s.askTo)};`;
    }
    story = cap(story);

    const eqs = {
      qr: { right: `${fmt(D)} = ${d} × ; + ;`, wrong: [`; = ${fmt(D)} × ${d} + ;`, `${d} = ${fmt(D)} × ; + ;`, `${fmt(D)} = ${d} + ; + ;`] },
      dividend: { right: `; = ${d} × ${q} + ${u}`, wrong: [`${d} = ; × ${q} + ${u}`, `; = ${d} + ${q} + ${u}`, `${q} = ${d} × ; + ${u}`] },
      divisor: { right: `${fmt(D)} = ; × ${q} + ${u}`, wrong: [`; = ${fmt(D)} × ${q} + ${u}`, `${fmt(D)} = ${q} × ${u} + ;`, `; = ${fmt(D)} + ${q} + ${u}`] },
    }[find];
    const Q = (x: string) => x.replace(/;/g, '□');

    const steps: ProblemStep[] = [
      b.tag(undefined, find === 'qr' ? 'Ότι κάτι περίσσεψε το ξέρουμε· πόσο ακριβώς, το ψάχνουμε.' : 'Το υπόλοιπο μετράει κι αυτό.'),
      b.choice('plan', 'Ποια ισότητα Δ = δ × π + υ ταιριάζει στο πρόβλημα; (□: αυτό που ψάχνουμε)', Q(eqs.right), eqs.wrong.map(Q),
        'Διαιρετέος: όλα μαζί. Διαιρέτης: σε πόσα μοιράζονται. Πηλίκο: πόσα παίρνει το καθένα. Υπόλοιπο: όσα περισσεύουν.'),
    ];
    if (find === 'qr') {
      steps.push(b.numbers('solve', `Κάνουμε τη διαίρεση ${fmt(D)} : ${d}.`, [
        { label: `${s.eachLabel} (πηλίκο)`, answer: q },
        { label: `${cap(s.th.many)} που περίσσεψαν (υπόλοιπο)`, answer: u },
      ], `${d} × ${q} = ${fmt(d * q)} και ${d} × ${q + 1} = ${fmt(d * (q + 1))}, που είναι μεγαλύτερο από το ${fmt(D)}.`));
      if (q > 1 && r.chance(0.6)) {
        steps.push(b.choice('check', `Κάποιος βρήκε πηλίκο ${q - 1} και υπόλοιπο ${u + d}. Τι λάθος έκανε;`,
          `Το υπόλοιπο ${u + d} είναι πολύ μεγάλο`,
          ['Κανένα: είναι κι αυτό σωστό', `Έπρεπε να προσθέσει ${fmt(D)} + ${d}`, 'Το υπόλοιπο πρέπει να είναι μηδέν'],
          'Το υπόλοιπο είναι πάντα μικρότερο από τον διαιρέτη.'));
      } else {
        steps.push(b.numbers('check', 'Αναστοχαζόμαστε: επαληθεύουμε τη διαίρεση.', [{ label: `${d} × ${q} + ${u} =`, answer: D }],
          'Δ = δ × π + υ'));
      }
    } else if (find === 'dividend') {
      const ops = r.chance(0.5);
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        { label: ops ? `${cap(s.th.many)} που μοιράστηκαν: ${d} × ${q} =` : `${cap(s.th.many)} που μοιράστηκαν`, answer: d * q },
        { label: ops ? `Μαζί με το υπόλοιπο: ${fmt(d * q)} + ${u} =` : 'Μαζί με το υπόλοιπο', answer: D, unit: s.th.many },
      ], `${d} × ${q} = ${fmt(d * q)}.`));
      steps.push(b.numbers('check', `Αναστοχαζόμαστε: κάνουμε τη διαίρεση ${fmt(D)} : ${d}. Βγαίνουν τα ίδια;`, [
        { label: `Πηλίκο της διαίρεσης ${fmt(D)} : ${d}`, answer: q },
        { label: 'Υπόλοιπο', answer: u },
      ]));
    } else {
      const ops = r.chance(0.5);
      steps.push(b.numbers('solve', 'Λύνουμε: αφαιρούμε πρώτα το υπόλοιπο.', [
        { label: ops ? `${cap(s.th.many)} που μοιράστηκαν: ${fmt(D)} − ${u} =` : `${cap(s.th.many)} που μοιράστηκαν`, answer: d * q },
        { label: ops ? `${s.toLabel}: ${fmt(d * q)} : ${q} =` : s.toLabel, answer: d },
      ], `${fmt(D)} − ${u} = ${fmt(d * q)}. Πόσες φορές χωράει το ${q} στο ${fmt(d * q)};`));
      if (r.chance(0.5)) {
        steps.push(b.numbers('check', 'Αναστοχαζόμαστε: επαληθεύουμε.', [{ label: `${d} × ${q} + ${u} =`, answer: D }], 'Δ = δ × π + υ'));
      } else {
        steps.push(b.choice('check', 'Αναστοχαζόμαστε: τι πρέπει να ισχύει ακόμα;', `Το υπόλοιπο ${u} είναι μικρότερο από τον διαιρέτη ${d}`,
                    // a false comparison with the quotient (judging it is the skill), whichever way it is false
          [...(u !== q ? [`Το υπόλοιπο ${u} είναι ${u > q ? 'μικρότερο' : 'μεγαλύτερο'} από το πηλίκο, το ${q}`] : []), ...(d % 2 ? [`Ο διαιρέτης ${d} είναι άρτιος`] : []), `${fmt(D)} + ${u} = ${fmt(D + u)}`],
          `Αν το υπόλοιπο ήταν ${d} ή μεγαλύτερο, η μοιρασιά θα συνεχιζόταν.`));
      }
    }
    return { title: r.pick(s.title), story, steps };
  },
};
