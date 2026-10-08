// Coins: which coins make an amount («τρία νομίσματα συνολικής αξίας 72 λεπτών»), and how
// much a handful of coins is worth (Γ΄ κεφ. 12 «Προβλήματα» 3 και κεφ. 13 «Επαναληπτικό
// μάθημα» 6: «νομίσματα μόνο των 20 λεπτών»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, extra, known, PEOPLE, sought, type Family, type Rng } from '../../lib.ts';

const COINS = [200, 100, 50, 20, 10, 5, 2, 1]; // in λεπτά, biggest first
const WORD: Record<number, string> = { 2: 'δύο', 3: 'τρία', 4: 'τέσσερα', 5: 'πέντε' };

// "50 λεπτά", "1 λεπτό", "1 ευρώ"
const coin = (v: number) => (v >= 100 ? `${v / 100} ευρώ` : v === 1 ? '1 λεπτό' : `${v} λεπτά`);
// "των 20 λεπτών", "του 1 ευρώ"
const coinGen = (v: number) => (v === 1 ? 'του 1 λεπτού' : v === 100 ? 'του 1 ευρώ' : v === 200 ? 'των 2 ευρώ' : `των ${v} λεπτών`);
// An amount: "72 λεπτά", "3 ευρώ", "1 ευρώ και 20 λεπτά"
function amount(c: number, gen = false): string {
  const e = Math.floor(c / 100), l = c % 100;
  const cents = l === 1 ? (gen ? '1 λεπτού' : '1 λεπτό') : `${l} ${gen ? 'λεπτών' : 'λεπτά'}`;
  return e === 0 ? cents : l === 0 ? `${e} ευρώ` : `${e} ευρώ και ${cents}`;
}
// The coins of an answer, one by one, the unit once: "50 + 20 + 2 λεπτά", "2 + 1 ευρώ", "1 ευρώ + 50 + 5 λεπτά"
// (a unit after every coin made the wrong answer with one coin more stand out by its length)
function list(vs: number[]): string {
  const sorted = [...vs].sort((x, y) => y - x);
  const euros = sorted.filter(v => v >= 100).map(v => v / 100), cents = sorted.filter(v => v < 100);
  const e = euros.length ? `${euros.join(' + ')} ευρώ` : '';
  const c = cents.length ? `${cents.join(' + ')} ${cents.length === 1 && cents[0] === 1 ? 'λεπτό' : 'λεπτά'}` : '';
  return [e, c].filter(Boolean).join(' + ');
}
const key = (vs: number[]) => [...vs].sort((x, y) => y - x).join('+');

// How many ways n coins make the amount (multisets)
function ways(total: number, n: number, from = 0): number {
  if (n === 0) return total === 0 ? 1 : 0;
  let w = 0;
  for (let i = from; i < COINS.length; i++) if (COINS[i] <= total) w += ways(total - COINS[i], n - 1, i);
  return w;
}

// Splitting a coin into two smaller ones of the same value
const SPLIT: Record<number, number[]> = { 200: [100, 100], 100: [50, 50], 20: [10, 10], 10: [5, 5], 2: [1, 1] };

const SMALL_BUYS = [
  { what: 'μια τσίχλα', the: 'η τσίχλα', min: 20, max: 80 }, { what: 'ένα κουλούρι', the: 'το κουλούρι', min: 40, max: 90 },
  { what: 'μια γόμα', the: 'η γόμα', min: 25, max: 95 }, { what: 'ένα μολύβι', the: 'το μολύβι', min: 30, max: 95 },
  { what: 'ένα αυτοκόλλητο', the: 'το αυτοκόλλητο', min: 10, max: 60 },
];
const BIG_BUYS = [
  { what: 'έναν χυμό', min: 100, max: 200 }, { what: 'ένα περιοδικό με κόμικ', min: 200, max: 450 },
  { what: 'ένα τοστ', min: 150, max: 300 }, { what: 'ένα τετράδιο', min: 100, max: 300 }, { what: 'ένα παγωτό', min: 100, max: 300 },
];

