// A story without numbers first: which question fits it? Then the same story with its
// numbers, to tag, solve and check (Γ΄ κεφ. 12 «Προβλήματα»; «προβλήματα χωρίς αριθμούς»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { count, extra, fmt, known, people, sought, thing, type Family, type Person, type Rng, type Thing, type Wording } from '../../lib.ts';

interface Tale {
  plain: string;        // the story without numbers
  story: string;        // with numbers and marks
  right: string;        // the question that fits
  wrongs: Wording[];    // questions that don't (in a few wordings each)
  a: number; b: number; op: '+' | '−';
  unit: string;
  plan: string;         // why this operation
  label: string;        // the answer row, when it doesn't show the operation
}

const some = (t: Thing) => (t.g === 'n' ? 'μερικά' : t.g === 'f' ? 'μερικές' : 'μερικούς');
const Many = (t: Thing, acc = true) => (t.g === 'n' ? 'Πόσα' : t.g === 'f' ? 'Πόσες' : acc ? 'Πόσους' : 'Πόσοι');
const more = (t: Thing) => (t.g === 'n' ? 'περισσότερα' : t.g === 'f' ? 'περισσότερες' : 'περισσότερους');
const him = (p: Person) => (p.female ? 'της' : 'του');

// 1. Someone gives someone more: join
function gift(r: Rng, p: Person, q: Person, noise: (present?: boolean) => string): Tale {
  const t = r.pick([thing('κάρτα', 'κάρτες', 'f'), thing('αυτοκόλλητο', 'αυτοκόλλητα', 'n'), thing('βόλος', 'βόλοι', 'm', 'βόλους'), thing('χάντρα', 'χάντρες', 'f')]);
  const a = r.int(15, 90), b = r.int(5, 40);
  const Q = `${Many(t)} ${t.manyAcc} έχει τώρα ${p.nom}`;
  return {
    plain: `${p.Nom} είχε ${some(t)} ${t.manyAcc}. ${q.Nom} ${him(p)} χάρισε ${some(t)} ακόμα.`,
    story: `${p.Nom} είχε ${known(count(a, t, true))}. ${q.Nom} ${him(p)} χάρισε ${known(`άλλ${t.g === 'n' ? 'α' : t.g === 'f' ? 'ες' : 'ους'} ${count(b, t, true)}`)}. ${noise()} ${sought(Q)};`,
    right: `${Q};`,
    wrongs: [[`${Many(t)} ${t.manyAcc} έχασε ${p.nom} στο παιχνίδι;`, `${Many(t)} ${t.manyAcc} έχασε ${p.nom};`],
      [`Πόσο κοστίζει ${t.g === 'n' ? 'ένα' : t.g === 'f' ? 'μία' : 'ένας'} ${t.one} στο περίπτερο;`, `Πόσο κοστίζει ${t.g === 'n' ? 'ένα' : t.g === 'f' ? 'μία' : 'ένας'} ${t.one};`],
      [`Πόσων χρονών είναι τώρα ${q.nom};`, `Πόσων χρονών είναι ${q.nom};`]],
    a, b, op: '+', unit: t.manyAcc, plan: 'Πήρε κι άλλα: τα έχει όλα μαζί.', label: 'Τώρα έχει',
  };
}

