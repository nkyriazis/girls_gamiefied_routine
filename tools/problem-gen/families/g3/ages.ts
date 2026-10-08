// Ages in a family: the sum, the difference, and what happens in k years: both grow by
// k, so the sum grows by 2k and the difference stays (Γ΄ κεφ. 13 «Επαναληπτικό μάθημα»,
// 5 «Συγκρίνω τις ηλικίες»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, extra, known, PEOPLE, sought, type Family } from '../../lib.ts';

interface Rel {
  nom: string; // "η μαμά"
  gen: string; // "της μαμάς"
  f: boolean;
  gap: [number, number]; // years older (or younger, for a sibling)
  sibling?: boolean;
}

const RELS: Rel[] = [
  { nom: 'η μαμά', gen: 'της μαμάς', f: true, gap: [24, 38] },
  { nom: 'ο μπαμπάς', gen: 'του μπαμπά', f: false, gap: [26, 42] },
  { nom: 'η γιαγιά', gen: 'της γιαγιάς', f: true, gap: [50, 64] },
  { nom: 'ο παππούς', gen: 'του παππού', f: false, gap: [52, 66] },
  { nom: 'ο θείος', gen: 'του θείου', f: false, gap: [18, 30] },
  { nom: 'ο αδερφός', gen: 'του αδερφού', f: false, gap: [2, 7], sibling: true },
  { nom: 'η αδερφή', gen: 'της αδερφής', f: true, gap: [2, 7], sibling: true },
  { nom: 'η ξαδέρφη', gen: 'της ξαδέρφης', f: true, gap: [2, 6], sibling: true },
];

const MONTHS = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου',
  'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];

