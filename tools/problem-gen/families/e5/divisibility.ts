// Can n pupils, flowers or cards be split exactly into groups of 2, 3, 5, 9 or 10? The
// divisibility criteria; the missing digit; the remainder when it doesn't split (Ε΄ κεφ.
// 2.11 «Κριτήρια διαιρετότητας»: ο ανθοπώλης με τα 4.32□ κυκλάμινα).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, count, extra, fmt, known, sought, thing, type Family, type Rng, type Thing } from '../../lib.ts';

const digits = (n: number) => String(n).split('').map(Number);
const digitSum = (n: number) => digits(n).reduce((x, y) => x + y, 0);
const KS = [2, 3, 5, 9, 10];

interface Setting {
  title: string[];
  item: Thing;
  /** "ομάδες", "ανθοδέσμες" */
  groups: string;
  /** "ομάδες των 3" read as "groups of 3" in the options */
  of: (k: number) => string;
  /** Opening, with the number (a known phrase) and a noise phrase */
  open: (n: string, noise: string) => string;
  /** "θέλει να τα βάλει σε ανθοδέσμες με ίσο αριθμό" */
  split: string;
  /** "Μπορεί να τις βάλει|σε ": the verb, and the preposition before each "πακέτα των 9" */
  can: string;
  /** "Σκέφτεται" / "Σκέφτονται" */
  thinks: string;
  /** "Θα φτιάξει" + "ανθοδέσμες των 9" */
  will: string;
  noise: (r: Rng) => string;
  range: [number, number];
}

const SETTINGS: Setting[] = [
  {
    title: ['Ο ανθοπώλης', 'Τα κυκλάμινα'], item: thing('κυκλάμινο', 'κυκλάμινα', 'n'), groups: 'ανθοδέσμες',
    of: k => `ανθοδέσμες των ${k}`, range: [1000, 9999],
    open: (n, noise) => `Ένας ανθοπώλης, ${noise}, έχει ${n}.`,
    split: 'Θέλει να φτιάξει ανθοδέσμες με ίσο αριθμό κυκλάμινων',
    can: 'Μπορεί να φτιάξει|', thinks: 'Σκέφτεται', will: 'Θα φτιάξει',
    noise: r => extra(`που ανοίγει στις ${r.int(7, 9)} το πρωί`),
  },
  {
    title: ['Οι αγώνες του δήμου', 'Οι ομάδες'], item: thing('μαθητής', 'μαθητές', 'm'), groups: 'ομάδες',
    of: k => `ομάδες των ${k}`, range: [300, 2999],
    open: (n, noise) => `Στους αγώνες του δήμου ήρθαν ${n} ${noise}.`,
    split: 'Οι οργανωτές θέλουν να τους χωρίσουν σε ομάδες με ίσο αριθμό μαθητών',
    can: 'Οι οργανωτές μπορούν να τους χωρίσουν|σε ', thinks: 'Σκέφτονται', will: 'Θα τους χωρίσουν σε',
    noise: r => extra(`από ${r.int(8, 25)} σχολεία`),
  },
  {
    title: ['Οι κάρτες', 'Τα πακέτα με τις κάρτες'], item: thing('κάρτα', 'κάρτες', 'f'), groups: 'πακέτα',
    of: k => `πακέτα των ${k}`, range: [1000, 9999],
    open: (n, noise) => `Ένα τυπογραφείο, ${noise}, τύπωσε ${n} με ζώα.`,
    split: 'Θέλει να τις βάλει σε πακέτα με ίσο αριθμό καρτών',
    can: 'Μπορεί να τις βάλει|σε ', thinks: 'Σκέφτεται', will: 'Θα τις βάλει σε',
    noise: r => extra(`που έχει ${r.int(3, 9)} μηχανές`),
  },
  {
    title: ['Οι χάντρες', 'Τα βραχιόλια'], item: thing('χάντρα', 'χάντρες', 'f'), groups: 'σακουλάκια',
    of: k => `σακουλάκια των ${k}`, range: [300, 3999],
    open: (n, noise) => `Ένα κατάστημα με είδη χειροτεχνίας, ${noise}, έχει ${n}.`,
    split: 'Θέλει να τις βάλει σε σακουλάκια με ίσο αριθμό χαντρών',
    can: 'Μπορεί να τις βάλει|σε ', thinks: 'Σκέφτεται', will: 'Θα τις βάλει σε',
    noise: r => extra(`ανοιχτό ${r.int(5, 6)} ημέρες την εβδομάδα`),
  },
  {
    title: ['Οι επισκέπτες του μουσείου', 'Η ξενάγηση'], item: thing('επισκέπτης', 'επισκέπτες', 'm'), groups: 'ομάδες',
    of: k => `ομάδες των ${k}`, range: [200, 1999],
    open: (n, noise) => `Ένα μουσείο, ${noise}, περιμένει την Κυριακή ${n}.`,
    split: 'Θέλει να τους χωρίσει σε ομάδες ξενάγησης με ίσο αριθμό επισκεπτών',
    can: 'Μπορεί να τους χωρίσει|σε ', thinks: 'Σκέφτεται', will: 'Θα τους χωρίσει σε',
    noise: r => extra(`που έχει ${r.int(8, 30)} αίθουσες`),
  },
  {
    title: ['Τα κουλουράκια', 'Τα σακουλάκια του φούρνου'], item: thing('κουλουράκι', 'κουλουράκια', 'n'), groups: 'σακουλάκια',
    of: k => `σακουλάκια των ${k}`, range: [300, 2999],
    open: (n, noise) => `Ένας φούρνος, ${noise}, έψησε ${n}.`,
    split: 'Θέλει να τα βάλει σε σακουλάκια με ίσο αριθμό',
    can: 'Μπορεί να τα βάλει|σε ', thinks: 'Σκέφτεται', will: 'Θα τα βάλει σε',
    noise: r => extra(`που ανοίγει στις ${r.int(5, 7)} το πρωί`),
  },
];

