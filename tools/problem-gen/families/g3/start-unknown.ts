// The start is unknown: had some, got or lost some, now has c. How many at first? We work
// backwards (Γ΄ κεφ. 12 «Προβλήματα», κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { count, extra, howMany, fmt, known, people, sought, thing, type Family, type Person, type Rng, type Thing } from '../../lib.ts';

interface Setting {
  t: Thing;
  some: string; // "κάποιες κάρτες"
  min: number;
  max: number;
  /** What happened, with the number already marked. */
  lose: (n: string, p: Person, q: Person) => string;
  gain: (n: string, p: Person, q: Person) => string;
  noise: (r: Rng, p: Person) => string;
}

const SETTINGS: Setting[] = [
  {
    t: thing('βόλος', 'βόλοι', 'm', 'βόλους'), some: 'κάποιους βόλους', min: 12, max: 90,
    lose: n => `Στο διάλειμμα έχασε ${n} στο παιχνίδι`,
    gain: n => `Στο διάλειμμα κέρδισε ${n} στο παιχνίδι`,
    noise: r => `Το διάλειμμα κράτησε ${extra(`${r.int(15, 25)} λεπτά`)}.`,
  },
  {
    t: thing('κάρτα', 'κάρτες', 'f'), some: 'κάποιες κάρτες', min: 20, max: 200,
    lose: (n, _p, q) => `Χάρισε ${n} σ${q.acc}`,
    gain: (n, _p, q) => `Πήρε ${n} από ${q.acc}`,
    noise: r => `Ένα άλμπουμ χωράει ${extra(`${r.step(150, 400, 50)} κάρτες`)}.`,
  },
  {
    t: thing('ευρώ', 'ευρώ', 'n'), some: 'κάποια χρήματα στον κουμπαρά', min: 15, max: 150,
    lose: n => `Έβγαλε ${n} για να αγοράσει ένα βιβλίο`,
    gain: (n, p) => `Πήρε ${n} από τη γιαγιά ${p.his}`,
    noise: (r, p) => `Ο κουμπαράς ${p.his} είναι ένα γουρουνάκι ψηλό ${extra(`${r.int(15, 25)} εκατοστά`)}.`,
  },
  {
    t: thing('αυτοκόλλητο', 'αυτοκόλλητα', 'n'), some: 'κάποια αυτοκόλλητα', min: 20, max: 150,
    lose: (n, p) => `Κόλλησε ${n} στο άλμπουμ ${p.his}`,
    gain: n => `Αγόρασε άλλα ${n} από το περίπτερο`,
    noise: r => `Τα αυτοκόλλητα είναι από μια ταινία που βγήκε πριν από ${extra(`${r.int(2, 5)} χρόνια`)}.`,
  },
  {
    t: thing('κοχύλι', 'κοχύλια', 'n'), some: 'κάποια κοχύλια σε ένα κουτί', min: 15, max: 90,
    lose: n => `Χρησιμοποίησε ${n} για να φτιάξει ένα κολιέ`,
    gain: n => `Στην παραλία μάζεψε άλλα ${n}`,
    noise: r => `Το κουτί το έχει από τότε που ήταν ${extra(`${r.int(5, 7)} χρονών`)}.`,
  },
];

