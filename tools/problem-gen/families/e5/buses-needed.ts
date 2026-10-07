// An excursion: how many buses of s seats, and how many seats stay empty in the last one
// (Ε΄ κεφ. 2.12 «Η διαίρεση στους φυσικούς αριθμούς»: the remainder needs one more bus).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, extra, fmt, known, people, sought, type Family, type Rng } from '../../lib.ts';

interface Setting {
  title: string[];
  intro: (r: Rng) => string;
  /** The groups that travel; the first is the big one */
  groups: { many: string; label: string; range: [number, number] }[];
  goes: string;       // "Θα πάνε"
  noise: (r: Rng) => string;
}

const SETTINGS: Setting[] = [
  {
    title: ['Η σχολική εκδρομή', 'Εκδρομή στο Ναύπλιο'],
    intro: r => { const [p] = people(r, 1); return `Το σχολείο ${p.gen} οργανώνει εκδρομή στο Ναύπλιο.`; },
    groups: [{ many: 'μαθητές', label: 'Μαθητές', range: [90, 420] }, { many: 'εκπαιδευτικοί', label: 'Εκπαιδευτικοί', range: [5, 22] }],
    goes: 'Θα πάνε',
    noise: r => r.chance(0.5) ? `Το Ναύπλιο απέχει ${extra(`${r.int(140, 180)} χιλιόμετρα`)}.` : `Η αναχώρηση είναι ${extra(`στις ${r.int(7, 8)} το πρωί`)}.`,
  },
  {
    title: ['Οι φίλαθλοι', 'Ο τελικός του κυπέλλου'],
    intro: () => 'Ο σύλλογος φιλάθλων μιας ομάδας οργανώνει ταξίδι για τον τελικό του κυπέλλου.',
    groups: [{ many: 'φίλαθλοι', label: 'Φίλαθλοι', range: [150, 560] }],
    goes: 'Δήλωσαν συμμετοχή',
    noise: r => r.chance(0.5) ? `Το γήπεδο έχει ${extra(`${fmt(r.step(20_000, 45_000, 1000))} θέσεις`)}.` : `Ο αγώνας αρχίζει ${extra(`στις ${r.int(7, 9)} το βράδυ`)}.`,
  },
  {
    title: ['Η χορωδία ταξιδεύει', 'Το φεστιβάλ'],
    intro: () => 'Η χορωδία του δήμου πηγαίνει σε ένα φεστιβάλ στην Καλαμάτα.',
    groups: [{ many: 'τραγουδιστές', label: 'Τραγουδιστές', range: [60, 180] }, { many: 'μουσικοί', label: 'Μουσικοί', range: [8, 30] }],
    goes: 'Θα ταξιδέψουν',
    noise: r => r.chance(0.5) ? `Το φεστιβάλ κρατά ${extra(`${r.int(3, 5)} ημέρες`)}.` : `Η χορωδία έχει ήδη ${extra(`${r.int(12, 40)} βραβεία`)}.`,
  },
  {
    title: ['Η κατασκήνωση των προσκόπων', 'Οι πρόσκοποι'],
    intro: () => 'Οι πρόσκοποι της πόλης πηγαίνουν για κατασκήνωση στο βουνό.',
    groups: [{ many: 'πρόσκοποι', label: 'Πρόσκοποι', range: [90, 300] }, { many: 'αρχηγοί', label: 'Αρχηγοί', range: [8, 25] }],
    goes: 'Θα πάνε',
    noise: r => r.chance(0.5) ? `Θα στήσουν ${extra(`${r.int(20, 45)} σκηνές`)}.` : `Η κατασκήνωση θα κρατήσει ${extra(`${r.int(5, 12)} ημέρες`)}.`,
  },
  {
    title: ['Οι αγώνες στίβου', 'Ταξίδι για τους αγώνες'],
    intro: () => 'Ο αθλητικός σύλλογος της πόλης πηγαίνει στους πανελλήνιους αγώνες στίβου.',
    groups: [{ many: 'αθλητές', label: 'Αθλητές', range: [80, 260] }, { many: 'προπονητές', label: 'Προπονητές', range: [6, 20] }],
    goes: 'Θα ταξιδέψουν',
    noise: r => r.chance(0.5) ? `Οι αγώνες έχουν ${extra(`${r.int(18, 30)} αγωνίσματα`)}.` : `Το ταξίδι διαρκεί ${extra(`${r.int(4, 7)} ώρες`)}.`,
  },
  {
    title: ['Η εκδρομή του συλλόγου', 'Στα Μετέωρα'],
    intro: () => 'Ο πολιτιστικός σύλλογος του χωριού οργανώνει εκδρομή στα Μετέωρα.',
    groups: [{ many: 'ενήλικες', label: 'Ενήλικες', range: [70, 260] }, { many: 'παιδιά', label: 'Παιδιά', range: [20, 80] }],
    goes: 'Δήλωσαν συμμετοχή',
    noise: r => r.chance(0.5) ? `Ο σύλλογος έχει ${extra(`${r.int(350, 900)} μέλη`)}.` : `Θα μείνουν ${extra(`${r.int(2, 3)} νύχτες`)} σε ξενοδοχείο.`,
  },
];

