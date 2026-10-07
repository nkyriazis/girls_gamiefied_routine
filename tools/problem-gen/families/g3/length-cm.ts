// Lengths in metres and centimetres, 1 μέτρο = 100 εκατοστά: pieces cut from a ribbon,
// how many pieces fit, heights and jumps (Γ΄ κεφ. 8 «Μέτρηση μηκών με εκατοστά και χιλιοστά»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { extra, fmt, known, people, sought, type Family, type Person, type Rng } from '../../lib.ts';

const m = (n: number) => (n === 1 ? '1 μέτρο' : `${n} μέτρα`);
/** 215 → "2 μέτρα και 15 εκατοστά" */
const mcm = (cm: number) => `${m(Math.floor(cm / 100))} και ${cm % 100} εκατοστά`;
const CM = 'εκατοστά';

interface Roll { what: string; the: string; for: string; fit?: string; noise: (r: Rng) => string }
const ROLLS: Roll[] = [
  { what: 'μια κορδέλα', the: 'η κορδέλα', for: 'για να τυλίξει δώρα', fit: 'για να κάνει μικρούς φιόγκους', noise: r => `Η κορδέλα κόστισε ${extra(`${r.int(2, 5)} ευρώ`)}.` },
  { what: 'ένα σκοινί', the: 'το σκοινί', for: 'για να φτιάξει μια κούνια', noise: r => `Το δέντρο στον κήπο είναι ${extra(`${r.int(20, 40)} χρονών`)}.` },
  { what: 'ένα κορδόνι', the: 'το κορδόνι', for: 'για να φτιάξει βραχιόλια', fit: 'για να δέσει σακουλάκια με κουφέτα', noise: r => `Στο κουτί με τις χάντρες υπάρχουν ${extra(`${r.int(20, 60)} χάντρες`)}.` },
  { what: 'ένα κομμάτι ύφασμα', the: 'το ύφασμα', for: 'για να ράψει κουρτίνες για το κουκλόσπιτο', fit: 'για να ράψει μαξιλαράκια για τις κούκλες', noise: r => `Το κουκλόσπιτο έχει ${extra(`${r.int(3, 6)} δωμάτια`)}.` },
  { what: 'μια χάρτινη ταινία', the: 'η χάρτινη ταινία', for: 'για να στολίσει την τάξη', fit: 'για να φτιάξει σημαιάκια', noise: r => `Η γιορτή είναι στις ${extra(`${r.int(10, 12)} το πρωί`)}.` },
];

export const lengthCm: Family = {
  id: 'length-cm',
  grade: 3,
  unit: 2,
  source: 'Μαθηματικά Γ΄, κεφ. 8 «Μέτρηση μηκών με εκατοστά και χιλιοστά»',
  make(r, b) {
    const [p, q] = people(r, 2);
    const kind = r.pick(['cut', 'cut', 'fit', 'height', 'jump'] as const);
    if (kind === 'cut') return cut(r, b, p);
    if (kind === 'fit') return fit(r, b, p);
    if (kind === 'height') return height(r, b, p, q);
    return jump(r, b, p, q);
  },
};

type B = Parameters<Family['make']>[1];

