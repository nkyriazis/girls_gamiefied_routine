// A total, one known part, and the rest split in a ratio: "the volleyballs were twice
// the footballs" (Ε΄ κεφ. 1.3 «Πώς λύνουμε ένα πρόβλημα»).
import { extra, fmt, known, sought, type Family } from '../../lib.ts';

type Times = { f: string; n: string };
const TIMES: Record<number, Times> = {
  2: { f: 'διπλάσιες', n: 'διπλάσια' },
  3: { f: 'τριπλάσιες', n: 'τριπλάσια' },
  4: { f: 'τετραπλάσιες', n: 'τετραπλάσια' },
};

// Each setting spells out its own sentences, so every noun and adjective agrees.
interface Setting {
  title: string;
  g: 'f' | 'n';
  opening: (noise: string, total: string) => string;
  first: (n: string) => string;
  rest: string;
  relation: (times: string) => string;
  relG: 'f' | 'n';
  askBig: string;
  askSmall: string;
  big: string;   // "Μπάλες βόλεϊ"
  small: string; // "Μπάλες ποδοσφαίρου"
  smallOne: string; // "μπάλα ποδοσφαίρου", for "1 μπάλα ποδοσφαίρου"
  noise: (n: number) => string;
}

const SETTINGS: Setting[] = [
  {
    title: 'Οι μπάλες του καταστήματος', g: 'f',
    opening: (noise, total) => `Ένα κατάστημα αθλητικών ειδών, ${noise}, πούλησε ${total}.`,
    first: n => `Οι ${n} ήταν του μπάσκετ`, rest: 'και οι υπόλοιπες του βόλεϊ και του ποδοσφαίρου.',
    relation: t => `οι μπάλες του βόλεϊ ήταν ${t} από του ποδοσφαίρου`, relG: 'f',
    askBig: 'Πόσες μπάλες του βόλεϊ', askSmall: 'πόσες του ποδοσφαίρου', big: 'Μπάλες βόλεϊ', small: 'Μπάλες ποδοσφαίρου', smallOne: 'μπάλα ποδοσφαίρου',
    noise: n => `ανοιχτό ${n} ημέρες την εβδομάδα`,
  },
  {
    title: 'Η δανειστική βιβλιοθήκη', g: 'n',
    opening: (noise, total) => `Η βιβλιοθήκη του σχολείου, ${noise}, δάνεισε τον Οκτώβριο ${total}.`,
    first: n => `Τα ${n} ήταν παραμύθια`, rest: 'και τα υπόλοιπα κόμικ και βιβλία γνώσεων.',
    relation: t => `τα κόμικ ήταν ${t} από τα βιβλία γνώσεων`, relG: 'n',
    askBig: 'Πόσα κόμικ', askSmall: 'πόσα βιβλία γνώσεων', big: 'Κόμικ', small: 'Βιβλία γνώσεων', smallOne: 'βιβλίο γνώσεων',
    noise: n => `που έχει ${n} ράφια`,
  },
  {
    title: 'Το φυτώριο', g: 'n',
    opening: (noise, total) => `Ένα φυτώριο, ${noise}, φύτεψε φέτος ${total}.`,
    first: n => `Τα ${n} ήταν ελιές`, rest: 'και τα υπόλοιπα λεμονιές και πορτοκαλιές.',
    relation: t => `οι λεμονιές ήταν ${t} από τις πορτοκαλιές`, relG: 'f',
    askBig: 'Πόσες λεμονιές', askSmall: 'πόσες πορτοκαλιές', big: 'Λεμονιές', small: 'Πορτοκαλιές', smallOne: 'πορτοκαλιά',
    noise: n => `που έχει ${n} θερμοκήπια`,
  },
  {
    title: 'Τα εισιτήρια του θεάτρου', g: 'n',
    opening: (noise, total) => `Ένα θέατρο, ${noise}, πούλησε για τρεις παραστάσεις ${total}.`,
    first: n => `Τα ${n} ήταν για την Παρασκευή`, rest: 'και τα υπόλοιπα για το Σάββατο και την Κυριακή.',
    relation: t => `τα εισιτήρια του Σαββάτου ήταν ${t} από της Κυριακής`, relG: 'n',
    askBig: 'Πόσα εισιτήρια για το Σάββατο', askSmall: 'πόσα για την Κυριακή', big: 'Εισιτήρια Σαββάτου', small: 'Εισιτήρια Κυριακής', smallOne: 'εισιτήριο Κυριακής',
    noise: n => `με ${n} σειρές καθισμάτων`,
  },
  {
    title: 'Οι τούρτες του ζαχαροπλαστείου', g: 'f',
    opening: (noise, total) => `Ένα ζαχαροπλαστείο, ${noise}, έφτιαξε τον Δεκέμβριο ${total}.`,
    first: n => `Οι ${n} ήταν σοκολάτα`, rest: 'και οι υπόλοιπες φράουλα και βανίλια.',
    relation: t => `οι τούρτες φράουλα ήταν ${t} από τις τούρτες βανίλια`, relG: 'f',
    askBig: 'Πόσες τούρτες φράουλα', askSmall: 'πόσες βανίλια', big: 'Τούρτες φράουλα', small: 'Τούρτες βανίλια', smallOne: 'τούρτα βανίλια',
    noise: n => `που έχει ${n} ψυγεία`,
  },
  {
    title: 'Τα ζώα της φάρμας', g: 'n',
    opening: (noise, total) => `Σε μια φάρμα, ${noise}, ζουν ${total}.`,
    first: n => `Τα ${n} είναι κότες`, rest: 'και τα υπόλοιπα πρόβατα και κατσίκες.',
    relation: t => `τα πρόβατα είναι ${t} από τις κατσίκες`, relG: 'n',
    askBig: 'Πόσα πρόβατα', askSmall: 'πόσες κατσίκες', big: 'Πρόβατα', small: 'Κατσίκες', smallOne: 'κατσίκα',
    noise: n => `που απέχει ${n} χιλιόμετρα από την πόλη`,
  },
];

