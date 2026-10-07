// A car, train or ship covers k km every hour for h hours: the distance; what is left of a
// route; the hours a route needs (Ε΄ κεφ. 2.9 και 2.12: πολλαπλασιασμός και διαίρεση).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, extra, fmt, known, people, sought, type Family, type Person, type Rng } from '../../lib.ts';

interface Setting {
  title: string[];
  /** "Η οικογένεια της Άννας ταξιδεύει με το αυτοκίνητο ως το χωριό του παππού." */
  intro: (p: Person) => string;
  /** The subject of "διανύει": "Το αυτοκίνητο" */
  it: string;
  /** Verbs for the subject: "διανύει", "διάνυσε", "θα έχει διανύσει", "θα φτάσει", "συνεχίσει" */
  v: [string, string, string, string, string];
  legs: boolean;
  /** The longest route that makes sense */
  max: number;
  km: [number, number, number];
  hours: [number, number];
  noise: (r: Rng) => string;
}

const SG: Setting['v'] = ['διανύει', 'διάνυσε', 'θα έχει διανύσει', 'θα φτάσει', 'συνεχίσει'];
const PL: Setting['v'] = ['διανύουν', 'διάνυσαν', 'θα έχουν διανύσει', 'θα φτάσουν', 'συνεχίσουν'];

const SETTINGS: Setting[] = [
  {
    title: ['Ταξίδι με το αυτοκίνητο', 'Στον δρόμο για το χωριό'],
    intro: p => `Η οικογένεια ${p.gen} ταξιδεύει με το αυτοκίνητο ως το χωριό του παππού.`,
    it: 'Το αυτοκίνητο', max: 600, v: SG, legs: true, km: [70, 110, 5], hours: [2, 6],
    noise: r => r.chance(0.5) ? `Ξεκίνησαν ${extra(`στις ${r.int(6, 10)} το πρωί`)}.` : `Μέσα ταξιδεύουν ${extra(`${r.int(3, 5)} άτομα`)}.`,
  },
  {
    title: ['Το τρένο', 'Ταξίδι με το τρένο'],
    intro: p => `${p.Nom} ταξιδεύει με το τρένο για να δει τη θεία ${p.his}.`,
    it: 'Το τρένο', max: 600, v: SG, legs: false, km: [80, 160, 10], hours: [2, 5],
    noise: r => r.chance(0.5) ? `Έχει ${extra(`${r.int(4, 9)} βαγόνια`)}.` : `Το εισιτήριο κόστισε ${extra(`${r.int(18, 45)} €`)}.`,
  },
  {
    title: ['Η ποδηλατάδα', 'Με το ποδήλατο'],
    intro: p => `${p.Nom} και ο πατέρας ${p.his} πηγαίνουν με τα ποδήλατά τους ως τη λίμνη.`,
    it: 'Οι δύο ποδηλάτες', max: 70, v: PL, legs: true, km: [12, 18, 1], hours: [2, 4],
    noise: r => r.chance(0.5) ? `Πήραν μαζί τους ${extra(`${r.int(2, 4)} μπουκάλια νερό`)}.` : `Τα ποδήλατα έχουν ${extra(`${r.int(18, 24)} ταχύτητες`)}.`,
  },
  {
    title: ['Το πλοίο', 'Ταξίδι με το πλοίο'],
    intro: () => 'Ένα πλοίο ταξιδεύει από τον Πειραιά ως ένα νησί του Αιγαίου.',
    it: 'Το πλοίο', max: 350, v: SG, legs: false, km: [25, 40, 1], hours: [3, 9],
    noise: r => r.chance(0.5) ? `Έχει ${extra(`${fmt(r.step(800, 2200, 100))} επιβάτες`)}.` : `Αναχώρησε ${extra(`στις ${r.int(7, 9)} το πρωί`)}.`,
  },
  {
    title: ['Το φορτηγό', 'Η παράδοση των φρούτων'],
    intro: () => 'Ένα φορτηγό μεταφέρει φρούτα από τον κάμπο σε μια μεγάλη αγορά.',
    it: 'Το φορτηγό', max: 600, v: SG, legs: true, km: [55, 85, 5], hours: [2, 7],
    noise: r => r.chance(0.5) ? `Κουβαλά ${extra(`${r.int(80, 300)} τελάρα`)}.` : `Ο οδηγός κάνει αυτή τη δουλειά ${extra(`${r.int(5, 25)} χρόνια`)}.`,
  },
  {
    title: ['Η πτήση', 'Με το αεροπλάνο'],
    intro: () => 'Ένα αεροπλάνο πετά από την Αθήνα σε μια μακρινή πόλη.',
    it: 'Το αεροπλάνο', max: 5000, v: SG, legs: false, km: [700, 900, 10], hours: [2, 5],
    noise: r => r.chance(0.5) ? `Έχει ${extra(`${r.int(150, 300)} θέσεις`)}.` : `Πετά σε ύψος ${extra(`${fmt(r.step(9000, 12000, 500))} μέτρων`)}.`,
  },
];

