// Stories that read right (#50): who is meant, the order of events, both sides of a gift,
// and prices. Written apart from the generators: it reads the story as a child does, plus the
// calc step's quantities and relations. audit.ts runs it on every problem of every pool, as
// errors (#50 part 5b); story-check.test.ts holds a case for each rule.
//
// People are the children of lib.ts and relatives and friends («η γιαγιά», «ο θείος», «η φίλη της»).
//   - a clitic before a verb («του χάρισε», «της έμειναν») has one person of its gender to point
//     at: in the sentence before (not the sentence's own subject), or else the only one so far;
//   - two sentences in a row don't open with the same person («Ο Θοδωρής … Ο Θοδωρής …»);
//   - two told sentences in a row don't both say the same «<noun> του/της <someone>» («Στο άλμπουμ
//     του Στέλιου … Το άλμπουμ του Στέλιου …»);
//   - nothing changes after a «Τώρα» sentence (the question aside), except what a sentence opening
//     with «Νωρίτερα» tells: that came before («Τώρα … έχει 115. Νωρίτερα αγόρασε…»);
//   - when more than one person is the subject of a sentence, a question names whom it means if its
//     verb is singular and it has no subject of its own («Πόσες κάρτες είχε στην αρχή;» after two
//     children «είχε»). A plural verb («μάζεψαν και οι δύο μαζί»), its own subject («η ρόδα», «ο
//     καθένας», «ποιο παιδί», «κάθε σειρά», a neuter «το καρουζέλ» only where it can't be the object)
//     or no verb («Πόσα ευρώ λιγότερα;») pass;
//   - the worst case: right after a sentence whose subject is someone the story isn't about (another
//     child, or a relative or friend of the hero), a question with no subject of its own reads as
//     about that one, by its verb («… Η φίλη του έχει 12 νομίσματα. Πόσα λεπτά έχει;») or by its
//     «του/της» («… Η αδερφή της είναι 7 χρονών. Πόσα ευρώ θα της μείνουν;»);
//   - «Αναρωτιέται»: whoever wonders is named in that sentence, or is the one person of the sentence
//     before, or the only one so far (the clitic's rule, any gender);
//   - a gift between two people who both have a «… τώρα» quantity is in each one's relations
//     (otherwise a right calculation on that side reads back as meaning nothing);
//   - a world check step has at least 3 options;
//   - prices (readPrices): every price names its item in its own sentence, and the item costs
//     within its range (ITEMS below, per piece: a pack «με 6 χυμούς» or a total «τα πέντε τετράδια
//     κοστίζουν» is divided by its count); notes and coins are real ones; «πληρώνει με» is a sum of
//     real notes, at least the price, that needs its largest note.

import type { ProblemExercise } from '../../shared/types.ts';
import { PEOPLE, type Person } from './lib.ts';

const MARK = /\[([^\]|]+)\|(known|sought|extra)\]/g;
const plain = (story: string) => story.replace(MARK, '$1');
const NUM = /\d{1,3}(?:\.\d{3})+|\d+/;
const toNumber = (s: string) => Number(s.replace(/\./g, ''));
const WORDS: Record<string, number> = {
  ένα: 1, δύο: 2, τρία: 3, τρεις: 3, τέσσερα: 4, τέσσερις: 4, πέντε: 5, έξι: 6, επτά: 7, εφτά: 7, οκτώ: 8, οχτώ: 8,
  εννέα: 9, εννιά: 9, δέκα: 10, έντεκα: 11, δώδεκα: 12,
};
const COUNT = `${NUM.source}|${Object.keys(WORDS).join('|')}`;
const value = (s: string) => /\d/.test(s) ? toNumber(s) : WORDS[s.toLowerCase()];
/** The first number in a sentence, in digits or in words («ένα» aside: it is mostly «a»). */
const numberIn = (s: string) => {
  const d = s.match(NUM);
  if (d) return toNumber(d[0]);
  const w = s.split(/[\s.,;;]+/).find(x => x.toLowerCase() in WORDS && x.toLowerCase() !== 'ένα');
  return w ? WORDS[w.toLowerCase()] : undefined;
};

// ---------------------------------------------------------------------------------------------
// People: the children, and relatives and friends

interface Who { bare: string; female: boolean; Nom: string; nom: string; words: string[]; gen: string }
const child = (p: Person): Who => ({ bare: p.bare, female: p.female, Nom: p.Nom, nom: p.nom, gen: p.gen.split(' ')[1], words: [p.bare, p.gen.split(' ')[1], p.acc.split(' ')[1]] });
const relative = (nom: string, gen: string, acc: string, female: boolean): Who =>
  ({ bare: nom, female, Nom: `${female ? 'Η' : 'Ο'} ${nom}`, nom: `${female ? 'η' : 'ο'} ${nom}`, gen, words: [nom, gen, acc] });
