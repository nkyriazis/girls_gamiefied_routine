// A factory or bakery makes n an hour, h hours a day, for d days: per day, in all; or
// how many days for an order (Ε΄ κεφ. 2.9 «Ο πολλαπλασιασμός στους φυσικούς αριθμούς»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, count, extra, fmt, HowMany, known, sought, thing, type Family, type Rng, type Thing } from '../../lib.ts';

interface Setting {
  title: string[];
  who: string;    // "Ένας φούρνος"
  makes: string;  // "ψήνει"
  made: string;   // "έψησε"
  item: Thing;
  rate: [number, number, number]; // min, max, step
  /** Two machines: "Έχει δύο φούρνους: ο ένας ψήνει X την ώρα και ο άλλος Y." */
  two: (a: string, b: string) => string;
  /** "τον έναν φούρνο" */
  one: string;
  /** "και από τους δύο φούρνους" */
  both: string;
  noise: (r: Rng) => string;
}

const SETTINGS: Setting[] = [
  {
    title: ['Το αρτοποιείο', 'Τα ψωμιά'], who: 'Ένα αρτοποιείο', one: 'τον έναν φούρνο', both: 'και από τους δύο φούρνους', makes: 'ψήνει', made: 'έψησε',
    item: thing('ψωμί', 'ψωμιά', 'n'), rate: [60, 240, 10],
    two: (a, b) => `Έχει δύο μεγάλους φούρνους: ο ένας ψήνει ${a} και ο άλλος ${b}.`,
    noise: r => extra(`που απασχολεί ${r.int(4, 12)} αρτοποιούς`),
  },
  {
    title: ['Το εργοστάσιο παιχνιδιών', 'Τα παιχνίδια'], who: 'Ένα εργοστάσιο παιχνιδιών', one: 'τη μία γραμμή', both: 'και από τις δύο γραμμές', makes: 'φτιάχνει', made: 'έφτιαξε',
    item: thing('παιχνίδι', 'παιχνίδια', 'n'), rate: [120, 650, 10],
    two: (a, b) => `Έχει δύο γραμμές παραγωγής: η μία φτιάχνει ${a} και η άλλη ${b}.`,
    noise: r => extra(`που λειτουργεί από το ${r.int(1965, 2005)}`),
  },
  {
    title: ['Το εμφιαλωτήριο', 'Τα μπουκάλια νερό'], who: 'Ένα εμφιαλωτήριο', one: 'τη μία μηχανή', both: 'και από τις δύο μηχανές', makes: 'γεμίζει', made: 'γέμισε',
    item: thing('μπουκάλι νερό', 'μπουκάλια νερό', 'n'), rate: [800, 3000, 100],
    two: (a, b) => `Έχει δύο μηχανές: η μία γεμίζει ${a} και η άλλη ${b}.`,
    noise: r => extra(`που βρίσκεται ${r.int(12, 60)} χιλιόμετρα από την πόλη`),
  },
  {
    title: ['Το τυπογραφείο', 'Τα βιβλία'], who: 'Ένα τυπογραφείο', one: 'το ένα πιεστήριο', both: 'και από τα δύο πιεστήρια', makes: 'τυπώνει', made: 'τύπωσε',
    item: thing('βιβλίο', 'βιβλία', 'n'), rate: [150, 900, 50],
    two: (a, b) => `Έχει δύο πιεστήρια: το ένα τυπώνει ${a} και το άλλο ${b}.`,
    noise: r => extra(`που έχει ${r.int(3, 6)} αποθήκες`),
  },
  {
    title: ['Το εργαστήριο κεραμικής', 'Οι κούπες'], who: 'Ένα εργαστήριο κεραμικής', one: 'τον έναν πάγκο', both: 'και από τους δύο πάγκους', makes: 'φτιάχνει', made: 'έφτιαξε',
    item: thing('κούπα', 'κούπες', 'f'), rate: [8, 30, 2],
    two: (a, b) => `Έχει δύο πάγκους: ο ένας φτιάχνει ${a} και ο άλλος ${b}.`,
    noise: r => extra(`όπου δουλεύουν ${r.int(3, 9)} τεχνίτες`),
  },
  {
    title: ['Οι φάκελοι', 'Το χαρτοποιείο'], who: 'Ένα χαρτοποιείο', one: 'τη μία μηχανή', both: 'και από τις δύο μηχανές', makes: 'φτιάχνει', made: 'έφτιαξε',
    item: thing('φάκελος', 'φάκελοι', 'm', 'φακέλους'), rate: [300, 1500, 50],
    two: (a, b) => `Έχει δύο μηχανές: η μία φτιάχνει ${a} και η άλλη ${b}.`,
    noise: r => extra(`που έχει ${r.int(25, 90)} υπαλλήλους`),
  },
];

