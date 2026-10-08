// Estimate first, then compute: round to the nearest ten or hundred, add or subtract,
// then do the exact 3-digit operation and compare it with the estimate
// (Γ΄ κεφ. 20 «Επαναληπτικό μάθημα»: «Πόσο είναι περίπου το αποτέλεσμα της πράξης; Δώσε
// μια πρόχειρη, γρήγορη απάντηση και μετά υπολόγισε κανονικά», και κεφ. 15).
import type { ProblemStep } from '../../../../shared/types.ts';
import { extra, fmt, known, PEOPLE, sought, type Family, type Rng } from '../../lib.ts';

interface Setting {
  op: '+' | '−';
  title: string;
  a: [number, number];
  b: [number, number];
  story: (a: string, b: string, noise: string) => string;
  noise: (r: Rng) => string;
  unit: string; // for the answer rows
}

const SETTINGS: Setting[] = [
  {
    op: '+', title: 'Η γιορτή του σχολείου', a: [180, 480], b: [150, 450], unit: 'θεατές',
    story: (a, b, n) => `Στη γιορτή του σχολείου ήρθαν ${known(`${a} θεατές`)} το Σάββατο και ${known(`${b} θεατές`)} την Κυριακή. ${n} ${sought('Πόσοι θεατές ήρθαν και τις δύο μέρες')};`,
    noise: r => r.pick([`Η γιορτή κράτησε ${extra(`${r.int(2, 3)} ώρες`)}.`, `Στη σκηνή ανέβηκαν ${extra(`${r.int(40, 90)} μαθητές`)}.`, `Το εισιτήριο κόστιζε ${extra(`${r.int(2, 5)} ευρώ`)}.`]),
  },
  {
    op: '+', title: 'Η βιβλιοθήκη', a: [140, 560], b: [120, 480], unit: 'βιβλία',
    story: (a, b, n) => `Η δημοτική βιβλιοθήκη δάνεισε ${known(`${a} βιβλία`)} τον Οκτώβριο και ${known(`${b} βιβλία`)} τον Νοέμβριο. ${n} ${sought('Πόσα βιβλία δάνεισε τους δύο μήνες')};`,
    noise: r => r.pick([`Είναι ανοιχτή ${extra(`${r.int(5, 6)} μέρες`)} την εβδομάδα.`, `Στα ράφια της έχει ${extra(`${fmt(r.step(4000, 9000, 500))} βιβλία`)}.`, `Εκεί δουλεύουν ${extra(`${r.int(3, 6)} βιβλιοθηκάριοι`)}.`]),
  },
  {
    op: '+', title: 'Τα πορτοκάλια', a: [210, 690], b: [160, 580], unit: 'κιλά',
    story: (a, b, n) => `Ένας αγρότης μάζεψε ${known(`${a} κιλά`)} πορτοκάλια την πρώτη μέρα και ${known(`${b} κιλά`)} τη δεύτερη. ${n} ${sought('Πόσα κιλά μάζεψε τις δύο μέρες')};`,
    noise: r => r.pick([`Στο χωράφι του έχει ${extra(`${r.int(40, 90)} πορτοκαλιές`)}.`, `Τον βοήθησαν ${extra(`${r.int(3, 6)} εργάτες`)}.`, `Κάθε τελάρο χωράει ${extra(`${r.int(15, 25)} κιλά`)}.`]),
  },
  {
    op: '+', title: 'Ο φούρνος', a: [130, 460], b: [110, 390], unit: 'κουλούρια',
    story: (a, b, n) => `Ένας φούρνος έψησε ${known(`${a} κουλούρια`)} το πρωί και ${known(`${b} κουλούρια`)} το απόγευμα. ${n} ${sought('Πόσα κουλούρια έψησε όλη τη μέρα')};`,
    noise: r => r.pick([`Ο φούρνος ανοίγει στις ${extra(`${r.int(5, 7)} το πρωί`)}.`, `Κάθε κουλούρι κοστίζει ${extra(`${r.step(50, 90, 10)} λεπτά`)}.`, `Στον φούρνο δουλεύουν ${extra(`${r.int(3, 6)} αρτοποιοί`)}.`]),
  },
  {
    op: '+', title: 'Το τρένο', a: [120, 390], b: [25, 180], unit: 'επιβάτες',
    story: (a, b, n) => `Ένα τρένο ξεκίνησε από τη Φλώρινα με ${known(`${a} επιβάτες`)}. Στο Αμύνταιο ανέβηκαν ${known(`${b} επιβάτες`)} ακόμη και δεν κατέβηκε κανείς. ${n} ${sought('Πόσοι επιβάτες είναι τώρα στο τρένο')};`,
    noise: r => r.pick([`Το τρένο έχει ${extra(`${r.int(4, 8)} βαγόνια`)}.`, `Η διαδρομή κράτησε ${extra(`${r.int(20, 40)} λεπτά`)}.`, `Ξεκίνησε στις ${extra(`${r.int(7, 9)} το πρωί`)}.`]),
  },
  {
    op: '−', title: 'Το θέατρο', a: [420, 900], b: [150, 400], unit: 'θέσεις',
    story: (a, b, n) => `Ένα θέατρο έχει ${known(`${a} θέσεις`)}. Για την αποψινή παράσταση έχουν πουληθεί ${known(`${b} εισιτήρια`)}. ${n} ${sought('Πόσες θέσεις είναι ακόμη ελεύθερες')};`,
    noise: r => r.pick([`Η παράσταση αρχίζει στις ${extra(`${r.int(8, 9)} το βράδυ`)}.`, `Το εισιτήριο κοστίζει ${extra(`${r.int(10, 20)} ευρώ`)}.`, `Στο έργο παίζουν ${extra(`${r.int(5, 12)} ηθοποιοί`)}.`]),
  },
  {
    op: '−', title: 'Το φυτώριο', a: [350, 900], b: [120, 340], unit: 'γλάστρες',
    story: (a, b, n) => `Ένα φυτώριο είχε ${known(`${a} γλάστρες`)} με λουλούδια. Την άνοιξη πούλησε ${known(`${b} γλάστρες`)}. ${n} ${sought('Πόσες γλάστρες έμειναν')};`,
    noise: r => r.pick([`Έχει ${extra(`${r.int(2, 5)} θερμοκήπια`)}.`, `Κάθε γλάστρα κοστίζει ${extra(`${r.int(3, 8)} ευρώ`)}.`, `Εκεί δουλεύουν ${extra(`${r.int(3, 7)} κηπουροί`)}.`]),
  },
  {
    op: '−', title: 'Το ταξίδι', a: [0, 0], b: [0, 0], unit: 'χιλιόμετρα',
    story: (a, b, n) => `${a} ${n} ${b}`, // built in make(): the distance is a real one
    noise: r => r.pick([`Στο αυτοκίνητο είναι ${extra(`${r.int(3, 5)} άτομα`)}.`, `Ξεκίνησαν στις ${extra(`${r.int(7, 9)} το πρωί`)}.`, `Σταμάτησαν για φαγητό ${extra(`${r.int(30, 50)} λεπτά`)}.`]),
  },
];