export const RELATIVES: Who[] = [
  relative('γιαγιά', 'γιαγιάς', 'γιαγιά', true), relative('παππούς', 'παππού', 'παππού', false),
  relative('μαμά', 'μαμάς', 'μαμά', true), relative('μπαμπάς', 'μπαμπά', 'μπαμπά', false),
  relative('μητέρα', 'μητέρας', 'μητέρα', true), relative('πατέρας', 'πατέρα', 'πατέρα', false),
  relative('θεία', 'θείας', 'θεία', true), relative('θείος', 'θείου', 'θείο', false),
  relative('νονά', 'νονάς', 'νονά', true), relative('νονός', 'νονού', 'νονό', false),
  relative('αδερφή', 'αδερφής', 'αδερφή', true), relative('αδερφός', 'αδερφού', 'αδερφό', false),
  relative('ξαδέρφη', 'ξαδέρφης', 'ξαδέρφη', true), relative('ξάδερφος', 'ξαδέρφου', 'ξάδερφο', false),
  relative('φίλη', 'φίλης', 'φίλη', true), relative('φίλος', 'φίλου', 'φίλο', false),
];
const WHO: Who[] = [...PEOPLE.map(child), ...RELATIVES];
const CHILD = new Map(PEOPLE.map(p => [p.bare, p]));

const word = (w: string) => new RegExp(`(?<!\\p{L})(?:${w})(?!\\p{L})`, 'u');
const mentions = (s: string) => WHO.filter(p => p.words.some(f => word(f).test(s)));
/** People in the nominative, with their article: «ο Θοδωρής», «Η γιαγιά» (not «τη Χαρά»). */
const subjects = (s: string) => WHO.filter(p => word(`(?:${p.female ? 'η|Η' : 'ο|Ο'}) ${p.bare}`).test(s));
const opener = (s: string) => WHO.find(p => new RegExp(`^${p.Nom}(?!\\p{L})`, 'u').test(s));
const isQuestion = (s: string) => /[;;]$/.test(s) || /^(Να βρεις|Θέλουμε να βρούμε)/.test(s) || /ναρωτιέται/.test(s);
const CLITIC = /(?<!\p{L})(του|της) (?:θα )?(χάρισε|χαρίζει|έδωσε|δίνει|πήρε|περισσέψουν|περισσεύουν|έμειναν|μένουν|μείνουν|λείπουν|λείψουν)(?!\p{L})/u;
const CHANGE = /χάρισε|έδωσε|έχασε|αγόρασε|ξόδεψε|πήρε|έβαλε/;
const GIFT = /χάρισε|έδωσε|πήρε/;
const GENITIVES = new Set(WHO.map(p => p.gen));

// ---------------------------------------------------------------------------------------------
// Questions: whom a question with no name means