function noise(r: Rng, his: string) {
  return r.pick([
    `Είναι ${extra(`${r.int(2, 6)} η ώρα`)} το απόγευμα.`,
    `${r.pick(['Ο αδερφός', 'Η αδερφή', 'Ο φίλος', 'Η φίλη'])} ${his} έχει ${extra(`${r.int(5, 12)} νομίσματα`)}.`,
    `Στην τσάντα ${his} έχει και ${extra(`${r.int(3, 8)} μολύβια`)}.`,
    `Ο παππούς ${his} έχει μια συλλογή με ${extra(`${r.int(40, 120)} παλιά νομίσματα`)}.`,
  ]);
}

export const coins: Family = {
  id: 'coins',
  grade: 3,
  chapter: '12',
  topic: 'Χρήματα',
  source: 'Μαθηματικά Γ΄, κεφ. 12 «Προβλήματα» 3 (τρία νομίσματα συνολικής αξίας 72 λεπτών) και κεφ. 13 «Επαναληπτικό μάθημα»',
  make(r, b) {
    const p = r.pick(PEOPLE);
    return r.chance(0.55) ? which(r, b, p) : handful(r, b, p);
  },
};

type Args = Parameters<Family['make']>;
type P = (typeof PEOPLE)[number];

// Which n coins make this amount? Only amounts that n coins make in exactly one way.
function which(r: Args[0], b: Args[1], p: P) {
  const n = r.pick([2, 3, 3, 4]);
  const pool = r.chance(0.6) ? COINS.slice(2) : COINS.slice(0, 6);
  const set = Array.from({ length: n }, () => r.pick(pool)).sort((x, y) => y - x);
  const total = set.reduce((s, v) => s + v, 0);
  if (new Set(set).size === 1 && n > 2) return null; // "three coins of 20" is too easy
  if (ways(total, n) !== 1) return null;

  // Wrong answers: one coin off (wrong total), and the right total with one coin more
  const wrongs: number[][] = [];
  for (let guard = 0; wrongs.length < 2 && guard < 30; guard++) {
    const i = r.int(0, n - 1);
    const j = COINS.indexOf(set[i]) + (r.chance(0.5) ? 1 : -1);
    if (j < 0 || j >= COINS.length) continue;
    const w = set.map((v, x) => (x === i ? COINS[j] : v));
    if (![set, ...wrongs].some(s => key(s) === key(w))) wrongs.push(w);
  }
  const splittable = set.findIndex(v => SPLIT[v]);
  const split = splittable >= 0 ? [...set.filter((_, x) => x !== splittable), ...SPLIT[set[splittable]]] : null;
  if (split) wrongs.push(split);
  if (wrongs.length < 2) return null;

  const W = WORD[n];
  const buy = total < 100 ? r.pick(SMALL_BUYS.filter(x => x.min <= total && x.max >= total)) : r.pick(BIG_BUYS.filter(x => x.min <= total && x.max >= total));
  const tellings = [
    () => `${p.Nom} έχει στην τσέπη ${p.his} ${known(`${W} νομίσματα`)} συνολικής αξίας ${known(amount(total, true))}. ${noise(r, p.his)} ${sought('Ποια νομίσματα έχει')};`,
    () => `Στο πορτοφόλι ${p.gen} υπάρχουν μόνο ${known(`${W} νομίσματα`)}. Όλα μαζί κάνουν ${known(amount(total))}. ${noise(r, p.his)} ${sought('Ποια είναι αυτά τα νομίσματα')};`,
    ...(buy ? [() => `${p.Nom} αγόρασε ${buy.what} που κόστιζε ${known(amount(total))}. Πλήρωσε ακριβώς το ποσό, με ${known(`${W} νομίσματα`)}. ${noise(r, p.his)} ${sought('Ποια νομίσματα έδωσε')};`] : []),
  ];
  const t = r.int(0, tellings.length - 1);
  const story = tellings[t]();

  const steps: ProblemStep[] = [b.tag(undefined, 'Χρειαζόμαστε πόσα νομίσματα είναι και πόσο κάνουν όλα μαζί.')];
  if (total >= 100 && r.chance(0.6)) {
    steps.push(b.numbers('plan', 'Γράφουμε πρώτα το ποσό σε λεπτά.', [{ label: cap(amount(total)), answer: total, unit: 'λεπτά' }],
      'Ένα ευρώ έχει 100 λεπτά.'));
  }
  steps.push(b.choice('solve', `Ποια ${W} νομίσματα κάνουν ${amount(total)};`, list(set), wrongs.slice(0, 3).map(list),
    `Προσθέτουμε τα νομίσματα κάθε απάντησης. Πρέπει να κάνουν ${amount(total)} και να είναι ${W}.`));
  if (split && r.chance(0.5)) {
    steps.push(b.choice('check', `Γιατί δεν είναι σωστό το «${list(split)}»;`, `Γιατί είναι ${WORD[n + 1]} νομίσματα`,
      [['Γιατί μαζί δεν κάνουν τόσα', 'Γιατί δεν κάνουν τόσα', 'Γιατί όλα μαζί δεν κάνουν τόσα'], ['Γιατί δεν υπάρχουν τέτοια κέρματα', 'Γιατί δεν υπάρχουν τέτοια', 'Δεν υπάρχουν τέτοια κέρματα']],
      'Μετράμε τα νομίσματα και τα προσθέτουμε.'));
  } else {
    steps.push(b.numbers('check', 'Ελέγχουμε: προσθέτουμε τα νομίσματα σε λεπτά.', [
      { label: `${set.join(' + ')} =`, answer: total, unit: 'λεπτά' },
    ], total >= 100 ? 'Ένα ευρώ έχει 100 λεπτά.' : undefined));
  }
  return { title: r.pick(['Τα νομίσματα', 'Ποια νομίσματα;', ['Στην τσέπη', 'Το πορτοφόλι', 'Ακριβώς το ποσό'][t]]), story, steps };
}