export const busesNeeded: Family = {
  id: 'buses-needed',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, κεφ. 2.12 «Η διαίρεση στους φυσικούς αριθμούς»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const seats = r.pick([40, 45, 48, 50, 52, 55, 60]);
    const counts = s.groups.map(g => r.int(...g.range));
    const total = counts.reduce((x, y) => x + y, 0);
    const q = Math.floor(total / seats), rest = total % seats;
    if (rest === 0 || q < 1 || q > 10) return null;
    const need = q + 1, empty = seats - rest;
    const price = r.step(250, 600, 10);
    const ask = r.pick(['buses', 'empty', 'cost'] as const);
    // Without the small group (teachers, coaches): the typical slip
    const withoutSmall = counts.length > 1 ? Math.ceil(counts[0] / seats) : 0;

    const who = s.groups.map((g, i) => known(`${fmt(counts[i])} ${g.many}`));
    const travel = `${s.goes} ${who.length > 1 ? `${who[0]} και ${who[1]}` : who[0]}.`;
    const bus = `Κάθε λεωφορείο έχει ${known(`${seats} θέσεις`)} για επιβάτες.`;
    const costLine = ask === 'cost'
      ? ` Το καθένα κοστίζει ${known(`${fmt(price)} €`)}.`
      : r.chance(0.3) ? ` Το καθένα κοστίζει ${extra(`${fmt(price)} €`)}.` : '';
    const noise = costLine && ask !== 'cost' && r.chance(0.5) ? '' : ` ${s.noise(r)}`;
    const question = ask === 'buses'
      ? sought('Πόσα λεωφορεία χρειάζονται, για να πάνε όλοι')
      : ask === 'empty'
        ? `${sought('Πόσα λεωφορεία χρειάζονται')} και, ${known('αν γεμίσουν πρώτα τα άλλα')}, ${sought('πόσες θέσεις θα μείνουν άδειες στο τελευταίο')}`
        : sought('Πόσα € θα πληρώσουν για τα λεωφορεία');
    const order = r.chance(0.5);
    const story = order
      ? `${s.intro(r)} ${travel}${noise} ${bus}${costLine} ${question};`
      : `${s.intro(r)} ${bus.replace('Κάθε λεωφορείο', 'Κάθε λεωφορείο που θα νοικιάσουν')}${costLine} ${travel}${noise} ${question};`;

    const steps: ProblemStep[] = [
      b.tag(undefined, counts.length > 1 ? `Στο λεωφορείο κάθονται και ${s.groups[1].many === 'παιδιά' ? 'τα' : 'οι'} ${s.groups[1].many}.` : 'Τι αλλάζει τον αριθμό των λεωφορείων;'),
    ];
    if (r.chance(0.6)) {
      steps.push(b.choice('plan', 'Η διαίρεση θα αφήσει υπόλοιπο. Τι κάνουμε με αυτό;', "Παίρνουμε ένα λεωφορείο ακόμα γι' αυτούς",
        ['Το αφήνουμε: είναι λίγοι και δεν μετράνε', 'Πηγαίνουν όρθιοι στα άλλα λεωφορεία', 'Προσθέτουμε το υπόλοιπο στα λεωφορεία'],
        'Πρέπει να πάνε όλοι, και καθένας θέλει μια θέση.'));
    }
    const showOps = r.chance(0.5);
    const rows: { label: string; answer: number; unit?: string }[] = [];
    if (counts.length > 1) rows.push({ label: showOps ? `Επιβάτες: ${fmt(counts[0])} + ${fmt(counts[1])} =` : 'Επιβάτες όλοι μαζί', answer: total });
    rows.push({ label: showOps ? `Γεμάτα λεωφορεία (${fmt(total)} : ${seats}, το πηλίκο)` : 'Γεμάτα λεωφορεία', answer: q });
    rows.push({ label: 'Επιβάτες που περισσεύουν', answer: rest });
    rows.push({ label: 'Λεωφορεία που χρειάζονται', answer: need });
    if (ask === 'empty') rows.push({ label: showOps ? `Άδειες θέσεις στο τελευταίο: ${seats} − ${rest} =` : 'Άδειες θέσεις στο τελευταίο', answer: empty });
    if (ask === 'cost') rows.push({ label: showOps ? `Κόστος: ${need} × ${fmt(price)} =` : 'Κόστος', answer: need * price, unit: '€' });
    const hint = `${counts.length > 1 ? `${fmt(counts[0])} + ${fmt(counts[1])} = ${fmt(total)}. ` : ''}${seats} × ${q} = ${fmt(seats * q)}, άρα ${rest === 1 ? 'περισσεύει 1' : `περισσεύουν ${rest}`}.`;
    if (rows.length > 4 && r.chance(0.5)) {
      // Split into two steps: the division, then the answer
      const cut = rows.findIndex(x => x.label === 'Λεωφορεία που χρειάζονται');
      steps.push(b.numbers('solve', 'Λύνουμε: πρώτα η διαίρεση.', rows.slice(0, cut), hint));
      steps.push(b.numbers('solve', 'Και τώρα η απάντηση.', rows.slice(cut), rest === 1 ? 'Κι αυτός που περισσεύει θέλει θέση σε λεωφορείο.' : `Οι ${rest} που περισσεύουν θέλουν κι αυτοί λεωφορείο.`));
    } else {
      steps.push(b.numbers('solve', 'Λύνουμε.', rows, hint));
    }

    if (steps.length < 5 && r.chance(0.5)) {
      const wrong = [`${fmt(total)} : ${seats} = ${q}, άρα ${q} λεωφορεία`, `Ναι: ${need} + ${seats} = ${fmt(need + seats)} θέσεις`];
      if (withoutSmall && withoutSmall !== need) wrong.push(`Οι ${fmt(counts[0])} χωράνε σε ${withoutSmall} λεωφορεία`);
      steps.push(b.choice('check', 'Αναστοχαζόμαστε: φτάνουν τα λεωφορεία;',
        `Ναι: ${need} × ${seats} = ${fmt(need * seats)} θέσεις`, wrong,
        'Πόσες θέσεις έχουν όλα τα λεωφορεία μαζί;'));
    } else if (steps.length < 5) {
      steps.push(b.numbers('check', 'Αναστοχαζόμαστε: βγαίνουν πάλι όλοι οι επιβάτες;', [{ label: `${seats} × ${q} + ${rest} =`, answer: total }],
        'Δ = δ × π + υ'));
    }
    return { title: r.pick(s.title), story: cap(story), steps };
  },
};