// A ribbon of 1–3 metres, two pieces cut off: how much is left?
function cut(r: Rng, b: B, p: Person) {
  const roll = r.pick(ROLLS);
  const metres = r.int(1, 3);
  const total = metres * 100;
  const a = r.int(15, Math.floor(total * 0.45));
  const c = r.int(12, Math.floor(total * 0.4));
  const left = total - a - c;
  if (left < 8) return null;
  const story = r.pick([
    () => `${p.Nom} έχει ${roll.what} με μήκος ${known(m(metres))} ${roll.for}. Κόβει ένα κομμάτι ${known(`${a} εκατοστά`)} και ένα άλλο ${known(`${c} εκατοστά`)}. ${roll.noise(r)} ${sought(`Πόσα εκατοστά έμειναν`)};`,
    () => `${p.Nom} αγόρασε ${roll.what} με μήκος ${known(m(metres))}. Χρειάζεται ${known(`${a} εκατοστά`)} και ${known(`${c} εκατοστά`)} ${roll.for}. ${roll.noise(r)} ${sought(`Πόσα εκατοστά θα ${p.his} περισσέψουν`)};`,
    () => `${Cap(roll.the)} ${p.gen} έχει μήκος ${known(m(metres))}. Κόβει ${known(`${a} εκατοστά`)} και μετά άλλα ${known(`${c} εκατοστά`)}. ${roll.noise(r)} ${sought(`Πόσο μήκος έχει τώρα ${roll.the}`)};`,
  ])();
  const steps: ProblemStep[] = [b.tag(undefined, 'Χρειαζόμαστε όλο το μήκος και τα κομμάτια που κόβει.')];
  const style = r.int(0, 2);
  if (style === 0) {
    steps.push(b.numbers('plan', 'Πρώτα κάνουμε τα μέτρα εκατοστά.', [{ label: `${m(metres)} =`, answer: total, unit: CM }],
      '1 μέτρο = 100 εκατοστά.'));
    steps.push(b.numbers('solve', 'Λύνουμε.', [
      { label: `${fmt(total)} − ${a} =`, answer: total - a, unit: CM },
      { label: `${fmt(total - a)} − ${c} =`, answer: left, unit: CM },
    ], 'Βγάζουμε το ένα κομμάτι και μετά το άλλο.'));
  } else if (style === 1) {
    steps.push(b.choice('plan', 'Τι κάνουμε πρώτα;', 'Κάνουμε τα μέτρα εκατοστά',
      [`Αφαιρούμε τα εκατοστά από το ${metres}`, 'Προσθέτουμε όλα μαζί'],
      `Δεν αφαιρούμε εκατοστά από μέτρα. ${m(metres)} δεν είναι ${metres} εκατοστά αλλά ${fmt(total)}.`));
    steps.push(b.numbers('solve', 'Λύνουμε.', [
      { label: 'Όλο το μήκος', answer: total, unit: CM },
      { label: 'Τα δύο κομμάτια μαζί', answer: a + c, unit: CM },
      { label: 'Έμειναν', answer: left, unit: CM },
    ], `1 μέτρο = 100 εκατοστά. Μετά: ${a} + ${c} = ${a + c}.`));
  } else {
    steps.push(b.numbers('solve', 'Λύνουμε.', [
      { label: `${m(metres)} =`, answer: total, unit: CM },
      { label: `${a} + ${c} =`, answer: a + c, unit: CM },
      { label: `${fmt(total)} − ${a + c} =`, answer: left, unit: CM },
    ], '1 μέτρο = 100 εκατοστά.'));
  }
  steps.push(b.choice('check', 'Πώς ελέγχουμε;', `${a} + ${c} + ${left} = ${fmt(total)}`,
    [`${a} + ${c} + ${left} = ${metres}`, `${fmt(total)} + ${a} + ${c} = ${fmt(total + a + c)}`],
    'Τα κομμάτια μαζί με ό,τι έμεινε κάνουν όλο το μήκος.'));
  return { title: r.pick(['Κόβουμε κομμάτια', 'Τι έμεινε;', 'Μέτρα και εκατοστά']), story, steps };
}

