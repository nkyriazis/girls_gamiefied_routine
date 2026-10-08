// Things that repeat every a, b (and c) days or minutes: when do they happen together
// again? The least common multiple (Ε΄ κεφ. 2.10 «Πολλαπλάσια και διαιρέτες»;
// Επαναληπτικό 2, 5ο πρόβλημα: τριανταφυλλιά, γαριφαλιά, κάκτος).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, extra, fmt, known, people, sought, type Family, type Person, type Rng } from '../../lib.ts';

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (xs: number[]) => xs.reduce((l, x) => (l / gcd(l, x)) * x, 1);

/** "2, 3 και 5" */
const list = (xs: string[]) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} και ${xs[xs.length - 1]}`);

interface Scene {
  title: string;
  /** The story before the claim and the question (every number marked). */
  intro: string;
  /** What happens together, for "Σε πόσα λεπτά θα ..." */
  ask: string;
  /** The same question, told another way. */
  ask2: string;
  /** Both, naming who does it: after a child's claim, «θα ξαναποτίσει» alone would be the child's */
  named?: [string, string];
  unit: string;
  /** What the kid counts in the rows: "Ποτίσματα της τριανταφυλλιάς" */
  each: string[];
}

interface Setting {
  sizes: number[];
  periods: (r: Rng, n: number) => number[] | null;
  scene: (r: Rng, ps: number[], who: Person[]) => Scene;
}

/** `n` different periods from `pool`, sorted, with a least common multiple in [min, max]. */
function pickPeriods(r: Rng, pool: number[], n: number, min: number, max: number): number[] | null {
  const ps = r.sample(pool, n).sort((x, y) => x - y);
  // No period may divide another: then the answer is just the biggest, and there's nothing to find
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (ps[j] % ps[i] === 0) return null;
  const l = lcm(ps);
  return l >= min && l <= max ? ps : null;
}

const PLANTS = [
  { a: 'μια τριανταφυλλιά', the: 'η τριανταφυλλιά', of: 'της τριανταφυλλιάς' },
  { a: 'μια γαριφαλιά', the: 'η γαριφαλιά', of: 'της γαριφαλιάς' },
  { a: 'έναν κάκτο', the: 'ο κάκτος', of: 'του κάκτου' },
  { a: 'μια βουκαμβίλια', the: 'η βουκαμβίλια', of: 'της βουκαμβίλιας' },
  { a: 'έναν βασιλικό', the: 'ο βασιλικός', of: 'του βασιλικού' },
];

const SETTINGS: Setting[] = [
  {
    // Επαναληπτικό 2, 5ο πρόβλημα
    sizes: [2, 3],
    periods: (r, n) => pickPeriods(r, [2, 3, 4, 5, 6, 7, 8], n, 10, 60),
    scene: (r, ps, [kid]) => {
      const grandma = r.chance(0.5);
      const who = grandma ? `Η γιαγιά ${kid.gen}` : `Ο παππούς ${kid.gen}`;
      const whoAfter = who[0].toLowerCase() + who.slice(1); // «η γιαγιά του Μάρκου»: only the article
      const plants = r.sample(PLANTS, ps.length);
      const noise = r.chance(0.5)
        ? extra(`που είναι ${r.int(66, 86)} χρονών`)
        : extra(`που μένει στον ${r.int(2, 6)}ο όροφο`);
      const his = grandma ? 'της' : 'του';
      const needs = plants.map((p, i) => i === 0 ? `${p.the} θέλει πότισμα ${known(`κάθε ${ps[i]} ημέρες`)}` : `${p.the} ${known(`κάθε ${ps[i]}`)}`);
      const all = ps.length === 3 ? 'και τις τρεις γλάστρες' : 'και τις δύο γλάστρες';
      return {
        title: r.pick(['Το πότισμα', 'Οι γλάστρες στο μπαλκόνι']),
        intro: `${who}, ${noise}, έχει στο μπαλκόνι ${his} ${list(plants.map(p => p.a))}. `
          + `${cap(list(needs))}. ${known(`Σήμερα πότισε ${all}`)}.`,
        ask: `Σε πόσες ημέρες θα ποτίσει ξανά ${all} την ίδια ημέρα`,
        ask2: `Μετά από πόσες ημέρες θα ξαναποτίσει ${all} μαζί`,
        named: [`Σε πόσες ημέρες θα ποτίσει ${whoAfter} ξανά ${all} την ίδια ημέρα`, `Μετά από πόσες ημέρες θα ξαναποτίσει ${whoAfter} ${all} μαζί`],
        unit: 'ημέρες',
        each: plants.map(p => `Ποτίσματα ${p.of}`),
      };
    },
  },
  {
    sizes: [2],
    periods: (r, n) => pickPeriods(r, [6, 8, 9, 10, 12, 15, 18, 20, 24, 30], n, 24, 120),
    scene: (r, [a, b]) => {
      const [c1, c2] = r.sample([['μπλε', 'μπλε', 'των μπλε λεωφορείων'], ['πράσινο', 'πράσινα', 'των πράσινων λεωφορείων'],
        ['κόκκινο', 'κόκκινα', 'των κόκκινων λεωφορείων'], ['κίτρινο', 'κίτρινα', 'των κίτρινων λεωφορείων']], 2);
      const place = r.pick(['τον σταθμό της πλατείας', 'την αφετηρία του λιμανιού', 'τον σταθμό του νοσοκομείου']);
      const noise = r.chance(0.5)
        ? `${extra(`Στις ${r.int(6, 9)} το πρωί`)} ${known(`έφυγαν μαζί ένα ${c1[0]} και ένα ${c2[0]}`)}.`
        : `${known(`Μόλις έφυγαν μαζί ένα ${c1[0]} και ένα ${c2[0]}`)}. Κάθε ${c1[0]} λεωφορείο κάνει ${extra(`${r.int(14, 32)} στάσεις`)} ως το τέρμα.`;
      return {
        title: r.pick(['Τα δρομολόγια', 'Τα λεωφορεία της πόλης']),
        intro: `Από ${place} τα ${c1[1]} λεωφορεία ξεκινούν ${known(`κάθε ${a} λεπτά`)} και τα ${c2[1]} ${known(`κάθε ${b} λεπτά`)}. ${noise}`,
        ask: 'Σε πόσα λεπτά θα ξαναφύγουν μαζί',
        ask2: `Μετά από πόσα λεπτά θα ξεκινήσουν πάλι μαζί ένα ${c1[0]} και ένα ${c2[0]}`,
        unit: 'λεπτά',
        each: [`Δρομολόγια ${c1[2]}`, `Δρομολόγια ${c2[2]}`],
      };
    },
  },
  {
    sizes: [2, 3],
    periods: (r, n) => pickPeriods(r, [4, 5, 6, 8, 9, 10, 12, 15], n, 12, 90),
    scene: (r, ps) => {
      const noise = r.chance(0.5)
        ? extra(`ο ψηλότερος έχει ύψος ${r.int(18, 45)} μέτρα`)
        : extra(`ο παλαιότερος χτίστηκε πριν από ${r.int(90, 180)} χρόνια`);
      const ord = ['Ο πρώτος', 'ο δεύτερος', 'ο τρίτος'];
      const flashes = ps.map((p, i) => i === 0 ? `${ord[i]} αναβοσβήνει ${known(`κάθε ${p} δευτερόλεπτα`)}` : `${ord[i]} ${known(`κάθε ${p}`)}`);
      const n = ps.length === 3 ? 'Τρεις' : 'Δύο';
      const all = ps.length === 3 ? 'και οι τρεις' : 'και οι δύο';
      return {
        title: r.pick(['Οι φάροι', 'Τα φώτα στη θάλασσα']),
        intro: `${n} φάροι φωτίζουν τον κόλπο· ${noise}. ${list(flashes)}. ${known(`Μόλις άναψαν ${all} μαζί`)}.`,
        ask: `Σε πόσα δευτερόλεπτα θα ξανανάψουν ${all} μαζί`,
        ask2: 'Μετά από πόσα δευτερόλεπτα θα ανάψουν πάλι την ίδια στιγμή',
        unit: 'δευτερόλεπτα',
        each: ['Αναλαμπές του πρώτου', 'Αναλαμπές του δεύτερου', 'Αναλαμπές του τρίτου'].slice(0, ps.length),
      };
    },
  },
  {
    sizes: [2],
    periods: (r, n) => pickPeriods(r, [3, 4, 5, 6, 8, 9, 10], n, 12, 60),
    scene: (r, [a, b], [x, y]) => {
      const place = r.pick([
        { go: 'για κολύμπι', at: 'στο κολυμβητήριο', noise: () => extra(`που έχει ${r.int(6, 10)} διαδρόμους`) },
        { go: 'στη δημοτική βιβλιοθήκη', at: 'στη βιβλιοθήκη', noise: () => extra(`που έχει ${fmt(r.step(3000, 9000, 100))} βιβλία`) },
        { go: 'στην πισίνα του συλλόγου', at: 'στην πισίνα', noise: () => extra(`που ανοίγει στις ${r.int(7, 9)} το πρωί`) },
        { go: 'στο εργαστήρι ζωγραφικής', at: 'στο εργαστήρι', noise: () => extra(`που έχει ${r.int(12, 20)} καβαλέτα`) },
      ]);
      return {
        title: r.pick(['Πότε θα ξανασυναντηθούν;', 'Η συνάντηση']),
        intro: `${x.Nom} πηγαίνει ${place.go} ${known(`κάθε ${a} ημέρες`)} και ${y.nom} ${known(`κάθε ${b}`)}. `
          + `${known(`Σήμερα συναντήθηκαν ${place.at}`)}, ${place.noise()}.`,
        ask: `Σε πόσες ημέρες θα ξανασυναντηθούν ${place.at}`,
        ask2: 'Μετά από πόσες ημέρες θα βρεθούν πάλι εκεί την ίδια ημέρα',
        unit: 'ημέρες',
        each: [`Επισκέψεις ${x.gen}`, `Επισκέψεις ${y.gen}`],
      };
    },
  },
  {
    sizes: [2],
    periods: (r, n) => pickPeriods(r, [4, 5, 6, 8, 9, 10], n, 12, 45),
    scene: (r, [a, b], [x, y]) => {
      const both = x.female && y.female ? 'Δύο φίλες' : 'Δύο φίλοι';
      const noise = r.chance(0.5)
        ? extra(`με περίμετρο ${fmt(r.step(600, 1500, 100))} μέτρα`)
        : extra(`που έχει ${r.int(8, 20)} παγκάκια`);
      return {
        title: r.pick(['Γύροι στο πάρκο', 'Το τρέξιμο']),
        intro: `${both} τρέχουν γύρους σε ένα πάρκο ${noise}. ${x.Nom} κάνει έναν γύρο ${known(`σε ${a} λεπτά`)} και ${y.nom} ${known(`σε ${b}`)}. `
          + `${known('Ξεκίνησαν μαζί από την είσοδο')}.`,
        ask: 'Σε πόσα λεπτά θα ξαναβρεθούν μαζί στην είσοδο',
        ask2: 'Μετά από πόσα λεπτά θα περάσουν πάλι μαζί από την είσοδο',
        unit: 'λεπτά',
        each: [`Γύροι ${x.gen}`, `Γύροι ${y.gen}`],
      };
    },
  },
  {
    sizes: [2, 3],
    periods: (r, n) => pickPeriods(r, [2, 3, 4, 5, 6, 8, 9, 10], n, 12, 60),
    scene: (r, ps) => {
      const colours = r.sample([['τα κόκκινα', 'των κόκκινων'], ['τα χρυσά', 'των χρυσών'], ['τα μπλε', 'των μπλε'], ['τα πράσινα', 'των πράσινων']], ps.length);
      const blink = ps.map((p, i) => i === 0 ? `${colours[i][0]} λαμπάκια αναβοσβήνουν ${known(`κάθε ${p} δευτερόλεπτα`)}` : `${colours[i][0]} ${known(`κάθε ${p}`)}`);
      return {
        title: r.pick(['Τα λαμπάκια', 'Το χριστουγεννιάτικο δέντρο']),
        intro: `Στο χριστουγεννιάτικο δέντρο της πλατείας, ${extra(`ψηλό ${r.int(8, 16)} μέτρα`)}, ${list(blink)}. ${known('Μόλις άναψαν όλα μαζί')}.`,
        ask: 'Σε πόσα δευτερόλεπτα θα ξανανάψουν όλα μαζί',
        ask2: 'Μετά από πόσα δευτερόλεπτα θα ανάψουν πάλι όλα την ίδια στιγμή',
        unit: 'δευτερόλεπτα',
        each: colours.map(c => `Αναλαμπές ${c[1]}`),
      };
    },
  },
];

export const togetherAgain: Family = {
  id: 'together-again',
  grade: 5,
  chapter: '2.10',
  topic: 'Πολλαπλασιασμός',
  source: 'Μαθηματικά Ε΄, κεφ. 2.10 «Πολλαπλάσια και διαιρέτες» (Ε.Κ.Π.) και Επαναληπτικό 2, 5ο πρόβλημα',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const ps = s.periods(r, r.pick(s.sizes));
    if (!ps) return null;
    const L = lcm(ps);
    const who = people(r, 3);
    const sc = s.scene(r, ps, who);
    const nums = ps.map(p => fmt(p));
    const prod = ps.reduce((x, y) => x * y, 1);
    const sum = ps.reduce((x, y) => x + y, 0);
    const big = ps[ps.length - 1];
    const others = ps.slice(0, -1).map(p => `με το ${p}`).join(' και ');

    // A friend multiplies the periods: a common multiple, but not the least
    const claim = prod > L && r.chance(0.4);
    const c = who[2];
    // After someone else of the scene («Ο Μιχάλης κάνει…», «Ο παππούς του Μάρκου…»), «Έχει δίκιο;»
    // names who claims it
    const crowd = who.slice(0, 2).some(x => sc.intro.includes(x.Nom) || sc.intro.includes(x.nom)) || /(?:Η γιαγιά|Ο παππούς)/.test(sc.intro);
    const claimText = claim
      ? ` ${known(`${c.Nom} λέει ότι αυτό θα ξαναγίνει σε ${fmt(prod)} ${sc.unit}, γιατί ${ps.map(fmt).join(' × ')} = ${fmt(prod)}`)}. ${sought(`Έχει δίκιο${crowd ? ` ${c.nom}` : ''}`)};`
      : '';
    const [ask, ask2] = claim && sc.named ? sc.named : [sc.ask, sc.ask2];
    const story = `${sc.intro}${claimText} ${sought(r.chance(0.5) ? ask : ask2)};`;

    const steps: ProblemStep[] = [
      b.tag(undefined, claim
        ? `Αυτό που λέει ${c.nom} είναι κάτι που ξέρουμε: θα το ελέγξουμε. Ό,τι δεν αλλάζει την απάντηση δεν χρειάζεται.`
        : 'Ό,τι δεν αλλάζει την απάντηση δεν χρειάζεται.'),
    ];

    // The multiples of x before the Ε.Κ.Π., three at most: the list never reaches the answer («15, 30, …» for 45)
    const upTo = (x: number) => {
      const xs = [1, 2, 3].map(i => i * x).filter(v => v < L);
      return xs.length ? `${xs.map(fmt).join(', ')}, …` : `${fmt(x)} και τα πολλαπλάσιά του.`;
    };
    const plan = r.int(0, 2);
    if (plan === 0) {
      steps.push(b.choice('plan', 'Τι ψάχνουμε στην ουσία;', [`Το Ε.Κ.Π. των ${list(nums)}`, 'Το Ε.Κ.Π. τους'],
        [[`Το άθροισμα ${nums.join(' + ')}`, `Το άθροισμα των ${list(nums)}`, 'Το άθροισμά τους'], [`Έναν διαιρέτη των ${list(nums)}`, 'Έναν διαιρέτη τους'],
          [`Το ${fmt(big)}, τον μεγαλύτερο αριθμό`, `Το ${fmt(big)}, τον μεγαλύτερο`]],
        `Ξανασυμπίπτουν σε έναν αριθμό ${sc.unit === 'ημέρες' ? 'ημερών' : sc.unit === 'λεπτά' ? 'λεπτών' : 'δευτερολέπτων'} που είναι πολλαπλάσιο ${nums.map(n => `και του ${n}`).join(' ')}.`));
    } else if (plan === 1) {
      steps.push(b.choice('plan', 'Ποιο εργαλείο μας βοηθά περισσότερο;', `Ένας κατάλογος με τα πολλαπλάσια των ${list(nums)}`,
        [`Ένας κατάλογος με τους διαιρέτες των ${list(nums)}`, `Μια διαίρεση, ${fmt(big)} : ${fmt(ps[0])}, και κρατάω το πηλίκο`],
        `Γράφουμε πότε ξαναγίνεται το καθένα: ${upTo(ps[0])}`));
    } else {
      steps.push(b.order('plan', 'Βάζουμε σε σειρά το σχέδιό μας.', [
        `Γράφω τα πολλαπλάσια του μεγαλύτερου αριθμού, του ${fmt(big)}`,
        `Ελέγχω ποιο από αυτά διαιρείται και ${others}`,
        'Το πρώτο που διαιρείται είναι το Ε.Κ.Π.',
        `Απαντώ σε ${sc.unit}`,
      ], 'Ξεκινάμε από τον μεγαλύτερο αριθμό: τα πολλαπλάσιά του είναι λιγότερα ως το Ε.Κ.Π.'));
    }

    const k = L / big;
    if (k <= 4 && r.chance(0.5)) {
      const rows = [];
      for (let i = 2; i <= k; i++) rows.push({ label: `${fmt(big)} × ${i} =`, answer: big * i });
      rows.push({ label: `Το πρώτο που διαιρείται και ${others}`, answer: L, unit: sc.unit });
      steps.push(b.numbers('solve', `Γράφουμε τα πολλαπλάσια του ${fmt(big)}.`, rows,
        `Παίρνουμε τα πολλαπλάσια του ${fmt(big)} ένα ένα: διαιρείται ${others}; Αν όχι, πάμε στο επόμενο.`));
    } else if (r.chance(0.5)) {
      steps.push(b.numbers('solve', 'Λύνουμε.', [{ label: `Ε.Κ.Π. των ${list(nums)}`, answer: L, unit: sc.unit }],
        `Πολλαπλάσια του ${fmt(big)}: ${upTo(big)} Ποιο διαιρείται πρώτο και ${others};`));
    } else {
      steps.push(b.numbers('solve', 'Λύνουμε και βλέπουμε πόσες φορές ξαναγίνεται το καθένα ως τότε.', [
        { label: `Ε.Κ.Π. των ${list(nums)}`, answer: L, unit: sc.unit },
        // (the Ε.Κ.Π. is the row above: named, not written)
        ...ps.map((p, i) => ({ label: `${sc.each[i]} ως τότε: Ε.Κ.Π. : ${fmt(p)} =`, answer: L / p })),
      ], `Πολλαπλάσια του ${fmt(big)}: ${upTo(big)} Ποιο διαιρείται πρώτο και ${others};`));
    }

    if (claim) {
      // What is wrong in the claim, not «Έχει δίκιο;» (#83): it is always wrong, so «Όχι» was always right
      steps.push(b.choice('check', `Τι έκανε λάθος ${c.nom};`, `Συμπίπτουν νωρίτερα, στο ${fmt(L)}`,
        ['Κανένα λάθος: τους πολλαπλασιάζουμε', `Έπρεπε να προσθέσει ${nums.join(' + ')} = ${fmt(sum)}`],
        `Συμπίπτουν και στο ${fmt(prod)}, αλλά μήπως συμπίπτουν νωρίτερα;`));
    } else if (r.chance(0.5)) {
      steps.push(b.choice('check', 'Αναστοχαζόμαστε: τι δείχνει ότι η απάντηση είναι σωστή;',
        // The right one is the whole of it: divides by each, and the smallest such. Beside it the
        // greatest for the smallest (Μ.Κ.Δ. for Ε.Κ.Π.), half of it (true of every common multiple), and
        // a true one beside the point (bigger than each)
        `Είναι το μικρότερο που διαιρείται με ${list(nums.map(n => `το ${n}`))}`,
        [`Είναι το μεγαλύτερο που διαιρείται με ${list(nums.map(n => `το ${n}`))}`, `Διαιρείται με ${list(nums.map(n => `το ${n}`))}`,
          `Είναι μεγαλύτερο από ${list(nums.map(n => `το ${n}`))}`],
        'Το Ε.Κ.Π. διαιρείται ακριβώς με καθέναν από τους αριθμούς, και είναι το μικρότερο τέτοιο.'));
    } else {
      steps.push(b.numbers('check', `Αναστοχαζόμαστε: διαιρείται το ${fmt(L)} ακριβώς με καθέναν από τους αριθμούς;`,
        ps.map(p => ({ label: `${fmt(L)} : ${fmt(p)} =`, answer: L / p }))));
    }
    return { title: sc.title, story, steps };
  },
};
