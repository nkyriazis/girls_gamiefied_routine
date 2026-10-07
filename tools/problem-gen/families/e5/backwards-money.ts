// Working backwards: spent some, then half of what was left, ... and ended with c: how
// much at first? (Ε΄ κεφ. 1.3, στρατηγική «Εργάζομαι αντίστροφα»; Επαναληπτικό 2, 2ο πρόβλημα).
import { extra, fmt, known, NO_MISTAKE, people, sought, STRATEGY, type Family, type Person } from '../../lib.ts';
import type { ProblemStep } from '../../../../shared/types.ts';

type Kind = 'minus' | 'plus' | 'half';
interface Op { kind: Kind; n: number; before: string }

/** One thing that happens: the phrase (with its number) and the name of the moment before it. */
interface Event { say: (n: string, p: Person) => string; before: string; /** the most it costs, when less than any amount */ max?: number }

interface Setting {
  title: string;
  unit: string;          // "€", "κουλούρια"
  start: [number, number];
  step: number;          // the numbers spent are multiples of this
  who: (p: Person) => string;
  minus: Event[];
  plus: Event;
  /** Half: as the first thing, or of what was left. */
  half: [(p: Person) => string, (p: Person) => string, (p: Person) => string];
  halfBefore: string;
  end: (c: string, p: Person) => string;
  ask: string;
  noise: (n: number) => string;
  wrongHalf: string;
}

const SETTINGS: Setting[] = [
  {
    title: 'Τα χρήματα στο πανηγύρι', unit: '€', start: [30, 160], step: 1,
    who: p => `${p.Nom} πήγε στο πανηγύρι του χωριού με τα χρήματα του κουμπαρά ${p.his}.`,
    minus: [
      { say: n => `αγόρασε ένα βιβλίο των ${n} €`, before: 'Πριν από το βιβλίο' },
      { say: n => `έδωσε ${n} € για ένα βραχιόλι`, before: 'Πριν από το βραχιόλι' },
      { say: n => `πλήρωσε ${n} € για λουκουμάδες`, before: 'Πριν από τους λουκουμάδες', max: 15 },
    ],
    plus: { say: (n, p) => `πήρε ${n} € από τη γιαγιά ${p.his}`, before: 'Πριν από τα χρήματα της γιαγιάς' },
    half: [p => `ξόδεψε τα μισά χρήματά ${p.his} σε παιχνίδια`, p => `ξόδεψε σε παιχνίδια τα μισά από όσα ${p.his} είχαν μείνει`, () => 'ξόδεψε σε παιχνίδια τα μισά από όσα είχε τότε'],
    halfBefore: 'Πριν από τα παιχνίδια',
    end: (c, p) => `Έτσι ${p.his} έμειναν ${c} €`,
    ask: 'Πόσα € είχε στην αρχή',
    noise: n => `Στο πανηγύρι υπήρχαν ${n * 5 + 20} πάγκοι`,
    wrongHalf: 'Πήρε τα μισά, αντί να τα διπλασιάσει',
  },
  {
    title: 'Τα κουλούρια του φούρνου', unit: 'κουλούρια', start: [120, 480], step: 5,
    who: () => 'Ένας φούρνος έψησε ένα πρωί κουλούρια.',
    minus: [
      { say: n => `πούλησε ${n} κουλούρια σε ένα σχολείο`, before: 'Πριν από το σχολείο' },
      { say: n => `έδωσε ${n} κουλούρια σε ένα κατάστημα`, before: 'Πριν από το κατάστημα' },
      { say: n => `πούλησε ${n} κουλούρια το απόγευμα`, before: 'Πριν από το απόγευμα' },
    ],
    plus: { say: n => `έψησε άλλα ${n} κουλούρια`, before: 'Πριν ψήσει τα καινούργια' },
    half: [() => 'πούλησε τα μισά κουλούρια', () => 'πούλησε τα μισά από όσα είχαν μείνει', () => 'πούλησε τα μισά από όσα είχε τότε'],
    halfBefore: 'Πριν πουλήσει τα μισά',
    end: c => `Το βράδυ είχαν μείνει ${c} κουλούρια`,
    ask: 'Πόσα κουλούρια έψησε ο φούρνος το πρωί',
    noise: n => `Ο φούρνος έχει ${Math.min(n, 4)} υπαλλήλους`,
    wrongHalf: 'Πήρε τα μισά, αντί να τα διπλασιάσει',
  },
  {
    title: 'Στη λαϊκή αγορά', unit: '€', start: [40, 140], step: 1,
    who: p => `Η γιαγιά ${p.gen} πήγε στη λαϊκή αγορά.`,
    minus: [
      { say: n => `ξόδεψε ${n} € για φρούτα`, before: 'Πριν από τα φρούτα' },
      { say: n => `πλήρωσε ${n} € για λουλούδια`, before: 'Πριν από τα λουλούδια' },
      { say: n => `έδωσε ${n} € για αυγά`, before: 'Πριν από τα αυγά', max: 10 },
    ],
    plus: { say: n => `πήρε πίσω ${n} € από μια φίλη της που της χρωστούσε`, before: 'Πριν πάρει πίσω τα χρήματα' },
    half: [() => 'έδωσε τα μισά χρήματά της για ψάρια', () => 'έδωσε για ψάρια τα μισά από όσα της είχαν μείνει', () => 'έδωσε για ψάρια τα μισά από όσα είχε τότε'],
    halfBefore: 'Πριν από τα ψάρια',
    end: c => `Γύρισε στο σπίτι με ${c} €`,
    ask: 'Πόσα € είχε η γιαγιά όταν ξεκίνησε',
    noise: n => `Η λαϊκή έχει ${n * 10 + 30} πάγκους`,
    wrongHalf: 'Πήρε τα μισά, αντί να τα διπλασιάσει',
  },
  {
    title: 'Οι κάρτες της συλλογής', unit: 'κάρτες', start: [60, 300], step: 1,
    who: p => `${p.Nom} έχει μια συλλογή με κάρτες ποδοσφαιριστών.`,
    minus: [
      { say: (n, p) => `έδωσε ${n} κάρτες σε μια φίλη ${p.his}`, before: 'Πριν από τη φίλη' },
      { say: n => `έχασε ${n} κάρτες στο σχολείο`, before: 'Πριν χάσει τις κάρτες' },
      { say: (n, p) => `χάρισε ${n} κάρτες στον ξάδερφό ${p.his}`, before: 'Πριν από τον ξάδερφο' },
    ],
    plus: { say: n => `αγόρασε ένα φακελάκι με ${n} κάρτες`, before: 'Πριν από το φακελάκι' },
    half: [p => `έδωσε τις μισές κάρτες ${p.his} στον αδερφό ${p.his}`, p => `έδωσε στον αδερφό ${p.his} τις μισές από όσες ${p.his} είχαν μείνει`, p => `έδωσε στον αδερφό ${p.his} τις μισές από όσες είχε τότε`],
    halfBefore: 'Πριν από τον αδερφό',
    end: c => `Τώρα έχει ${c} κάρτες`,
    ask: 'Πόσες κάρτες είχε στην αρχή',
    noise: n => `Οι κάρτες είναι από ${n + 5} ομάδες`,
    wrongHalf: 'Πήρε τις μισές, αντί να τις διπλασιάσει',
  },
];