const NOT_VERB = new Set(['κάθε', 'πέντε', 'ποτέ', 'τότε', 'πότε', 'εκεί', 'όταν', 'αν', 'καν', 'σαν', 'ότε']);
const SINGULAR = /(?:ει|εί|ε|εται|ιέται|άει|άται)$/u;
const PLURAL = /(?:ουν|ούν|ουνε|αν|ανε|ονται|ούνται|ιούνται)$/u;
/** The question's first verb: singular, plural, or none (a follow-up: «Πόσα ευρώ λιγότερα;»). */
const firstVerb = (q: string): { form: 'sg' | 'pl'; at: number; word: string } | undefined => {
  for (const m of q.matchAll(/\p{L}+/gu)) {
    const w = m[0].toLowerCase();
    if (w.length < 3 || NOT_VERB.has(w)) continue;
    if (PLURAL.test(w)) return { form: 'pl', at: m.index!, word: w };
    if (SINGULAR.test(w)) return { form: 'sg', at: m.index!, word: w };
  }
  return undefined;
};
// A neuter «το/τα …» after these is their subject («Πόσα € κοστίζει το κουδουνάκι;»); after others
// it may be the object («Πόσες φορές θα γεμίσει το δοχείο;»), unless «Πόσα <thing>» is the object
// already («Πόσα € θα πληρώσει το σχολείο;»). Times and counts of times are no object.
const STATIVE = /^(?:έχει|είχε|κοστίζει|κόστιζε|κόστισε|κοστίσει|κρατάει|κρατά|κράτησε|διαρκεί|διάρκεσε|χωράει|χωρά|ζυγίζει|ζύγιζε|μένει|έμεινε|περισσεύει|περίσσεψε|λείπει|χρειάζεται|απέχει)$/u;
const MEASURES = /^(?:φορές|λεπτά|ώρες|ημέρες|μέρες|δευτερόλεπτα|εβδομάδες|μήνες|χρόνια|χρονών)$/u;
const PREPOSITION = '(?:για|από|με|σε|στο|στα|στον|στη|στην|στις|στους|προς|ως|μέχρι|χωρίς|μετά|πριν|ανά)';
const ownSubject = (q: string, verb: { at: number; word: string }) => {
  if (/(?<!\p{L})(?:ο|η|οι|Ο|Η|Οι) \p{L}/u.test(q)) return true; // «η ρόδα», «ο καθένας», «οι δύο»
  if (/(?<!\p{L})(?:[Ππ]οιο|[Ππ]οιος|[Ππ]οια|[Ππ]οιοι)(?!\p{L})/u.test(q)) return true; // «ποιο παιδί»
  if (new RegExp(`(?<!${PREPOSITION} )(?<!\\p{L})(?:κάθε \\p{L}+|το καθένα|η καθεμία|η καθεμιά)`, 'u').test(q)) return true;
  const after = q.slice(verb.at + verb.word.length);
  const neuter = new RegExp(`(?<!${PREPOSITION} )(?<!\\p{L})(?:το|τα) \\p{L}+`, 'u').test(after);
  if (!neuter) return false;
  const object = q.match(/^(?:Πόσα|Πόσες|Πόσους|Πόσοι) (\p{L}+)/u);
  return STATIVE.test(verb.word) || (!!object && !MEASURES.test(object[1]) && !/^(?:θα|να)$/.test(object[1]));
};

// ---------------------------------------------------------------------------------------------
// Prices

/**
 * What one piece costs, in euros: what a Greek shop asks (2025–26), from a cheap shop or the λαϊκή to a
 * dear one, wide on purpose. Written from real prices, not from the pools: a price a family writes
 * outside its item's range is fixed in the family. Per piece: a pack's price is divided by its count
 * («κουτί με 12 μαρκαδόρους για 6 €»: 0,50 € a μαρκαδόρος); a pack told without a count is an item
 * of its own («κουτί ξυλομπογιές»). A plural with no count («Οι χυμοί κοστίζουν…») is what a class
 * buys for a party. Tickets: a child's is at most an adult's. [item, lo, hi, eachLo, eachHi]: the last two
 * when one piece of a pack differs from what is bought by itself («έδωσε 4 € για αυγά», one egg 0,33 €).
 */
