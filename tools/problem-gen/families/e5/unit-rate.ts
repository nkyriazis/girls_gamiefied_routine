// Reduce to one, then scale: "3 crates hold 12 kg; how much do 246 hold?"
// (Ε΄ Επαναληπτικό 1, 2ο πρόβλημα; αναγωγή στη μονάδα).
import { extra, fmt, known, sought, type Family } from '../../lib.ts';

interface Setting {
  title: string;
  story: (few: string, per: string, many: string, noise: string, ask: string) => string;
  few: (n: number) => string;   // "3 τελάρα"
  total: (n: number) => string; // "12 κιλά μήλα"
  many: (n: number) => string;  // "246 τελάρα"
  ask: string;
  one: string;                  // "Κιλά σε 1 τελάρο"
  all: (n: number) => string;   // "Κιλά σε 246 τελάρα"
  unit: string;
  /** A realistic amount for one: kilos in a crate, pencils in a box, ... */
  per: [number, number];
  /** How many there are in the end */
  amount: [number, number];
  noise: (r: () => number) => string;
}

const SETTINGS: Setting[] = [
  {
    title: 'Τα τελάρα με τα μήλα',
    story: (few, per, many, noise, ask) => `Σε ${few} χωράνε ${per}. Ένα φορτηγό, που ${noise}, έφερε ${many}. ${ask};`,
    few: n => `${n} τελάρα`, total: n => `${fmt(n)} κιλά μήλα`, many: n => `${fmt(n)} τελάρα`,
    ask: 'Πόσα κιλά μήλα χωράνε σε όλα τα τελάρα', one: 'Κιλά σε 1 τελάρο', all: n => `Κιλά σε ${fmt(n)} τελάρα`, unit: 'κιλά', per: [8, 25], amount: [110, 990],
    noise: r => `ξεκίνησε στις ${r()} το πρωί`,
  },
  {
    title: 'Τα κουτιά με τα μολύβια',
    story: (few, per, many, noise, ask) => `Σε ${few} υπάρχουν ${per}. Το σχολείο, ${noise}, παρήγγειλε ${many}. ${ask};`,
    few: n => `${n} κουτιά`, total: n => `${fmt(n)} μολύβια`, many: n => `${fmt(n)} κουτιά`,
    ask: 'Πόσα μολύβια θα πάρει το σχολείο', one: 'Μολύβια σε 1 κουτί', all: n => `Μολύβια σε ${fmt(n)} κουτιά`, unit: 'μολύβια', per: [6, 24], amount: [110, 600],
    noise: r => `που έχει ${r()} τμήματα`,
  },
  {
    title: 'Τα κιβώτια με το νερό',
    story: (few, per, many, noise, ask) => `${few} έχουν ${per}. Για τους αγώνες του δήμου, ${noise}, αγόρασαν ${many}. ${ask};`,
    few: n => `${n} κιβώτια`, total: n => `${fmt(n)} μπουκάλια νερό`, many: n => `${fmt(n)} κιβώτια`,
    ask: 'Πόσα μπουκάλια νερό αγόρασαν', one: 'Μπουκάλια σε 1 κιβώτιο', all: n => `Μπουκάλια σε ${fmt(n)} κιβώτια`, unit: 'μπουκάλια', per: [6, 24], amount: [110, 800],
    noise: r => `που κράτησαν ${r()} ημέρες`,
  },
  {
    title: 'Τα πακέτα με τα μπισκότα',
    story: (few, per, many, noise, ask) => `${few} έχουν ${per}. Ένας φούρνος, ${noise}, έφτιαξε ${many}. ${ask};`,
    few: n => `${n} πακέτα`, total: n => `${fmt(n)} μπισκότα`, many: n => `${fmt(n)} πακέτα`,
    ask: 'Πόσα μπισκότα έφτιαξε ο φούρνος', one: 'Μπισκότα σε 1 πακέτο', all: n => `Μπισκότα σε ${fmt(n)} πακέτα`, unit: 'μπισκότα', per: [8, 30], amount: [110, 990],
    noise: r => `που ανοίγει στις ${r()} το πρωί`,
  },
  {
    title: 'Τα λεωφορεία της εκδρομής',
    story: (few, per, many, noise, ask) => `Σε ${few} κάθονται ${per}. Για μια μεγάλη εκδρομή, ${noise}, νοίκιασαν ${many}. ${ask};`,
    few: n => `${n} λεωφορεία`, total: n => `${fmt(n)} επιβάτες`, many: n => `${fmt(n)} λεωφορεία`,
    ask: 'Πόσοι επιβάτες χωράνε σε όλα τα λεωφορεία', one: 'Επιβάτες σε 1 λεωφορείο', all: n => `Επιβάτες σε ${fmt(n)} λεωφορεία`, unit: 'επιβάτες', per: [40, 60], amount: [12, 60],
    noise: r => `που θα κρατήσει ${r()} ημέρες`,
  },
];

export const unitRate: Family = {
  id: 'unit-rate',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, Επαναληπτικό 1, 2ο πρόβλημα (αναγωγή στη μονάδα)',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const few = r.int(2, 9);
    const per = r.int(...s.per);
    const many = r.int(...s.amount);
    const total = many * per;
    if (total > 99_999) return null;
    const story = s.story(known(s.few(few)), known(s.total(few * per)), known(s.many(many)), extra(s.noise(() => r.int(2, 9))), sought(s.ask));
    const round = Math.round(many / 10) * 10;
    const steps = [
      b.tag(undefined, 'Χρειαζόμαστε ό,τι αλλάζει την ποσότητα. Τα υπόλοιπα τα αφήνουμε.'),
      b.choice('plan', 'Ποιο σχέδιο δουλεύει;', 'Βρίσκω πρώτα πόσο είναι για 1 και μετά για όλα',
        [`${fmt(many)} × ${fmt(few * per)}`, `${fmt(many)} + ${fmt(few * per)} + ${few}`],
        `Τα ${fmt(few * per)} είναι για ${few}, όχι για 1.`),
      b.numbers('solve', 'Λύνουμε.', [
        { label: s.one, answer: per },
        { label: s.all(many), answer: total, unit: s.unit },
      ], `${fmt(few * per)} : ${few} = ${per}. Μετά ${fmt(many)} × ${per}.`),
      b.choice('check', 'Είναι λογική η απάντηση;', `Ναι: περίπου ${fmt(round)} × ${per} = ${fmt(round * per)}`,
        [`Όχι: πρέπει να είναι λιγότερο από ${fmt(many)}`, `Όχι: πρέπει να είναι περίπου ${fmt(round * per * 10)}`],
        `Στρογγυλοποιούμε το ${fmt(many)} στο ${fmt(round)}.`),
    ];
    return { title: s.title, story, steps };
  },
};