export const ages: Family = {
  id: 'ages',
  grade: 3,
  unit: 2,
  source: 'Μαθηματικά Γ΄, κεφ. 13 «Επαναληπτικό μάθημα» («Συγκρίνω τις ηλικίες») και κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών»',
  make(r, b) {
    const p = r.pick(PEOPLE);
    const rel = r.pick(RELS);
    const a = r.int(7, 12);
    const gap = r.int(...rel.gap);
    const older = !rel.sibling || r.chance(0.5);
    const c = older ? a + gap : a - gap; // the relative's age
    if (c < 2 || c > 80) return null;
    const k = r.int(2, 9);
    const big = Math.max(a, c), small = Math.min(a, c);
    const adj = older ? (rel.f ? 'μεγαλύτερη' : 'μεγαλύτερος') : (rel.f ? 'μικρότερη' : 'μικρότερος');
    const R = `${rel.nom} ${p.his}`; // "η μαμά της"

    const tail = r.pick([
      ` και έχει ύψος ${extra(`${115 + 5 * (a - 7) + r.int(-5, 5)} εκατοστά`)}.`,
      ` και ζυγίζει ${extra(`${23 + 3 * (a - 7) + r.int(-2, 3)} κιλά`)}.`,
      `. Γεννήθηκε στις ${extra(`${r.int(2, 28)} ${r.pick(MONTHS)}`)}.`,
      `. Στην τάξη ${p.his} είναι ${extra(`${r.int(17, 25)} παιδιά`)}.`,
    ]);
    const kid = `${p.Nom} είναι ${known(`${a} χρονών`)}${tail}`;
    const title = r.pick(['Οι ηλικίες', 'Πόσων χρονών;', 'Η οικογένεια', 'Μεγαλώνουμε']);
    const kind = r.pick(['diff', 'diff', 'sum', 'gap', 'born'] as const);
    const steps: ProblemStep[] = [];

    if (kind === 'gap') {
      // The relative's age from the gap, then in k years
      const story = `${kid} ${cap(R)} είναι ${known(`${gap} χρόνια ${adj}`)}. `
        + `${sought(`Πόσων χρονών είναι ${R}`)}; ${sought(`Πόσων χρονών θα είναι σε ${k} χρόνια`)};`;
      steps.push(b.tag(undefined, 'Χρειαζόμαστε μόνο τους αριθμούς που μιλούν για χρόνια.'));
      if (r.chance(0.6)) {
        steps.push(b.choice('plan', `Πώς βρίσκουμε την ηλικία ${rel.gen} ${p.his};`,
          older ? `${a} + ${gap}` : `${a} − ${gap}`,
          [older ? `${a} − ${gap}` : `${a} + ${gap}`, `${a} × ${gap}`].filter(o => !o.startsWith(`${a} − `) || a > gap),
          older ? `Αφού είναι ${adj}, έχει περισσότερα χρόνια από ${p.acc}.` : `Αφού είναι ${adj}, έχει λιγότερα χρόνια από ${p.acc}.`));
      }
      const ops = r.chance(0.5);
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        { label: ops ? (older ? `${a} + ${gap} =` : `${a} − ${gap} =`) : `${cap(R)} τώρα`, answer: c, unit: 'χρονών' },
        { label: ops ? `${c} + ${k} =` : `${cap(R)} σε ${k} χρόνια`, answer: c + k, unit: 'χρονών' },
      ], `Πρώτα η ηλικία τώρα. Σε ${k} χρόνια θα έχει ${k} χρόνια παραπάνω.`));
      steps.push(b.choice('check', 'Πώς ελέγχουμε;', `${big} − ${small} = ${gap}`,
        [`${a} + ${c} = ${a + c}`, older ? `${a} − ${gap} = ${a - gap}` : `${a} + ${gap} = ${a + gap}`].filter(o => !o.endsWith(` = ${gap}`) && !o.includes('-')),
        `Η διαφορά των δύο ηλικιών πρέπει να είναι ${gap}.`));
      return { title, story, steps };
    }

    const cSentence = `${cap(R)} είναι ${known(`${c} χρονών`)}.`;
    if (kind === 'sum') {
      const sum = a + c;
      const story = `${kid} ${cSentence} ${sought('Πόσα χρόνια κάνουν μαζί οι ηλικίες τους')}; ${sought(`Πόσα θα κάνουν σε ${k} χρόνια`)};`;
      steps.push(b.tag(undefined, 'Χρειαζόμαστε μόνο τους αριθμούς που είναι ηλικίες.'));
      steps.push(b.numbers('solve', 'Πόσα χρόνια κάνουν μαζί τώρα;', [
        { label: r.chance(0.5) ? `${a} + ${c} =` : 'Μαζί τώρα', answer: sum, unit: 'χρόνια', eq: `${a} + ${c}` },
      ]));
      const shown = r.chance(0.5);
      steps.push(b.choice('solve', `Πόσα θα κάνουν μαζί σε ${k} χρόνια;`, `${sum + 2 * k}, μεγαλώνουν και οι δύο`,
        [`${sum + k}, περνούν ${k} χρόνια`, `${sum}, οι ηλικίες δεν αλλάζουν`],
        // (the ages in k years are the next step's rows: the hint never works them out)
        shown ? `Σε ${k} χρόνια, ${p.nom} θα έχει ${k} χρόνια παραπάνω, και ${R} το ίδιο.` : `Σε ${k} χρόνια θα έχει μεγαλώσει ο καθένας ${k} χρόνια.`));
      if (!shown || r.chance(0.5)) {
        steps.push(b.numbers('check', 'Ελέγχουμε με τις ηλικίες σε λίγα χρόνια.', [
          { label: `${cap(p.nom)} σε ${k} χρόνια`, answer: a + k, unit: 'χρονών', eq: `${a} + ${k}` },
          { label: `${cap(R)} σε ${k} χρόνια`, answer: c + k, unit: 'χρονών', eq: `${c} + ${k}` },
          { label: `Μαζί σε ${k} χρόνια`, answer: sum + 2 * k, unit: 'χρόνια', eq: `${a + k} + ${c + k}` },
        ]));
      }
      return { title, story, steps };
    }

    const d = big - small;
    if (kind === 'born') {
      // How old the older one was when the younger was born: the difference
      const [o, y] = older ? [R, p.nom] : [p.nom, R];
      const story = `${kid} ${cSentence} ${sought(`Πόσων χρονών ήταν ${o} όταν γεννήθηκε ${y}`)};`;
      steps.push(b.tag(undefined, 'Χρειαζόμαστε μόνο τους αριθμούς που είναι ηλικίες.'));
      steps.push(b.choice('plan', 'Ποια πράξη μας βοηθά;', `${big} − ${small}`, [`${big} + ${small}`],
        `Όταν γεννήθηκε ${y}, ${o} είχε ήδη τόσα χρόνια όσα είναι η διαφορά τους.`));
      steps.push(b.numbers('solve', 'Λύνουμε.', [{ label: r.chance(0.5) ? `${big} − ${small} =` : 'Ήταν', answer: d, unit: 'χρονών', eq: `${big} − ${small}` }]));
      // What happens to it, not «Θα αλλάξει;» (#83): its verdict is always «Όχι», alone beside two «Ναι»
      steps.push(b.choice('check', `Τι γίνεται με τη διαφορά των ${d} χρόνων όταν μεγαλώσουν;`, 'Μένει ίδια',
        ['Μεγαλώνει', 'Μικραίνει'],
        `Σε ${k} χρόνια: ${big} + ${k} = ${big + k} και ${small} + ${k} = ${small + k}. Πόση είναι τότε η διαφορά;`));
      return { title, story, steps };
    }

    // The difference now, and in k years
    const ask2 = r.pick([`Πόσα χρόνια ${adj} θα είναι σε ${k} χρόνια`, `Πόση θα είναι η διαφορά τους σε ${k} χρόνια`]);
    const story = `${kid} ${cSentence} ${sought(`Πόσα χρόνια ${adj} είναι ${R} από ${p.acc}`)}; ${sought(ask2)};`;
    steps.push(b.tag(undefined, 'Χρειαζόμαστε μόνο τους αριθμούς που είναι ηλικίες.'));
    steps.push(b.numbers('solve', 'Πόση είναι η διαφορά τους τώρα;', [
      { label: r.chance(0.5) ? `${big} − ${small} =` : 'Διαφορά τώρα', answer: d, unit: 'χρόνια' },
    ], 'Από τη μεγαλύτερη ηλικία βγάζουμε τη μικρότερη.'));
    const future = r.chance(0.5);
    if (future) {
      steps.push(b.numbers('solve', `Πόσων χρονών θα είναι σε ${k} χρόνια;`, [
        { label: cap(p.nom), answer: a + k, unit: 'χρονών', eq: `${a} + ${k}` },
        { label: cap(R), answer: c + k, unit: 'χρονών', eq: `${c} + ${k}` },
      ]));
    }
    steps.push(b.choice('check', `Πόση θα είναι η διαφορά τους σε ${k} χρόνια;`, `${d} χρόνια, μεγαλώνουν και οι δύο`,
      // (or, with no room to shrink, both ages' years added: as long as the right one)
      [`${d + k} χρόνια, γιατί περνούν ${k} χρόνια`, d - k >= 2 ? `${d - k} χρόνια, η διαφορά μικραίνει` : `${d + 2 * k} χρόνια, μεγαλώνουν και οι δύο`],
      future ? `${big + k} − ${small + k} = ${d}` : 'Σε μερικά χρόνια θα έχουν μεγαλώσει και οι δύο το ίδιο.'));
    return { title, story, steps };
  },
};
