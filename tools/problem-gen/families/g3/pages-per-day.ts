// A book of N pages, k pages a day: in how many days is it finished? When k doesn't go
// into N exactly, the last day is shorter: one more day for the pages that are left
// (Γ΄ κεφ. 18 «Διαιρέσεις»: 42 : 5, τα δύο διαδοχικά γινόμενα 5 × 8 = 40 και 5 × 9 = 45).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, extra, fmt, known, PEOPLE, sought, type Family } from '../../lib.ts';

const BOOKS = [
  'ένα βιβλίο με παραμύθια', 'ένα βιβλίο για τους δεινόσαυρους', 'ένα μυθιστόρημα περιπέτειας',
  'ένα βιβλίο με μύθους του Αισώπου', 'ένα βιβλίο για τα ζώα της θάλασσας', 'ένα βιβλίο για τους πλανήτες',
  'ένα βιβλίο με ελληνικούς μύθους',
];

// When the reading happens: every day, or every evening at bedtime
interface When {
  HowMany: string; // "Σε πόσες μέρες"
  many: string; // "μέρες"
  one: string; // "μέρα"
  oneMore: string; // "μία μέρα ακόμη"
  each: string; // "κάθε μέρα"
  times: string; // hint for the check
}
const DAY: When = {
  HowMany: 'Σε πόσες μέρες', many: 'μέρες', one: 'μέρα', oneMore: 'μία μέρα ακόμη', each: 'κάθε μέρα',
  times: 'Όσες μέρες, επί όσες σελίδες την ημέρα, πρέπει να κάνουν όλες τις σελίδες.',
};
const EVENING: When = {
  HowMany: 'Σε πόσα βράδια', many: 'βράδια', one: 'βράδυ', oneMore: 'ένα βράδυ ακόμη', each: 'κάθε βράδυ',
  times: 'Όσα βράδια, επί όσες σελίδες το βράδυ, πρέπει να κάνουν όλες τις σελίδες.',
};

const GROWNUPS = ['η γιαγιά', 'ο παππούς', 'η μαμά', 'ο μπαμπάς'];