const nobody = (t: Thing) => (t.g === 'f' ? 'καμία' : t.g === 'm' ? 'κανένας' : 'κανένα');
const list = (xs: string[]) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} και ${xs[xs.length - 1]}`);

/** "Σε ανθοδέσμες των 2, των 3 και των 9" */
function groupsText(s: Setting, ks: number[]): string {
  if (!ks.length) return fem(s) ? 'Σε καμία από αυτές' : 'Σε κανένα από αυτά';
  return `Σε ${s.groups} ${list(ks.map(k => `των ${k}`))}`;
}

// The two criteria, told the same way so that neither stands out: the right one names the number
// its criterion looks at, and she judges it
const bySum = (n: number) => `Γιατί το άθροισμα των ψηφίων του είναι ${digitSum(n)}`;
const byLast = (n: number) => `Γιατί το τελευταίο του ψηφίο είναι το ${n % 10}`;
const why = (n: number, k: number) => (k === 3 || k === 9 ? bySum(n) : byLast(n));

export const divisibility: Family = {
  id: 'divisibility',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, κεφ. 2.11 «Κριτήρια διαιρετότητας»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const it = s.item;
    const ask = r.pick(['which', 'digit', 'rest'] as const);
    const none = nobody(it);
    const steps: ProblemStep[] = [b.tag(undefined, 'Ό,τι δεν είναι ο αριθμός που μοιράζουμε ή οι ομάδες δεν χρειάζεται.')];
    const criteria = 'Με το 2: τελευταίο ψηφίο 0, 2, 4, 6, 8. Με το 5: 0 ή 5. Με το 10: 0. Με το 3 ή το 9: το άθροισμα των ψηφίων διαιρείται με το 3 ή το 9.';

    if (ask === 'digit') {
      // The last digit is missing: which digit makes the number divisible by all of these?
      const cond = r.pick([[9], [2, 9], [5, 9], [3, 5], [3, 10], [9, 10]]);
      const head = Math.floor(r.int(Math.max(1000, s.range[0]), s.range[1]) / 10);
      const fits = Array.from({ length: 10 }, (_, x) => x).filter(x => cond.every(k => (head * 10 + x) % k === 0));
      if (fits.length !== 1) return null;
      const x = fits[0], n = head * 10 + x, S = digitSum(head);
      const shown = `${fmt(head * 10).slice(0, -1)}□`;
      const [verb, prep] = s.can.split('|');
      const how = cond.length === 1 ? `${prep}${s.of(cond[0])}` : cond.map(k => `είτε ${prep}${s.of(k)}`).join(' ');
      const story = `${s.open(known(`${shown} ${it.many}`), s.noise(r))} Στη λίστα, όμως, το τελευταίο ψηφίο του αριθμού έχει σβηστεί. `
        + `Ξέρουμε ότι ${lower(verb)} ${known(how)}, χωρίς να περισσέψει ${none}. ${sought('Ποιο είναι το ψηφίο που λείπει')};`;
      const need39 = cond.includes(3) || cond.includes(9);
      // Conditions on the last digit first, then the one on the sum of the digits
      // One criterion: the sum of the digits, beside the product and the last digit (the same words, so
      // no option stands out); two: both criteria, beside one of them or just the last
      const [k1, k2] = cond;
      steps.push(cond.length === 1
        ? b.choice('plan', 'Τι πρέπει να ισχύει για τον αριθμό;', `Το άθροισμα των ψηφίων να διαιρείται με το ${k1}`,
          [`Το γινόμενο των ψηφίων να διαιρείται με το ${k1}`, `Το τελευταίο ψηφίο να διαιρείται με το ${k1}`], criteria)
        : b.choice('plan', 'Τι πρέπει να ισχύει για τον αριθμό;', `Να ισχύουν τα κριτήρια και του ${k1} και του ${k2}`,
          [`Να ισχύει ένα από τα κριτήρια, του ${k1} ή του ${k2}`, `Να ισχύει μόνο το κριτήριο του ${k2}`, `Να διαιρείται το πρώτο ψηφίο με το ${k2}`],
          criteria));
      if (need39) {
        steps.push(b.numbers('solve', 'Προσθέτουμε τα ψηφία που φαίνονται.', [{ label: `${digits(head).join(' + ')} =`, answer: S }]));
      }
      steps.push(b.numbers('solve', 'Βρίσκουμε το ψηφίο.', [{ label: 'Το ψηφίο που λείπει', answer: x }],
        need39 ? `Στο ${S} προσθέτουμε το ψηφίο που λείπει: δοκιμάζουμε τα ψηφία από το 0 ως το 9.` : 'Δοκιμάζουμε τα ψηφία από το 0 ως το 9.'));
      steps.push(b.numbers('check', `Αναστοχαζόμαστε: διαιρείται το ${fmt(n)} ακριβώς;`,
        cond.slice(-2).map(k => ({ label: `${fmt(n)} : ${k} =`, answer: n / k }))));
      return { title: r.pick(s.title), story, steps };
    }

    const n = r.int(...s.range);
    const ds = digits(n), last = ds[ds.length - 1], sum = digitSum(n);
    if (ask === 'which') {
      const divs = KS.filter(k => n % k === 0);
      if (!divs.length || divs.length > 3) return null;
      const options = `${s.of(2)}, των 3, των 5, των 9 ή των 10`;
      const story = `${s.open(known(count(n, it, true)), s.noise(r))} ${s.split}, χωρίς να περισσέψει ${none}. `
        + `${s.thinks} ${known(options)}. ${sought(fem(s) ? 'Ποιες από αυτές γίνονται' : 'Ποια από αυτά γίνονται')};`;
      // The sum's row is named only: its digits would show the last one, the row above's answer. (The draw
      // that chose between the two labels stays, so the problems after it stay the same.)
      r.chance(0.5);
      steps.push(b.numbers('solve', `Κοιτάμε τον αριθμό ${fmt(n)}.`, [
        { label: 'Το τελευταίο ψηφίο του', answer: last },
        { label: 'Το άθροισμα των ψηφίων του', answer: sum },
      ], `Το τελευταίο ψηφίο είναι το πιο δεξί του ${fmt(n)}. Μετά προσθέτουμε τα ψηφία ένα ένα, από τα αριστερά.`));
      // One with as many as the right one (one swapped for another), then lists one longer (from a
      // single one) or one shorter (from three): a list of one beside lists of two, or of three beside
      // two, stands out by its length, so two of the right one's size are swapped instead
      const others = KS.filter(k => !divs.includes(k));
      const sorted = (t: number[]) => [...t].sort((x, y) => x - y);
      const swaps = divs.flatMap(d => others.map(k => sorted([...divs.filter(x => x !== d), k])));
      const wrongs = new Set<string>([groupsText(s, r.pick(swaps))]);
      const more = divs.length === 1 ? others.map(k => sorted([...divs, k])) : divs.length === 3 ? divs.map(k => divs.filter(d => d !== k)) : swaps;
      for (const t of r.shuffle(more)) {
        wrongs.add(groupsText(s, t));
        if (wrongs.size === 3) break;
      }
      steps.push(b.choice('solve', `${fem(s) ? 'Ποιες' : 'Ποια'} γίνονται, χωρίς να περισσέψει ${none};`, groupsText(s, divs), [...wrongs], criteria));
      const notK = r.pick(KS.filter(k => !divs.includes(k)));
      steps.push(b.choice('check', `Αναστοχαζόμαστε: γιατί δεν γίνονται ${s.of(notK)};`, why(n, notK),
        // the other criterion, and two that are true of every number but beside the point
        [notK === 9 || notK === 3 ? byLast(n) : bySum(n), `Γιατί ο αριθμός αυτός έχει ${ds.length} ψηφία`, `Γιατί το πρώτο ψηφίο του αριθμού είναι το ${ds[0]}`],
        `Το κριτήριο για το ${notK}: ${notK === 3 || notK === 9 ? 'το άθροισμα των ψηφίων' : 'το τελευταίο ψηφίο'}.`));
      return { title: r.pick(s.title), story, steps };
    }

    // "rest": the remainder, from the criterion
    const k = r.pick([3, 9, 5, 10, 2]);
    const rem = n % k;
    if (rem === 0) return null;
    const q = Math.floor(n / k);
    const story = `${s.open(known(count(n, it, true)), s.noise(r))} ${known(`${s.will} ${s.of(k)}`)}. `
      + `${sought(`${cap(howManyNom(it))} ${it.many} θα περισσέψουν`)};`;
    const sumRule = k === 3 || k === 9;
    steps.push(b.choice('plan', 'Πώς βρίσκουμε γρήγορα αν θα περισσέψουν;',
      sumRule ? 'Από το άθροισμα των ψηφίων' : 'Από το τελευταίο ψηφίο',
      [sumRule ? ['Από το τελευταίο ψηφίο', 'Από το τελευταίο'] : ['Από το άθροισμα των ψηφίων', 'Από το άθροισμα'],
        ['Από το πρώτο ψηφίο', 'Από το πρώτο ψηφίο αριστερά', 'Από το πρώτο'], ['Από το πλήθος των ψηφίων του', 'Από το πλήθος των ψηφίων', 'Από πόσα ψηφία έχει']],
      criteria));
    steps.push(b.numbers('solve', 'Λύνουμε.', [
      sumRule ? { label: `Άθροισμα ψηφίων: ${ds.join(' + ')} =`, answer: sum } : { label: 'Τελευταίο ψηφίο', answer: last },
      { label: `${cap(it.many)} που περισσεύουν`, answer: rem },
    ], sumRule ? `Ό,τι περισσεύει από το άθροισμα των ψηφίων στη διαίρεση με το ${k}, περισσεύει και από το ${fmt(n)}.`
      : `Κοιτάμε το τελευταίο ψηφίο του ${fmt(n)}: ό,τι περισσεύει από αυτό στη διαίρεση με το ${k}, περισσεύει και από το ${fmt(n)}.`));
    steps.push(b.numbers('check', 'Αναστοχαζόμαστε: επαληθεύουμε με την Ευκλείδεια διαίρεση.', [
      { label: `${cap(s.groups)} (πηλίκο της διαίρεσης ${fmt(n)} : ${k})`, answer: q },
      { label: `${k} × πηλίκο + ${rem} =`, answer: n },
      // (the second row's answer is the story's number, so rowsHint, which can't tell, would name none)
    ], `Πόσες φορές χωράει το ${k} στο ${fmt(n)}; Μετά: Δ = δ × π + υ.`));
    return { title: r.pick(s.title), story, steps };
  },
};

const lower = (t: string) => t[0].toLowerCase() + t.slice(1);
const howManyNom = (t: Thing) => (t.g === 'f' ? 'πόσες' : t.g === 'm' ? 'πόσοι' : 'πόσα');

/** Are the groups feminine (ομάδες, ανθοδέσμες) or neuter (πακέτα, σακουλάκια)? */
function fem(s: Setting): boolean {
  return /ες$/.test(s.groups);
}