// 2. Some are sold or eaten: take away
function sold(r: Rng, _p: Person, _q: Person, noise: (present?: boolean) => string): Tale {
  const s = r.pick([
    { t: thing('κουλούρι', 'κουλούρια', 'n'), where: 'Στο ράφι του φούρνου', who: 'Ο φούρναρης', verb: 'πούλησε', shop: 'ο φούρνος' },
    { t: thing('τυρόπιτα', 'τυρόπιτες', 'f'), where: 'Στο κυλικείο του σχολείου', who: 'Η κυρία Ρούλα', verb: 'πούλησε', shop: 'το κυλικείο' },
    { t: thing('καρπούζι', 'καρπούζια', 'n'), where: 'Στον πάγκο της λαϊκής', who: 'Ο κύριος Μανώλης', verb: 'πούλησε', shop: 'η λαϊκή' },
    { t: thing('βάζο με μέλι', 'βάζα με μέλι', 'n'), where: 'Στο ράφι του μπακάλικου', who: 'Η κυρία Ελένη', verb: 'πούλησε', shop: 'το μπακάλικο' },
  ]);
  const t = s.t;
  const a = r.int(30, 150), b = r.int(8, a - 5);
  const Q = `${Many(t, false)} ${t.many} έμειναν ${s.where.replace(/^Σ/, 'σ')}`;
  return {
    plain: `${s.where} υπήρχαν ${some(t)} ${t.manyAcc}. ${s.who} ${s.verb} ${some(t)} από αυτά το πρωί.`.replace('μερικές από αυτά', 'μερικές από αυτές'),
    story: `${s.where} υπήρχαν ${known(count(a, t))}. ${s.who} ${s.verb} ${known(count(b, t, true))} το πρωί. ${noise()} ${sought(Q)};`,
    right: `${Q};`,
    wrongs: [[`${Many(t)} ${t.manyAcc} θα φέρουν αύριο ${s.where.replace(/^Σ/, 'σ')};`, `${Many(t)} ${t.manyAcc} θα φέρουν αύριο;`],
      [`Πόσο κοστίζει ${t.g === 'f' ? 'μία' : 'ένα'} ${t.one} ${s.where.replace(/^Σ/, 'σ')};`, `Πόσο κοστίζει ${t.g === 'f' ? 'μία' : 'ένα'} ${t.one};`],
      [`Τι ώρα ανοίγει ${s.shop} τις καθημερινές;`, `Τι ώρα ανοίγει ${s.shop};`]],
    a, b, op: '−', unit: t.many, plan: 'Κάποια έφυγαν: μένουν λιγότερα.', label: 'Έμειναν',
  };
}

// 3. Compare two amounts
function compare(r: Rng, p: Person, q: Person, noise: (present?: boolean) => string): Tale {
  const s = r.pick([
    { t: thing('σελίδα', 'σελίδες', 'f'), verb: 'διάβασε', pl: 'διάβασαν', tail: 'από ένα βιβλίο', at: 'από το βιβλίο' },
    { t: thing('πόντος', 'πόντοι', 'm', 'πόντους'), verb: 'μάζεψε', pl: 'μάζεψαν', tail: 'σε ένα ηλεκτρονικό παιχνίδι', at: 'στο παιχνίδι' },
    { t: thing('κοχύλι', 'κοχύλια', 'n'), verb: 'μάζεψε', pl: 'μάζεψαν', tail: 'στην παραλία', at: 'στην παραλία' },
    { t: thing('κάστανο', 'κάστανα', 'n'), verb: 'μάζεψε', pl: 'μάζεψαν', tail: 'στο δάσος', at: 'στο δάσος' },
  ]);
  const t = s.t;
  const b = r.int(20, 150), a = b + r.int(5, 60);
  const Q = `${Many(t)} ${more(t)} ${t.manyAcc} ${s.verb} ${q.nom} από ${p.acc}`;
  return {
    plain: `${p.Nom} ${s.verb} ${some(t)} ${t.manyAcc} ${s.tail}. ${q.Nom} ${s.verb} ${more(t)} από ${p.female ? 'αυτήν' : 'αυτόν'}.`,
    story: `${p.Nom} ${s.verb} ${known(count(b, t, true))} ${s.tail}. ${q.Nom} ${s.verb} ${known(count(a, t, true))}. ${noise()} ${sought(Q)};`,
    right: `${Q};`,
    // The comparison the other way round, both together (the usual slips), what the story already says
    wrongs: [`${Many(t)} ${more(t)} ${t.manyAcc} ${s.verb} ${p.nom} από ${q.acc};`, [`${Many(t)} ${t.manyAcc} ${s.pl} μαζί ${p.nom} και ${q.nom} ${s.at};`, `${Many(t)} ${t.manyAcc} ${s.pl} μαζί ${p.nom} και ${q.nom};`], `${Many(t)} ${t.manyAcc} ${s.verb} ${q.nom} ${s.tail} χθες;`],
    a, b, op: '−', unit: t.manyAcc, plan: 'Η διαφορά βρίσκεται με αφαίρεση.', label: 'Η διαφορά',
  };
}

