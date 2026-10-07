// Stories that read right (#50): who is meant, the order of events, both sides of a gift,
// and prices. Written apart from the generators: it reads the story as a child does, plus the
// calc step's quantities and relations. audit.ts runs it on the world pool and change-left
// (where the rules are kept); the other families come later (#50 part 5).
//
//   - a clitic before a verb («του χάρισε», «της έμειναν») has one person of its gender to point
//     at: in the sentence before (not the sentence's own subject), or else the only one so far;
//   - two sentences in a row don't open with the same name («Ο Θοδωρής … Ο Θοδωρής …»);
//   - nothing changes after a «Τώρα» sentence (the question aside);
//   - the question names someone when more than one person is the subject of a sentence
//     («Πόσες κάρτες είχε στην αρχή;» after two children «είχε»); «Αναρωτιέται» is left for later;
//   - a gift between two people who both have a «… τώρα» quantity is in each one's relations
//     (otherwise a right calculation on that side reads back as meaning nothing);
//   - a world check step has at least 3 options;
//   - a known item costs within its range (the table below), and «πληρώνει με» is a sum of
//     real notes, at least the price, that needs its largest note.

import type { ProblemExercise } from '../../shared/types.ts';
import { PEOPLE, type Person } from './lib.ts';

const MARK = /\[([^\]|]+)\|(known|sought|extra)\]/g;
const plain = (story: string) => story.replace(MARK, '$1');
const NUM = /\d{1,3}(?:\.\d{3})+|\d+/;
const toNumber = (s: string) => Number(s.replace(/\./g, ''));
const WORDS: Record<string, number> = {
  δύο: 2, τρεις: 3, τρία: 3, τέσσερις: 4, τέσσερα: 4, πέντε: 5, έξι: 6, επτά: 7, εφτά: 7, οκτώ: 8, οχτώ: 8,
  εννέα: 9, εννιά: 9, δέκα: 10, έντεκα: 11, δώδεκα: 12,
};
/** The first number in a sentence, in digits or in words. */
const numberIn = (s: string) => {
  const d = s.match(NUM);
  if (d) return toNumber(d[0]);
  const w = s.split(/[\s.,;;]+/).find(x => x.toLowerCase() in WORDS);
  return w ? WORDS[w.toLowerCase()] : undefined;
};

// What things cost, in euros: what a shop asks, wide enough for any shop. Toys 5–60 € (the
// README), bigger things a few hundred.
const PRICES: [RegExp, number, number][] = [
  [/παζλ/, 5, 40], [/μπάλα/, 5, 35], [/βιβλίο/, 4, 25], [/κασετίνα/, 3, 20], [/επιτραπέζιο/, 10, 50],
  [/σακίδιο/, 10, 60], [/κούκλα/, 8, 45], [/αυτοκινητάκι/, 3, 25], [/αυτοκίνητο ράλι/, 10, 60],
  [/πατίνια/, 15, 80], [/τηλεσκόπιο/, 15, 80], [/ποδήλατο/, 80, 600], [/κιθάρα/, 60, 500], [/πιάνο/, 100, 800],
];
const NOTES = [5, 10, 20, 50, 100, 200, 500];

const word = (w: string) => new RegExp(`(?<!\\p{L})${w}(?!\\p{L})`, 'u');
const forms = (p: Person) => [p.bare, p.gen.split(' ')[1], p.acc.split(' ')[1]];
const mentions = (s: string) => PEOPLE.filter(p => forms(p).some(f => word(f).test(s)));
/** People in the nominative, with their article: «ο Θοδωρής», «Η Χαρά» (not «τη Χαρά»). */
const subjects = (s: string) => PEOPLE.filter(p => word(`(?:${p.female ? 'η|Η' : 'ο|Ο'}) ${p.bare}`).test(s));
const opener = (s: string) => PEOPLE.find(p => new RegExp(`^${p.female ? 'Η' : 'Ο'} ${p.bare}(?!\\p{L})`, 'u').test(s));
const isQuestion = (s: string) => /[;;]$/.test(s) || /^(Να βρεις|Θέλουμε να βρούμε)/.test(s) || /ναρωτιέται/.test(s);
const CLITIC = /(?<!\p{L})(του|της) (?:θα )?(χάρισε|χαρίζει|έδωσε|δίνει|πήρε|περισσέψουν|περισσεύουν|έμειναν|μένουν)(?!\p{L})/u;
const CHANGE = /χάρισε|έδωσε|έχασε|αγόρασε|ξόδεψε|πήρε|έβαλε/;
const GIFT = /χάρισε|έδωσε|πήρε/;

export function checkStory(ex: ProblemExercise): string[] {
  const out: string[] = [];
  const text = plain(ex.story);
  const ss = text.split(/(?<=[.;;])\s+/);
  const told = ss.filter(s => !isQuestion(s));

  // Who a clitic points at: one person of its gender in the sentence before (not the
  // sentence's own subject), or else the only one named so far
  const referent = (i: number, female: boolean): Person | undefined | null => {
    const own = subjects(ss[i]);
    const fits = (s: string) => mentions(s).filter(p => p.female === female && !own.includes(p));
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

  const now = told.findIndex(s => /^Τώρα/.test(s));
  if (now >= 0) {
    const late = told.slice(now + 1).find(s => CHANGE.test(s));
    if (late) out.push(`a change after «${told[now]}»: «${late}»`);
  }

  const who = new Set(told.flatMap(subjects));
  for (const q of ss.filter(isQuestion)) {
    if (/ναρωτιέται/.test(q)) continue; // «Αναρωτιέται…»: #50 part 5
    if (who.size > 1 && !mentions(q).length) out.push(`the question names no one, and ${[...who].map(p => p.nom).join(', ')} are subjects: «${q}»`);
  }

  // A gift between two people who both have a «… τώρα»: in each one's relations
  const calc = ex.steps.find(s => s.kind === 'calc');
  if (calc) {
    const nowOf = new Map<Person, string>();
    for (const q of calc.quantities) {
      if (!/τώρα$/.test(q.label)) continue;
      const p = PEOPLE.find(x => q.label.includes(` ${x.gen} `));
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

  // Prices
  let price: number | undefined;
  for (const s of told) {
    const m = s.match(new RegExp(`(?:κοστίζει|κόστιζε) (${NUM.source}) ευρώ|ξόδεψε (${NUM.source}) ευρώ για`));
    if (!m) continue;
    price = toNumber(m[1] ?? m[2]);
    const item = PRICES.find(([re]) => re.test(s));
    if (!item) out.push(`a price for something the audit has no range for: «${s}»`);
    else if (price < item[1] || price > item[2]) out.push(`${price} € for ${s.match(item[0])![0]} (${item[1]}–${item[2]} €): «${s}»`);
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