type Item = [re: string, lo: number, hi: number, eachLo?: number, eachHi?: number];
const ITEMS: Item[] = [
  // Toys and things a child buys (Jumbo, a toy shop; in line with prices.ts and the README's 5–60 €); a book
  // from a 3 € children's paperback to a 30 € hardback
  ['παζλ', 4, 40], ['μπάλ(?:α|ας|ες)', 5, 40], ['βιβλί(?:ο|α)', 3, 30], ['κασετίνα', 3, 25], ['επιτραπέζιο', 8, 60],
  ['σακίδιο', 10, 70], ['σχολική τσάντα', 15, 80], ['κούκλα', 5, 50], ['αυτοκινητάκι', 2, 25], ['αυτοκίνητο ράλι', 10, 70],
  ['πατίνια', 20, 90], ['πατίνι', 20, 150], ['τηλεσκόπιο', 15, 90], ['ποδήλατο', 70, 600], ['κιθάρα', 50, 500],
  ['πιάνο', 80, 900], ['γιογιό', 1, 10], ['λούτρινο αρκουδάκι', 5, 35], ['σ[κχ]οινάκι', 2, 12], ['φυτό', 3, 40], ['βραχιόλι', 2, 40],
  ['σκέιτμπορντ', 20, 150], ['(?:σετ με )?τουβλάκια', 10, 100], ['αναμνηστικό', 1, 15],
  // Stationery and small things (a χαρτοπωλείο, a περίπτερο)
  ['τετράδι(?:ο|α)', 0.5, 5], ['τετράδι(?:ο|α) ζωγραφικής', 1, 6], ['μαρκαδόρ\\p{L}*', 0.3, 3], ['κουτί μαρκαδόρους', 2, 20],
  ['μολύβι(?:α)?', 0.2, 2], ['ξυλομπογιές', 2, 20], ['λεξικό', 8, 40], ['ημερολόγιο', 3, 20], ['κάρτα με (?:τις )?ευχές', 1, 6],
  ['χαρτί περιτυλίγματος', 1, 6], ['κορδέλα', 0.5, 6], ['αυτοκόλλητο', 0.1, 2], ['περιοδικό', 2, 8], ['τσίχλα', 0.2, 1.5],
  ['μπαταρί(?:α|ες)', 0.3, 3], ['φακός', 3, 25], ['γόμα', 0.2, 2], ['άλμπουμ ζωγραφικής', 2, 12],
  ['κάρτ(?:α|ες)', 0.5, 6], ['φακελάκι', 0.5, 3],
  // A pack named by itself (what is in it is in the sentence before): stickers, an empty box to pack in
  ['πακέτο', 0.5, 8], ['κουτί', 0.2, 5],
  // Sport and the bicycle (Decathlon, a bike shop)
  ['φόρμα', 15, 70], ['παγούρι', 3, 25], ['παπούτσια', 20, 150], ['τσάντα για το γυμναστήριο', 10, 50], ['κάλτσες', 1, 12], ['φανέλα', 8, 70], ['μπλουζάκι(?:α)?', 4, 30],
  ['μπαλάκια? του τένις|μπαλάκια?', 0.5, 3], ['κράνος', 15, 80], ['κουδούνι|κουδουνάκι', 2, 15], ['φωτάκια', 5, 30],
  ['κλειδαριά', 5, 40], ['καλαθάκι', 8, 40],
  // Food (the σούπερ μάρκετ, the λαϊκή per kilo, a ζαχαροπλαστείο); a class party's plural with no count is the lot
  ['τούρτα', 15, 45], ['οι χυμοί', 3, 25], ['χυμ(?:ός|ό|ούς|οί)', 0.4, 3], ['τα πατατάκια', 2, 20], ['πατατάκια', 0.8, 4],
  ['(?:τα|χάρτινα) ποτήρια', 1, 8], ['τα μπαλόνια', 2, 15], ['μπαλόνι(?:α)?', 0.2, 6], ['σοκολάτα', 0.5, 5], ['λουλούδι', 0.5, 6],
  ['λουλούδια', 3, 40], ['μάτσο λουλούδια', 3, 25], ['τριαντάφυλλο', 1, 5], ['γλάστρ(?:α|ες)(?: με βασιλικό)?', 1.5, 25],
  ['παγωτ(?:ό|ά)', 1, 6], ['παγωτό κασάτο', 3, 15], ['κουτί κουλουράκια', 3, 15], ['ταψί μπακλαβά', 15, 60],
  ['μαλλί της γριάς', 1, 5], ['ποπ ?κ(?:ο|ό)ρν', 1.5, 8], ['τοστ', 1.5, 5], ['σάντουιτς', 2, 6], ['κουλούρι', 0.3, 1.5], ['πίτσα', 6, 20], ['λουκουμάδες', 3, 15],
  ['φρούτα', 2, 25], ['κεράσια', 2, 12], ['πατάτες', 0.5, 2.5], ['ντομάτες', 0.8, 4], ['μήλα', 0.8, 4], ['πορτοκάλια', 0.5, 2.5], ['φράουλες', 2, 8], ['καρπούζι', 2, 12],
  ['βάζο μέλι', 4, 20], ['αυγ(?:ό|ά)', 1, 10, 0.15, 0.8], ['θήκη αυγά', 1.5, 7],
  ['γιαούρτι(?:α)?', 0.4, 2.5], ['μπουκάλι(?:α)? νερό', 0.15, 1.5],
  // Tickets and outings, per person (a child's at most an adult's; a school group's from 3–5 €). A ticket
  // of no named kind runs from a bus fare to an intercity train
  ['εισιτήρι(?:ο|α)', 1, 50], ['ρόδα', 2, 10], ['συγκρουόμενα', 2, 8], ['γύρ(?:ος|ο)', 1, 6], ['κινηματογράφου', 4, 14],
  ['μουσεί(?:ο|ου)(?: φυσικής ιστορίας)?', 2, 20], ['πλανηταρίου', 4, 15], ['ενυδρείου', 5, 25], ['ζωολογικού κήπου', 6, 25],
  ['θεατρικής παράστασης', 5, 35], ['εισιτήριο του πλοίου', 10, 90], ['εισιτήριο του τρένου', 5, 70], ['είσοδ(?:ος|ο)', 2, 40],
  ['κάρτα για τους αναβατήρες', 15, 60],
  // A family's trip and holidays (Ε΄): per night, per way, or the lot
  ['δωμάτιο', 30, 250], ['βενζίνη', 15, 250], ['διόδια', 1, 40], ['για το αυτοκίνητο', 20, 200], ['πάρκινγκ', 2, 25],
  ['στάθμευση', 0.5, 5], ['εκδρομές', 30, 1500], ['ενοικίαση ενός αυτοκινήτου', 100, 1200], ['ενοικίαση ενός λεωφορείου', 200, 1500],
  ['φαγητό', 100, 2500], ['ξενοδοχείο', 150, 3500], ['τα εισιτήρια του πλοίου', 40, 1000],
  // Clothes (Ε΄)
  ['μπλούζα', 5, 50], ['παντελόνι', 10, 80], ['μπουφάν', 25, 200], ['φούτερ', 10, 70],
  // Furniture and appliances (Ε΄ budget: IKEA to a dear shop, Κωτσόβολος)
  ['καναπέ(?:ς)?', 200, 2500], ['κρεβάτι', 150, 1500], ['βιβλιοθήκη', 50, 800], ['ντουλάπα', 150, 1500], ['γραφείο', 60, 800],
  ['τραπεζαρία', 200, 2000], ['κουζίνα', 250, 1500], ['πλυντήριο ρούχων', 250, 1200], ['φούρνο(?:ς)? μικροκυμάτων', 50, 300],
  ['τηλεόραση', 150, 2000], ['ψυγείο', 300, 2000], ['οθόνη', 80, 800], ['διαδραστικό(?:ς)? πίνακα(?:ς)?', 800, 4000], ['ηλεκτρική σκούπα', 50, 600], ['φορητό(?:ς)? υπολογιστή(?:ς)?', 300, 2000], ['κάμερα', 50, 1500],
  ['προβολέα(?:ς)?', 150, 2000], ['εκτυπωτή(?:ς)?', 50, 800], ['πλακάκι(?:α)?', 0.5, 15],
  // A school's or a club's lot («αξίας»)
  ['ηχεία', 30, 1500], ['στρώματα γυμναστικής', 80, 3000], ['μπάλες αξίας', 30, 800], ['στολές(?: για την ομάδα)?', 100, 3000],
  ['καλάθι μπάσκετ', 80, 1500],
];