const CHAINS: Kind[][] = [['minus', 'half'], ['half', 'minus'], ['minus', 'half', 'minus'], ['plus', 'half', 'minus'], ['minus', 'half', 'plus']];

export const backwardsMoney: Family = {
  id: 'backwards-money',
  grade: 5,
  unit: 1,
  source: 'Μαθηματικά Ε΄, κεφ. 1.3 «Πώς λύνουμε ένα πρόβλημα» (στρατηγική «Εργάζομαι αντίστροφα»)',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const [p] = people(r, 1);
    const chain = r.pick(CHAINS);
    if (s.unit === 'κουλούρια' && chain[0] === 'plus') return null; // "Πρώτα έψησε άλλα" reads badly
    const minus = r.shuffle(s.minus);
    // Build forward from the start, so every step is a whole number
    const start = r.int(...s.start);
    const ops: Op[] = [];
    const phrases: string[] = [];
    const values = [start];
    let x = start;
    for (const [i, k] of chain.entries()) {
      if (k === 'half') {
        if (x % 2) return null;
        x /= 2;
        ops.push({ kind: k, n: 2, before: s.halfBefore });
        phrases.push(s.half[i === 0 ? 0 : chain[i - 1] === 'plus' ? 2 : 1](p));
      } else {
        const n = r.int(3, s.step === 5 ? 14 : 25) * s.step;
        const ev = k === 'plus' ? s.plus : minus.pop()!;
        if (k === 'minus') { if (n >= x || n > (ev.max ?? n)) return null; x -= n; } else x += n;
        ops.push({ kind: k, n, before: ev.before });
        phrases.push(ev.say(fmt(n), p));
      }
      values.push(x);
    }
    const c = x;
    if (c < 3) return null;

    const lead = (i: number) => i === 0 ? 'Πρώτα ' : i === phrases.length - 1 ? (phrases.length === 2 ? 'και μετά ' : 'και στο τέλος ') : 'μετά ';
    const body = phrases.map((t, i) => known(`${lead(i)}${t}`)).join(', ').replace(/, (\[και )/, ' $1');
    const noise = extra(s.noise(r.int(2, 9)));
    const end = known(s.end(fmt(c), p));
    const t = r.int(0, 2);
    const story = t === 0
      ? `${s.who(p)} ${body}. ${end}. ${noise}. ${sought(s.ask)};`
      : t === 1
        ? `${s.who(p)} ${noise}. ${body}. ${end}. ${sought(s.ask)};`
        : `${sought(s.ask)}; ${s.who(p)} ${body}. ${end}. ${noise}.`;

    // Going back: undo the last step first
    const show = r.chance(0.5);
    const back = [];
    for (let i = ops.length - 1; i >= 0; i--) {
      const op = ops[i];
      // The row above is «ό,τι βρήκαμε», never its number; the end is the story's
      const after = i === ops.length - 1 ? fmt(values[i + 1]) : 'ό,τι βρήκαμε';
      const how = op.kind === 'half' ? `${after} × 2` : op.kind === 'minus' ? `${after} + ${fmt(op.n)}` : `${after} − ${fmt(op.n)}`;
      const name = i === 0 ? 'Στην αρχή' : op.before;
      back.push({ label: show ? `${name}: ${how} =` : name, answer: values[i], unit: s.unit });
    }

    const naive = ops.reduce((acc, op) => op.kind === 'minus' ? acc + op.n : op.kind === 'plus' ? acc - op.n : acc, c);
    const halfBack = ops.reduceRight((acc, op) => op.kind === 'half' ? acc / 2 : op.kind === 'minus' ? acc + op.n : acc - op.n, c);
    const steps: ProblemStep[] = [b.tag(undefined, 'Ξέρουμε το τέλος και όλα όσα έγιναν. Ό,τι δεν αλλάζει τους αριθμούς το αφήνουμε.')];
    if (r.chance(0.6)) {
      steps.push(b.choice('plan', 'Ποια στρατηγική ταιριάζει;', STRATEGY.backwards,
        // (never the number the naive sum gives: it is the first step's answer)
        [STRATEGY.pattern, naive > 0 && naive !== start ? ['Κάνω με τη σειρά τις πράξεις της ιστορίας', 'Κάνω τις πράξεις με τη σειρά']
          : ['Προσθέτω όλους τους αριθμούς της ιστορίας', 'Προσθέτω τους αριθμούς']],
        'Ξέρουμε μόνο πόσα έμειναν στο τέλος. Από εκεί γυρίζουμε πίσω, κάνοντας κάθε φορά το αντίθετο.'));
    }
    steps.push(b.numbers('solve', 'Πηγαίνουμε αντίστροφα, από το τέλος προς την αρχή.', back,
      'Το αντίθετο του «τα μισά» είναι το διπλάσιο. Ό,τι έφυγε το ξαναπροσθέτουμε και ό,τι ήρθε το αφαιρούμε.'));
    const fwd = ops.map((op, i) => ({
      label: op.kind === 'half' ? `${fmt(values[i])} : 2 =` : op.kind === 'minus' ? `${fmt(values[i])} − ${fmt(op.n)} =` : `${fmt(values[i])} + ${fmt(op.n)} =`,
      answer: values[i + 1],
    }));
    steps.push(r.chance(0.6) || !Number.isInteger(halfBack) || halfBack <= 0 || halfBack === start
      ? b.numbers('check', `Πώς ελέγχουμε; Ξαναπαίζουμε την ιστορία από την αρχή, με ${fmt(start)}.`, fwd,
        `Στο τέλος πρέπει να βρούμε ${fmt(c)}.`)
      : b.choice('check', `Κάποιος απάντησε «${fmt(halfBack)}». Τι έκανε λάθος;`, s.wrongHalf,
        [['Κανένα λάθος, η απάντηση είναι σωστή', ...NO_MISTAKE], ['Ξεκίνησε από την αρχή αντί από το τέλος', 'Ξεκίνησε από την αρχή']],
        'Όταν πηγαίνουμε πίσω, κάνουμε το αντίθετο κάθε βήματος.'));
    return { title: s.title, story, steps };
  },
};
