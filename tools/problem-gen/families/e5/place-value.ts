// Puzzles with digits and place value: the largest and the smallest number made with given
// digits and their difference or sum; a number told by its places («3ΔΕ 6ΕΧ 3ΔΧ 9Μ»)
// (Ε΄ κεφ. 1.5 «Αξία θέσης ψηφίου», 1.6 «Σύγκριση και διάταξη», Επαναληπτικό 1).
import { extra, fmt, known, people, sought, type Builder, type Family, type Person, type Rng } from '../../lib.ts';
import type { ProblemStep } from '../../../../shared/types.ts';

const toNum = (ds: number[]) => Number(ds.join(''));
const listDigits = (ds: number[]) => `${ds.slice(0, -1).join(', ')} και ${ds[ds.length - 1]}`;
const WORD: Record<number, string> = { 4: 'τετραψήφιο', 5: 'πενταψήφιο', 6: 'εξαψήφιο' };
const WORD_GEN: Record<number, string> = { 4: 'τετραψήφιου', 5: 'πενταψήφιου', 6: 'εξαψήφιου' };
const WORD_NOM: Record<number, string> = { 4: 'τετραψήφιος', 5: 'πενταψήφιος', 6: 'εξαψήφιος' };

// The largest and the smallest number with these digits, each used once
function digits(r: Rng, b: Builder, p: Person): { title: string; story: string; steps: ProblemStep[] } | null {
  const k = r.int(5, 6);
  const withZero = r.chance(0.6);
  const ds = r.sample(withZero ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9], k);
  if (withZero && !ds.includes(0)) ds[r.int(1, k - 1)] = 0;
  if (new Set(ds).size !== k) return null;
  const desc = [...ds].sort((x, y) => y - x);
  const asc = [...ds].sort((x, y) => x - y);
  // The smallest: the smallest digit that isn't 0 first, then the rest in order
  const firstNZ = asc.find(d => d !== 0)!;
  const small = [firstNZ, ...asc.filter((d, i) => i !== asc.indexOf(firstNZ))];
  const L = toNum(desc), S = toNum(small);
  const add = r.chance(0.35) && L + S <= 999_999;
  const res = add ? L + S : L - S;
  const word = WORD[k], wordGen = WORD_GEN[k];
  const ask = add ? `Πόσο είναι το άθροισμα του μεγαλύτερου και του μικρότερου ${wordGen} αριθμού` : `Πόση είναι η διαφορά του μεγαλύτερου και του μικρότερου ${wordGen} αριθμού`;
  const t = r.int(0, 2);
  const story = t === 0
    ? `${p.Nom} έχει ${known(`${k} κάρτες με τα ψηφία ${listDigits(ds)}`)}. Φτιάχνει αριθμούς ${known('με όλες τις κάρτες, από μία φορά την καθεμία')}. ${extra(`Παίζει με ${r.int(2, 4)} φίλους ${p.his}`)}. ${sought(`${ask} που μπορεί να φτιάξει`)};`
    : t === 1
      ? `Ένα ξενοδοχείο, ${extra(`με ${r.int(20, 90)} δωμάτια`)}, έχει ένα χρηματοκιβώτιο με δύο κωδικούς. Ο πρώτος είναι ο μεγαλύτερος ${WORD_NOM[k]} αριθμός που γράφεται ${known(`με τα ψηφία ${listDigits(ds)}`)}, ${known('το καθένα μία φορά')}. Ο δεύτερος είναι ο μικρότερος τέτοιος αριθμός. ${sought(add ? 'Πόσο κάνουν μαζί οι δύο κωδικοί' : 'Πόσο μεγαλύτερος είναι ο πρώτος κωδικός από τον δεύτερο')};`
      : `Στο κυνήγι θησαυρού της τάξης, ${extra(`με ${r.int(4, 6)} ομάδες`)}, το σημείωμα γράφει: «Πάρτε ${known(`τα ψηφία ${listDigits(ds)}`)} και φτιάξτε ${known(`τον μεγαλύτερο και τον μικρότερο ${word} αριθμό`)}, ${known('με κάθε ψηφίο μία φορά')}». ${sought(add ? 'Ποιο είναι το άθροισμά τους' : 'Ποια είναι η διαφορά τους')};`;
  const steps: ProblemStep[] = [b.tag(undefined, 'Χρειαζόμαστε τα ψηφία και τον κανόνα με τον οποίο τα βάζουμε. Ό,τι δεν αλλάζει τους αριθμούς το αφήνουμε.')];
  if (r.chance(0.4)) {
    steps.push(b.choice('plan', 'Πώς φτιάχνουμε τον μεγαλύτερο αριθμό;', 'Βάζουμε τα ψηφία από το μεγαλύτερο προς το μικρότερο',
      ['Βάζουμε τα ψηφία με τη σειρά που τα λέει η ιστορία', 'Βάζουμε τα ψηφία από το μικρότερο προς το μεγαλύτερο'],
      'Το πιο αριστερό ψηφίο έχει τη μεγαλύτερη αξία.'));
  }
  const zeroFirst = toNum(asc); // "01.368" is a smaller number with fewer digits
  const zeroEnd = toNum([...small.filter(d => d !== 0), ...small.filter(d => d === 0)]); // the 0 pushed to the end
  if (withZero && r.chance(0.5)) {
    steps.push(b.numbers('solve', 'Ο μεγαλύτερος αριθμός', [{ label: `Ο μεγαλύτερος ${WORD_NOM[k]}`, answer: L }],
      'Από το μεγαλύτερο ψηφίο προς το μικρότερο.'));
    const swapped = toNum([small[0], small[2], small[1], ...small.slice(3)]);
    steps.push(b.choice('solve', `Ποιος είναι ο μικρότερος ${WORD_NOM[k]};`, fmt(S),
      [fmt(zeroFirst), ...(swapped !== S ? [fmt(swapped)] : []), fmt(zeroEnd)]
        .filter((x, i, xs) => x !== fmt(S) && xs.indexOf(x) === i).slice(0, 3),
      `Το 0 δεν μπορεί να είναι το πρώτο ψηφίο: τότε ο αριθμός δεν θα ήταν ${WORD_NOM[k]}.`));
  } else {
    steps.push(b.numbers('solve', 'Φτιάχνουμε τους δύο αριθμούς.', [
      { label: `Ο μεγαλύτερος ${WORD_NOM[k]}`, answer: L },
      { label: `Ο μικρότερος ${WORD_NOM[k]}`, answer: S },
    ], withZero ? `Για τον μικρότερο: από το μικρότερο ψηφίο προς το μεγαλύτερο, αλλά το 0 δεν μπαίνει πρώτο.` : 'Για τον μικρότερο: από το μικρότερο ψηφίο προς το μεγαλύτερο.'));
  }
  steps.push(b.numbers('solve', 'Λύνουμε.', [
    { label: r.chance(0.5) ? `${fmt(L)} ${add ? '+' : '−'} ${fmt(S)} =` : add ? 'Άθροισμα' : 'Διαφορά', answer: res },
  ], add ? 'Προσθέτουμε θέση προς θέση και προσέχουμε τα κρατούμενα.' : 'Αφαιρούμε θέση προς θέση και προσέχουμε τα δανεικά.'));
  if (steps.length < 5) {
    steps.push(b.numbers('check', add ? 'Πώς ελέγχουμε; Από το άθροισμα βγάζουμε τον μικρότερο αριθμό.' : 'Πώς ελέγχουμε; Στη διαφορά προσθέτουμε τον μικρότερο αριθμό.', [
      { label: add ? `${fmt(res)} − ${fmt(S)} =` : `${fmt(res)} + ${fmt(S)} =`, answer: L },
    ], `Πρέπει να βρούμε τον μεγαλύτερο αριθμό, το ${fmt(L)}.`));
  }
  return { title: ['Οι κάρτες με τα ψηφία', 'Ο κωδικός του χρηματοκιβωτίου', 'Το κυνήγι θησαυρού'][t], story, steps };
}

