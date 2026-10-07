// Money in coins or notes of one kind: turn it into euros, then buy with it (Ε΄ Επαναληπτικό 1,
// 3ο πρόβλημα: «Η Δανάη ανοίγει τον κουμπαρά της και βρίσκει 146 κέρματα των 50 λεπτών»).
import { extra, fmt, known, people, sought, type Family, type Person } from '../../lib.ts';
import type { ProblemStep } from '../../../../shared/types.ts';

interface Coin {
  name: (n: number) => string; // "146 κέρματα των 50 λεπτών"
  short: string;               // "κέρματα", for the rows
  /** Coins in 1 €, or euros in one coin. */
  perEuro?: number;
  euros?: number;
  cents?: number;
  max: number; // at most this many (a jar holds so many)
}

const COINS: Record<string, Coin> = {
  c10: { name: n => `${fmt(n)} κέρματα των 10 λεπτών`, short: 'κέρματα', perEuro: 10, cents: 10, max: 400 },
  c20: { name: n => `${fmt(n)} κέρματα των 20 λεπτών`, short: 'κέρματα', perEuro: 5, cents: 20, max: 450 },
  c50: { name: n => `${fmt(n)} κέρματα των 50 λεπτών`, short: 'κέρματα', perEuro: 2, cents: 50, max: 400 },
  e2: { name: n => `${fmt(n)} κέρματα των 2 €`, short: 'κέρματα', euros: 2, max: 150 },
  e5: { name: n => `${fmt(n)} χαρτονομίσματα των 5 €`, short: 'χαρτονομίσματα', euros: 5, max: 120 },
  e10: { name: n => `${fmt(n)} χαρτονομίσματα των 10 €`, short: 'χαρτονομίσματα', euros: 10, max: 80 },
};

interface Item { a: string; the: string; price: [number, number] }
const item = (a: string, the: string, lo: number, hi: number): Item => ({ a, the, price: [lo, hi] });
/** The item as a subject: "η μπλούζα", "τα παπούτσια". */
const nom = (i: Item) => i.the.replace(/^την? /, 'η ').replace(/^τον /, 'ο ');
const costs = (i: Item) => (i.the.startsWith('τα ') ? 'κοστίζουν' : 'κοστίζει');

interface Setting {
  title: string;
  coins: string[];
  items: Item[];
  /** Where the money is: the opening sentence, with the marked coins in it. */
  open: ((coins: string, p: Person, noise: string) => string)[];
  noise: (n: number) => string;
  buyer: (p: Person) => string; // who buys: "Με αυτά αγοράζει"
  plural?: boolean;
  left: (p: Person) => string;  // "Πόσα € της περισσεύουν"
  many: { many: string; for?: string; price: [number, number] }; // "βιβλία" (των 6 €) "για τη βιβλιοθήκη"
}