// 4. A whole with two parts: find the other part
function parts(r: Rng, _p: Person, _q: Person, noise: (present?: boolean) => string): Tale {
  const s = r.pick([
    { whole: thing('παιδί', 'παιδιά', 'n'), x: 'αγόρια', y: thing('κορίτσι', 'κορίτσια', 'n'), where: 'Στο πούλμαν της εκδρομής', verb: 'κάθονται', place: 'στο πούλμαν',
      wrong: [['Πόσα παιδιά έχει όλο το σχολείο;', 'Πόσα παιδιά έχει το σχολείο;'], ['Πόσων χρονών είναι ο οδηγός του πούλμαν;', 'Πόσων χρονών είναι ο οδηγός;'], ['Πόσες ώρες κρατά το ταξίδι της εκδρομής;', 'Πόσες ώρες κρατά το ταξίδι;']] },
    { whole: thing('λουλούδι', 'λουλούδια', 'n'), x: 'τριαντάφυλλα', y: thing('μαργαρίτα', 'μαργαρίτες', 'f'), where: 'Στον κήπο της γιαγιάς', verb: 'υπάρχουν', place: 'στον κήπο',
      wrong: [['Πόσα λουλούδια έκοψε η γιαγιά για το βάζο;', 'Πόσα λουλούδια έκοψε η γιαγιά;'], ['Πόσων χρονών είναι η γιαγιά φέτος;', 'Πόσων χρονών είναι η γιαγιά;'], ['Τι χρώμα έχουν τα τριαντάφυλλα του κήπου;', 'Τι χρώμα έχουν τα τριαντάφυλλα;']] },
    { whole: thing('δέντρο', 'δέντρα', 'n'), x: 'ελιές', y: thing('λεμονιά', 'λεμονιές', 'f'), where: 'Στο κτήμα του παππού', verb: 'υπάρχουν', place: 'στο κτήμα',
      wrong: [['Πόσα κιλά λάδι βγάζει ο παππούς;', 'Πόσα κιλά λάδι βγάζει ο παππούς κάθε χρόνο;'], ['Πόσα δέντρα φύτεψε φέτος ο παππούς;', 'Πόσα δέντρα φύτεψε ο παππούς;'], ['Πόσο μεγάλο είναι το κτήμα του παππού;', 'Πόσο μεγάλο είναι το κτήμα;']] },
    { whole: thing('βιβλίο', 'βιβλία', 'n'), x: 'παραμύθια', y: thing('κόμικ', 'κόμικ', 'n'), where: 'Στη βιβλιοθήκη της τάξης', verb: 'υπάρχουν', place: 'στη βιβλιοθήκη',
      wrong: [['Πόσα βιβλία δανείστηκαν τα παιδιά της τάξης;', 'Πόσα βιβλία δανείστηκαν τα παιδιά;'], ['Πόσες σελίδες έχει κάθε παραμύθι;', 'Πόσες σελίδες έχει κάθε παραμύθι της τάξης;'], ['Πόσα ράφια έχει η βιβλιοθήκη;', 'Πόσα ράφια έχει η βιβλιοθήκη της τάξης;']] },
  ]);
  const a = r.int(30, 120), b = r.int(8, a - 8);
  const Q = `${Many(s.y, false)} ${s.y.many} ${s.verb} ${s.place}`;
  const rest = 'τα άλλα';
  return {
    plain: `${s.where} ${s.verb} ${some(s.whole)} ${s.whole.many}. Κάποια από αυτά είναι ${s.x} και ${rest} ${s.y.many}.`,
    story: `${s.where} ${s.verb} ${known(count(a, s.whole))}. Από αυτά, ${known(`τα ${fmt(b)}`)} είναι ${s.x} και ${rest} ${s.y.many}. ${noise(true)} ${sought(Q)};`,
    right: `${Q};`,
    wrongs: s.wrong,
    a, b, op: '−', unit: s.y.many, plan: 'Από όλα βγάζουμε το ένα μέρος. Μένει το άλλο.', label: s.y.many[0].toUpperCase() + s.y.many.slice(1),
  };
}

