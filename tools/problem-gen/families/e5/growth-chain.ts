// A quantity that changes day by day: three times the day before, twice the day before,
// and on the last day as much as all the days before (Ε΄ Επαναληπτικό 1, 4ο πρόβλημα:
// «Η κυρία Μαρία την πρώτη ημέρα μάζεψε από την πορτοκαλιά της 8 πορτοκάλια»).
import { extra, fmt, known, people, sought, type Family, type Person } from '../../lib.ts';
import type { ProblemStep } from '../../../../shared/types.ts';

const TIMES: Record<number, { n: string; f: string }> = {
  2: { n: 'διπλάσια', f: 'διπλάσιες' },
  3: { n: 'τριπλάσια', f: 'τριπλάσιες' },
  4: { n: 'τετραπλάσια', f: 'τετραπλάσιες' },
};

interface Setting {
  title: string;
  g: 'n' | 'f';
  noun: string;      // "πορτοκάλια"
  first: [number, number];
  /** Who, doing what: "Η γιαγιά της Δανάης μάζεψε" */
  who: (p: Person) => string;
  verb: string;      // "μάζεψε": the verb again, for the question
  subject: string;   // "η γιαγιά", in the question, when the story starts with it
  noise: (n: number, total: number) => string;
  max: number;       // a realistic total
}

const SETTINGS: Setting[] = [
  {
    title: 'Τα πορτοκάλια', g: 'n', noun: 'πορτοκάλια', first: [6, 15], max: 300,
    who: p => `Η γιαγιά ${p.gen} μάζεψε από την πορτοκαλιά της`, verb: 'μάζεψε', subject: 'η γιαγιά',
    noise: n => `Η πορτοκαλιά είναι φυτεμένη εδώ και ${n + 8} χρόνια`,
  },
  {
    title: 'Τα κουλούρια του φούρνου', g: 'n', noun: 'κουλούρια', first: [20, 60], max: 900,
    who: () => 'Ένας καινούργιος φούρνος πούλησε', verb: 'πούλησε', subject: 'ο φούρνος',
    noise: n => `Ο φούρνος ανοίγει στις ${Math.max(5, Math.min(n, 7))} το πρωί`,
  },
  {
    title: 'Το βιβλίο', g: 'f', noun: 'σελίδες', first: [3, 9], max: 280,
    who: p => `${p.Nom} διάβασε από ένα καινούργιο βιβλίο`, verb: 'διάβασε', subject: '',
    noise: (n, total) => `Το βιβλίο έχει ${Math.ceil((total + n * 10) / 10) * 10} σελίδες`,
  },
  {
    title: 'Η ανακύκλωση', g: 'n', noun: 'κουτάκια', first: [10, 40], max: 900,
    who: p => `Η τάξη ${p.gen} μάζεψε για ανακύκλωση`, verb: 'μάζεψε', subject: 'η τάξη',
    noise: n => `Στην τάξη είναι ${n + 17} παιδιά`,
  },
  {
    title: 'Τα εισιτήρια της παράστασης', g: 'n', noun: 'εισιτήρια', first: [15, 50], max: 1_200,
    who: () => 'Το θέατρο της πόλης πούλησε για μια νέα παράσταση', verb: 'πούλησε', subject: 'το θέατρο',
    noise: n => `Η παράσταση διαρκεί ${n + 80} λεπτά`,
  },
  {
    title: 'Οι φράουλες', g: 'n', noun: 'κιλά φράουλες', first: [20, 60], max: 1_500,
    who: p => `Ο θείος ${p.gen} μάζεψε από το χωράφι του`, verb: 'μάζεψε', subject: 'ο θείος',
    noise: n => `Το χωράφι έχει ${n + 10} σειρές με φράουλες`,
  },
];

const DAYS_ACC = ['την πρώτη', 'τη δεύτερη', 'την τρίτη', 'την τέταρτη'];

