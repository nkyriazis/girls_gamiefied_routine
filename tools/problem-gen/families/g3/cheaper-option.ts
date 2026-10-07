// Two ways to buy the same amount: 3 packs of 4 at 5 euros, or 2 packs of 6 at 8 euros?
// The cost of each, which is cheaper, and by how much (Γ΄ κεφ. 11 «Πολλαπλασιασμός
// διψήφιου με μονοψήφιο αριθμό», κεφ. 18 «Διαιρέσεις» και κεφ. 10 «Αφαιρέσεις»).
import type { ProblemStep } from '../../../../shared/types.ts';
import { cap, extra, known, PEOPLE, sought, type Family } from '../../lib.ts';

interface Pack { one: string; many: string; gen: string; g: 'n' | 'f' }
interface Product {
  acc: string; // "αυγά", "μαρκαδόρους"
  it: string; // "τα", "τις", "τους": the pronoun for the things
  pack: Pack;
  sizes: [number, [number, number]][]; // pack size and its price range
  max: number; // most things anyone needs
  shops: [string, string];
  why: string;
}

const THIKI: Pack = { one: 'θήκη', many: 'θήκες', gen: 'μίας θήκης', g: 'f' };
const PAKETO: Pack = { one: 'πακέτο', many: 'πακέτα', gen: 'ενός πακέτου', g: 'n' };
const SYSK: Pack = { one: 'συσκευασία', many: 'συσκευασίες', gen: 'μίας συσκευασίας', g: 'f' };
const KOUTI: Pack = { one: 'κουτί', many: 'κουτιά', gen: 'ενός κουτιού', g: 'n' };

const PRODUCTS: Product[] = [
  { acc: 'αυγά', it: 'τα', pack: THIKI, sizes: [[6, [2, 3]], [10, [3, 5]], [12, [4, 6]]], max: 36,
    shops: ['στο μπακάλικο', 'στο σούπερ μάρκετ'], why: 'για να φτιάξει γλυκά για τη γιορτή του σχολείου' },
  { acc: 'γιαούρτια', it: 'τα', pack: PAKETO, sizes: [[2, [2, 3]], [3, [3, 4]], [4, [3, 5]]], max: 16,
    shops: ['στο γαλακτοπωλείο', 'στο σούπερ μάρκετ'], why: 'για όλη την οικογένεια' },
  { acc: 'μπαταρίες', it: 'τις', pack: SYSK, sizes: [[2, [2, 4]], [4, [4, 7]], [8, [7, 12]]], max: 24,
    shops: ['στο περίπτερο', 'στο σούπερ μάρκετ'], why: 'για τα τηλεκατευθυνόμενα αυτοκίνητα της τάξης' },
  { acc: 'μαρκαδόρους', it: 'τους', pack: KOUTI, sizes: [[6, [3, 5]], [12, [5, 9]]], max: 36,
    shops: ['στο βιβλιοπωλείο', 'στο χαρτοπωλείο'], why: 'για τη γωνιά ζωγραφικής της τάξης' },
  { acc: 'μπαλάκια του τένις', it: 'τα', pack: KOUTI, sizes: [[3, [4, 7]], [4, [5, 9]]], max: 24,
    shops: ['στο αθλητικό κατάστημα της πλατείας', 'στο αθλητικό κατάστημα της παραλίας'], why: 'για τις προπονήσεις της ομάδας' },
  { acc: 'μολύβια', it: 'τα', pack: KOUTI, sizes: [[5, [2, 4]], [10, [4, 7]]], max: 30,
    shops: ['στο βιβλιοπωλείο', 'στο χαρτοπωλείο'], why: 'για όλα τα παιδιά της τάξης' },
  { acc: 'μπουκάλια νερό', it: 'τα', pack: PAKETO, sizes: [[6, [2, 4]], [12, [4, 7]]], max: 36,
    shops: ['στο περίπτερο', 'στο σούπερ μάρκετ'], why: 'για την εκδρομή της τάξης' },
];