const NOTES = [5, 10, 20, 50, 100, 200, 500];
const CENT_COINS = [1, 2, 5, 10, 20, 50];
const EURO_COINS = [1, 2];

// An amount of money: «12 ευρώ», «12 €», «δέκα ευρώ», «2 ευρώ και 50 λεπτά», «40 λεπτά»
const MONEY = new RegExp(`(?<![\\p{L}\\d.])(${COUNT})\\s*(ευρώ|€)(?:\\s+και\\s+(\\d+)\\s+λεπτά)?|(?<![\\p{L}\\d.])(\\d+)\\s+(λεπτά|λεπτών)(?!\\p{L})`, 'gu');
const COST = /(?:κοστίζει|κοστίζουν|κόστιζε|κόστιζαν|κόστισε|κόστισαν|κοστίσει|κοστίσουν)\s*$/iu;
const COST_PLURAL = /(?:κοστίζουν|κόστιζαν|κόστισαν|κοστίσουν|κάνουν|έκαναν)\s*$/iu;
const MAKES = /(?:κάνει|κάνουν|έκανε|έκαναν)\s*$/iu; // «που κάνει 25 ευρώ»: a price only with its item
const PAY = /(?<!\p{L})(?:ξόδεψε|ξοδεύει|ξόδεψαν|ξοδεύουν|πλήρωσε|πληρώνει|πλήρωσαν|πληρώνουν|πληρώσει|πληρώσουν|πληρώσουμε|έδωσε|δίνει|έδωσαν|δίνουν|δώσει|δώσουν|έβγαλε|βγάζει)(?!\p{L})/iu;
const PER = /^\s*(?:το κιλό|την καθεμία|την καθεμιά|το καθένα|ο καθένας|η καθεμία|η καθεμιά|το άτομο|τη νύχτα|την ημέρα|την ώρα|τον μήνα|για την καθεμία|για το καθένα)(?!\p{L})/iu;
const DENOMINATION = /(χαρτονόμισμα|χαρτονομίσματα|κέρμα|κέρματα|νόμισμα|νομίσματα) των\s*$/u;

export interface Price { sentence: string; amount: number; item?: string; lo?: number; hi?: number; each: number; per: number }