const MONTHS = ['τον Μάρτιο', 'τον Οκτώβριο', 'τον Μάιο', 'τον Νοέμβριο'];

export const production: Family = {
  id: 'production',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, κεφ. 2.9 «Ο πολλαπλασιασμός στους φυσικούς αριθμούς»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const it = s.item;
    const rate = r.step(s.rate[0], s.rate[1], s.rate[2]);
    const h = r.int(5, 10);
    const d = r.int(5, 26);
    const ask = r.pick(['total', 'days', 'two'] as const);
    const rate2 = r.step(s.rate[0], s.rate[1], s.rate[2]);
    if (ask === 'two' && rate2 === rate) return null;
    const perHour = ask === 'two' ? rate + rate2 : rate;
    const perDay = perHour * h;
    const total = perDay * d;
    if (total > 999_999) return null;
    const month = r.pick(MONTHS);
    const hours = known(`${h} ώρες την ημέρα`);
    const opening = ask === 'two'
      ? `${s.who}, ${s.noise(r)}, δουλεύει ${hours}. ${s.two(known(`${count(rate, it, true)} την ώρα`), known(`${fmt(rate2)}`))}`
      : `${s.who}, ${s.noise(r)}, ${s.makes} ${known(`${count(rate, it, true)} την ώρα`)} και δουλεύει ${hours}.`;
    const both = r.chance(0.4);
    const question = ask === 'days'
      ? `Πήρε μια παραγγελία για ${known(count(total, it, true))}. ${sought(r.chance(0.5) ? 'Σε πόσες ημέρες θα την ετοιμάσει' : 'Πόσες ημέρες θα δουλέψει για την παραγγελία')};`
      : `${cap(month)} δούλεψε ${known(`${d} ημέρες`)}. ${both ? `${sought(`${HowMany(it)} ${it.manyAcc} ${s.makes} την ημέρα`)} και ${sought(`${HowMany(it).toLowerCase()} ${s.made} ${month}`)}` : sought(`${HowMany(it)} ${it.manyAcc} ${s.made} ${month}`)};`;
    const story = `${opening} ${question}`;
    const U = cap(it.many);

    const steps: ProblemStep[] = [
      b.tag(undefined, ask === 'two' ? 'Δουλεύουν και οι δύο. Ό,τι δεν αλλάζει πόσα φτιάχνονται δεν χρειάζεται.' : 'Ό,τι δεν αλλάζει πόσα φτιάχνονται δεν χρειάζεται.'),
    ];
    const showOps = r.chance(0.5);
    if (ask === 'total' || ask === 'two') {
      if (r.chance(0.5)) {
        steps.push(b.choice('plan', 'Ποιο σχέδιο δουλεύει;', 'Βρίσκω πόσα φτιάχνονται την ημέρα και μετά σε όλες τις ημέρες',
          [`Προσθέτω ${fmt(rate)} + ${h} + ${d}`, `Πολλαπλασιάζω μόνο ${fmt(rate)} × ${d}`, ...(ask === 'two' ? [`Υπολογίζω μόνο ${s.one}`] : [])],
          `${h} ώρες την ημέρα, ${d} ημέρες: πρώτα η μία ημέρα.`));
      }
      const rows = [
        ...(ask === 'two' ? [{ label: showOps ? `${U} την ώρα ${s.both}: ${fmt(rate)} + ${fmt(rate2)} =` : `${U} την ώρα ${s.both}`, answer: perHour }] : []),
        { label: showOps ? `${U} την ημέρα: ${fmt(perHour)} × ${h} =` : `${U} την ημέρα`, answer: perDay },
        { label: showOps ? `${U} σε ${d} ημέρες: ${fmt(perDay)} × ${d} =` : `${U} ${month}`, answer: total, unit: it.many },
      ];
      steps.push(b.numbers('solve', 'Λύνουμε.', rows, `${fmt(perHour)} × ${h} = ${fmt(perDay)}.`));
      if (r.chance(0.5)) {
        steps.push(b.choice('check', 'Αναστοχαζόμαστε: ποια πράξη δίνει το ίδιο αποτέλεσμα;',
          `${fmt(perHour)} × ${fmt(h * d)} = ${fmt(total)}, γιατί ${d} ημέρες των ${h} ωρών είναι ${fmt(h * d)} ώρες`,
          [`${fmt(perHour)} × ${fmt(h + d)}, γιατί ${h} + ${d} = ${fmt(h + d)}`, `${fmt(perHour)} + ${fmt(h * d)}`],
          'Στον πολλαπλασιασμό μπορούμε να αλλάξουμε τη σειρά: πρώτα οι ώρες όλων των ημερών.'));
      } else {
        steps.push(b.numbers('check', 'Αναστοχαζόμαστε: εργαζόμαστε αντίστροφα.', [
          { label: `${fmt(total)} : ${d} =`, answer: perDay },
          { label: `${fmt(perDay)} : ${h} =`, answer: perHour },
        ], 'Πρέπει να ξαναβρούμε πόσα φτιάχνονται την ημέρα και την ώρα.'));
      }
    } else {
      if (r.chance(0.5)) {
        steps.push(b.order('plan', 'Βάζουμε σε σειρά το σχέδιό μας.', [
          'Βρίσκω πόσα φτιάχνονται την ημέρα',
          'Διαιρώ την παραγγελία με αυτόν τον αριθμό',
          'Ελέγχω πολλαπλασιάζοντας',
        ], 'Η παραγγελία μοιράζεται σε ημέρες, όχι σε ώρες.'));
      }
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        { label: showOps ? `${U} την ημέρα: ${fmt(rate)} × ${h} =` : `${U} την ημέρα`, answer: perDay },
        { label: showOps ? `Ημέρες: ${fmt(total)} : ${fmt(perDay)} =` : 'Ημέρες για την παραγγελία', answer: d, unit: 'ημέρες' },
      ], `${fmt(rate)} × ${h} = ${fmt(perDay)}. Πόσες φορές χωράει το ${fmt(perDay)} στο ${fmt(total)};`));
      const wrongs = [`${fmt(total)} : ${fmt(rate)} = ${fmt(h * d)}, άρα ${fmt(h * d)} ημέρες`, `${fmt(perDay)} × ${d} = ${fmt(total)}, άρα ${fmt(total)} ημέρες`];
      steps.push(b.choice('check', 'Αναστοχαζόμαστε: τι δείχνει ότι η απάντηση είναι σωστή;',
        `${fmt(perDay)} × ${d} = ${fmt(total)}: σε ${d} ημέρες γίνεται όλη η παραγγελία`, wrongs,
        `Όσα γίνονται την ημέρα, επί τις ημέρες, πρέπει να κάνουν ${fmt(total)}.`));
    }
    return { title: r.pick(s.title), story, steps };
  },
};
