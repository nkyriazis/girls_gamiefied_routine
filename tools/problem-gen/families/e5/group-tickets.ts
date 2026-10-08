// Tickets for a mixed group: adults and children at different prices («για τα παιδιά 2 €
// λιγότερα»), paid with a note, the change; or a school group where one teacher for every
// 10 pupils goes in free (Ε΄ Επαναληπτικό 2, 3ο πρόβλημα; κεφ. 2.8 και 2.9).
import type { ProblemStep } from '../../../../shared/types.ts';
import { extra, fmt, known, NO_MISTAKE, people, sought, type Family, type Person, type Rng } from '../../lib.ts';

interface Venue {
  title: string[];
  /** "Το εισιτήριο μιας θεατρικής παράστασης" */
  ticket: string;
  /** "στην παράσταση" */
  go: string;
  adult: [number, number];
  /** The least a child's or a pupil's ticket costs there (a school group's price included) */
  child: number;
  noise: (r: Rng) => string;
}

const VENUES: Venue[] = [
  { title: ['Στο θέατρο', 'Η θεατρική παράσταση'], ticket: 'Το εισιτήριο μιας θεατρικής παράστασης', go: 'στην παράσταση', adult: [12, 20], child: 5, noise: r => `Η παράσταση διαρκεί ${extra(`${r.step(70, 120, 10)} λεπτά`)}.` },
  { title: ['Ο ζωολογικός κήπος', 'Μια μέρα με τα ζώα'], ticket: 'Το εισιτήριο του ζωολογικού κήπου', go: 'στον ζωολογικό κήπο', adult: [14, 22], child: 6, noise: r => `Ο κήπος έχει ${extra(`${r.int(80, 250)} είδη ζώων`)}.` },
  { title: ['Το ενυδρείο', 'Στο ενυδρείο'], ticket: 'Το εισιτήριο του ενυδρείου', go: 'στο ενυδρείο', adult: [10, 18], child: 5, noise: r => `Το ενυδρείο έχει ${extra(`${r.int(40, 90)} δεξαμενές`)}.` },
  { title: ['Στον κινηματογράφο', 'Η ταινία'], ticket: 'Το εισιτήριο του κινηματογράφου', go: 'στον κινηματογράφο', adult: [8, 12], child: 4, noise: r => `Η ταινία αρχίζει ${extra(`στις ${r.int(5, 7)} το απόγευμα`)}.` },
  { title: ['Το πλανητάριο', 'Ταξίδι στα αστέρια'], ticket: 'Το εισιτήριο του πλανηταρίου', go: 'στο πλανητάριο', adult: [8, 14], child: 4, noise: r => `Ο θόλος του πλανηταρίου έχει διάμετρο ${extra(`${r.int(15, 25)} μέτρα`)}.` },
  { title: ['Το μουσείο', 'Επίσκεψη στο μουσείο'], ticket: 'Το εισιτήριο του μουσείου φυσικής ιστορίας', go: 'στο μουσείο', adult: [6, 12], child: 3, noise: r => `Το μουσείο έχει ${extra(`${r.int(8, 20)} αίθουσες`)}.` },
];

const WORDS = ['', 'ένα', 'δύο', 'τρία', 'τέσσερα'];
const NOTES = [20, 50, 100, 200];
const adults = (n: number) => (n === 1 ? '1 ενηλίκου' : `${n} ενηλίκων`);
const kidsT = (n: number) => (n === 1 ? '1 παιδικό' : `${n} παιδικά`);

/** A family: two parents (sometimes a grandmother too) and some children, and its verb. */
function family(r: Rng, p: Person): { text: string; go: string; adults: number; kids: number; mine: boolean } {
  const way = r.int(0, 2);
  if (way === 0) {
    const kids = r.int(2, 4);
    return { text: `Μια οικογένεια με ${WORDS[kids]} παιδιά`, go: 'θα πάει', adults: 2, kids, mine: false };
  }
  if (way === 1) {
    const sib = r.pick([
      { t: p.female ? 'τον αδερφό της' : 'τον αδερφό του', k: 1 },
      { t: `τις δύο αδερφές ${p.his}`, k: 2 },
      { t: `τα δύο αδέρφια ${p.his}`, k: 2 },
    ]);
    return { text: `${p.Nom} με τους γονείς ${p.his} και ${sib.t}`, go: 'θα πάει', adults: 2, kids: 1 + sib.k, mine: true };
  }
  return r.chance(0.5)
    ? { text: `${p.Nom}, οι γονείς ${p.his} και η γιαγιά ${p.his}`, go: 'θα πάνε', adults: 3, kids: 1, mine: true }
    : { text: `${p.Nom}, ${p.female ? 'η αδερφή της' : 'ο αδερφός του'}, οι γονείς τους και η γιαγιά τους`, go: 'θα πάνε', adults: 3, kids: 2, mine: true };
}

