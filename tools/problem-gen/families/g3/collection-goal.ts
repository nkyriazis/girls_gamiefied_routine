// Two classes collect for recycling or for a good cause: a 3-digit sum with regrouping,
// then how many are still missing to reach the goal (Γ΄ κεφ. 15 «Προσθέσεις και αφαιρέσεις
// τριψήφιων αριθμών» και κεφ. 14 «Αριθμοί μέχρι το 3.000»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { extra, fmt, known, sought, type Family } from '../../lib.ts';

interface Thing {
  what: string; // "πλαστικά μπουκάλια"
  short: string; // "μπουκάλια"
  g: 'n' | 'f';
  per: [number, number]; // what one class collects
  why: string;
  bag: string; // extra: "Κάθε σακούλα χωράει"
  bagN: [number, number];
}

const THINGS: Thing[] = [
  { what: 'πλαστικά μπουκάλια', short: 'μπουκάλια', g: 'n', per: [180, 880], why: 'για την ανακύκλωση', bag: 'Κάθε σακούλα χωράει', bagN: [20, 40] },
  { what: 'αλουμινένια κουτάκια', short: 'κουτάκια', g: 'n', per: [150, 760], why: 'για την ανακύκλωση', bag: 'Κάθε σακούλα χωράει', bagN: [30, 60] },
  { what: 'πλαστικά καπάκια', short: 'καπάκια', g: 'n', per: [320, 1400], why: 'για να αγοραστεί ένα αναπηρικό αμαξίδιο', bag: 'Κάθε σακούλα χωράει', bagN: [200, 400] },
  { what: 'βιβλία', short: 'βιβλία', g: 'n', per: [110, 380], why: 'για τη βιβλιοθήκη του νοσοκομείου παίδων', bag: 'Κάθε κούτα χωράει', bagN: [20, 40] },
  { what: 'κονσέρβες τροφίμων', short: 'κονσέρβες', g: 'f', per: [120, 340], why: 'για το κοινωνικό παντοπωλείο του δήμου', bag: 'Κάθε κούτα χωράει', bagN: [20, 30] },
  { what: 'μπαταρίες', short: 'μπαταρίες', g: 'f', per: [130, 460], why: 'για την ανακύκλωση', bag: 'Κάθε κουτί συλλογής χωράει', bagN: [100, 200] },
];

const CLASSES = ['Β΄', 'Γ΄', 'Δ΄', 'Ε΄', 'ΣΤ΄'];
// "η Γ΄ τάξη"; the article before a letter follows its name (άλφα, βήτα, γάμμα...)
const cls = (c: string) => `η ${c} τάξη`;
const tin = (c: string) => `${c === 'Ε΄' ? 'την' : 'τη'} ${c}`; // "από τη Γ΄", "από την Ε΄"