export const distanceTime: Family = {
  id: 'distance-time',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, κεφ. 2.9 «Ο πολλαπλασιασμός» και 2.12 «Η διαίρεση στους φυσικούς αριθμούς»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const [p] = people(r, 1);
    const k = r.step(s.km[0], s.km[1], s.km[2]);
    const h = r.int(...s.hours);
    const ask = r.pick(['far', 'left', 'hours', 'legs'] as const);
    const rate = known(`${fmt(k)} χιλιόμετρα κάθε ώρα`);
    const done = k * h;
    // The route: a whole number of hours more, for "left" (so the hours left are exact too)
    const more = r.int(1, 4);
    const R = ask === 'left' ? done + k * more : done;
    // Two legs: a slower road after the first one
    const k2 = Math.max(s.km[0] - 20, Math.round(k * 0.6 / 5) * 5 || 5), h2 = r.int(1, 2);
    if (ask === 'legs' && (k2 >= k || !s.legs)) return null;
    if (R > s.max || done + k2 * h2 > s.max) return null;

    let text: string;
    const asksHoursLeft = ask === 'left' && r.chance(0.5);
    if (ask === 'far') {
      text = `${s.it} ${s.v[0]} ${rate}. ${s.noise(r)} ${sought(`Πόσα χιλιόμετρα ${s.v[2]}`)} ${known(`σε ${h} ώρες`)};`;
    } else if (ask === 'left') {
      text = `Όλη η διαδρομή είναι ${known(`${fmt(R)} χιλιόμετρα`)}. ${s.it} ${s.v[0]} ${rate}. ${s.noise(r)} `
        + `${known(`Έχουν περάσει ${h} ώρες από την αναχώρηση`)}. ${sought(`Πόσα χιλιόμετρα μένουν ακόμα`)}${asksHoursLeft ? ` και ${sought(`σε πόσες ώρες ${s.v[3]}, αν ${s.v[4]} έτσι`)}` : ''};`;
    } else if (ask === 'hours') {
      text = `Όλη η διαδρομή είναι ${known(`${fmt(done)} χιλιόμετρα`)}. ${s.it} ${s.v[0]} ${rate}. ${s.noise(r)} ${sought(`Σε πόσες ώρες ${s.v[3]}`)};`;
    } else {
      text = `${s.it} ${s.v[0]} πρώτα ${rate} ${known(`για ${h} ώρες`)} και μετά, σε πιο δύσκολο δρόμο, ${known(`${fmt(k2)} χιλιόμετρα κάθε ώρα`)} ${known(`για ${h2 === 1 ? '1 ώρα' : `${h2} ώρες`}`)}. `
        + `${s.noise(r)} ${sought(`Πόσα χιλιόμετρα ${s.v[1]} συνολικά`)};`;
    }
    const story = `${s.intro(p)} ${text}`;

    const steps: ProblemStep[] = [b.tag(undefined, 'Ό,τι δεν αλλάζει τα χιλιόμετρα ή τις ώρες δεν χρειάζεται.')];
    const ops = r.chance(0.5);
    if (ask === 'far') {
      if (r.chance(0.6)) {
        steps.push(b.choice('plan', 'Ποια πράξη κάνουμε;', `${fmt(k)} × ${h}`,
          [`${fmt(k)} + ${h}`, `${fmt(k)} : ${h}`], `Κάθε ώρα προστίθενται ${fmt(k)} χιλιόμετρα.`));
      }
      steps.push(b.numbers('solve', 'Λύνουμε.', [{ label: ops ? `${fmt(k)} × ${h} =` : `Σε ${h} ώρες`, answer: done, unit: 'χιλιόμετρα' }],
        `${fmt(k)} + ${fmt(k)} + … ${h} φορές.`));
      steps.push(b.numbers('check', 'Αναστοχαζόμαστε: εργαζόμαστε αντίστροφα.', [{ label: `${fmt(done)} : ${h} =`, answer: k }],
        'Αν μοιράσουμε τα χιλιόμετρα στις ώρες, πρέπει να βρούμε πόσα διανύει κάθε ώρα.'));
    } else if (ask === 'left') {
      if (r.chance(0.6)) {
        steps.push(b.order('plan', 'Βάζουμε σε σειρά το σχέδιό μας.', [
          `Βρίσκω πόσα χιλιόμετρα ${s.v[1]} σε ${h} ώρες`,
          'Τα αφαιρώ από όλη τη διαδρομή',
          ...(asksHoursLeft ? [`Διαιρώ ό,τι μένει με το ${fmt(k)}`] : []),
          'Απαντώ με τη μονάδα μέτρησης',
        ], 'Πρώτα όσα έγιναν, μετά όσα μένουν.'));
      }
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        { label: ops ? `${cap(s.v[1])}: ${fmt(k)} × ${h} =` : `Ως τώρα ${s.v[1]}`, answer: done, unit: 'χιλιόμετρα' },
        { label: ops ? `Μένουν: ${fmt(R)} − ${fmt(done)} =` : 'Μένουν', answer: R - done, unit: 'χιλιόμετρα' },
        ...(asksHoursLeft ? [{ label: ops ? `Ώρες ακόμα: ${fmt(R - done)} : ${fmt(k)} =` : 'Ώρες ακόμα', answer: more, unit: 'ώρες' }] : []),
      ], `${fmt(k)} × ${h} = ${fmt(done)}.`));
      steps.push(b.choice('check', 'Αναστοχαζόμαστε: πώς ελέγχουμε;', `${fmt(done)} + ${fmt(R - done)} = ${fmt(R)}`,
        [`${fmt(R)} + ${fmt(done)} = ${fmt(R + done)}`, `${fmt(R)} − ${fmt(k)} = ${fmt(R - k)}`],
        'Τα δύο κομμάτια μαζί πρέπει να κάνουν όλη τη διαδρομή.'));
    } else if (ask === 'hours') {
      if (r.chance(0.6)) {
        steps.push(b.choice('plan', 'Ποια πράξη κάνουμε;', `${fmt(done)} : ${fmt(k)}`,
          [`${fmt(done)} × ${fmt(k)}`, `${fmt(done)} − ${fmt(k)}`], 'Κάθε ώρα «τρώει» ένα κομμάτι της διαδρομής.'));
      }
      steps.push(b.numbers('solve', 'Λύνουμε.', [{ label: ops ? `${fmt(done)} : ${fmt(k)} =` : 'Θα φτάσει σε', answer: h, unit: 'ώρες' }],
        `${fmt(k)} × 2 = ${fmt(k * 2)}, ${fmt(k)} × 3 = ${fmt(k * 3)}, …`));
      steps.push(b.numbers('check', 'Αναστοχαζόμαστε: σε τόσες ώρες φτάνει;', [{ label: `${fmt(k)} × ${h} =`, answer: done, unit: 'χιλιόμετρα' }]));
    } else {
      steps.push(b.numbers('solve', 'Λύνουμε κάθε κομμάτι χωριστά.', [
        { label: ops ? `Πρώτο κομμάτι: ${fmt(k)} × ${h} =` : 'Πρώτο κομμάτι', answer: done, unit: 'χιλιόμετρα' },
        { label: ops ? `Δεύτερο κομμάτι: ${fmt(k2)} × ${h2} =` : 'Δεύτερο κομμάτι', answer: k2 * h2, unit: 'χιλιόμετρα' },
        { label: ops ? `Συνολικά: ${fmt(done)} + ${fmt(k2 * h2)} =` : 'Συνολικά', answer: done + k2 * h2, unit: 'χιλιόμετρα' },
      ], `${fmt(k)} × ${h} = ${fmt(done)}.`));
      const wrongSame = k * (h + h2);
      steps.push(b.choice('check', `Κάποιος έγραψε ${fmt(k)} × ${h + h2} = ${fmt(wrongSame)}. Τι λάθος έκανε;`,
        `Στο δεύτερο κομμάτι: ${fmt(k2)}, όχι ${fmt(k)}`,
        ['Κανένα: έτσι βρίσκουμε το σύνολο', `Έπρεπε να προσθέσει ${fmt(k)} + ${fmt(k2)} = ${fmt(k + k2)}`],
        'Οι δύο δρόμοι δεν είναι ίδιοι.'));
    }
    return { title: r.pick(s.title), story, steps };
  },
};