const SETTINGS: Setting[] = [
  {
    title: 'Ο κουμπαράς', coins: ['c50', 'c20', 'c10', 'e2'],
    items: [item('μια μπλούζα', 'την μπλούζα', 10, 22), item('ένα παντελόνι', 'το παντελόνι', 18, 35), item('ένα μπουφάν', 'το μπουφάν', 30, 60),
      item('ένα ζευγάρι παπούτσια', 'τα παπούτσια', 25, 55), item('ένα φούτερ', 'το φούτερ', 18, 40)],
    open: [
      (coins, p, noise) => `${p.Nom} ανοίγει τον κουμπαρά ${p.his}, ${noise}, και βρίσκει ${coins}.`,
      (coins, p, noise) => `Στον κουμπαρά ${p.gen}, ${noise}, υπάρχουν ${coins}.`,
    ],
    noise: n => `που τον γεμίζει εδώ και ${n} χρόνια`,
    buyer: () => 'Με αυτά αγοράζει',
    left: p => `Πόσα € ${p.his} περισσεύουν`,
    many: { many: 'βιβλία', price: [5, 12] },
  },
  {
    title: 'Το ταμείο της τάξης', coins: ['c50', 'c20', 'e2'],
    items: [item('μια μπάλα', 'την μπάλα', 12, 25), item('ένα επιτραπέζιο παιχνίδι', 'το επιτραπέζιο', 18, 35), item('ένα σχοινάκι', 'το σχοινάκι', 5, 10),
      item('ένα φυτό', 'το φυτό', 8, 20), item('ένα παζλ', 'το παζλ', 10, 25)],
    open: [
      (coins, p, noise) => `Στο ταμείο της τάξης ${p.gen} μαζεύτηκαν, ${noise}, ${coins}.`,
      (coins, p, noise) => `Στην τάξη ${p.gen}, ${noise}, μάζεψαν στο ταμείο ${coins}.`,
    ],
    noise: n => `μέσα σε ${n + 2} μήνες`,
    buyer: () => 'Με αυτά τα παιδιά αγοράζουν', plural: true,
    left: () => 'Πόσα € περισσεύουν στο ταμείο',
    many: { many: 'τετράδια ζωγραφικής', for: 'για την τάξη', price: [2, 5] },
  },
  {
    title: 'Το παζάρι του σχολείου', coins: ['e5', 'e10'],
    items: [item('έναν προβολέα', 'τον προβολέα', 250, 450), item('ένα ζευγάρι ηχεία', 'τα ηχεία', 60, 150), item('ένα ηλεκτρικό πιάνο', 'το πιάνο', 180, 320),
      item('μια οθόνη', 'την οθόνη', 150, 300), item('έναν εκτυπωτή', 'τον εκτυπωτή', 90, 200)],
    open: [
      (coins, p, noise) => `Στο παζάρι του σχολείου, ${noise}, ο σύλλογος γονέων μάζεψε ${coins}.`,
      (coins, p, noise) => `Η μητέρα ${p.gen}, ταμίας του συλλόγου γονέων, μέτρησε τα χρήματα από το παζάρι του σχολείου, ${noise}: ήταν ${coins}.`,
    ],
    noise: n => `που κράτησε ${n > 4 ? 2 : 3} ημέρες`,
    buyer: () => 'Με αυτά ο σύλλογος αγοράζει',
    left: () => 'Πόσα € περισσεύουν',
    many: { many: 'βιβλία', for: 'για τη βιβλιοθήκη του σχολείου', price: [8, 15] },
  },
  {
    title: 'Το βάζο του παππού', coins: ['e2', 'c50', 'e5'],
    items: [item('ένα ποδήλατο', 'το ποδήλατο', 110, 220), item('ένα κράνος', 'το κράνος', 20, 40), item('ένα κουδουνάκι', 'το κουδουνάκι', 5, 10),
      item('μια κλειδαριά', 'την κλειδαριά', 10, 20), item('ένα καλαθάκι', 'το καλαθάκι', 12, 25)],
    open: [
      (coins, p, noise) => `Ο παππούς ${p.gen} αδειάζει ένα βάζο, ${noise}, και βρίσκει ${coins}.`,
      (coins, p, noise) => `Ο παππούς ${p.gen} αδειάζει το βάζο του, ${noise}, και μετράει ${coins}.`,
    ],
    noise: n => `που το γέμιζε ${n} χρόνια`,
    buyer: p => `Με αυτά αγοράζει για ${p.female ? 'την εγγονή' : 'τον εγγονό'} του`,
    left: () => 'Πόσα € περισσεύουν στον παππού',
    many: { many: 'βιβλία', for: 'για τα εγγόνια του', price: [6, 15] },
  },
];