export const growthChain: Family = {
  id: 'growth-chain',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, Επαναληπτικό 1, 4ο πρόβλημα (τα πορτοκάλια της κυρίας Μαρίας)',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const [p] = people(r, 1);
    const g = s.g;
    const many = (n: string, f: string) => (g === 'n' ? n : f); // agreement with the noun
    const a = r.int(...s.first);
    const m2 = r.pick([2, 3, 4]);
    const d2 = a * m2;
    // Day 3: a multiple, or some more or fewer than day 2
    const kind3 = r.pick(['times', 'more', 'less'] as const);
    const m3 = r.pick([2, 3]);
    const k = r.int(2, 9) * (a >= 20 ? 5 : 1);
    const d3 = kind3 === 'times' ? d2 * m3 : kind3 === 'more' ? d2 + k : d2 - k;
    if (d3 <= 0) return null;
    // Day 4: as many as all the days before, or as the two days before
    const all = r.chance(0.65);
    const d4 = all ? a + d2 + d3 : d2 + d3;
    const total = a + d2 + d3 + d4;
    if (total > s.max) return null;

    const rule2 = `${DAYS_ACC[1]} ${TIMES[m2][g]} από ${DAYS_ACC[0]}`;
    const rule3 = kind3 === 'times' ? `${DAYS_ACC[2]} ${TIMES[m3][g]} από ${DAYS_ACC[1]}`
      : `${DAYS_ACC[2]} ${k} ${kind3 === 'more' ? many('περισσότερα', 'περισσότερες') : many('λιγότερα', 'λιγότερες')} από ${DAYS_ACC[1]}`;
    const rule4 = all ? `${DAYS_ACC[3]} ${many('τόσα', 'τόσες')}, ${many('όσα', 'όσες')} όλες τις προηγούμενες ημέρες μαζί`
      : `${DAYS_ACC[3]} ${many('τόσα', 'τόσες')}, ${many('όσα', 'όσες')} τη δεύτερη και την τρίτη ημέρα μαζί`;
    const ask = `${g === 'n' ? 'Πόσα' : 'Πόσες'} ${s.noun} ${s.verb}${s.subject ? ` ${s.subject}` : ''} και τις τέσσερις ημέρες`;
    const noise = extra(s.noise(r.int(3, 9), total));
    const who = s.who(p);
    // "τη δεύτερη ημέρα μάζεψε τριπλάσια...": the rule as a sentence of its own
    const withVerb = (rule: string) => rule.replace(/^(την? \S+)( ημέρα)?/, (_m, d) => `${d} ημέρα ${s.verb}`);
    const t = r.int(0, 2);
    const story = t === 0
      ? `${who} ${known(`την πρώτη ημέρα ${a} ${s.noun}`)}, ${known(rule2)}, ${known(rule3)} και ${known(rule4)}. ${noise}. ${sought(ask)};`
      : t === 1
        ? `${who} ${known(`${a} ${s.noun} την πρώτη ημέρα`)}. ${noise}. ${cap(known(withVerb(rule2)))}. ${cap(known(withVerb(rule3)))}. ${cap(known(withVerb(rule4)))}. ${sought(ask)};`
        : `${sought(ask)}; ${who} ${known(`${a} ${s.noun} την πρώτη ημέρα`)}, ${known(rule2)}, ${known(rule3)} και ${known(rule4)}. ${noise}.`;

    const show = r.chance(0.5);
    const day = (i: number) => `${i + 1}η ημέρα`;
    const rows = [
      { label: show ? `${day(1)}: ${a} × ${m2} =` : day(1), answer: d2, unit: s.noun },
      { label: show ? `${day(2)}: ${kind3 === 'times' ? `${d2} × ${m3}` : kind3 === 'more' ? `${d2} + ${k}` : `${d2} − ${k}`} =` : day(2), answer: d3, unit: s.noun },
      { label: show ? `${day(3)}: ${all ? `${a} + ${d2} + ${d3}` : `${d2} + ${d3}`} =` : day(3), answer: d4, unit: s.noun },
      { label: show ? `Όλες οι ημέρες: ${a} + ${d2} + ${d3} + ${d4} =` : 'Όλες οι ημέρες', answer: total, unit: s.noun },
    ];
    if (r.chance(0.3)) rows.unshift({ label: day(0), answer: a, unit: s.noun });

    const steps: ProblemStep[] = [b.tag(undefined, `Κάθε σχέση («${TIMES[m2][g]}», «${many('τόσα', 'τόσες')}, ${many('όσα', 'όσες')}») είναι κάτι που γνωρίζουμε. Ό,τι δεν αλλάζει τους αριθμούς δεν χρειάζεται.`)];
    if (r.chance(0.6)) {
      steps.push(b.choice('plan', r.chance(0.5) ? 'Ποιο εργαλείο μας βοηθά;' : 'Πώς οργανώνουμε τη λύση;',
        'Ένας πίνακας με μια γραμμή για κάθε ημέρα',
        ['Προσθέτω μόνο τους αριθμούς που βλέπω στην ιστορία', `Πολλαπλασιάζω ${a} × 4, γιατί είναι τέσσερις ημέρες`],
        'Κάθε ημέρα εξαρτάται από την προηγούμενη. Τις βρίσκουμε μία μία, με τη σειρά.'));
    }
    steps.push(b.numbers('solve', 'Βρίσκουμε κάθε ημέρα με τη σειρά.', rows,
      `Τη δεύτερη ημέρα: ${a} × ${m2}. Την τέταρτη ημέρα προσθέτουμε ${all ? 'τις τρεις πρώτες' : 'τη δεύτερη και την τρίτη'}.`));
    steps.push(all && r.chance(0.5)
      ? b.numbers('check', 'Αναστοχαζόμαστε: η τέταρτη ημέρα είναι όσο οι τρεις πρώτες μαζί. Άρα όλες οι ημέρες είναι το διπλάσιο της τέταρτης.',
        [{ label: `2 × ${d4} =`, answer: total, unit: s.noun }], 'Αν βγει ίδιο με το σύνολο που βρήκαμε, οι πράξεις μας είναι σωστές.')
      : b.choice('check', `Κάποιος απάντησε «${fmt(d4)}». Τι έκανε λάθος;`, 'Βρήκε μόνο την τέταρτη ημέρα, όχι όλες μαζί',
        ['Τίποτα, είναι σωστό', 'Ξέχασε να πολλαπλασιάσει με το 4'],
        'Η ερώτηση ζητάει και τις τέσσερις ημέρες μαζί.'));
    return { title: s.title, story, steps };
  },
};

const cap = (s: string) => s.replace(/^(\[?)(.)/, (_m, br, c) => br + c.toUpperCase());