// How many pieces of k cm fit in L cm, and what is left
function fit(r: Rng, b: B, p: Person) {
  const roll = r.pick(ROLLS.filter(x => x.fit));
  const k = r.int(4, 10);
  const n = r.int(3, 10);
  const rest = r.chance(0.6) ? r.int(1, k - 1) : 0;
  const L = n * k + rest;
  if (L > 100 || L < 20) return null;
  const story = r.pick([
    () => `${p.Nom} έχει ${roll.what} με μήκος ${known(`${L} εκατοστά`)}. Κόβει κομμάτια των ${known(`${k} εκατοστών`)} ${roll.fit}. ${roll.noise(r)} ${sought('Πόσα κομμάτια θα κόψει')}; ${sought('Πόσα εκατοστά θα περισσέψουν')};`,
    () => `${p.Nom} θέλει κομμάτια από ${known(`${k} εκατοστά`)} το καθένα ${roll.fit}. ${Cap(roll.the)} ${p.his} έχει μήκος ${known(`${L} εκατοστά`)}. ${roll.noise(r)} ${sought('Πόσα κομμάτια θα βγάλει')}; ${sought('Πόσα εκατοστά θα μείνουν')};`,
  ])();
  const steps: ProblemStep[] = [b.tag(undefined, 'Χρειαζόμαστε όλο το μήκος και το μήκος κάθε κομματιού.')];
  steps.push(b.choice('plan', 'Ποια πράξη μας βοηθά;', `${L} : ${k}`, [`${L} − ${k}`, `${L} × ${k}`, `${L} + ${k}`].slice(0, r.int(2, 3)),
    `Πόσες φορές χωράει το ${k} στο ${L};`));
  steps.push(b.numbers('solve', 'Λύνουμε.', [
    { label: 'Κομμάτια', answer: n },
    { label: 'Εκατοστά που περισσεύουν', answer: rest },
  ], `${k} × ${n} = ${n * k}.${rest ? ` Πόσα μένουν ως το ${L};` : ''}`));
  steps.push(b.choice('check', 'Πώς ελέγχουμε;', rest ? `${n} × ${k} + ${rest} = ${L}` : `${n} × ${k} = ${L}`,
    rest ? [`${n} + ${k} + ${rest} = ${n + k + rest}`, `${n} × ${k} − ${rest} = ${n * k - rest}`] : [`${n} + ${k} = ${n + k}`, `${L} − ${k} = ${L - k}`],
    'Όλα τα κομμάτια μαζί, και ό,τι περισσεύει, κάνουν όλο το μήκος.'));
  return { title: r.pick(['Πόσα κομμάτια;', 'Κομματάκια', 'Κόβουμε ίσα κομμάτια']), story, steps };
}

// Heights: 1 metre and x cm, and someone taller or shorter
function height(r: Rng, b: B, p: Person, q: Person) {
  const hp = r.int(118, 140);
  const d = r.int(3, 15);
  const taller = r.chance(0.5);
  const hq = taller ? hp + d : hp - d;
  const age = r.int(8, 9);
  const noise = r.pick([`Στην τάξη είναι ${extra(`${r.int(18, 25)} παιδιά`)}.`, `Η μεζούρα της τάξης έχει μήκος ${extra(m(r.int(2, 3)))}.`, `Τα παιδιά είναι ${extra(`${age} χρονών`)}.`]);
  const rel = taller ? 'ψηλότερ' : 'κοντύτερ';
  const relQ = `${rel}${q.female ? 'η' : 'ος'}`;
  const story = r.pick([
    () => `Στο μάθημα μετρήσαμε το ύψος μας. ${p.Nom} έχει ύψος ${known(mcm(hp))}. ${q.Nom} είναι ${known(`${d} εκατοστά`)} ${relQ}. ${noise} ${sought(`Πόσα εκατοστά είναι το ύψος ${q.gen}`)};`,
    () => `${q.Nom} είναι ${known(`${d} εκατοστά`)} ${relQ} από ${p.acc}. ${noise} ${p.Nom} έχει ύψος ${known(mcm(hp))}. ${sought(`Πόσο ψηλ${q.female ? 'ή' : 'ός'} είναι ${q.nom} σε εκατοστά`)};`,
    () => `${noise} Το ύψος ${p.gen} είναι ${known(mcm(hp))}. ${q.Nom} είναι ${known(`${d} εκατοστά`)} ${relQ}. ${sought(`Πόσα εκατοστά είναι το ύψος ${q.gen}`)};`,
  ])();
  const steps: ProblemStep[] = [b.tag(undefined, 'Χρειαζόμαστε το ύψος του ενός και πόσο διαφέρει ο άλλος.')];
  if (r.chance(0.5)) {
    steps.push(b.choice('plan', `Αφού ${q.nom} είναι ${relQ}, το ύψος ${q.female ? 'της' : 'του'} θα είναι…`,
      taller ? `πάνω από ${fmt(hp)} εκατοστά` : `κάτω από ${fmt(hp)} εκατοστά`,
      [taller ? `κάτω από ${fmt(hp)} εκατοστά` : `πάνω από ${fmt(hp)} εκατοστά`, `ακριβώς ${fmt(hp)} εκατοστά`],
      taller ? 'Ψηλότερος σημαίνει περισσότερα εκατοστά.' : 'Κοντύτερος σημαίνει λιγότερα εκατοστά.'));
  }
  steps.push(b.numbers('solve', 'Λύνουμε.', [
    { label: `${mcm(hp)} =`, answer: hp, unit: CM },
    { label: taller ? `${fmt(hp)} + ${d} =` : `${fmt(hp)} − ${d} =`, answer: hq, unit: CM },
  ], '1 μέτρο = 100 εκατοστά.'));
  steps.push(b.choice('check', 'Πώς ελέγχουμε;', taller ? `${fmt(hq)} − ${d} = ${fmt(hp)}` : `${fmt(hq)} + ${d} = ${fmt(hp)}`,
    [taller ? `${fmt(hq)} + ${d} = ${fmt(hq + d)}` : `${fmt(hq)} − ${d} = ${fmt(hq - d)}`, `${hp % 100} + ${d} = ${hp % 100 + d}`],
    `Από το ύψος ${q.gen} γυρίζουμε στο ύψος ${p.gen}.`));
  return { title: r.pick(['Πόσο ψηλοί είμαστε;', 'Το ύψος μας', 'Μετράμε το ύψος']), story, steps };
}