// A number told by its places: "2 ΔΧ, 5 Μ, 8 ΕΧ και 3 Ε"
const PLACE = [
  { abbr: 'Μ', v: 1, pack: ['μολύβι μόνο του', 'μολύβια μόνα τους'] },
  { abbr: 'Δ', v: 10, pack: ['πακέτο των 10 μολυβιών', 'πακέτα των 10 μολυβιών'] },
  { abbr: 'Ε', v: 100, pack: ['κουτί των 100 μολυβιών', 'κουτιά των 100 μολυβιών'] },
  { abbr: 'ΜΧ', v: 1_000, pack: ['κιβώτιο των 1.000 μολυβιών', 'κιβώτια των 1.000 μολυβιών'] },
  { abbr: 'ΔΧ', v: 10_000, pack: ['παλέτα των 10.000 μολυβιών', 'παλέτες των 10.000 μολυβιών'] },
  { abbr: 'ΕΧ', v: 100_000, pack: ['', ''] },
];
const ABBR = 'Μ = μονάδες, Δ = δεκάδες, Ε = εκατοντάδες, ΜΧ = μονάδες χιλιάδων, ΔΧ = δεκάδες χιλιάδων, ΕΧ = εκατοντάδες χιλιάδων.';

function places(r: Rng, b: Builder, p: Person): { title: string; story: string; steps: ProblemStep[] } | null {
  const pack = r.chance(0.35);
  const k = pack ? 5 : r.int(5, 6);
  // Digits from the top place down; one or two zeros below the top
  const ds = Array.from({ length: k }, (_, i) => (i === 0 ? r.int(1, 9) : r.int(1, 9)));
  const zeros = r.sample([...Array(k - 1).keys()].map(i => i + 1), r.int(1, 2));
  for (const z of zeros) ds[z] = 0;
  const N = toNum(ds);
  const parts = ds.map((d, i) => ({ d, place: PLACE[k - 1 - i] })).filter(x => x.d !== 0);
  const shown = r.chance(0.6) ? r.shuffle(parts) : parts;
  let story: string;
  let title = 'Η αποθήκη με τα μολύβια';
  if (pack) {
    const phrase = (x: (typeof parts)[number]) => `${x.d} ${x.place.pack[x.d === 1 ? 0 : 1]}`;
    const list = parts.map(x => known(phrase(x)));
    const text = list.length > 1 ? `${list.slice(0, -1).join(', ')} και ${list[list.length - 1]}` : list[0];
    story = `Ένα εργοστάσιο, ${extra(`με ${r.int(20, 80)} εργάτες`)}, συσκευάζει μολύβια. Στην αποθήκη του έχει ${text}. ${sought('Πόσα μολύβια έχει στην αποθήκη')};`;
  } else {
    const list = shown.map(x => known(`${x.d} ${x.place.abbr}`)).join(', ').replace(/, ([^,]*)$/, ' και $1');
    const t = r.int(0, 2);
    title = ['Ο λαχνός', 'Ο αριθμός στον πίνακα', 'Ο κωδικός του ποδηλάτου'][t];
    story = t === 0
      ? `Ο λαχνός που κέρδισε στη μεγάλη λαχειοφόρο αγορά της πόλης έχει ${list}. ${known('Τα άλλα ψηφία του είναι 0')}. ${extra(`Η κλήρωση έγινε στις ${r.int(5, 7)} το απόγευμα`)}. ${sought('Ποιος είναι ο αριθμός του λαχνού')};`
      : t === 1
        ? `Η δασκάλα έγραψε στον πίνακα έναν ${WORD[k]} αριθμό με ${list}. ${known('Στις άλλες θέσεις έχει 0')}. ${p.Nom} ${extra(`τον βρήκε σε ${r.int(2, 5)} λεπτά`)}. ${sought('Ποιος είναι ο αριθμός')};`
        : `${p.Nom} θέλει να θυμάται τον κωδικό του ποδηλάτου ${p.his}, που είναι ${known(`${WORD_NOM[k]} αριθμός`)}. Γράφει: ${list}, ${known('και 0 σε όσες θέσεις λείπουν')}. ${extra(`Το ποδήλατο έχει ${r.pick([18, 21, 24])} ταχύτητες`)}. ${sought('Ποιος είναι ο κωδικός')};`;
  }
  const inOrder = toNum(shown.map(x => x.d));
  const noZeros = toNum(parts.map(x => x.d));
  // The 0 one place off: a digit in the wrong place
  const mv = [...ds];
  const zi = zeros[0], zj = zi + 1 < k ? zi + 1 : zi - 1;
  [mv[zi], mv[zj]] = [mv[zj], mv[zi]];
  const moved = toNum(mv);
  const steps: ProblemStep[] = [b.tag(undefined, pack ? 'Κάθε συσκευασία είναι μια θέση του αριθμού. Ό,τι δεν αλλάζει το πλήθος το αφήνουμε.' : `Χρειαζόμαστε τα ψηφία και τις θέσεις τους. ${ABBR}`)];
  if (r.chance(0.4)) {
    steps.push(b.choice('plan', pack ? 'Τι γράφουμε στη θέση μιας συσκευασίας που δεν υπάρχει;' : 'Τι γράφουμε στις θέσεις που δεν αναφέρονται;', '0',
      ['Τις παραλείπουμε', '1'], 'Μια θέση χωρίς τίποτα δεν χάνεται: κρατάει τη θέση της με το 0.'));
  }
  if (pack) {
    steps.push(b.numbers('solve', 'Πόσα μολύβια έχει κάθε είδος συσκευασίας;', [
      ...parts.filter(x => x.place.v > 1).map(x => ({ label: `${x.d} × ${fmt(x.place.v)} =`, answer: x.d * x.place.v })),
      { label: 'Όλα τα μολύβια', answer: N, unit: 'μολύβια' },
    ], 'Στο τέλος προσθέτουμε όλα τα μολύβια, και όσα είναι μόνα τους.'));
  } else if (r.chance(0.5)) {
    steps.push(b.choice('solve', 'Ποιος είναι ο αριθμός;', fmt(N),
      [fmt(noZeros), ...(inOrder !== noZeros && inOrder !== N ? [fmt(inOrder)] : []), fmt(moved), fmt(noZeros * 10)].filter((x, i, xs) => x !== fmt(N) && xs.indexOf(x) === i).slice(0, 3),
      `Γράφουμε κάθε ψηφίο στη θέση του, από τις ${PLACE[k - 1].abbr} ως τις Μ. ${ABBR}`));
  } else {
    steps.push(b.numbers('solve', 'Γράφουμε τον αριθμό.', [{ label: 'Ο αριθμός', answer: N }],
      `Γράφουμε κάθε ψηφίο στη θέση του, από τις ${PLACE[k - 1].abbr} ως τις Μ, και 0 όπου δεν έχει τίποτα.`));
  }
  const z = PLACE[k - 1 - zeros[0]];
  const top = PLACE[k - 1];
  steps.push(r.chance(0.5)
    ? b.numbers('check', 'Ελέγχουμε τον αριθμό μας, θέση προς θέση.', [
      { label: `Ψηφίο στις ${top.abbr}`, answer: ds[0] },
      { label: `Ψηφίο στις ${z.abbr}`, answer: 0 },
      { label: 'Πόσα ψηφία έχει', answer: k },
    ], ABBR)
    : b.numbers('check', `Ελέγχουμε: αναλύουμε τον αριθμό ${fmt(N)} σε άθροισμα.`, [
      { label: `${parts.map(x => fmt(x.d * x.place.v)).join(' + ')} =`, answer: N },
    ], 'Κάθε ψηφίο αξίζει όσο λέει η θέση του.'));
  return { title, story, steps };
}

export const placeValue: Family = {
  id: 'place-value',
  grade: 5,
  unit: 1,
  source: 'Μαθηματικά Ε΄, κεφ. 1.5 «Αξία θέσης ψηφίου στους φυσικούς αριθμούς» και 1.6 «Σύγκριση και διάταξη», Επαναληπτικό 1',
  make(r, b) {
    const [p] = people(r, 1);
    return r.chance(0.55) ? digits(r, b, p) : places(r, b, p);
  },
};