export const groupTickets: Family = {
  id: 'group-tickets',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, Επαναληπτικό 2, 3ο πρόβλημα; κεφ. 2.8 και 2.9 (πράξεις με φυσικούς αριθμούς)',
  make(r, b) {
    const v = r.pick(VENUES);
    const [p, q] = people(r, 2);
    const A = r.int(...v.adult);
    const kind = r.pick(['family', 'family', 'school'] as const);
    const steps: ProblemStep[] = [];

    if (kind === 'family') {
      const f = family(r, p);
      const less = r.int(2, 6);
      const C = A - less;
      const total = f.adults * A + f.kids * C;
      const note = NOTES.find(n => n > total);
      if (!note || C < Math.max(3, v.child)) return null;
      const pays = r.chance(0.6);
      const intro = `${v.ticket} κοστίζει ${known(`${A} € για τους ενήλικες`)} και ${known(`για τα παιδιά ${less} € λιγότερα`)}.`;
      // "Μια οικογένεια με τρία παιδιά" has no digit; the others name the people
      const who = `${known(f.text)} ${f.go} ${v.go}.`;
      const story = `${intro} ${v.noise(r)} ${who} `
        + (pays ? `Οι γονείς θα πληρώσουν ${known(`με ένα χαρτονόμισμα των ${note} €`)}. ${sought('Πόσα ρέστα θα πάρουν')};` : `${sought('Πόσα € θα πληρώσουν όλοι μαζί')};`);
      const nAll = f.adults + f.kids;
      steps.push(b.tag(undefined, 'Μετράμε χωριστά τους ενήλικες και τα παιδιά: έχουν άλλη τιμή.'));
      const right = `${adults(f.adults)} και ${kidsT(f.kids)}`;
      steps.push(b.choice('plan', 'Πόσα εισιτήρια ενηλίκων και πόσα παιδικά χρειάζονται;', right,
        [`${adults(nAll)} και κανένα παιδικό`, `${adults(f.adults)} και ${kidsT(f.kids - 1 || f.kids + 1)}`, `${adults(f.adults - 1)} και ${kidsT(f.kids + 1)}`]
          .filter((o, i, a) => o !== right && a.indexOf(o) === i),
        f.mine ? `Μην ξεχάσεις ${p.acc}: είναι κι ${p.female ? 'αυτή' : 'αυτός'} παιδί.` : 'Μια οικογένεια έχει δύο γονείς.'));
      const ops = r.chance(0.6);
      steps.push(b.numbers('solve', 'Λύνουμε βήμα βήμα.', [
        { label: ops ? `Παιδικό εισιτήριο: ${A} − ${less} =` : 'Παιδικό εισιτήριο', answer: C, unit: '€' },
        { label: ops ? `Ενήλικες: ${f.adults} × ${A} =` : 'Για τους ενήλικες', answer: f.adults * A, unit: '€' },
        // A row names the one above («το παιδικό», «όλοι μαζί»), never its number
        { label: ops ? `Παιδιά: ${f.kids} × το παιδικό =` : 'Για τα παιδιά', answer: f.kids * C, unit: '€' },
        { label: 'Όλοι μαζί', answer: total, unit: '€' },
        ...(pays ? [{ label: ops ? `Ρέστα: ${note} − το σύνολο =` : 'Ρέστα', answer: note - total, unit: '€' }] : []),
      ], `Το «${less} € λιγότερα» σημαίνει ${A} − ${less}.`));
      const allAdult = nAll * A;
      steps.push(b.choice('check', `Αναστοχαζόμαστε: κάποιος βρήκε ${nAll} × ${A} = ${allAdult} €. Τι λάθος έκανε;`,
        'Πλήρωσε τα παιδιά σαν ενήλικες',
        [NO_MISTAKE, f.kids > 1 ? [`Έπρεπε να αφαιρέσει ${less} € μόνο μία φορά`, `Έπρεπε να αφαιρέσει ${less} € μία φορά`]
          : [`Έπρεπε να προσθέσει ${less} € στο σύνολο`, `Έπρεπε να προσθέσει ${less} €`, `Έπρεπε να προσθέσει άλλα ${less} €`]],
        `Η διαφορά είναι ${f.kids} × ${less} = ${f.kids * less} €.`));
      return { title: r.pick(v.title), story, steps };
    }

    // A school group: one teacher for every 10 pupils goes in free
    const pupils = r.int(22, 78);
    const free = Math.floor(pupils / 10);
    const teachers = free + r.int(1, 3);
    const C = r.int(3, Math.max(4, A - 4));
    if (C < v.child) return null;
    const payT = teachers - free;
    const total = pupils * C + payT * A;
    const note = r.chance(0.5) ? NOTES.find(n => n > total) : undefined;
    const prices = `${v.ticket} κοστίζει ${known(`${C} € για κάθε μαθητή`)} και ${known(`${A} € για κάθε ενήλικα`)}, αλλά ${known('για κάθε 10 μαθητές ένας εκπαιδευτικός μπαίνει δωρεάν')}.`;
    const intro = `Από το σχολείο ${p.gen} θα πάνε ${v.go} ${known(`${pupils} μαθητές`)} και ${known(`${teachers} εκπαιδευτικοί`)}.`;
    const boss = `${q.female ? 'Η κυρία' : 'Ο κύριος'} ${q.bare}`;
    const story = `${prices} ${intro} ${v.noise(r)} `
      + (note ? `${boss}, ${q.female ? 'η υπεύθυνη' : 'ο υπεύθυνος'} της εκδρομής, θα πληρώσει ${known(`με ένα χαρτονόμισμα των ${note} €`)}. ${sought('Πόσα ρέστα θα πάρει')};` : `${sought('Πόσα € θα πληρώσει το σχολείο')};`);
    if (note && note - total > 150) return null;
    steps.push(b.tag(undefined, 'Το «για κάθε 10 μαθητές» μάς λέει πόσοι εκπαιδευτικοί δεν πληρώνουν.'));
    steps.push(b.choice('plan', 'Πόσοι εκπαιδευτικοί μπαίνουν δωρεάν;', `${free}, γιατί ${pupils} = 10 × ${free} + ${pupils % 10}`,
      [[`${teachers}, δηλαδή κάθε εκπαιδευτικός`, `${teachers}, κάθε εκπαιδευτικός`],
        ...(pupils % 10 && free + 1 !== teachers ? [[`${free + 1}, γιατί το ${pupils} είναι περίπου ${Math.ceil(pupils / 10) * 10}`, `${free + 1}, περίπου ${Math.ceil(pupils / 10) * 10} μαθητές`]] : []),
        ...(free > 1 ? [[`${free - 1}, γιατί ${free - 1} × 10 = ${(free - 1) * 10}`, `${free - 1}, γιατί ${free - 1} × 10 = ${(free - 1) * 10} μαθητές`]] : ['Κανένας, γιατί είναι λίγοι'])],
      `Πόσες ολόκληρες δεκάδες μαθητών υπάρχουν στο ${pupils};`));
    const ops = r.chance(0.6);
    steps.push(b.numbers('solve', 'Λύνουμε βήμα βήμα.', [
      { label: ops ? `Μαθητές: ${pupils} × ${C} =` : 'Για τους μαθητές', answer: pupils * C, unit: '€', eq: `${pupils} × ${C}` },
      { label: ops ? `Εκπαιδευτικοί που πληρώνουν: ${teachers} − ${free} =` : 'Εκπαιδευτικοί που πληρώνουν', answer: payT },
      { label: ops ? `Για αυτούς: όσοι πληρώνουν × ${A} =` : 'Για τους εκπαιδευτικούς', answer: payT * A, unit: '€' },
      { label: 'Όλα μαζί', answer: total, unit: '€' },
      ...(note ? [{ label: ops ? `Ρέστα: ${note} − όλα μαζί =` : 'Ρέστα', answer: note - total, unit: '€' }] : []),
    ]));
    // Statements about «Όλα μαζί», not «Ναι»/«Όχι» (#83): every ticket at the adults' price, or less than the pupils' alone
    steps.push(b.choice('check', 'Γιατί είναι λογικό το συνολικό ποσό;', `Είναι λίγο πάνω από τα ${fmt(pupils * C)} € των μαθητών`,
      [[`Είναι ${fmt((pupils + teachers) * A)} €, αν όλοι πλήρωναν τιμή ενήλικα`, `Είναι ${fmt((pupils + teachers) * A)} €, όλοι με τιμή ενήλικα`], [`Είναι κάτω από τα ${fmt(pupils * C)} € των μαθητών`, `Είναι κάτω από ${fmt(pupils * C)} €`]],
      'Συγκρίνουμε με το ποσό για τους μαθητές μόνο.'));
    return { title: r.pick(v.title), story, steps };
  },
};