export const startUnknown: Family = {
  id: 'start-unknown',
  grade: 3,
  unit: 2,
  source: 'Μαθηματικά Γ΄, κεφ. 12 «Προβλήματα» και κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών»',
  make(r, b) {
    const [p, q] = people(r, 2);
    const s = r.pick(SETTINGS);
    const t = s.t;
    const lost = r.chance(0.55);
    const start = r.int(s.min + 10, s.max);
    const change = r.int(4, Math.max(5, Math.floor(start * 0.6)));
    const now = lost ? start - change : start + change;
    if (now < 3 || change >= start) return null;
    const ch = known(count(change, t, true));
    // "της" in the stickers and the shells belongs to the person
    const happened = (lost ? s.lose : s.gain)(ch, p, q);
    const noise = s.noise(r, p);
    const Many = t.g === 'n' ? 'Πόσα' : t.g === 'f' ? 'Πόσες' : 'Πόσους';
    const nowPhrase = known(count(now, t, true));
    const story = r.pick([
      () => `${p.Nom} είχε ${s.some}. ${happened}. ${noise} Τώρα έχει ${nowPhrase}. ${sought(`${Many} ${t.manyAcc} είχε στην αρχή`)};`,
      () => `Τώρα ${p.nom} έχει ${nowPhrase}. Νωρίτερα, ${happened[0].toLowerCase()}${happened.slice(1)}. ${noise} ${sought(`${Many} ${t.manyAcc} είχε πριν`)};`,
      () => `${p.Nom} δεν θυμάται πόσ${t.g === 'n' ? 'α' : t.g === 'f' ? 'ες' : 'ους'} ${t.manyAcc} είχε. Ξέρει ότι ${happened[0].toLowerCase()}${happened.slice(1)} και ότι τώρα έχει ${nowPhrase}. ${noise} ${sought(`${Many} ${t.manyAcc} είχε στην αρχή`)};`,
    ])();

    const right = lost ? `${fmt(now)} + ${fmt(change)}` : `${fmt(now)} − ${fmt(change)}`;
    const wrongOp = lost ? `${fmt(now)} − ${fmt(change)}` : `${fmt(now)} + ${fmt(change)}`;
    const steps: ProblemStep[] = [b.tag(undefined, 'Ψάχνουμε κάτι που έγινε πριν. Τι ξέρουμε για το τέλος;')];
    const style = r.int(0, 2);
    if (style === 0) {
      steps.push(b.choice('plan', 'Πώς το λύνουμε;', 'Ξεκινάμε από το τέλος και γυρίζουμε πίσω',
        ['Προσθέτουμε όλους τους αριθμούς', 'Κάνουμε ό,τι λέει η ιστορία, με την ίδια σειρά'],
        'Την αρχή δεν την ξέρουμε. Ξέρουμε όμως το τέλος.'));
    } else if (style === 1) {
      steps.push(b.order('plan', 'Βάζουμε σε σειρά το σχέδιό μας.', [
        `Ξεκινάμε από ${t.g === 'n' ? 'όσα' : t.g === 'f' ? 'όσες' : 'όσους'} έχει τώρα: ${count(now, t, true)}`,
        lost ? `Γυρίζουμε πίσω: προσθέτουμε ${count(change, t, true)} που έφυγαν` : `Γυρίζουμε πίσω: αφαιρούμε ${count(change, t, true)} που ήρθαν`,
        `Βρίσκουμε ${howMany(t)} ${t.manyAcc} είχε στην αρχή`,
      ], 'Δουλεύουμε αντίστροφα: από το τέλος προς την αρχή.'));
    }
    steps.push(b.choice('plan', 'Ποια πράξη μας βοηθά;', right, [wrongOp, `Καμία, η απάντηση είναι ${count(now, t)}`],
      `Πριν από αυτό που έγινε, είχε ${lost ? 'περισσότερ' : 'λιγότερ'}${t.g === 'n' ? 'α' : t.g === 'f' ? 'ες' : 'ους'}.`));
    steps.push(b.numbers('solve', 'Λύνουμε.', [
      { label: style === 2 ? `${right} =` : 'Στην αρχή είχε', answer: start, unit: t.manyAcc },
    ]));
    steps.push(b.choice('check', 'Πώς ελέγχουμε;',
      lost ? `${fmt(start)} − ${fmt(change)} = ${fmt(now)}` : `${fmt(start)} + ${fmt(change)} = ${fmt(now)}`,
      [lost ? `${fmt(start)} + ${fmt(change)} = ${fmt(start + change)}` : `${fmt(start)} − ${fmt(change)} = ${fmt(start - change)}`,
        `${fmt(start)} + ${fmt(now)} = ${fmt(start + now)}`],
      'Ξεκινάμε από όσα βρήκαμε και κάνουμε ό,τι έγινε στην ιστορία. Πρέπει να καταλήξουμε σε όσα έχει τώρα.'));
    return { title: r.pick(['Τι είχε στην αρχή;', 'Πίσω στην αρχή', 'Από το τέλος', 'Το μυστήριο της αρχής']), story, steps };
  },
};