export const collectionGoal: Family = {
  id: 'collection-goal',
  grade: 3,
  unit: 3,
  source: 'Μαθηματικά Γ΄, κεφ. 15 «Προσθέσεις και αφαιρέσεις τριψήφιων αριθμών» και κεφ. 14 «Αριθμοί μέχρι το 3.000»',
  make(r, b) {
    const t = r.pick(THINGS);
    const [c1, c2] = r.sample(CLASSES, 2);
    const more = r.chance(0.3); // "the second class collected d more"
    const a = r.int(...t.per);
    const d = more ? r.int(15, 190) : 0;
    const bb = more ? a + d : r.int(...t.per);
    const sum = a + bb;
    const goal = Math.ceil((sum + 1) / 100) * 100 + r.step(100, 700, 100);
    if (goal > 3000) return null;
    const missing = goal - sum;
    // At least one regrouping in the sum
    if ((a % 10) + (bb % 10) < 10 && (a % 100) + (bb % 100) < 100) return null;

    const P = t.g === 'n' ? { Many: 'Πόσα', more: 'περισσότερα', the: 'τα' } : { Many: 'Πόσες', more: 'περισσότερες', the: 'οι' };
    const noise = r.pick([
      `Στο σχολείο υπάρχουν ${extra(`${r.int(3, 8)} κάδοι`)} για τη συλλογή.`,
      `Η ${c1} τάξη έχει ${extra(`${r.int(18, 25)} μαθητές`)}.`,
      `Η συλλογή κράτησε ${extra(`${r.int(3, 6)} εβδομάδες`)}.`,
      `${t.bag} ${extra(`${r.step(...t.bagN, 10)} ${t.short}`)}.`,
    ]);
    const first = `${cap(cls(c1))} μάζεψε ${known(`${fmt(a)} ${t.what}`)}`;
    const second = more
      ? `${cap(cls(c2))} μάζεψε ${known(`${d} ${t.short} ${P.more}`)} από ${tin(c1)}.`
      : `${cap(cls(c2))} μάζεψε ${known(`${fmt(bb)} ${t.short}`)}.`;
    const goalText = known(`${fmt(goal)} ${t.short}`);
    const ask = sought(`${P.Many} ${t.short} λείπουν ακόμη για τον στόχο`);
    const story = r.pick([
      () => `${first} ${t.why}. ${second} ${noise} Ο στόχος του σχολείου είναι ${goalText}. ${ask};`,
      () => `Το σχολείο θέλει να μαζέψει ${known(`${fmt(goal)} ${t.what}`)} ${t.why}. ${cap(cls(c1))} μάζεψε ${known(`${fmt(a)} ${t.short}`)}. ${second} ${noise} ${ask};`,
      () => `Οι μαθητές του σχολείου μαζεύουν ${t.what} ${t.why}. Θέλουν να φτάσουν ${known(`${t.g === 'n' ? 'τα' : 'τις'} ${fmt(goal)} ${t.short}`)}. ${cap(cls(c1))} μάζεψε ${known(`${fmt(a)} ${t.short}`)}. ${second} ${noise} ${ask};`,
    ])();

    const steps: ProblemStep[] = [b.tag(undefined, 'Χρειαζόμαστε όσα μάζεψε κάθε τάξη και τον στόχο.')];
    if (more) {
      steps.push(b.choice('plan', 'Τι βρίσκουμε πρώτα;', `${P.Many} ${t.short} μάζεψε η ${c2} τάξη`,
        [`${P.Many} ${t.short} λείπουν για τον στόχο`, `${P.Many} ${t.short} μάζεψαν μαζί`],
        `Για να βρούμε όσα μάζεψαν μαζί, πρέπει να ξέρουμε πόσα μάζεψε κάθε τάξη.`));
    } else if (r.chance(0.4)) {
      steps.push(b.choice('plan', 'Ποιες πράξεις μας βοηθούν;', 'Πρώτα πρόσθεση, μετά αφαίρεση',
        ['Μόνο πρόσθεση', 'Πρώτα αφαίρεση, μετά πρόσθεση', 'Μόνο αφαίρεση'].slice(0, r.int(2, 3)),
        'Βρίσκουμε όσα μάζεψαν μαζί και μετά πόσα απέχουν από τον στόχο.'));
    }
    const ops = r.chance(0.6);
    steps.push(b.numbers('solve', 'Λύνουμε.', [
      ...(more ? [{ label: ops ? `${fmt(a)} + ${d} =` : `Μάζεψε η ${c2}`, answer: bb, unit: t.short }] : []),
      { label: ops ? `${fmt(a)} + ${fmt(bb)} =` : 'Μάζεψαν μαζί', answer: sum, unit: t.short },
      { label: ops ? `${fmt(goal)} − ${fmt(sum)} =` : 'Λείπουν ακόμη', answer: missing, unit: t.short },
    ], 'Στην πρόσθεση και στην αφαίρεση προσέχουμε τα κρατούμενα.'));
    steps.push(r.chance(0.5)
      ? b.choice('check', 'Πώς ελέγχουμε;', `${fmt(sum)} + ${fmt(missing)} = ${fmt(goal)}`,
        [`${fmt(goal)} + ${fmt(sum)} = ${fmt(goal + sum)}`, `${fmt(goal)} − ${fmt(a)} = ${fmt(goal - a)}`],
        'Όσα μάζεψαν μαζί με όσα λείπουν πρέπει να κάνουν τον στόχο.')
      : b.choice('check', 'Είναι λογική η απάντηση;', 2 * sum > goal
          ? 'Ναι, λείπουν κάτω από τα μισά'
          : 'Ναι, λείπουν πάνω από τα μισά',
        [`Όχι, πρέπει να λείπουν ${fmt(goal - a)} ${t.short}`, `Όχι, πρέπει να λείπουν ${fmt(goal + sum)} ${t.short}`],
        `Τα μισά του στόχου είναι ${fmt(goal / 2)}. Μάζεψαν ${fmt(sum)}.`));
    return { title: r.pick(['Ο στόχος', 'Μαζεύουμε όλοι', 'Η συλλογή', t.why === 'για την ανακύκλωση' ? 'Ανακύκλωση' : 'Για καλό σκοπό']), story, steps };
  },
};

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
