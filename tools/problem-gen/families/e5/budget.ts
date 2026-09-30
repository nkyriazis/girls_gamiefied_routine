// A family (or a school, a club) buys several expensive things: the total, whether the money
// is enough, and how much is left or missing (Ε΄ κεφ. 2.8 «Η πρόσθεση και η αφαίρεση στους
// φυσικούς αριθμούς»).
import { extra, fmt, known, people, sought, type Family, type Person } from '../../lib.ts';
import type { ProblemStep } from '../../../../shared/types.ts';

/** An item and its price in a phrase: "μια τηλεόραση των 1.250 €". */
interface Item { say: (price: string) => string; price: [number, number]; step: number }
const of = (a: string, lo: number, hi: number, step = 5): Item => ({ say: x => `${a} των ${x} €`, price: [lo, hi], step });
const worth = (a: string, lo: number, hi: number, step = 5): Item => ({ say: x => `${a} αξίας ${x} €`, price: [lo, hi], step });
const pay = (a: string, lo: number, hi: number, step = 5): Item => ({ say: x => `${x} € για ${a}`, price: [lo, hi], step });

interface Setting {
  title: string;
  items: Item[];
  /** Who has the money, with the marked budget: "Οι γονείς της Ζωής έχουν μαζέψει 3.000 €" */
  has: (p: Person, money: string) => string;
  why: string;
  buy: string;                   // "Θέλουν να αγοράσουν"
  says: [string, string];        // «Θα αγοράσουμε ...», λέει η μητέρα
  noise: ((n: number) => string)[];
  their: string;                 // "τα χρήματά τους"
}

const SETTINGS: Setting[] = [
  {
    title: 'Οι ηλεκτρικές συσκευές',
    items: [of('μια τηλεόραση', 450, 1_450), of('ένα ψυγείο', 380, 1_200), of('ένα πλυντήριο ρούχων', 320, 780),
      of('μια κουζίνα', 350, 890), of('έναν φούρνο μικροκυμάτων', 70, 190), of('μια ηλεκτρική σκούπα', 90, 350)],
    has: (p, money) => `Οι γονείς ${p.gen} έχουν μαζέψει ${money}`,
    why: 'για το καινούργιο σπίτι τους', buy: 'Θέλουν να αγοράσουν', says: ['Θα αγοράσουμε', 'λέει η μητέρα'],
    noise: [n => `Το κατάστημα έχει ${Math.min(n, 4)} ορόφους`, n => `Το σπίτι τους έχει ${Math.min(n, 5)} δωμάτια`],
    their: 'τα χρήματά τους',
  },
  {
    title: 'Τα έπιπλα',
    items: [of('έναν καναπέ', 480, 1_600), of('μια τραπεζαρία', 350, 1_100), of('ένα κρεβάτι', 250, 900),
      of('μια ντουλάπα', 300, 950), of('μια βιβλιοθήκη', 120, 420), of('ένα γραφείο', 110, 380)],
    has: (p, money) => `Η θεία ${p.gen} έχει ${money}`,
    why: 'για να επιπλώσει το καινούργιο διαμέρισμά της', buy: 'Διαλέγει', says: ['Θα πάρω', 'λέει η θεία'],
    noise: [n => `Το διαμέρισμα είναι στον ${Math.min(n, 6)}ο όροφο`, n => `Το κατάστημα απέχει ${n + 4} χιλιόμετρα από το σπίτι της`],
    their: 'τα χρήματά της',
  },
  {
    title: 'Η αίθουσα υπολογιστών',
    items: [of('έναν διαδραστικό πίνακα', 1_200, 2_800, 50), of('έναν εκτυπωτή', 180, 450), of('έναν προβολέα', 350, 900),
      of('έναν φορητό υπολογιστή', 550, 1_100), worth('ηχεία', 60, 240), of('μια κάμερα', 90, 320)],
    has: (p, money) => `Το σχολείο ${p.gen} έχει ${money}`,
    why: 'για την αίθουσα υπολογιστών', buy: 'Ο διευθυντής θέλει να αγοράσει', says: ['Θα αγοράσουμε', 'λέει ο διευθυντής'],
    noise: [n => `Στο σχολείο φοιτούν ${n * 20 + 120} μαθητές`, n => `Η αίθουσα έχει ${n + 12} θρανία`],
    their: 'τα χρήματα του σχολείου',
  },
  {
    title: 'Οι διακοπές',
    items: [pay('τα εισιτήρια του πλοίου', 180, 460), pay('το ξενοδοχείο', 650, 1_400, 10), pay('την ενοικίαση ενός αυτοκινήτου', 220, 480),
      pay('τις εκδρομές', 120, 350), pay('το φαγητό', 400, 900, 10)],
    has: (p, money) => `Η οικογένεια ${p.gen} έχει κρατήσει ${money}`,
    why: 'για τις καλοκαιρινές διακοπές', buy: 'Υπολογίζουν να πληρώσουν', says: ['Θα πληρώσουμε', 'λέει ο πατέρας'],
    noise: [n => `Το ταξίδι με το πλοίο κρατάει ${n} ώρες`, n => `Οι διακοπές θα κρατήσουν ${n + 4} ημέρες`],
    their: 'τα χρήματά τους',
  },
  {
    title: 'Ο αθλητικός σύλλογος',
    items: [worth('στολές για την ομάδα', 450, 980), worth('μπάλες', 120, 380), of('ένα καινούργιο καλάθι μπάσκετ', 600, 1_500),
      pay('το λεωφορείο για τους αγώνες', 300, 750), worth('στρώματα γυμναστικής', 250, 640)],
    has: (p, money) => `Ο αθλητικός σύλλογος της γειτονιάς ${p.gen} έχει ${money}`,
    why: 'για τη νέα χρονιά', buy: 'Ο προπονητής θέλει να πάρει', says: ['Θα πάρουμε', 'λέει ο προπονητής'],
    noise: [n => `Στον σύλλογο γράφτηκαν ${n * 10 + 40} παιδιά`, n => `Οι προπονήσεις γίνονται ${Math.min(n, 5)} φορές την εβδομάδα`],
    their: 'τα χρήματα του συλλόγου',
  },
];