export const coinsNotes: Family = {
  id: 'coins-notes',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, Επαναληπτικό 1, 3ο πρόβλημα (τα κέρματα των 50 λεπτών)',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const [p] = people(r, 1);
    const coin = COINS[r.pick(s.coins)];
    const [i1, i2, i3] = r.sample(s.items, 3);
    const p1 = r.int(...i1.price), p2 = r.int(...i2.price), p3 = r.int(...i3.price);
    const kind = r.pick(['last', 'left', 'many'] as const);
    let total: number;
    const perItem = r.int(...s.many.price);
    if (kind === 'last') total = p1 + p2 + p3;
    else if (kind === 'left') total = p1 + p2 + p3; // p3 is what is left
    else total = perItem * r.int(6, 30);
    const count = coin.perEuro ? total * coin.perEuro : total / coin.euros!;
    if (!Number.isInteger(count) || count > coin.max || count < 12) return null;
    // A price equal to the coin makes the answer just the number of coins
    if (kind === 'many' && coin.euros === perItem) return null;

    const coins = known(coin.name(count));
    const open = r.pick(s.open)(coins, p, extra(s.noise(r.int(2, 6))));
    const buy = `${s.buyer(p)} ${known(`${i1.a} των ${p1} €`)} και ${known(`${i2.a} των ${p2} €`)}`;
    const and = /^[αεηιοουωάέήίόύώ]/.test(i3.a) ? 'κι' : 'και';
    const v = s.plural ? { buy: 'αγοράζουν', get: 'πάρουν', spend: 'ξοδεύουν' } : { buy: 'αγοράζει', get: 'πάρει', spend: 'ξοδεύει' };
    const story = kind === 'last'
      ? r.chance(0.5)
        ? `${open} ${s.buyer(p)} ${known(`${i1.a} των ${p1} €`)}, ${known(`${i2.a} των ${p2} €`)} ${and} ${i3.a}. ${sought(`Με πόσα € ${v.buy} ${i3.the}`)} ${known(`χωρίς να ${v.get} ρέστα`)};`
        : `${open} ${s.buyer(p)} ${known(`${i1.a} των ${p1} €`)}, ${known(`${i2.a} των ${p2} €`)} ${and} ${i3.a}, και ${known(`${v.spend} όλα τα χρήματα`)}. ${sought(`Πόσα € ${costs(i3)} ${nom(i3)}`)};`
      : kind === 'left'
        ? `${open} ${buy}. ${sought(s.left(p))};`
        : r.chance(0.5)
          ? `${open} ${sought(`Πόσα ${s.many.many} των ${perItem} € μπορούν να αγοραστούν`)} με όλα αυτά τα χρήματα${s.many.for ? ` ${s.many.for}` : ''};`
          : `${open} ${cap(s.buyer(p).replace(/^Με αυτά /, '').replace(/ για (την εγγονή|τον εγγονό) του$/, ''))} με όλα τα χρήματα ${known(`${s.many.many} των ${perItem} €`)}${s.many.for ? ` ${s.many.for}` : ''}. ${sought(`Πόσα ${s.many.many} ${s.plural ? 'παίρνουν' : 'παίρνει'}`)};`;

    const euros = total;
    const convert = coin.perEuro
      ? [{ label: `${coin.short === 'κέρματα' ? 'Κέρματα' : 'Χαρτονομίσματα'} που κάνουν 1 €`, answer: coin.perEuro },
        { label: r.chance(0.5) ? `${fmt(count)} : ${coin.perEuro} =` : 'Όλα τα χρήματα', answer: euros, unit: '€' }]
      : [{ label: r.chance(0.5) ? `${fmt(count)} × ${coin.euros} =` : 'Όλα τα χρήματα', answer: euros, unit: '€' }];
    const convertHint = coin.perEuro
      ? `Το 1 € έχει 100 λεπτά. ${100 / coin.cents!} κέρματα των ${coin.cents} λεπτών κάνουν 1 €.`
      : `Κάθε ${coin.short === 'κέρματα' ? 'κέρμα' : 'χαρτονόμισμα'} αξίζει ${coin.euros} €.`;
    const wrongEuros = (coin.perEuro ? [count, count * coin.perEuro, count * coin.cents!] : [count, count / coin.euros!, count + coin.euros!])
      .filter(x => Number.isInteger(x))
      .filter((x, k, xs) => x !== euros && xs.indexOf(x) === k);

    const steps: ProblemStep[] = [b.tag(undefined, 'Χρειαζόμαστε πόσα και τι κέρματα ή χαρτονομίσματα είναι, και τις τιμές. Ό,τι δεν αλλάζει τα χρήματα το αφήνουμε.')];
    if (r.chance(0.4)) {
      steps.push(b.choice('solve', `Πόσα € είναι ${coin.name(count).replace(/^[\d.]+ /, m => `τα ${m}`)};`, `${fmt(euros)} €`,
        wrongEuros.map(x => `${fmt(x)} €`), convertHint));
    } else {
      steps.push(b.numbers('solve', 'Πρώτα βρίσκουμε πόσα € είναι όλα μαζί.', convert, convertHint));
    }
    if (kind === 'many') {
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        { label: r.chance(0.5) ? `${fmt(euros)} : ${perItem} =` : cap(s.many.many), answer: euros / perItem },
      ], `Πόσες φορές χωράνε τα ${perItem} € στα ${fmt(euros)} €;`));
      steps.push(b.numbers('check', 'Πώς ελέγχουμε;', [{ label: `${fmt(euros / perItem)} × ${perItem} =`, answer: euros, unit: '€' }],
        'Αν πολλαπλασιάσουμε το πλήθος με την τιμή, πρέπει να βρούμε όλα τα χρήματα.'));
    } else {
      const named = r.chance(0.5);
      steps.push(b.numbers('solve', 'Λύνουμε.', [
        { label: named ? 'Κοστίζουν τα δύο πρώτα' : `${p1} + ${p2} =`, answer: p1 + p2, unit: '€' },
        { label: named ? (kind === 'last' ? cap(`${costs(i3)} ${nom(i3)}`) : 'Περισσεύουν') : `${fmt(euros)} − ${p1 + p2} =`, answer: p3, unit: '€' },
      ], `Από όλα τα χρήματα, τα ${fmt(euros)} €, βγάζουμε όσα κοστίζουν ${nom(i1)} και ${nom(i2)}.`));
      const naive = count - p1 - p2;
      steps.push(r.chance(0.5) || naive <= 0 || naive === p3
        ? b.numbers('check', 'Πώς ελέγχουμε; Όλα μαζί πρέπει να κάνουν όσα ήταν στην αρχή.', [{ label: `${p1} + ${p2} + ${p3} =`, answer: euros, unit: '€' }])
        : b.choice('check', `Κάποιος απάντησε «${fmt(naive)} €». Τι έκανε λάθος;`,
          `Πήρε τα ${fmt(count)} ${coin.short} σαν να ήταν ${fmt(count)} €`,
          ['Τίποτα, είναι σωστό', `Ξέχασε να αφαιρέσει ${i2.the}`],
          `Τα ${coin.short} δεν αξίζουν 1 € το καθένα.`));
    }
    return { title: s.title, story, steps };
  },
};

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