// 5. Money spent: what is left
function spend(r: Rng, p: Person, _q: Person, noise: (present?: boolean) => string): Tale {
  const item = r.pick([
    { acc: 'ένα βιβλίο', nom: 'το βιβλίο' }, { acc: 'μια μπάλα', nom: 'η μπάλα' },
    { acc: 'ένα παζλ', nom: 'το παζλ' }, { acc: 'μια κασετίνα', nom: 'η κασετίνα' },
  ]);
  const a = r.int(25, 99), b = r.int(6, a - 4);
  const Q = `Πόσα ευρώ ${p.his} έμειναν`;
  return {
    plain: `${p.Nom} είχε μερικά χρήματα στον κουμπαρά. Πήρε κάποια από αυτά και αγόρασε ${item.acc}.`,
    story: `${p.Nom} είχε ${known(`${fmt(a)} ευρώ`)} στον κουμπαρά. Πήρε ${known(`${b} ευρώ`)} από αυτά και αγόρασε ${item.acc}. ${noise()} ${sought(Q)};`,
    right: `${Q};`,
    wrongs: [[`Πόσα ευρώ κέρδισε ${p.nom};`, 'Πόσα ευρώ κέρδισε;'], ['Πού πήγε για ψώνια;', 'Σε ποιο μαγαζί πήγε;'], ['Πόσα ευρώ έχει στην τράπεζα;', 'Πόσα έχει στην τράπεζα;']],
    a, b, op: '−', unit: 'ευρώ', plan: 'Ξόδεψε χρήματα: μένουν λιγότερα.', label: 'Έμειναν',
  };
}

// 6. Two parts of a day: put together
function twoTimes(r: Rng, p: Person, _q: Person, noise: (present?: boolean) => string): Tale {
  const s = r.pick([
    { t: thing('κοχύλι', 'κοχύλια', 'n'), verb: 'μάζεψε', where: 'στην παραλία', wrong: ['Πόσες ώρες έμεινε στην παραλία;', 'Πόσες ώρες έμεινε εκεί;'] },
    { t: thing('σελίδα', 'σελίδες', 'f'), verb: 'διάβασε', where: 'από το βιβλίο του', wrong: ['Πόσες σελίδες έχει όλο το βιβλίο;', 'Πόσες σελίδες έχει το βιβλίο;'] },
    { t: thing('κάστανο', 'κάστανα', 'n'), verb: 'μάζεψε', where: 'στο δάσος', wrong: ['Πόσο μακριά από το σπίτι είναι το δάσος;', 'Πόσο μακριά είναι το δάσος;'] },
    { t: thing('λουλούδι', 'λουλούδια', 'n'), verb: 'φύτεψε', where: 'στον κήπο', wrong: ['Πόσο μεγάλος είναι ο κήπος του σπιτιού;', 'Πόσο μεγάλος είναι ο κήπος;'] },
  ]);
  const t = s.t;
  const where = s.where.replace('του', p.his);
  const a = r.int(12, 80), b = r.int(8, 60);
  const Q = `${Many(t)} ${t.manyAcc} ${s.verb} όλη τη μέρα`;
  return {
    plain: `Το πρωί ${p.nom} ${s.verb} ${some(t)} ${t.manyAcc} ${where}. Το απόγευμα ${s.verb} ${some(t)} ακόμα.`,
    story: `Το πρωί ${p.nom} ${s.verb} ${known(count(a, t, true))} ${where}. Το απόγευμα ${s.verb} ${known(`άλλ${t.g === 'n' ? 'α' : t.g === 'f' ? 'ες' : 'ους'} ${count(b, t, true)}`)}. ${noise()} ${sought(Q)};`,
    right: `${Q};`,
    wrongs: [[`${Many(t)} ${t.manyAcc} έχασε το βράδυ;`, `${Many(t)} ${t.manyAcc} έχασε το βράδυ στον δρόμο;`], s.wrong,
      [`${Many(t)} ${t.manyAcc} ${s.verb} το πρωί ${p.female ? 'η μαμά της' : 'η μαμά του'};`, `${Many(t)} ${t.manyAcc} ${s.verb} ${p.female ? 'η μαμά της' : 'η μαμά του'};`]],
    a, b, op: '+', unit: t.manyAcc, plan: 'Βάζουμε μαζί το πρωί και το απόγευμα.', label: 'Όλη τη μέρα',
  };
}