// Real road distances, rounded
const TRIPS = [
  { from: 'την Αθήνα', to: 'τη Θεσσαλονίκη', km: 502 },
  { from: 'την Αθήνα', to: 'τα Ιωάννινα', km: 446 },
  { from: 'τη Θεσσαλονίκη', to: 'την Αλεξανδρούπολη', km: 346 },
  { from: 'την Αθήνα', to: 'την Καλαμάτα', km: 238 },
  { from: 'την Πάτρα', to: 'τη Θεσσαλονίκη', km: 468 },
  { from: 'την Αθήνα', to: 'τη Λάρισα', km: 354 },
];

const round = (n: number, to: number) => Math.round(n / to) * to;
// No halfway numbers: 350 or 45 could go either way for a child
const halfway = (n: number, to: number) => n % to === to / 2;

// The sum a child gets by forgetting to carry, or the difference by taking the smaller
// digit from the bigger one in each place
function slip(a: number, b: number, op: '+' | '−'): number {
  let out = 0;
  for (let place = 1; place <= Math.max(a, b); place *= 10) {
    const x = Math.floor(a / place) % 10, y = Math.floor(b / place) % 10;
    out += (op === '+' ? (x + y) % 10 : Math.abs(x - y)) * place;
  }
  return out;
}

export const estimateFirst: Family = {
  id: 'estimate-first',
  grade: 3,
  chapter: '15',
  topic: 'Πρόσθεση',
  source: 'Μαθηματικά Γ΄, κεφ. 20 «Επαναληπτικό μάθημα» (Πόσο είναι περίπου το αποτέλεσμα;) και κεφ. 15 «Προσθέσεις και αφαιρέσεις τριψήφιων αριθμών»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    let a: number, c: number, story: string;
    if (s.title === 'Το ταξίδι') {
      const trip = r.pick(TRIPS);
      a = trip.km;
      c = r.int(90, a - 60);
      const kid = r.pick(PEOPLE);
      story = `Από ${trip.from} μέχρι ${trip.to} είναι ${known(`${a} χιλιόμετρα`)}. ${kid.Nom} ταξιδεύει με τους γονείς ${kid.his} με το αυτοκίνητο. `
        + `Ως τη στάση για φαγητό έχουν κάνει ${known(`${c} χιλιόμετρα`)}. ${s.noise(r)} ${sought('Πόσα χιλιόμετρα τους μένουν ακόμη')};`;
    } else {
      a = r.int(...s.a);
      c = r.int(...s.b);
      story = s.story(fmt(a), fmt(c), s.noise(r));
    }
    const to = c < 100 || r.chance(0.35) ? 10 : 100;
    if (halfway(a, to) || halfway(c, to) || a % to === 0 || c % to === 0) return null;
    const ra = round(a, to), rc = round(c, to);
    if (rc === 0) return null;
    const exact = s.op === '+' ? a + c : a - c;
    const est = s.op === '+' ? ra + rc : ra - rc;
    if (exact === est || est <= 0) return null;
    // Some regrouping, or the exact sum is too easy to need an estimate
    const carries = s.op === '+' ? (a % 10) + (c % 10) >= 10 || (a % 100) + (c % 100) >= 100 : a % 10 < c % 10 || a % 100 < c % 100;
    if (!carries) return null;

    const place = to === 100 ? 'εκατοντάδα' : 'δεκάδα';
    const steps: ProblemStep[] = [b.tag(undefined, 'Ποιοι αριθμοί χρειάζονται για την πράξη; Οι άλλοι δεν αλλάζουν την απάντηση.')];
    const opText = (x: number, y: number) => `${fmt(x)} ${s.op} ${fmt(y)}`;

    if (r.chance(0.5)) {
      steps.push(b.numbers('plan', `Υπολογίζουμε πρώτα περίπου: στρογγυλοποιούμε στην πιο κοντινή ${place}.`, [
        { label: `Το ${fmt(a)} είναι περίπου`, answer: ra },
        { label: `Το ${fmt(c)} είναι περίπου`, answer: rc },
        // (the rounded numbers are the rows above: this one names them, and the hint gives the rule, not the two candidates)
        { label: `Περίπου: ${s.op === '+' ? 'το άθροισμά' : 'η διαφορά'} τους`, answer: est, unit: s.unit },
      ], `Κοιτάμε το ψηφίο των ${to === 100 ? 'δεκάδων' : 'μονάδων'} του ${fmt(a)}: από 5 και πάνω, πάμε στην επόμενη ${place}.`));
    } else {
      // Wrong estimates: both rounded down, both rounded up, only one rounded
      const fa = Math.floor(a / to) * to, fc = Math.floor(c / to) * to;
      const cands = [[fa, fc], [fa + to, fc + to], [ra, c], [a, rc]]
        .map(([x, y]) => [x, y, s.op === '+' ? x + y : x - y])
        .filter(([x, y, v]) => v > 0 && !(x === ra && y === rc));
      const wrongs = [...new Map(cands.map(([x, y, v]) => [v, `${opText(x, y)} = ${fmt(v)}`])).entries()]
        .filter(([v]) => v !== est).map(([, t]) => t).slice(0, 2);
      if (wrongs.length < 2) return null;
      steps.push(b.choice('plan', `Πόσο είναι περίπου; Στρογγυλοποιούμε στην πιο κοντινή ${place}.`, `${opText(ra, rc)} = ${fmt(est)}`, wrongs,
        // The rule, not the rounded numbers: they are the right option's (owner decision 3, #50 part 5d)
        `Κοιτάμε το ψηφίο των ${to === 100 ? 'δεκάδων' : 'μονάδων'} του ${fmt(a)} και του ${fmt(c)}: από 5 και πάνω, πάμε στην επόμενη ${place}, αλλιώς μένουμε στην ίδια.`));
    }
    steps.push(b.numbers('solve', 'Τώρα υπολογίζουμε κανονικά.', [{ label: `${opText(a, c)} =`, answer: exact, unit: s.unit }],
      s.op === '+' ? 'Προσθέτουμε μονάδες, δεκάδες, εκατοντάδες. Μην ξεχάσεις τα κρατούμενα!' : 'Αφαιρούμε μονάδες, δεκάδες, εκατοντάδες. Όταν δεν φτάνουν, δανειζόμαστε μία δεκάδα ή μία εκατοντάδα.'));

    const bad = slip(a, c, s.op);
    const far = Math.abs(bad - est) > Math.abs(exact - est) + to / 2;
    const who = r.pick(PEOPLE);
    const kind = r.int(0, 2);
    if (kind === 0 && bad !== exact && far) {
      steps.push(b.choice('check', `${who.Nom} βρήκε ${fmt(bad)}. Πώς καταλαβαίνουμε ότι έκανε λάθος;`,
        'Απέχει πολύ από την εκτίμηση',
        [['Δεν έκανε κανένα λάθος', 'Κανένα λάθος', 'Δεν έκανε κανένα λάθος, είναι σωστό'],
          [`Γιατί το ${fmt(bad)} είναι ${bad % 2 ? 'μονός' : 'ζυγός'} αριθμός`, `Γιατί είναι ${bad % 2 ? 'μονός' : 'ζυγός'} αριθμός`, `Γιατί το ${fmt(bad)} είναι ${bad % 2 ? 'μονός' : 'ζυγός'}`]],
        s.op === '+' ? 'Θυμήσου την εκτίμηση. Μήπως ξέχασε ένα κρατούμενο;' : 'Θυμήσου την εκτίμηση. Μήπως αφαίρεσε το μικρό ψηφίο από το μεγάλο;'));
    } else if (kind === 1) {
      const [hi, lo] = exact > est ? [exact, est] : [est, exact];
      steps.push(b.numbers('check', 'Πόσο απέχει το αποτέλεσμα από την εκτίμηση;', [
        { label: `${fmt(hi)} − ${fmt(lo)} =`, answer: hi - lo, unit: s.unit },
      ], 'Από τον μεγαλύτερο αριθμό βγάζουμε τον μικρότερο.'));
    } else {
      // Statements about the result, not «Ναι»/«Όχι» (#83): the estimate taken as exact, or a wrong estimate
      steps.push(b.choice('check', 'Γιατί το αποτέλεσμα είναι λογικό;', [`Είναι αρκετά κοντά στο ${fmt(est)}`, `Είναι κοντά στο ${fmt(est)}`],
        [[`Είναι ακριβώς ${fmt(est)}, όσο η εκτίμηση`, `Είναι ακριβώς ${fmt(est)}`], [`Είναι πιο κοντά στο ${fmt(est + 3 * to)}`, `Είναι περίπου ${fmt(est + 3 * to)}`]],
        'Η εκτίμηση δεν είναι ακριβώς το αποτέλεσμα, αλλά πρέπει να είναι κοντά του.'));
    }
    return { title: r.pick([s.title, 'Πρώτα περίπου', 'Υπολογίζω περίπου']), story, steps };
  },
};
