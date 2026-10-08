// Sharing equally, sometimes with the classic trap: "for Fotis and his 3 friends" is 4 kids
// (Γ΄ κεφ. 6 «Πολλαπλασιασμός και διαίρεση», κεφ. 51 «Προβλήματα» 2).
import { cap, count, extra, fmt, HowMany, known, PEOPLE, sought, the, thing, type Family } from '../../lib.ts';

const TREATS = [
  { t: thing('κουλουράκι', 'κουλουράκια', 'n'), maker: 'έψησε' },
  { t: thing('καραμέλα', 'καραμέλες', 'f'), maker: 'αγόρασε' },
  { t: thing('μπισκότο', 'μπισκότα', 'n'), maker: 'έψησε' },
  { t: thing('μήλο', 'μήλα', 'n'), maker: 'μάζεψε' },
  { t: thing('κάρτα', 'κάρτες', 'f'), maker: 'έφερε' },
  { t: thing('αυτοκόλλητο', 'αυτοκόλλητα', 'n'), maker: 'έφερε' },
  { t: thing('μανταρίνι', 'μανταρίνια', 'n'), maker: 'μάζεψε' },
];
const GROWNUPS = ['Ο μπαμπάς', 'Η μαμά', 'Η γιαγιά', 'Ο παππούς', 'Η θεία'];

export const share: Family = {
  id: 'share-equally',
  grade: 3,
  chapter: '6',
  topic: 'Διαίρεση',
  source: 'Μαθηματικά Γ΄, κεφ. 6 «Πολλαπλασιασμός και διαίρεση» και κεφ. 51 «Προβλήματα»',
  make(r, b) {
    const kid = r.pick(PEOPLE);
    const { t, maker } = r.pick(TREATS);
    const each = r.int(2, 10);
    const trap = r.chance(0.6);
    const friends = r.int(2, 5);
    const kids = trap ? friends + 1 : friends;
    const total = each * kids;
    const noise = r.pick([
      maker === 'έψησε' ? `${cap(the(t))} έψησε σε ${extra(`${r.step(20, 50, 5)} λεπτά`)}.` : `Ήταν ${extra(`${r.int(2, 6)} η ώρα`)} το απόγευμα.`,
      `Ήταν ${extra(`${r.int(2, 6)} η ώρα`)} το απόγευμα.`,
      `${cap(the(t))} έβαλε σε ${extra(`${r.int(2, 3)} πιάτα`)}.`,
    ]);
    const grown = r.pick(GROWNUPS);
    const who = trap
      ? known(`${kid.acc} και ${kid.female ? `τις ${friends} φίλες της` : `τους ${friends} φίλους του`}`)
      : known(`${friends} παιδιά`);
    const story = trap
      ? `${grown} ${kid.gen} ${maker} ${known(count(total, t, true))} για ${who}. ${noise} ${cap(the(t))} μοιράζει εξίσου σε όλα τα παιδιά. ${sought(`${HowMany(t)} ${t.many} θα πάρει το καθένα`)};`
      : `${grown} ${maker} ${known(count(total, t, true))} και ${the(t)} μοιράζει εξίσου σε ${who}. ${noise} ${sought(`${HowMany(t)} ${t.many} θα πάρει κάθε παιδί`)};`;

    const steps = [
      b.tag(undefined, 'Χρειαζόμαστε πόσα είναι όλα και σε πόσα παιδιά μοιράζονται. Ό,τι άλλο λέει η ιστορία δεν χρειάζεται.'),
      ...(trap ? [b.choice('plan', 'Σε πόσα παιδιά μοιράζονται;', String(kids), [String(friends), String(total)],
        `Μη ξεχάσεις και ${kid.female ? 'την ίδια' : 'τον ίδιο'} ${kid.acc}!`)] : []),
      b.choice('plan', 'Ποια πράξη μας βοηθά;', `${fmt(total)} : ${kids}`,
        [`${fmt(total)} − ${kids}`, `${fmt(total)} × ${kids}`, ...(trap ? [`${fmt(total)} : ${friends}`] : [`${fmt(total)} + ${kids}`])],
        'Μοιράζουμε εξίσου: αυτό είναι διαίρεση με τον αριθμό των παιδιών.'),
      b.numbers('solve', 'Λύνουμε.', [{ label: 'Κάθε παιδί παίρνει', answer: each, unit: t.many }], `Ποιος αριθμός επί ${kids} κάνει ${fmt(total)};`),
      b.choice('check', 'Πώς ελέγχουμε;', `${kids} × ${each} = ${fmt(total)}`,
        [`${fmt(total)} + ${each} = ${fmt(total + each)}`, `${friends === kids ? kids + 1 : friends} × ${each} = ${fmt((friends === kids ? kids + 1 : friends) * each)}`],
        'Όλα τα παιδιά μαζί πρέπει να έχουν όσα ήταν στην αρχή.'),
    ];
    return { title: r.pick([`${cap(the(t, false))} ${t.many}`, 'Μοιράζουμε εξίσου', 'Για όλα τα παιδιά']), story, steps };
  },
};