const TALES = [gift, sold, compare, parts, spend, twoTimes];

export const numberless: Family = {
  id: 'numberless',
  grade: 3,
  chapter: '12',
  topic: 'Αφαίρεση',
  source: 'Μαθηματικά Γ΄, κεφ. 12 «Προβλήματα»',
  make(r, b) {
    const [p, q] = people(r, 2);
    const n = r.int(0, 2), day = r.int(2, 28), deg = r.int(14, 30), sun = r.int(6, 8);
    const noise = (present = false) => [
      `${present ? 'Σήμερα είναι' : 'Ήταν'} ${extra(`${day} του μήνα`)}.`,
      `Το θερμόμετρο ${present ? 'δείχνει' : 'έδειχνε'} ${extra(`${deg} βαθμούς`)}.`,
      `Ο ήλιος ${present ? 'δύει' : 'έδυσε'} στις ${extra(`${sun} το απόγευμα`)}.`,
    ][n];
    const tale = r.pick(TALES)(r, p, q, noise);
    const { a, b: c, op } = tale;
    const answer = op === '+' ? a + c : a - c;
    if (answer <= 0) return null;
    const expr = `${fmt(a)} ${op} ${fmt(c)}`;
    const other = `${fmt(a)} ${op === '+' ? '−' : '+'} ${fmt(c)}`;

    const steps: ProblemStep[] = [
      b.choice('read', 'Διαβάζουμε την ιστορία χωρίς αριθμούς. Ποια ερώτηση ταιριάζει;', tale.right, r.sample(tale.wrongs, 2),
        'Ποια ερώτηση μπορούμε να απαντήσουμε με ό,τι λέει η ιστορία;', tale.plain),
      b.tag('Τώρα η ιστορία έχει αριθμούς. Τι ξέρουμε και τι ψάχνουμε;', 'Ποιοι αριθμοί χρειάζονται για την ερώτηση;'),
    ];
    const plan = r.chance(0.6);
    if (plan) {
      steps.push(b.choice('plan', 'Ποια πράξη μας βοηθά;', expr, [other, `${fmt(a)} × ${fmt(c)}`].slice(0, r.int(1, 2)), tale.plan));
    }
    steps.push(b.numbers('solve', 'Λύνουμε.', [{ label: plan && r.chance(0.5) ? tale.label : `${expr} =`, answer, unit: tale.unit, eq: expr }]));
    steps.push(op === '+'
      ? b.choice('check', 'Πώς ελέγχουμε;', `${fmt(answer)} − ${fmt(c)} = ${fmt(a)}`,
        // a sum that checks nothing, and the two numbers of the story taken apart (shorter: the right one isn't)
        [`${fmt(answer)} + ${fmt(c)} = ${fmt(answer + c)}`, a !== c ? `${fmt(Math.max(a, c))} − ${fmt(Math.min(a, c))} = ${fmt(Math.abs(a - c))}` : `${fmt(a)} + ${fmt(answer)} = ${fmt(a + answer)}`],
        'Αν βγάλουμε όσα προσθέσαμε, πρέπει να βρούμε όσα ήταν στην αρχή.')
      : b.choice('check', 'Πώς ελέγχουμε;', `${fmt(answer)} + ${fmt(c)} = ${fmt(a)}`,
        [`${fmt(a)} + ${fmt(c)} = ${fmt(a + c)}`, answer !== c ? `${fmt(Math.max(answer, c))} − ${fmt(Math.min(answer, c))} = ${fmt(Math.abs(answer - c))}` : `${fmt(answer)} + ${fmt(a)} = ${fmt(answer + a)}`],
        'Αν ξαναβάλουμε όσα βγάλαμε, πρέπει να βρούμε τον μεγαλύτερο αριθμό.'));
    return { title: r.pick(['Χωρίς αριθμούς', 'Πρώτα η ιστορία', 'Ποια ερώτηση;', 'Διαβάζω και καταλαβαίνω']), story: tale.story, steps };
  },
};
