// People on a bus, a train, a boat: they start with some, and at each stop some get off
// and some get on (Γ΄ κεφ. 2 «Προσθέσεις…» και κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { extra, fmt, known, sought, type Family, type Rng } from '../../lib.ts';

interface Vehicle {
  the: string;   // "το λεωφορείο"
  on: string;    // "στο λεωφορείο"
  who: string;   // "επιβάτες" (masc./neut. plural, nominative = accusative)
  how: 'Πόσοι' | 'Πόσα';
  howAcc: 'πόσους' | 'πόσα';
  start: [number, number];
  cap: number;
  move: [number, number]; // how many get on or off at a stop
  from: string;  // "ξεκινά από την αφετηρία"
  stops: [string, string]; // "Στην πρώτη στάση", ...
  end: string;   // "στο τέρμα"
  noise: (r: Rng) => string;
}

const VEHICLES: Vehicle[] = [
  {
    the: 'το λεωφορείο', on: 'στο λεωφορείο', who: 'επιβάτες', how: 'Πόσοι', howAcc: 'πόσους',
    start: [12, 35], cap: 60, move: [2, 15], from: 'ξεκινά από την αφετηρία',
    stops: ['Στην πρώτη στάση', 'Στη δεύτερη στάση'], end: 'στο τέρμα',
    noise: r => r.chance(0.5) ? `Το λεωφορείο έχει ${extra(`${r.int(40, 50)} θέσεις`)} για να κάθονται.` : `Η διαδρομή κρατά ${extra(`${r.int(35, 55)} λεπτά`)}.`,
  },
  {
    the: 'το τρένο', on: 'στο τρένο', who: 'επιβάτες', how: 'Πόσοι', howAcc: 'πόσους',
    start: [120, 380], cap: 500, move: [15, 90], from: 'ξεκινά από την Αθήνα για τη Θεσσαλονίκη',
    stops: ['Στη Λαμία', 'Στη Λάρισα'], end: 'στη Θεσσαλονίκη',
    noise: r => r.chance(0.5) ? `Το τρένο έχει ${extra(`${r.int(6, 9)} βαγόνια`)}.` : `Το ταξίδι κρατά ${extra(`${r.int(4, 5)} ώρες`)}.`,
  },
  {
    the: 'το πλοίο', on: 'στο πλοίο', who: 'επιβάτες', how: 'Πόσοι', howAcc: 'πόσους',
    start: [250, 700], cap: 950, move: [30, 180], from: 'φεύγει από τον Πειραιά',
    stops: ['Στη Σύρο', 'Στην Πάρο'], end: 'στη Νάξο',
    noise: r => r.chance(0.5) ? `Το πλοίο μεταφέρει και ${extra(`${r.int(40, 90)} αυτοκίνητα`)}.` : `Το ταξίδι κρατά ${extra(`${r.int(5, 6)} ώρες`)}.`,
  },
  {
    the: 'το τραμ', on: 'στο τραμ', who: 'επιβάτες', how: 'Πόσοι', howAcc: 'πόσους',
    start: [20, 60], cap: 110, move: [3, 20], from: 'ξεκινά από την παραλία',
    stops: ['Στην επόμενη στάση', 'Στη στάση της πλατείας'], end: 'στο Σύνταγμα',
    noise: r => `Περνάει ένα τραμ κάθε ${extra(`${r.int(8, 15)} λεπτά`)}.`,
  },
  {
    the: 'το μετρό', on: 'στο μετρό', who: 'επιβάτες', how: 'Πόσοι', howAcc: 'πόσους',
    start: [80, 250], cap: 400, move: [10, 60], from: 'ξεκινά από το Σύνταγμα',
    stops: ['Στο Μοναστηράκι', 'Στον Κεραμεικό'], end: 'στον Πειραιά',
    noise: r => r.chance(0.5) ? `Το μετρό έχει ${extra(`${r.int(6, 8)} βαγόνια`)}.` : `Περνάει ένα μετρό κάθε ${extra(`${r.int(4, 9)} λεπτά`)}.`,
  },
];