export const pagesPerDay: Family = {
  id: 'pages-per-day',
  grade: 3,
  unit: 3,
  source: 'Μαθηματικά Γ΄, κεφ. 18 «Διαιρέσεις»',
  make(r, b) {
    const p = r.pick(PEOPLE);
    const book = r.pick(BOOKS);
    const k = r.chance(0.2) ? 20 : r.int(4, 10);
    const q = k === 20 ? r.int(3, 9) : k === 10 ? r.int(4, 12) : r.int(4, 10);
    const rest = r.chance(0.65) ? r.int(1, k - 1) : 0;
    const read = r.chance(0.35) ? r.step(10, 60, 5) : 0; // pages already read
    const left = k * q + rest;
    const pages = left + read;
    if (pages < 40 || pages > 260) return null;

    const telling = r.int(0, 4);
    const w = telling === 4 ? EVENING : DAY;
    const they = telling === 4; // the grown-up and the kid read together
    const finish = they ? 'θα τελειώσουν' : 'θα τελειώσει';
    const noise = r.pick([
      `Είναι χωρισμένο σε ${extra(`${r.int(8, 15)} κεφάλαια`)}.`,
      `Μέσα έχει και ${extra(`${r.int(12, 30)} ζωγραφιές`)}.`,
      telling === 0 ? `Η βιβλιοθήκη έχει ${extra(`${fmt(r.step(1200, 3000, 100))} βιβλία`)}.` : `Στο βιβλιοπωλείο κοστίζει ${extra(`${r.int(7, 15)} ευρώ`)}.`,
      they ? `Διαβάζουν στις ${extra(`${r.int(8, 9)} το βράδυ`)}.` : `Κάθεται να διαβάσει πάντα στις ${extra(`${r.int(5, 7)} το απόγευμα`)}.`,
    ]);
    const has = `Το βιβλίο έχει ${known(`${fmt(pages)} σελίδες`)}.`;
    const already = read ? ` ${they ? 'Έχουν' : 'Έχει'} ήδη διαβάσει ${known(`${read} σελίδες`)}.` : '';
    const ask = sought(`${w.HowMany}${read ? ' ακόμη' : ''} ${finish} το βιβλίο`);
    const story = [
      () => `${p.Nom} δανείστηκε από τη βιβλιοθήκη ${book}. ${has}${already} ${noise} Κάθε μέρα διαβάζει ${known(`${k} σελίδες`)}. ${ask};`,
      () => `${p.Nom} πήρε δώρο για τη γιορτή ${p.his} ${book}. ${has}${already} ${noise} Θέλει να διαβάζει ${known(`${k} σελίδες`)} την ημέρα. ${ask};`,
      () => `Στις καλοκαιρινές διακοπές ${p.nom} διαβάζει ${book}. ${has}${already} Διαβάζει ${known(`${k} σελίδες`)} κάθε μέρα. ${noise} ${ask};`,
      () => `Η δασκάλα είπε στα παιδιά να διαβάσουν ${book}. ${has} ${p.Nom} διαβάζει ${known(`${k} σελίδες`)} την ημέρα.${already} ${noise} ${ask};`,
      () => `Κάθε βράδυ ${r.pick(GROWNUPS)} διαβάζει σ${p.acc} ${known(`${k} σελίδες`)} από ${book}. ${has}${already} ${noise} ${ask};`,
    ][telling]();

    const steps: ProblemStep[] = [
      b.tag(undefined, read
        ? 'Χρειαζόμαστε πόσες σελίδες έχει το βιβλίο, πόσες έχουν ήδη διαβαστεί και πόσες διαβάζονται κάθε φορά.'
        : 'Χρειαζόμαστε πόσες σελίδες έχει το βιβλίο και πόσες διαβάζονται κάθε φορά. Οι άλλοι αριθμοί δεν αλλάζουν τίποτα.'),
    ];
    if (read) {
      steps.push(b.numbers('solve', 'Πόσες σελίδες μένουν να διαβαστούν;', [
        { label: r.chance(0.5) ? `${fmt(pages)} − ${read} =` : 'Σελίδες που μένουν', answer: left, unit: 'σελίδες' },
      ], 'Από όλες τις σελίδες βγάζουμε όσες έχουν ήδη διαβαστεί.'));
    }
    if (r.chance(0.5)) {
      steps.push(b.choice('plan', 'Ποια πράξη μας βοηθά;', `${fmt(left)} : ${k}`,
        [`${fmt(left)} − ${k}`, `${fmt(left)} × ${k}`, read ? `${fmt(pages)} : ${k}` : `${fmt(left)} + ${k}`],
        `${cap(w.each)} φεύγουν ${k} σελίδες από τις ${fmt(left)}. Πόσες φορές γίνεται αυτό;`));
    }
    const title = r.pick(['Το βιβλίο', 'Σελίδα σελίδα', 'Διαβάζουμε', they ? 'Πριν τον ύπνο' : 'Το καινούργιο βιβλίο']);
    if (!rest) {
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        r.chance(0.5) ? { label: `${fmt(left)} : ${k} =`, answer: q, unit: w.many } : { label: cap(w.many), answer: q },
      ], `Ποιος αριθμός επί ${k} κάνει ${fmt(left)};`));
      steps.push(b.choice('check', 'Πώς ελέγχουμε;', `${q} × ${k} = ${fmt(left)}`,
        [`${fmt(left)} + ${k} = ${fmt(left + k)}`, `${q} + ${k} = ${q + k}`], w.times));
      return { title, story, steps };
    }

    steps.push(b.numbers('solve', `Μοιράζουμε τις ${fmt(left)} σελίδες σε ομάδες των ${k}.`, [
      { label: `${cap(w.many)} με ${k} σελίδες`, answer: q, unit: w.many },
      { label: 'Σελίδες που περισσεύουν', answer: rest },
    ], k >= 10
      ? `Μετράμε ανά ${k}: ${k}, ${2 * k}, ${3 * k}, … Πού σταματάμε, πριν ξεπεράσουμε το ${fmt(left)};`
      : `Σκέψου την προπαίδεια του ${k}: ποιο γινόμενο φτάνει πιο κοντά στο ${fmt(left)} χωρίς να το ξεπερνά;`));
    const restText = rest === 1 ? 'τη μία σελίδα που μένει' : `τις ${rest} σελίδες που μένουν`;
    if (r.chance(0.5)) {
      const wrongs = [`Σε ${q}, γιατί τόσες φορές χωράει το ${k} στο ${fmt(left)}`];
      if (rest > 1 && rest !== q && rest !== q + 1) wrongs.push(`Σε ${rest}, γιατί τόσες σελίδες περισσεύουν`);
      else if (rest > 1) wrongs.push(`Σε ${q + rest}: ${q} και οι ${rest} σελίδες που περισσεύουν`);
      steps.push(b.choice('check', `${w.HowMany} ${finish} λοιπόν το βιβλίο;`,
        `Σε ${q + 1}, ${w.oneMore} για ${rest === 1 ? 'τη μία σελίδα' : `τις ${rest} σελίδες`}`, wrongs,
        'Οι σελίδες που περισσεύουν πρέπει κι αυτές να διαβαστούν.'));
    } else {
      steps.push(b.choice('check', `Τι σημαίνει ${rest === 1 ? 'η σελίδα που περισσεύει' : `ότι περισσεύουν ${rest} σελίδες`};`,
        `Ότι θα χρειαστεί ${w.oneMore}`,
        [rest === 1 ? 'Ότι αυτή δεν θα διαβαστεί' : 'Ότι αυτές δεν θα διαβαστούν',
          they ? `Ότι θα το τελειώσουν σε ${q} ${w.many}` : `Ότι το βιβλίο θα τελειώσει σε ${q} ${w.many}`],
        `Μετά από ${q} ${w.many} το βιβλίο δεν έχει τελειώσει ακόμη.`));
    }
    return { title, story, steps };
  },
};