const TOTAL: Record<string, (n: string) => string> = {
  'Οι μπάλες του καταστήματος': n => `${n} μπάλες`,
  'Η δανειστική βιβλιοθήκη': n => `${n} βιβλία`,
  'Το φυτώριο': n => `${n} δέντρα`,
  'Τα εισιτήρια του θεάτρου': n => `${n} εισιτήρια`,
  'Οι τούρτες του ζαχαροπλαστείου': n => `${n} τούρτες`,
  'Τα ζώα της φάρμας': n => `${n} ζώα`,
};

export const parts: Family = {
  id: 'parts-ratio',
  grade: 5,
  unit: 1,
  source: 'Μαθηματικά Ε΄, κεφ. 1.3 «Πώς λύνουμε ένα πρόβλημα»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const m = r.pick([2, 3, 4]);
    const small = r.int(12, 95);
    const big = small * m;
    const first = r.step(40, 480, 10);
    const total = first + small + big;
    // The relation's adjective agrees with the bigger group's noun
    const times = TIMES[m][s.relG];
    const relation = s.relation(times);
    const story = `${s.opening(extra(s.noise(r.int(3, 9))), known(TOTAL[s.title](fmt(total))))} `
      + `${known(s.first(fmt(first)))} ${s.rest} `
      + `Ξέρουμε ακόμα ότι ${known(relation)}. `
      + `${sought(s.askBig)} και ${sought(s.askSmall)};`;
    const groupWord = `1 ${s.smallOne} και ${m} ${s.big.toLowerCase()}`;
    const steps = [
      b.tag(undefined, `Μια σχέση («${times}») είναι κι αυτή κάτι που γνωρίζουμε. Κάτι που δεν αλλάζει τους αριθμούς δεν χρειάζεται.`),
      b.choice('plan', 'Ποια στρατηγική μας βοηθά περισσότερο;',
        'Παρουσιάζω το πρόβλημα με σχέδιο',
        ['Προσθέτω τους αριθμούς του προβλήματος', 'Μοιράζω εξίσου στα δύο είδη'],
        `Το «${times}» σημαίνει ότι πάνε σε ομάδες: ${groupWord}.`),
      b.numbers('solve', 'Με ποιες σχέσεις βρίσκουμε τη λύση;', [
        { label: `${s.big} και ${s.small.toLowerCase()} μαζί`, answer: small + big },
        { label: `Ομάδες των ${m + 1}`, answer: small },
        { label: s.small, answer: small },
        { label: s.big, answer: big },
      ], `${fmt(total)} − ${fmt(first)} = ${fmt(small + big)}. Κάθε ομάδα έχει ${m + 1}: ${fmt(small + big)} : ${m + 1} = ${fmt(small)}.`),
      r.chance(0.5)
        ? b.numbers('check', 'Αναστοχαζόμαστε: πόσα βγαίνουν όλα μαζί;', [{ label: `${fmt(first)} + ${fmt(big)} + ${fmt(small)} =`, answer: total }])
        : b.choice('check', `Κάποιος απάντησε: «${fmt(big)} και ${fmt(small)}». Τι λείπει από την απάντηση;`,
          'Δεν λέει τι μετράει κάθε αριθμός',
          ['Οι αριθμοί του είναι λάθος', `Έπρεπε να γράψει μόνο το σύνολο, ${fmt(small + big)}`],
          'Οι αριθμοί είναι σωστοί. Θα καταλάβαινε κάποιος που δεν ξέρει το πρόβλημα τι σημαίνουν;'),
    ];
    return { title: s.title, story, steps };
  },
};