const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);
const from = (shop: string) => shop.replace(/^στο /, 'από το ').replace(/^στη /, 'από τη ').replace(/^στην /, 'από την ');

export const cheaperOption: Family = {
  id: 'cheaper-option',
  grade: 3,
  unit: 2,
  source: 'Μαθηματικά Γ΄, κεφ. 11 «Πολλαπλασιασμός διψήφιου με μονοψήφιο αριθμό» και κεφ. 10 «Αφαιρέσεις διψήφιων και τριψήφιων αριθμών»',
  make(r, b) {
    const pr = r.pick(PRODUCTS);
    const [[a, ra], [c, rc]] = r.sample(pr.sizes, 2);
    const lcm = (a * c) / gcd(a, c);
    const total = lcm * r.int(1, Math.max(1, Math.floor(pr.max / lcm)));
    if (total > pr.max) return null;
    const na = total / a, nc = total / c;
    const pa = r.int(...ra), pc = r.int(...rc);
    const A = na * pa, C = nc * pc;
    if (A === C || Math.abs(A - C) > 12 || Math.max(A, C) > 100) return null;
    // The bigger pack costs more, and the price of one thing differs by less than a half
    const [small, big] = a < c ? [[a, pa], [c, pc]] : [[c, pc], [a, pa]];
    if (big[1] <= small[1]) return null;
    const unit = (big[1] / big[0]) / (small[1] / small[0]);
    if (unit < 0.65 || unit > 1.5) return null;
    const P = pr.pack;
    const packs = (n: number, size: number) => `${n === 1 ? (P.g === 'f' ? 'μία' : 'ένα') : n} ${n === 1 ? P.one : P.many} με ${size} ${pr.acc}`;
    const onePack = (size: number) => `${P.g === 'f' ? 'μια' : 'ένα'} ${P.one} με ${size} ${pr.acc}`;
    const p = r.pick(PEOPLE);
    const [q] = r.sample(PEOPLE.filter(x => x !== p), 1);
    const cheapA = A < C;
    const diff = Math.abs(A - C);

    const telling = r.int(0, 2);
    let story: string, options: [string, string];
    const noise = telling === 0
      ? r.pick([`Τα δύο μαγαζιά απέχουν ${extra(`${r.int(2, 6)} στενά`)}.`, `Είναι ${extra(`${r.int(9, 11)} η ώρα`)} το πρωί.`])
      : r.pick([`Στο ράφι υπάρχουν ${extra(`${r.int(10, 30)} ${P.many}`)}.`, `Το σούπερ μάρκετ κλείνει στις ${extra(`${r.int(8, 9)} το βράδυ`)}.`]);
    if (telling === 0) {
      // Two shops
      story = `${p.Nom} χρειάζεται ${known(`${total} ${pr.acc}`)} ${pr.why}. ${cap(pr.shops[0])}, ${known(onePack(a))} κοστίζει ${known(`${pa} ευρώ`)}. `
        + `${cap(pr.shops[1])}, ${known(onePack(c))} κοστίζει ${known(`${pc} ευρώ`)}. ${noise} `
        + `${sought(`Πού θα ${pr.it} πάρει φθηνότερα`)}; ${sought('Πόσα ευρώ λιγότερα θα πληρώσει')};`;
      options = [cap(from(pr.shops[0])), cap(from(pr.shops[1]))];
    } else if (telling === 1) {
      // One shop, two packs
      story = `Στο σούπερ μάρκετ, ${known(onePack(a))} κοστίζει ${known(`${pa} ευρώ`)} και ${known(onePack(c))} κοστίζει ${known(`${pc} ευρώ`)}. `
        + `${p.Nom} θέλει να πάρει ${known(`${total} ${pr.acc}`)} ${pr.why}. ${noise} `
        + `${sought(`Με ποι${P.g === 'f' ? 'ες' : 'α'} ${P.many} θα πληρώσει λιγότερα`)}; ${sought('Πόσα λιγότερα')};`;
      options = [`Με ${P.many} των ${a}`, `Με ${P.many} των ${c}`];
    } else {
      // Two people who bought the same amount
      story = `${p.Nom} αγόρασε ${known(packs(na, a))} και έδωσε ${known(`${pa} ευρώ`)} για ${P.g === 'f' ? 'την καθεμία' : 'το καθένα'}. `
        + `${q.Nom} αγόρασε ${known(packs(nc, c))}, στα ${known(`${pc} ευρώ`)} ${P.g === 'f' ? 'την καθεμία' : 'το καθένα'}. `
        + `Έτσι πήραν και οι δύο ${extra(`${total} ${pr.acc}`)}. ${sought('Ποιο παιδί πλήρωσε λιγότερα')}; ${sought('Πόσα ευρώ λιγότερα')};`;
      options = [p.Nom, q.Nom];
    }

    const steps: ProblemStep[] = [b.tag(undefined, telling === 2
      ? `Για το κόστος χρειαζόμαστε πόσ${P.g === 'f' ? 'ες' : 'α'} ${P.many} πήρε το κάθε παιδί και πόσο κάνει ${P.g === 'f' ? 'η καθεμία' : 'το καθένα'}.`
      : `Χρειαζόμαστε πόσα θέλει να πάρει και πόσο κοστίζει κάθε ${P.one}.`)];
    if (telling !== 2) {
      steps.push(b.numbers('plan', `Πόσ${P.g === 'f' ? 'ες' : 'α'} ${P.many} χρειάζεται από κάθε είδος;`, [
        { label: `${cap(P.many)} με ${a}: ${total} : ${a} =`, answer: na },
        { label: `${cap(P.many)} με ${c}: ${total} : ${c} =`, answer: nc },
      ], `Πόσες φορές χωράει το ${a} στο ${total};`));
    }
    const ops = telling === 2 || r.chance(0.6);
    steps.push(b.numbers('solve', 'Πόσο κοστίζει ο κάθε τρόπος;', [
      { label: ops ? `${na} × ${pa} =` : `${cap(P.many)} με ${a}`, answer: A, unit: 'ευρώ' },
      { label: ops ? `${nc} × ${pc} =` : `${cap(P.many)} με ${c}`, answer: C, unit: 'ευρώ' },
    ], `Όσ${P.g === 'f' ? 'ες' : 'α'} ${P.many}, επί την τιμή ${P.g === 'f' ? 'της μίας' : 'του ενός'}.`));
    const trap = (pa < pc) !== cheapA; // the cheaper pack is not the cheaper way
    steps.push(b.choice('solve', telling === 2 ? 'Ποιο παιδί πλήρωσε λιγότερα;' : 'Ποιος τρόπος είναι φθηνότερος;',
      cheapA ? options[0] : options[1], [cheapA ? options[1] : options[0], ['Κοστίζουν το ίδιο παντού', 'Κοστίζουν το ίδιο', 'Ακριβώς ίσα'][telling]],
      trap ? `Δεν κοιτάμε την τιμή ${P.gen}, αλλά όσα πληρώνουμε για όλα: ${A} ή ${C} ευρώ;` : `Συγκρίνουμε ${A} και ${C} ευρώ.`));
    steps.push(b.numbers('check', 'Πόσα ευρώ λιγότερα;', [
      { label: r.chance(0.6) ? `${Math.max(A, C)} − ${Math.min(A, C)} =` : 'Λιγότερα', answer: diff, unit: 'ευρώ' },
    ], 'Από το μεγαλύτερο κόστος βγάζουμε το μικρότερο.'));
    return { title: r.pick(['Ποιο συμφέρει;', 'Το φθηνότερο', 'Συγκρίνουμε τιμές', 'Έξυπνα ψώνια']), story, steps };
  },
};