// A handful of coins: how much, and how much is missing to one euro (or left after buying)
function handful(r: Args[0], b: Args[1], p: P) {
  const kinds = r.sample([50, 20, 10, 5, 2], r.int(2, 3)).sort((x, y) => y - x);
  const counts = kinds.map(() => r.int(2, 5));
  const parts = kinds.map((v, i) => v * counts[i]);
  const total = parts.reduce((s, v) => s + v, 0);
  if (total >= 100 || total < 20) return null;
  const groups = kinds.map((v, i) => known(`${counts[i]} νομίσματα ${coinGen(v)}`));
  const groupText = `${groups.slice(0, -1).join(', ')} και ${groups[groups.length - 1]}`;
  const buy = r.chance(0.5) ? r.pick(SMALL_BUYS.filter(x => x.min < total)) : undefined;
  const price = buy ? r.step(buy.min, Math.min(buy.max, total - 5), 5) : 0;
  if (buy && (price < buy.min || price >= total)) return null;
  const telling = r.int(0, 2);
  // A sibling, a friend or the grandfather in the noise is a second subject: the question then
  // names her («Πόσα λεπτά έχει η Άννα;»), and so does the sentence after it
  const ask = (noise: string, giver?: string) => {
    // (or the one who gave them is of her gender: «Η γιαγιά έδωσε στην Άννα… Πόσα λεπτά της έδωσε;»)
    const other = /^(?:Ο|Η) (?:αδερφός|αδερφή|φίλος|φίλη|παππούς)/.test(noise) || !!giver?.startsWith(p.female ? 'Η' : 'Ο');
    const has = sought(telling === 2
      ? other ? `Πόσα λεπτά έδωσε ${giver!.toLowerCase()} σ${p.acc}` : `Πόσα λεπτά ${p.his} έδωσε`
      : other ? `Πόσα λεπτά έχει ${p.nom}` : 'Πόσα λεπτά έχει');
    return buy
      ? `${has}; ${other ? `${p.Nom} θέλει` : 'Θέλει'} να αγοράσει ${buy.what} που κοστίζει ${known(`${price} λεπτά`)}. ${sought(`Πόσα λεπτά θα ${p.his} περισσέψουν`)};`
      : `${has}; ${sought(other ? `Πόσα λεπτά λείπουν σ${p.acc} για να έχει ένα ευρώ` : `Πόσα λεπτά ${p.his} λείπουν για να έχει ένα ευρώ`)};`;
  };
  const story = [
    () => { const nz = noise(r, p.his); return `${p.Nom} άδειασε τον κουμπαρά ${p.his} και βρήκε ${groupText}. ${nz} ${ask(nz)}`; },
    () => { const nz = noise(r, p.his); return `Στην κασετίνα ${p.gen} υπάρχουν ${groupText}. ${nz} ${ask(nz)}`; },
    // (the grandfather who gave them is not the one with the collection: «Ο παππούς … Ο παππούς της …»)
    () => { const g = r.pick(['Η γιαγιά', 'Ο παππούς', 'Η θεία', 'Ο νονός']); const nz = noise(r, p.his); return nz.startsWith(g) ? '' : `${g} έδωσε σ${p.acc} ${groupText}. ${nz} ${ask(nz, g)}`; },
  ][telling]();
  if (!story) return null;

  const second = buy ? total - price : 100 - total;
  const steps: ProblemStep[] = [
    b.tag(undefined, 'Χρειαζόμαστε πόσα νομίσματα έχει από κάθε είδος.'),
    b.numbers('solve', 'Πόσα λεπτά κάνουν τα νομίσματα κάθε είδους;', kinds.map((v, i) => ({
      label: `${counts[i]} × ${v} =`, answer: parts[i], unit: 'λεπτά',
    })), `${counts[0]} νομίσματα ${coinGen(kinds[0])} είναι ${counts[0]} φορές ${coin(kinds[0])}.`),
    b.numbers('solve', 'Πόσα λεπτά είναι όλα μαζί;', [{ label: `${parts.join(' + ')} =`, answer: total, unit: 'λεπτά' }]),
  ];
  if (buy) {
    steps.push(b.numbers('solve', `Πόσα θα ${p.his} περισσέψουν;`, [{ label: r.chance(0.5) ? `${total} − ${price} =` : 'Περισσεύουν', answer: second, unit: 'λεπτά' }],
      `Από όσα έχει βγάζουμε όσα κοστίζει ${buy.the}.`));
  } else {
    steps.push(b.numbers('solve', `Πόσα ${p.his} λείπουν για ένα ευρώ;`, [{ label: r.chance(0.5) ? `100 − ${total} =` : 'Λείπουν', answer: second, unit: 'λεπτά' }],
      'Ένα ευρώ έχει 100 λεπτά.'));
  }
  if (r.chance(0.4)) {
    steps.push(b.choice('check', 'Πώς ελέγχουμε;', buy ? `${price} + ${second} = ${total}` : `${total} + ${second} = 100`,
      buy ? [`${total} + ${price} = ${total + price}`, `${second} + ${total} = ${second + total}`] : [`100 + ${total} = ${100 + total}`, `${total} + ${total} = ${2 * total}`],
      buy ? 'Όσα πλήρωσε μαζί με όσα περίσσεψαν πρέπει να κάνουν όσα είχε.' : 'Όσα έχει μαζί με όσα λείπουν πρέπει να κάνουν 100 λεπτά.'));
  }
  return { title: r.pick([['Ο κουμπαράς', 'Η κασετίνα', 'Το δώρο'][telling], 'Μετράμε τα νομίσματα', 'Πόσα λεπτά;']), story, steps };
}