export const budget: Family = {
  id: 'budget',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, κεφ. 2.8 «Η πρόσθεση και η αφαίρεση στους φυσικούς αριθμούς»',
  make(r, b) {
    const s = r.pick(SETTINGS);
    const [p] = people(r, 1);
    const n = r.int(2, 3);
    const items = r.sample(s.items, n);
    const prices = items.map(i => r.step(i.price[0], i.price[1], i.step) - (r.chance(0.4) ? 1 : 0));
    const total = prices.reduce((x, y) => x + y, 0);
    // The money: a round sum a bit above or below the total
    const enough = r.chance(0.5);
    const money = enough ? Math.ceil((total + r.int(20, 400)) / 50) * 50 : Math.floor((total - r.int(20, 400)) / 50) * 50;
    if (money <= 0 || money === total) return null;
    const diff = Math.abs(money - total);

    const list = items.map((it, k) => known(it.say(fmt(prices[k]))));
    const listText = list.length === 2 ? `${list[0]} και ${list[1]}` : `${list[0]}, ${list[1]} και ${list[2]}`;
    const noise = extra(r.pick(s.noise)(r.int(2, 9)));
    const has = s.has(p, known(`${fmt(money)} €`));
    const questions = r.chance(0.5)
      ? `${sought(`Φτάνουν ${s.their}`)}; ${sought('Πόσα € θα περισσέψουν ή θα λείψουν')};`
      : `${sought(`Φτάνουν ${s.their}`)}, και ${sought('πόσα € θα περισσέψουν ή θα λείψουν')};`;
    const t = r.int(0, 2);
    const story = t === 0
      ? `${has} ${s.why}. ${s.buy} ${listText}. ${noise}. ${questions}`
      : t === 1
        ? `${has} ${s.why}. ${noise}. ${s.buy} ${listText}. ${questions}`
        : `${has} ${s.why}. ${noise}. «${s.says[0]} ${listText}», ${s.says[1]}. ${questions}`;

    const show = r.chance(0.5);
    const sumLabel = show ? `${prices.map(fmt).join(' + ')} =` : 'Κοστίζουν όλα μαζί';
    const steps: ProblemStep[] = [b.tag(undefined, 'Χρειαζόμαστε τα χρήματα που υπάρχουν και τις τιμές. Ό,τι δεν αλλάζει το κόστος το αφήνουμε.')];
    const plan = r.chance(0.4);
    if (plan) {
      steps.push(b.order('plan', 'Βάζουμε τη λύση σε σειρά.', [
        'Προσθέτουμε όλες τις τιμές',
        `Συγκρίνουμε το άθροισμα με τα ${fmt(money)} €`,
        'Βρίσκουμε τη διαφορά με αφαίρεση',
      ], 'Πρώτα πρέπει να ξέρουμε πόσο κοστίζουν όλα μαζί.'));
    }
    steps.push(b.numbers('solve', 'Πόσο κοστίζουν όλα μαζί;', [{ label: sumLabel, answer: total, unit: '€' }],
      'Προσθέτουμε θέση προς θέση και προσέχουμε τα κρατούμενα.'));
    const top = Math.max(...prices);
    steps.push(b.choice('solve', `Φτάνουν ${s.their};`,
      enough ? `Ναι, γιατί ${fmt(total)} < ${fmt(money)}` : `Όχι, γιατί ${fmt(total)} > ${fmt(money)}`,
      [enough ? `Όχι, γιατί ${fmt(total)} > ${fmt(money)}` : `Ναι, γιατί ${fmt(total)} < ${fmt(money)}`,
        `Ναι, γιατί το ${fmt(top)} είναι μικρότερο από το ${fmt(money)}`],
      'Συγκρίνουμε το άθροισμα όλων των τιμών με τα χρήματα που υπάρχουν, όχι μία μόνο τιμή.'));
    steps.push(b.numbers('solve', enough ? 'Πόσα € θα περισσέψουν;' : 'Πόσα € θα λείψουν;', [
      { label: show ? (enough ? `${fmt(money)} − ${fmt(total)} =` : `${fmt(total)} − ${fmt(money)} =`) : (enough ? 'Περισσεύουν' : 'Λείπουν'), answer: diff, unit: '€' },
    ], 'Από τον μεγαλύτερο αριθμό βγάζουμε τον μικρότερο.'));
    if (!plan) {
      steps.push(b.numbers('check', enough ? 'Πώς ελέγχουμε; Όσα κοστίζουν όλα και όσα περισσεύουν κάνουν όσα χρήματα υπάρχουν.'
        : 'Πώς ελέγχουμε; Τα χρήματα που υπάρχουν και όσα λείπουν κάνουν όσα κοστίζουν όλα.', [
        { label: enough ? `${fmt(total)} + ${fmt(diff)} =` : `${fmt(money)} + ${fmt(diff)} =`, answer: enough ? money : total, unit: '€' },
      ]));
    }
    return { title: s.title, story, steps };
  },
};