// Long jump: two jumps in metres and cm, how many cm longer
function jump(r: Rng, b: B, p: Person, q: Person) {
  const jp = r.int(150, 240);
  const jq = r.int(130, jp - 4);
  if (jp % 100 < 2 || jq % 100 < 2) return null;
  const d = jp - jq;
  const noise = r.pick([`Ο αγώνας άρχισε στις ${extra(`${r.int(9, 11)} το πρωί`)}.`, `Στον αγώνα πήραν μέρος ${extra(`${r.int(12, 24)} παιδιά`)}.`, `Κάθε παιδί είχε ${extra(`${r.int(2, 3)} προσπάθειες`)}.`]);
  const story = r.pick([
    () => `Στον αγώνα άλματος εις μήκος του σχολείου, ${p.nom} πήδηξε ${known(mcm(jp))} και ${q.nom} ${known(mcm(jq))}. ${noise} ${sought(`Πόσα εκατοστά πιο μακριά πήδηξε ${p.nom}`)};`,
    () => `${noise} ${q.Nom} πήδηξε ${known(mcm(jq))} στο άλμα εις μήκος. ${p.Nom} πήδηξε ${known(mcm(jp))}. ${sought(`Πόσα εκατοστά πιο κοντά έπεσε ${q.nom}`)};`,
  ])();
  const steps: ProblemStep[] = [b.tag(undefined, 'Χρειαζόμαστε τα δύο άλματα.')];
  steps.push(b.numbers('solve', 'Κάνουμε τα άλματα εκατοστά και τα συγκρίνουμε.', [
    { label: `${p.Nom}: ${mcm(jp)} =`, answer: jp, unit: CM },
    { label: `${q.Nom}: ${mcm(jq)} =`, answer: jq, unit: CM },
    { label: `${fmt(jp)} − ${fmt(jq)} =`, answer: d, unit: CM },
  ], `${mcm(jp)}: ${m(Math.floor(jp / 100))} είναι ${Math.floor(jp / 100) * 100} εκατοστά, και ${jp % 100} ακόμα.`));
  steps.push(b.choice('check', 'Πώς ελέγχουμε;', `${fmt(jq)} + ${d} = ${fmt(jp)}`,
    [`${fmt(jp)} + ${fmt(jq)} = ${fmt(jp + jq)}`, `${fmt(jp)} + ${d} = ${fmt(jp + d)}`],
    'Στο μικρότερο άλμα προσθέτουμε τη διαφορά. Πρέπει να βρούμε το μεγαλύτερο.'));
  return { title: r.pick(['Άλμα εις μήκος', 'Ποιος πήδηξε πιο μακριά;', 'Στον αγώνα']), story, steps };
}

const Cap = (s: string) => s[0].toUpperCase() + s.slice(1);