/** The item nearest the end (or the start) of a stretch of text: [index in ITEMS, match]. */
const nearest = (text: string, fromEnd: boolean) => {
  let best: [number, RegExpMatchArray] | undefined;
  ITEMS.forEach(([re], i) => {
    for (const m of text.matchAll(new RegExp(`(?<!\\p{L})(?:${re})(?!\\p{L})`, 'giu'))) {
      if (!best) { best = [i, m]; continue; }
      const [, b] = best;
      const end = m.index! + m[0].length, bEnd = b.index! + b[0].length;
      const better = fromEnd ? end > bEnd || (end === bEnd && m[0].length > b[0].length)
        : m.index! < b.index! || (m.index === b.index && m[0].length > b[0].length);
      if (better) best = [i, m];
    }
  });
  return best;
};

/** The text ends with an item: «Για κάθε παιδί πληρώνει εισιτήριο ». */
const endsWithItem = (text: string) => {
  const near = nearest(text, true);
  return !!near && text.slice(near[1].index! + near[1][0].length).trim() === '';
};

/** Every price a story tells, with its item, and what one piece comes to. */
export function readPrices(story: string): (Price | { sentence: string; note: string })[] {
  const out: (Price | { sentence: string; note: string })[] = [];
  for (const s of plain(story).split(/(?<=[.;;])\s+/)) {
    const ms = [...s.matchAll(MONEY)];
    let last: { item?: [number, RegExpMatchArray] } | undefined; // the sentence's price before this one
    ms.forEach((m, k) => {
      const euros = m[1] !== undefined ? value(m[1]) + (m[3] ? Number(m[3]) / 100 : 0) : Number(m[4]) / 100;
      const cents = m[1] === undefined;
      const start = k ? ms[k - 1].index! + ms[k - 1][0].length : 0;
      const before = s.slice(start, m.index);
      const after = s.slice(m.index! + m[0].length, k + 1 < ms.length ? ms[k + 1].index : s.length);
      const wasPrice = last;
      last = undefined;
      // A note or a coin: «χαρτονόμισμα των 50 ευρώ», «κέρματα των 20 λεπτών»
      const den = before.match(DENOMINATION);
      if (den) {
        const n = cents ? euros * 100 : euros;
        const ok = /χαρτον/.test(den[1]) ? !cents && NOTES.includes(n) : cents ? CENT_COINS.includes(n) : EURO_COINS.includes(n);
        if (!ok) out.push({ sentence: s, note: `${/χαρτον/.test(den[1]) ? 'note' : 'coin'} of ${n} ${cents ? 'λεπτά' : '€'}` });
        return;
      }
      if (/^\s*(?:λιγότερ|περισσότερ)/u.test(after)) return; // a difference, not a price
      if (cents && !COST.test(before)) return; // «40 λεπτά» is mostly minutes
      const per = PER.test(after);
      const forItem = after.match(/^\s*(?:ο καθένας |η καθεμία |η καθεμιά )?για (?!την καθεμία|την καθεμιά|το καθένα|κάθε|να )([^,]*)/u);
      const forToBuy = after.match(/^\s*για να (?:αγοράσει|αγοράσουν|πάρει|πάρουν) ([^,]*)/u);
      let item: [number, RegExpMatchArray] | undefined;
      let kind: 'cost' | 'makes' | 'of' | 'pay' | 'per' | 'elided' | undefined;
      if (COST.test(before)) kind = 'cost';
      else if (MAKES.test(before)) kind = 'makes';
      else if (/(?<!\p{L})(?:των|(?<!συνολικής )αξίας|στα|για)\s*$/u.test(before) || (/(?<!\p{L})με\s*$/u.test(before) && /αγορ/u.test(before))) kind = 'of';
      else if (PAY.test(s.slice(0, m.index)) && (forItem || forToBuy || (/(?<!\p{L})[Γγ]ια (?!κάθε)/u.test(before) && new RegExp(`${PAY.source}\\s*$`, 'iu').test(before)))) kind = 'pay';
      else if (per) kind = 'per';
      else if (wasPrice && before.trim().split(/\s+/).length <= 7 && !before.split(/[\s,]+/).some(w => !NOT_VERB.has(w.toLowerCase()) && w.length > 2 && (PLURAL.test(w) || SINGULAR.test(w)))) kind = 'elided';
      else if (PAY.test(s.slice(0, m.index)) && endsWithItem(before)) kind = 'of'; // «πληρώνει εισιτήριο 4 ευρώ»
      if (!kind) return;
      const forText = kind === 'pay' && (forToBuy ?? forItem) ? (forToBuy ?? forItem)![1] : undefined;
      // «… για ένα σκοινάκι και μετά άλλα 20 ευρώ για μια φανέλα»: the item is after «για», or none
      if (forText !== undefined) item = nearest(forText, false);
      else item = nearest(before, true) ?? (kind === 'elided' || kind === 'pay' ? wasPrice?.item : undefined);
      if (kind === 'makes' && !item) return;
      last = { item };
      if (!item) { out.push({ sentence: s, note: `a price that names no item in its sentence (or one the audit has no range for): ${fmtEuro(euros)}` }); return; }
      // What one piece costs: a pack «με 6 χυμούς», a total «τα πέντε τετράδια κοστίζουν»
      const [i, im] = item;
      const lead = (forText ?? before).slice(0, im.index);
      const pack = lead.match(new RegExp(`(?<!\\p{L})με (${COUNT}) $`, 'u'));
      const count = !per && COST_PLURAL.test(before) ? lead.match(new RegExp(`(?<!\\p{L})(${COUNT}) $`, 'u')) : null;
      const n = pack ? value(pack[1]) : count ? value(count[1]) : 1;
      const [, lo, hi, eachLo, eachHi] = ITEMS[i];
      out.push({ sentence: s, amount: euros, item: im[0], lo: n > 1 ? eachLo ?? lo : lo, hi: n > 1 ? eachHi ?? hi : hi, each: euros / n, per: n });
    });
  }
  return out;
}