export const busStops: Family = {
  id: 'bus-stops',
  grade: 3,
  chapter: '10',
  topic: 'Αφαίρεση',
  source: 'Μαθηματικά Γ΄, κεφ. 2 «Προσθέσεις διψήφιων και τριψήφιων αριθμών» και κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών»',
  make(r, b) {
    const v = r.pick(VEHICLES);
    const start = r.int(...v.start);
    const two = r.chance(0.6);
    const moves = Array.from({ length: two ? 2 : 1 }, () => ({ off: r.int(...v.move), on: r.int(...v.move) }));
    // After each stop: never below 0, never above what fits
    let n = start;
    const after: number[] = [];
    const mid: number[] = [];
    for (const m of moves) {
      if (m.off >= n) return null;
      mid.push(n - m.off);
      n = n - m.off + m.on;
      if (n > v.cap) return null;
      after.push(n);
    }
    const final = n;
    const offs = moves.reduce((x, m) => x + m.off, 0);
    const ons = moves.reduce((x, m) => x + m.on, 0);
    if (offs === ons) return null;

    const Cap = (x: string) => x[0].toUpperCase() + x.slice(1);
    const stopText = moves.map((m, i) => r.chance(0.5)
      ? `${v.stops[i]} κατεβαίνουν ${known(`${fmt(m.off)} ${v.who}`)} και ανεβαίνουν ${known(fmt(m.on))}.`
      : `${v.stops[i]} ανεβαίνουν ${known(`${fmt(m.on)} ${v.who}`)} και κατεβαίνουν ${known(fmt(m.off))}.`).join(' ');
    const noise = v.noise(r);
    const ask = r.pick([
      `${sought(`${v.how} ${v.who} είναι τώρα ${v.on}`)};`,
      `${sought(`Με ${v.howAcc} ${v.who} φτάνει ${v.the} ${v.end}`)};`,
    ]);
    const story = r.pick([
      () => `${Cap(v.the)} ${v.from} με ${known(`${fmt(start)} ${v.who}`)}. ${stopText} ${noise} ${ask}`,
      () => `${Cap(v.the)} ${v.from} και έχει ${known(`${fmt(start)} ${v.who}`)}. ${stopText} ${noise} ${ask}`,
      () => `Όταν ${v.the} ${v.from}, έχει μέσα ${known(`${fmt(start)} ${v.who}`)}. ${stopText} ${noise} ${ask}`,
    ])();

    const steps: ProblemStep[] = [b.tag(undefined, 'Χρειαζόμαστε όσους ήταν στην αρχή, όσους κατεβαίνουν και όσους ανεβαίνουν.')];
    if (r.chance(0.4)) {
      steps.push(b.choice('plan', 'Τι κάνουμε με όσους κατεβαίνουν;', 'Τους αφαιρούμε', ['Τους προσθέτουμε', 'Τους αγνοούμε'],
        `Όταν κατεβαίνουν, ${v.on} μένουν λιγότεροι.`));
    }
    // "Στη Λαμία" → "μετά τη Λαμία"
    const afterStop = (i: number) => v.stops[i].replace(/^Σ/, 'μετά ');
    const style = r.int(0, 2);
    // A row after the first says «όσοι ήταν», not the number the row above asks for
    const rows = style === 0
      ? moves.flatMap((m, i) => [
        { label: `Κατεβαίνουν: ${i ? 'όσοι ήταν' : fmt(start)} − ${fmt(m.off)} =`, answer: mid[i] },
        { label: `Ανεβαίνουν: όσοι έμειναν + ${fmt(m.on)} =`, answer: after[i] },
      ])
      : style === 1
        ? moves.map((m, i) => ({ label: `${Cap(afterStop(i))}: ${i ? 'όσοι ήταν' : fmt(start)} − ${fmt(m.off)} + ${fmt(m.on)} =`, answer: after[i] }))
        : moves.map((_m, i) => ({ label: Cap(afterStop(i)), answer: after[i] }));
    steps.push(b.numbers('solve', 'Λύνουμε στάση στάση.', rows.map(x => ({ ...x, unit: v.who })),
      'Σε κάθε στάση: πρώτα αφαιρούμε όσους κατεβαίνουν, μετά προσθέτουμε όσους ανεβαίνουν.'));
    const moreNow = ons > offs;
    // Statements, not «Ναι»/«Όχι» (#83): the reason that holds, the other way round, or every number added
    const [up, down] = ['Ανέβηκαν πιο πολλοί από όσους κατέβηκαν', 'Κατέβηκαν πιο πολλοί από όσους ανέβηκαν'];
    steps.push(b.choice('check', 'Γιατί η απάντηση είναι λογική;', moreNow ? up : down,
      [moreNow ? down : up,
        [`Είναι ${fmt(start + offs + ons)}: όλοι οι αριθμοί της ιστορίας μαζί`, `Είναι ${fmt(start + offs + ons)}, όλοι οι αριθμοί μαζί`]],
      `Συγκρίνουμε: κατέβηκαν ${fmt(offs)} και ανέβηκαν ${fmt(ons)}.`));
    return { title: r.pick(['Στάση στάση', 'Ανεβαίνουν και κατεβαίνουν', 'Το ταξίδι', 'Πόσοι είναι τώρα;']), story, steps };
  },
};