const fmtEuro = (x: number) => `${Number.isInteger(x) ? x : x.toFixed(2).replace('.', ',')} €`;

export function checkStory(ex: ProblemExercise): string[] {
  const out: string[] = [];
  const text = plain(ex.story);
  const ss = text.split(/(?<=[.;;])\s+/);
  const told = ss.filter(s => !isQuestion(s));

  // Who a clitic points at: one person of its gender in the sentence before (not the
  // sentence's own subject), or else the only one named so far (either gender: «Αναρωτιέται»)
  const referent = (i: number, female?: boolean): Who | undefined | null => {
    const own = subjects(ss[i]);
    const fits = (s: string) => mentions(s).filter(p => (female === undefined || p.female === female) && !own.includes(p));
    const prev = i > 0 ? fits(ss[i - 1]) : [];
    if (prev.length) return prev.length === 1 ? prev[0] : null;
    const before = [...new Set(ss.slice(0, i).flatMap(fits))];
    return before.length === 1 ? before[0] : before.length ? null : undefined;
  };
  ss.forEach((s, i) => {
    const m = s.match(CLITIC);
    if (!m) return;
    const who = referent(i, m[1] === 'της');
    if (who === undefined) out.push(`«${m[0]}» before anyone it could mean is named: «${s}»`);
    if (who === null) out.push(`«${m[0]}» could mean more than one person: «${s}»`);
  });

  for (let i = 1; i < ss.length; i++) {
    const p = opener(ss[i]);
    if (p && p === opener(ss[i - 1])) out.push(`two sentences in a row open with «${p.Nom}»: «${ss[i - 1]} ${ss[i]}»`);
  }

  // «Στο άλμπουμ του Στέλιου … Το άλμπουμ του Στέλιου …»: said once, then «Το άλμπουμ»
  const owned = (s: string) => new Set([...s.matchAll(/(\p{L}+) (του|της) (\p{L}+)/gu)]
    .filter(m => GENITIVES.has(m[3]) && !/^(?:του|της)$/.test(m[1])).map(m => `${m[1].toLowerCase()} ${m[2]} ${m[3]}`));
  for (let i = 1; i < ss.length; i++) {
    if (isQuestion(ss[i - 1]) || isQuestion(ss[i])) continue;
    const before = owned(ss[i - 1]);
    for (const k of owned(ss[i])) if (before.has(k)) out.push(`«${k}» in two sentences in a row: «${ss[i - 1]} ${ss[i]}»`);
  }

  const now = told.findIndex(s => /^Τώρα/.test(s));
  if (now >= 0) {
    const late = told.slice(now + 1).find(s => CHANGE.test(s) && !/^Νωρίτερα(?!\p{L})/u.test(s));
    if (late) out.push(`a change after «${told[now]}»: «${late}»`);
  }

  const who = [...new Set(told.flatMap(subjects))];
  // Whom the story is about: its first subject when a child, else the first child it names («Στην
  // κασετίνα του Πυθαγόρα… Η φίλη του…»), else its first subject or the first one it names
  const named = ss.flatMap(s => mentions(s).map(p => [s.search(word(p.words.join('|'))), p] as const).sort((a, b) => a[0] - b[0]).map(([, p]) => p));
  const isChild = (p?: Who) => !!p && CHILD.has(p.bare);
  const hero = isChild(who[0]) ? who[0] : named.find(isChild) ?? who[0] ?? named[0];
  ss.forEach((q, i) => {
    if (!isQuestion(q)) return;
    if (/ναρωτιέται/.test(q)) {
      if (mentions(q).length) return;
      const r = referent(i);
      if (!r) out.push(`«Αναρωτιέται»: ${r === null ? 'more than one person' : 'no one'} it could mean before it: «${q}»`);
      return;
    }
    if (mentions(q).length) return;
    // The worst case: right after a sentence whose subject is someone the story isn't about, a
    // question with no subject of its own reads as about that one. By a clitic: «Η Σοφία έχει 20
    // ευρώ… Η αδερφή της είναι 7 χρονών. Πόσα ευρώ θα της μείνουν;», or by its verb: «Στην
    // κασετίνα του Πυθαγόρα… Η φίλη του έχει 12 νομίσματα. Πόσα λεπτά έχει;»
    const prevSubjects = i > 0 && !isQuestion(ss[i - 1]) ? subjects(ss[i - 1]) : [];
    const S = prevSubjects.length === 1 ? prevSubjects[0] : undefined;
    const other = S && hero && S !== hero ? S : undefined;
    const cl = q.match(CLITIC);
    const to = cl && referent(i, cl[1] === 'της');
    if (other && to === other) {
      out.push(`the question's «${cl![0]}» reads as about ${other.nom}, the sentence before: «${q}»`);
      return;
    }
    const verb = firstVerb(q);
    if (verb?.form !== 'sg' || ownSubject(q, verb)) return;
    if (who.length >= 2 || other) {
      const reads = other ? `; it reads as about ${other.nom}, the sentence before` : '';
      out.push(`the question names no one, and ${who.map(p => p.nom).join(', ')} ${who.length > 1 ? 'are subjects' : 'is the subject'}${reads}: «${q}»`);
    }
  });

  // A gift between two people who both have a «… τώρα»: in each one's relations
  const calc = ex.steps.find(s => s.kind === 'calc');
  if (calc) {
    const nowOf = new Map<Who, string>();
    for (const q of calc.quantities) {
      if (!/τώρα$/.test(q.label)) continue;
      const p = WHO.find(x => CHILD.has(x.bare) && q.label.includes(` ${CHILD.get(x.bare)!.gen} `));
      if (p) nowOf.set(p, q.id);
    }
    const before = (id: string, seen = new Set<string>()): Set<string> => {
      for (const r of calc.relations) {
        if (r.out !== id) continue;
        for (const x of [r.a, r.b]) if (!seen.has(x)) { seen.add(x); before(x, seen); }
      }
      return seen;
    };
    ss.forEach((s, i) => {
      if (isQuestion(s) || !GIFT.test(s)) return;
      const people = new Set(mentions(s));
      const m = s.match(CLITIC);
      if (m) { const p = referent(i, m[1] === 'της'); if (p) people.add(p); }
      if (people.size < 2) return;
      const n = numberIn(s);
      const byValue = n === undefined ? [] : calc.quantities.filter(q => q.value === n);
      const q = n === undefined ? calc.sought : byValue.length === 1 ? byValue[0].id : undefined;
      if (!q) return;
      for (const p of people) {
        const id = nowOf.get(p);
        if (id && id !== q && !before(id).has(q)) out.push(`calc: «${s}» changes what ${p.nom} has, but «${calc.quantities.find(x => x.id === id)!.label}» doesn't count it`);
      }
    });
  }

  if (ex.generatorParams?.world) {
    ex.steps.forEach((s, i) => {
      if (s.kind === 'choice' && s.phase === 'check' && s.options.length < 3) out.push(`step ${i} (check): ${s.options.length} options`);
    });
  }

  // Prices, and what she pays with
  let price: number | undefined;
  for (const p of readPrices(ex.story)) {
    if ('note' in p) { out.push(`${p.note}: «${p.sentence}»`); continue; }
    price = p.amount;
    if (p.each < p.lo! || p.each > p.hi!) out.push(`${fmtEuro(p.each)} for ${p.item}${p.per > 1 ? ` (${fmtEuro(p.amount)} for ${p.per})` : ''} (${p.lo}–${p.hi} €): «${p.sentence}»`);
  }
  const pay = text.match(new RegExp(`πληρώνει με (${NUM.source}) ευρώ`));
  if (pay) {
    const paid = toNumber(pay[1]);
    const largest = Math.max(...NOTES.filter(n => n <= paid));
    if (price === undefined) out.push(`pays with ${paid} € for no price`);
    else if (paid % 5 || paid < price || paid - largest >= price) out.push(`pays ${paid} € for ${price} €: not notes she would hand over`);
  }
  return out;
}
