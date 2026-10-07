// The audit of the plain language items (called from ../audit.ts, which checks every pool in
// one command). It derives each item's key again from its own text, the committed lexicon
// (lexicon.ts, typed from the books with pages) and the rule its skill names, written here
// apart from the families: each `skill` (generatorParams.skill) has a solver that reads the
// fixed wording its items use, and an item a solver can't read is an error. It reads only the
// pools, curriculum.ts, lexicon.ts and check-gender's word list; never materials/.
//
// Errors:
//   - a title that names some of the options and not all («Της ή τις;» over τις · της · των);
//   - the key isn't the rule's answer: a multiple choice or fill-blank without exactly one option
//     the rule accepts (so a wrong option that is itself right for the sentence is an error too);
//     an ordering out of order; a true-false whose statement the lexicon says otherwise;
//   - a key the rule can't prove alone: δε(ν)/μη(ν) where the subjunctive could follow too, a mood asked of a
//     form that is still two moods (ακούτε), a tense asked of part of a compound form, an adverb that can tell
//     two things (αργά), two definitions too close to pit against each other, the masculine genitive of an
//     -ης adjective (the everyday «του διεθνή» is right too), a compound or option the lexicon doesn't know;
//   - fewer than 3 or repeated options; the right option the only longest; for the spelling skills
//     the right option the one closest to all the others (a letter-by-letter vote would find it), or a
//     wrong spelling that is a word of the lexicon or isn't one or two slips (ι/η/υ/ει/οι, ο/ω, ε/αι,
//     ευ/εφ, a double letter, the capital) from the right one;
//   - a fill-blank without exactly one gap, or a gap inside a word (a punctuation mark goes right after one),
//     or a sentence over FILL_LINE_MAX besides its gap (it would break at the gap);
//   - a «Δείξε μου» over 60 characters (a match over 40);
//   - check-gender's words anywhere the child reads (title, body, question, options, items), template
//     leftovers, stray spaces, a space before punctuation, a Latin letter, a word of two or more
//     syllables without its accent (μια, για, πιο, δυο… are one syllable);
//   - a source that isn't a lesson page of the committed TOC within the grade's units; stars other than 1;
//     an id twice or not `<prefix>-lang-<family>-NNN` (or with «-gen-»); category other than Γλώσσα;
//   - a lexicon entry citing a page the books don't have, or a word of check-gender's list in the lexicon;
//   - per grade: fewer than 60 items; true-false over 10 % or fill-blank over 40 % of them; true-false
//     answered «Σωστό» outside 40–60 % of the pool's true-false items.

import type { Exercise } from '../../../shared/types.ts';
import { genderedWords } from '../../../frontend/scripts/gendered.mjs';
import type { Rng } from '../lib.ts';
import { revealMax, revealed } from '../maths/check.ts';
import { CURRICULUM, pageExists, placeOf, type LanguageGrade } from './curriculum.ts';
import { LEXICON, TENSES, type Expression, type Gender, type Lexicon, type Mood, type Person, type Tag, type Tense } from './lexicon.ts';

type Plain = Exclude<Exercise, { type: 'problem' }>;
type Pool = { file: string; grades: number[]; exercises: Exercise[] };

export const MIN_ITEMS = 60;
const PREFIX: Record<LanguageGrade, string> = { 3: 'g3', 5: 'e5' };
const MAX_TRUE_FALSE = 0.1;
/** A gap in a sentence is the book's own «Συμπλήρωσε»; one gap means no word left over by elimination. */
const MAX_FILL_BLANK = 0.4;
/**
 * Characters a fill-blank's sentence may have besides its gap: FillBlankRenderer lays the sentence out as
 * pieces between gaps, so a piece that doesn't fit after the gap jumps whole to the next line. At 1280×800
 * a line holds 43 characters and an empty gap («Είδαμε ένα ντοκιμαντέρ για τα ποτάμια της ___.»).
 */
export const FILL_LINE_MAX = 43;

// ---------------------------------------------------------------------------
// Greek words

const lower = (s: string) => s.toLocaleLowerCase('el');
/** The words of a text, without the punctuation around them. */
const wordsOf = (text: string) => text.split(/\s+/).map(w => w.replace(/^[«(“"']+|[»)”"'.,;:!·…]+$/g, '')).filter(Boolean);

/** One syllable, though two vowels are written (συνίζηση). */
const SYNIZESIS = new Set(['μια', 'μιας', 'για', 'πια', 'πιο', 'ποιο', 'ποια', 'ποιοι', 'ποιες', 'ποιον', 'ποιου', 'ποιων', 'δυο', 'γεια']);
const VOWEL = /[αεηιουωάέήίόύώϊϋΐΰ]/;
const hasAccent = (w: string) => /[́̈́]/.test(w.normalize('NFD'));

/** Syllables as written: each vowel or diphthong (a diaeresis splits two vowels: «τσάι», «ευφυΐα»). */
const DIPHTHONGS = new Set(['αι', 'ει', 'οι', 'υι', 'ου', 'αυ', 'ευ', 'ηυ', 'αί', 'εί', 'οί', 'υί', 'ού', 'αύ', 'εύ', 'ηύ']);
function syllables(word: string): number {
  const w = lower(word);
  let n = 0;
  for (let i = 0; i < w.length; i++) {
    if (!VOWEL.test(w[i])) continue;
    n++;
    if (DIPHTHONGS.has(w[i] + (w[i + 1] ?? ''))) i++;
  }
  return n;
}

/** Spellings of one sound, the slips a child makes; a double letter and its single one too. */
const SLIPS = [
  ['ι', 'η', 'υ', 'ει', 'οι'], ['ί', 'ή', 'ύ', 'εί', 'οί'], ['ο', 'ω'], ['ό', 'ώ'], ['ε', 'αι'], ['έ', 'αί'],
  ['ευ', 'εβ', 'εφ'], ['εύ', 'έβ', 'έφ'], ['αυ', 'αβ', 'αφ'], ['αύ', 'άβ', 'άφ'],
  ...[...'λσμβπτρκν'].map(c => [c, c + c]),
];

/** Every spelling one slip away from a word (and, with `capital`, the word with its first letter changed in case). */
function slipsOf(word: string, capital = false): Set<string> {
  const out = new Set<string>();
  for (const group of SLIPS) {
    for (const m of group) {
      for (let i = word.indexOf(m); i >= 0; i = word.indexOf(m, i + 1)) {
        for (const r of group) if (r !== m) out.add(word.slice(0, i) + r + word.slice(i + m.length));
      }
    }
  }
  if (capital && word) {
    const first = word[0], flipped = first === lower(first) ? first.toLocaleUpperCase('el') : lower(first);
    out.add(flipped + word.slice(1));
  }
  out.delete(word);
  return out;
}

/** Whether `wrong` is one or two slips from `right`. */
function slipped(right: string, wrong: string, capital = false): boolean {
  const one = slipsOf(right, capital);
  return one.has(wrong) || [...one].some(w => slipsOf(w, capital).has(wrong));
}

function distance(a: string, b: string): number {
  const A = [...a], B = [...b];
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i++) {
    const row = [i];
    for (let j = 1; j <= B.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[B.length];
}

// ---------------------------------------------------------------------------
// Articles (the definite, the indefinite, and σε with the article), by what they go with

const ARTICLE: Record<string, Tag[]> = {
  'ο': ['m.nom.sg'], 'η': ['f.nom.sg'], 'το': ['n.nom.sg', 'n.acc.sg'], 'οι': ['m.nom.pl', 'f.nom.pl'], 'τα': ['n.nom.pl', 'n.acc.pl'],
  'του': ['m.gen.sg', 'n.gen.sg'], 'της': ['f.gen.sg'], 'των': ['m.gen.pl', 'f.gen.pl', 'n.gen.pl'],
  'τον': ['m.acc.sg'], 'την': ['f.acc.sg'], 'τη': ['f.acc.sg'], 'τους': ['m.acc.pl'], 'τις': ['f.acc.pl'],
  'ένας': ['m.nom.sg'], 'έναν': ['m.acc.sg'], 'ενός': ['m.gen.sg', 'n.gen.sg'], 'μια': ['f.nom.sg', 'f.acc.sg'], 'μία': ['f.nom.sg', 'f.acc.sg'],
  'μιας': ['f.gen.sg'], 'ένα': ['n.nom.sg', 'n.acc.sg'],
  'στον': ['m.acc.sg'], 'στην': ['f.acc.sg'], 'στη': ['f.acc.sg'], 'στο': ['n.acc.sg'], 'στους': ['m.acc.pl'], 'στις': ['f.acc.pl'], 'στα': ['n.acc.pl'],
};
const articleTags = (w: string) => ARTICLE[lower(w)];

const PRONOUN: Record<string, Person> = {
  'εγώ': '1sg', 'εσύ': '2sg', 'αυτός': '3sg', 'αυτή': '3sg', 'αυτό': '3sg', 'εμείς': '1pl', 'εσείς': '2pl', 'αυτοί': '3pl', 'αυτές': '3pl', 'αυτά': '3pl',
};
/** Words with no part of speech in the lexicon that are never a verb. */
const PREPOSITIONS = new Set(['από', 'με', 'για', 'σε', 'χωρίς', 'μέχρι', 'προς']);
const QUESTION_WORDS = new Set(['τι', 'πώς', 'πόσο', 'πόσα', 'πόσες', 'πόσοι', 'πού', 'πότε', 'γιατί']);
const WEEK = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];
const COLLATE = new Intl.Collator('el', { sensitivity: 'base' });

/** «Βάλε το ρήμα στον αόριστο»: the tense in the accusative, as the wording names it. */
const TENSE_ACC: Record<string, Tense> = {
  'ενεστώτα': 'ενεστώτας', 'παρατατικό': 'παρατατικός', 'αόριστο': 'αόριστος', 'παρακείμενο': 'παρακείμενος', 'υπερσυντέλικο': 'υπερσυντέλικος',
  'εξακολουθητικό μέλλοντα': 'εξακολουθητικός μέλλοντας', 'συνοπτικό μέλλοντα': 'συνοπτικός μέλλοντας', 'συντελεσμένο μέλλοντα': 'συντελεσμένος μέλλοντας',
};
/** «οριστική ενεστώτα»: the indicative named with its tense, as the books' tables do (β26, τ21, γ142). */
const TENSE_GEN: Record<Tense, string> = {
  'ενεστώτας': 'ενεστώτα', 'παρατατικός': 'παρατατικού', 'αόριστος': 'αορίστου', 'παρακείμενος': 'παρακειμένου', 'υπερσυντέλικος': 'υπερσυντελίκου',
  'εξακολουθητικός μέλλοντας': 'εξακολουθητικού μέλλοντα', 'συνοπτικός μέλλοντας': 'συνοπτικού μέλλοντα', 'συντελεσμένος μέλλοντας': 'συντελεσμένου μέλλοντα',
};
const MOOD_LABELS = [...Object.values(TENSE_GEN).map(t => `οριστική ${t}`), 'εξακολουθητική υποτακτική', 'συνοπτική υποτακτική', 'εξακολουθητική προστακτική', 'συνοπτική προστακτική'];
const PAST: Tense[] = ['παρατατικός', 'αόριστος', 'υπερσυντέλικος'];
/** What a time word, phrase or clause is, in her books' words: β9 «επιρρήματα, φράσεις με προθέσεις, χρονικές προτάσεις», τ8 «φράσεις σε αιτιατική». */
const TIME_KINDS = ['επίρρημα', 'φράση με πρόθεση', 'φράση σε αιτιατική', 'χρονική πρόταση'];
const SHOWS = ['τόπο', 'χρόνο', 'τρόπο', 'ποσό'];
/** The final -ν stays before a vowel, κ, π, τ, μπ, ντ, γκ, ξ, ψ (γ55). */
const KEEPS_N = /^(?:[αεηιουωάέήίόύώϊϋΐΰ]|μπ|ντ|γκ|[κπτξψ])/;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whether `text` has `piece` as whole words, case ignored. */
const contains = (text: string, piece: string) => new RegExp(`(?<!\\p{L})${escape(lower(piece))}(?!\\p{L})`, 'u').test(lower(text));

// ---------------------------------------------------------------------------
// The lexicon, indexed

/** A verb form's reading: whose form it is, in which tense and mood, for which person. */
interface VerbReading { lemma: string; tense: Tense; mood: Mood; person: Person }

interface Index {
  tags: Map<string, Set<Tag>>;
  gender: Map<string, Gender>;
  pos: Map<string, Set<string>>;
  person: Map<string, Set<Person>>;
  verbs: Map<string, VerbReading[]>;
  expressions: Map<string, Expression>;
  proper: Set<string>;
  known: Set<string>;
  lex: Lexicon;
}

function index(lex: Lexicon): Index {
  const ix: Index = { tags: new Map(), gender: new Map(), pos: new Map(), person: new Map(), verbs: new Map(), expressions: new Map(), proper: new Set(), known: new Set(), lex };
  const add = <T>(m: Map<string, Set<T>>, k: string, v: T) => m.set(k, (m.get(k) ?? new Set()).add(v));
  for (const n of lex.nouns) {
    for (const [c, forms] of Object.entries(n.forms)) {
      forms!.forEach((f, i) => {
        if (!f) return;
        add(ix.tags, f, `${n.gender}.${c}.${i ? 'pl' : 'sg'}` as Tag);
        ix.gender.set(f, n.gender);
        add(ix.pos, f, 'ουσιαστικό');
        if (n.proper) ix.proper.add(f);
        ix.known.add(f);
      });
    }
  }
  for (const a of lex.adjectives) {
    for (const [g, cases] of Object.entries(a.forms)) {
      for (const [c, forms] of Object.entries(cases)) {
        forms!.forEach((f, i) => { add(ix.tags, f, `${g}.${c}.${i ? 'pl' : 'sg'}` as Tag); add(ix.pos, f, 'επίθετο'); ix.known.add(f); });
      }
    }
  }
  for (const v of lex.verbs) {
    for (const [p, f] of Object.entries(v.forms)) {
      add(ix.person, f!, p as Person); add(ix.pos, f!, 'ρήμα'); ix.known.add(f!);
      ix.verbs.set(f!, [...(ix.verbs.get(f!) ?? []), { lemma: v.lemma, tense: v.tense ?? 'ενεστώτας', mood: v.mood ?? 'οριστική', person: p as Person }]);
    }
  }
  for (const w of Object.keys(ARTICLE)) add(ix.pos, w, 'άρθρο');
  for (const l of lex.words) l.words.forEach(w => ix.known.add(w));
  for (const p of [...lex.opposites, ...lex.synonyms]) p.pair.forEach(w => ix.known.add(w));
  for (const f of lex.families) f.words.forEach(w => ix.known.add(w));
  for (const s of lex.sayings) ix.known.add(s.answer);
  for (const e of lex.expressions ?? []) { ix.expressions.set(lower(e.text), e); ix.known.add(e.text); }
  for (const c of lex.compounds ?? []) ix.known.add(c.word);
  for (const n of lex.numerals ?? []) ix.known.add(n.word);
  for (const d of lex.definitions ?? []) ix.known.add(d.word);
  return ix;
}

/** Every page the lexicon cites, and no gendered word in it. */
function lexiconErrors(grade: LanguageGrade, lex: Lexicon): string[] {
  const errs: string[] = [];
  const cites = [...lex.nouns, ...lex.adjectives, ...lex.verbs, ...lex.words, ...lex.opposites, ...lex.synonyms, ...lex.families, ...lex.phrases,
    ...lex.sayings, ...lex.expressions ?? [], ...lex.compounds ?? [], ...lex.numerals ?? [], ...lex.definitions ?? []].map(e => e.at);
  const BOOKS = { 'β': 'βιβλίο', 'τ': 'τετράδιο', 'γ': 'γραμματική' } as const;
  for (const at of new Set(cites)) {
    const m = at.match(/^([βτγ])(\d+)$/);
    if (!m || !pageExists(grade, BOOKS[m[1] as keyof typeof BOOKS], Number(m[2]))) errs.push(`lexicon: «${at}» is not a page of the ${CURRICULUM[grade].label} books`);
  }
  for (const w of index(lex).known) for (const g of genderedWords(w)) errs.push(`lexicon: «${w}» is on check-gender's list («${g}»)`);
  return errs;
}

// ---------------------------------------------------------------------------
// Solvers: what each skill's rule says the answer is

type Verdict = string[];

const one = (xs: string[], right: (x: string) => boolean, key: number, what = 'option'): Verdict => {
  const rights = xs.map((x, i) => (right(x) ? i : -1)).filter(i => i >= 0);
  if (rights.length !== 1) return [`${rights.length} ${what}s the rule accepts (${rights.map(i => `«${xs[i]}»`).join(', ') || 'none'})`];
  return rights[0] === key ? [] : [`the key is «${xs[key]}», the rule's answer «${xs[rights[0]]}»`];
};

const read = (text: string, re: RegExp) => {
  const m = text.match(re);
  if (!m) throw new Error(`can't read «${text}»`);
  return m;
};

/** A choice item's options and key: a multiple choice's, or a one-gap fill-blank's word bank. */
function choice(ex: Plain): { options: string[]; key: number } {
  if (ex.type === 'multiple-choice') return { options: ex.options, key: ex.correctIndex };
  if (ex.type === 'fill-blank') return { options: ex.options, key: ex.options.indexOf(ex.correctAnswers[0]) };
  throw new Error(`a ${ex.type} has no options`);
}

/** The sentence with the gap: a fill-blank's text ({0}) or a multiple choice's question («…»), as words, and where the gap is. */
function gapped(ex: Plain): { words: string[]; at: number } {
  const text = ex.type === 'fill-blank' ? ex.textWithGaps.replace('{0}', ' {0} ') : ex.type === 'multiple-choice' ? ex.question.replace('…', ' {0} ') : '';
  const words = text.split(/\s+/).filter(Boolean).map(w => (w === '{0}' ? w : w.replace(/^[«(]+|[»).,;:!·]+$/g, ''))).filter(Boolean);
  const at = words.indexOf('{0}');
  if (at < 0 || words.lastIndexOf('{0}') !== at) throw new Error('no single gap ({0} or …) to read');
  return { words, at };
}

function solvers(ix: Index): Record<string, (ex: Plain) => Verdict> {
  const tagsOf = (w: string) => ix.tags.get(w) ?? ix.tags.get(lower(w)) ?? new Set<Tag>();
  const posOf = (w: string) => ix.pos.get(w) ?? ix.pos.get(lower(w)) ?? new Set<string>();
  const known = (w: string) => ix.known.has(w) || ix.known.has(lower(w)) || posOf(w).size > 0;
  const unknown = (ws: string[]) => ws.filter(w => !known(w)).map(w => `«${w}» is not in the lexicon`);
  const meet = (a: Iterable<Tag>, b: Set<Tag>) => new Set([...a].filter(t => b.has(t)));

  return {
    // «Κύκλωσε το ρήμα της πρότασης: «…»» (the sentence has one), «Κύκλωσε ένα ουσιαστικό της πρότασης: «…»»
    // (it has more than one, one of them offered), and the true-false «Στην πρόταση «…» η λέξη «…» είναι ρήμα.»
    pos(ex) {
      if (ex.type === 'true-false') {
        const [, sentence, word, asked] = read(ex.question, /^Στην πρόταση «(.+)» η λέξη «(.+)» είναι (ρήμα|ουσιαστικό)\.$/);
        if (!wordsOf(sentence).includes(word)) return [`«${word}» is not in «${sentence}»`];
        if (!posOf(word).size) return [`«${word}» is not in the lexicon`];
        const truth = posOf(word).has(asked);
        return ex.correctValue === truth ? [] : [`key ${ex.correctValue}, the lexicon says ${truth}`];
      }
      const [, article, asked, sentence] = read(ex.type === 'multiple-choice' ? ex.question : '', /^Κύκλωσε (το|ένα) (ρήμα|ουσιαστικό) της πρότασης: «(.+)»$/);
      const { options, key } = choice(ex);
      const ws = wordsOf(sentence);
      const missing = options.filter(o => !ws.includes(o)).map(o => `«${o}» is not a word of the sentence`);
      const noPos = [...new Set([...ws, ...options])].filter(o => !posOf(o).size).map(o => `«${o}» has no part of speech in the lexicon`);
      // «το ρήμα» says the sentence has one; with two, it says «ένα»
      const inSentence = ws.filter(w => posOf(w).has(asked));
      const count = article === 'το' && inSentence.length !== 1 ? [`«το ${asked}», but the sentence has ${inSentence.length} (${inSentence.join(', ')}): say «ένα»`]
        : article === 'ένα' && inSentence.length < 2 ? [`«ένα ${asked}», but the sentence has ${inSentence.length}: say «το»`] : [];
      return [...missing, ...noPos, ...count, ...one(options, o => posOf(o).has(asked), key)];
    },
    // «Κύκλωσε το αρσενικό/θηλυκό/ουδέτερο ουσιαστικό.»
    gender(ex) {
      const asked = { 'αρσενικό': 'm', 'θηλυκό': 'f', 'ουδέτερο': 'n' }[read(ex.type === 'multiple-choice' ? ex.question : '', /^Κύκλωσε το (αρσενικό|θηλυκό|ουδέτερο) ουσιαστικό\.$/)[1]];
      const { options, key } = choice(ex);
      const noGender = options.filter(o => !ix.gender.has(o)).map(o => `«${o}» is not a noun of the lexicon`);
      return [...noGender, ...one(options, o => ix.gender.get(o) === asked, key)];
    },
    // A word next to an article takes the article's gender, case and number (and its noun's): the
    // gap is the word after the article, or the article before a word. With no article before the gap,
    // a word before a noun takes the noun's («λεπτά και … συναισθήματα»), and a word after «είναι» the
    // subject's, in the nominative («Η διαφορά … είναι …»: the sentence's first article and its noun)
    agree(ex) {
      const { options, key } = choice(ex);
      const { words, at } = gapped(ex);
      let compatible: (o: string) => boolean;
      if (options.every(o => articleTags(o))) {
        const next = words[at + 1], after = words[at + 2];
        if (!next || !tagsOf(next).size) return [`the word after the gap («${next ?? ''}») is not in the lexicon`];
        let want = tagsOf(next);
        if (after && posOf(next).has('επίθετο') && tagsOf(after).size) want = meet(want, tagsOf(after));
        compatible = o => articleTags(o).some(t => want.has(t));
      } else {
        const strange = options.filter(o => !tagsOf(o).size).map(o => `«${o}» is not in the lexicon`);
        if (strange.length) return strange;
        const before = words[at - 1], next = words[at + 1];
        let want: Set<Tag>;
        if (before && articleTags(before)) {
          want = new Set<Tag>(articleTags(before));
          if (next && posOf(next).has('ουσιαστικό')) want = meet(want, tagsOf(next));
        } else if (next && posOf(next).has('ουσιαστικό')) {
          want = tagsOf(next);
        } else if (before && (ix.verbs.get(lower(before)) ?? []).some(r => r.lemma === 'είμαι')) {
          const [article, noun] = words;
          if (!articleTags(article) || !posOf(noun ?? '').has('ουσιαστικό')) return [`can't read the subject of «${words.join(' ')}» (an article and a noun first)`];
          want = new Set([...meet(articleTags(article), tagsOf(noun))].filter(t => t.includes('.nom.')));
        } else return [`no article before the gap («${before ?? ''}»), no noun after it («${next ?? ''}») and no «είναι» before it`];
        // The masculine genitive of an -ης/-ες adjective is «του διεθνούς», but everyday speech says «του διεθνή»
        // (γ104): asked, the everyday form would be a right answer offered as wrong
        const isEs = (o: string) => ix.lex.adjectives.some(a => a.forms.m.gen?.[0].endsWith('ούς') && Object.values(a.forms).some(g => Object.values(g).some(f => f?.includes(o))));
        if (want.has('m.gen.sg') && options.some(isEs)) return ['asks the masculine genitive of an -ης adjective, whose everyday form (-ή, γ104) is right too'];
        compatible = o => [...tagsOf(o)].some(t => want.has(t));
      }
      return one(options, compatible, key);
    },
    // «Βάλε τις λέξεις σε αλφαβητική σειρά.»: by the Greek alphabet, accents ignored, letter by letter
    alpha(ex) {
      if (ex.type !== 'ordering') return ['alpha is an ordering'];
      read(ex.body ?? '', /^Βάλε τις λέξεις σε αλφαβητική σειρά\.$/);
      const items = ex.items.map(i => i.content);
      const errs = unknown(items);
      items.forEach((w, i) => { if (i && COLLATE.compare(items[i - 1], w) >= 0) errs.push(`«${items[i - 1]}» does not come before «${w}»`); });
      return errs;
    },
    // «Βάλε τις μέρες της εβδομάδας στη σειρά, από τη Δευτέρα.» (no Κυριακή: the book's week starts on either)
    week(ex) {
      if (ex.type !== 'ordering') return ['week is an ordering'];
      read(ex.body ?? '', /^Βάλε τις μέρες της εβδομάδας στη σειρά, από τη Δευτέρα\.$/);
      const at = ex.items.map(i => WEEK.indexOf(i.content));
      if (at.some(i => i < 0 || i === 6)) return [`not days from Δευτέρα to Σάββατο: ${ex.items.map(i => i.content).join(', ')}`];
      return at.every((x, i) => !i || x > at[i - 1]) ? [] : [`not in order: ${ex.items.map(i => i.content).join(', ')}`];
    },
    // Proper nouns take a capital: one option is the lexicon's proper noun, the rest its slips (the
    // small letter, a misspelling); and the true-false «Η λέξη «…» γράφεται πάντα με κεφαλαίο.»
    capital(ex) {
      if (ex.type === 'true-false') {
        const word = read(ex.question, /^Η λέξη «(.+)» γράφεται πάντα με κεφαλαίο\.$/)[1];
        if (!known(word)) return [`«${word}» is not in the lexicon`];
        const truth = ix.proper.has(word);
        return ex.correctValue === truth ? [] : [`key ${ex.correctValue}, the lexicon says ${truth}`];
      }
      if (ex.type !== 'fill-blank') return ['capital is a fill-blank or a true-false'];
      if (/(^|[.;!]\s*)\{0\}/.test(ex.textWithGaps)) return ['the gap starts a sentence: it takes a capital whatever the word'];
      const { options, key } = choice(ex);
      const errs = one(options, o => ix.proper.has(o), key, 'proper noun');
      const right = options[key];
      for (const o of options) {
        if (o === right) continue;
        if (ix.known.has(o)) errs.push(`«${o}» is a word of the lexicon, not a slip`);
        else if (!slipped(right, o, true)) errs.push(`«${o}» is not a slip of «${right}»`);
      }
      return errs;
    },
    // The verb takes its subject's person: a pronoun, or «Ο/Η/Το …», «Ένα/Μια …» (3rd singular; with «και»,
    // plural), «Οι/Τα …». Every option is a form of the lexicon or a slip of one (-ται/-τε, υ/ι, a double letter)
    person(ex) {
      if (ex.type !== 'fill-blank') return ['person is a fill-blank'];
      const before = ex.textWithGaps.split('{0}')[0];
      const first = lower(wordsOf(before)[0] ?? '');
      const person: Person | undefined = PRONOUN[first]
        ?? (['ο', 'η', 'το', 'ένας', 'μια', 'μία', 'ένα'].includes(first) ? (/ και /.test(before) ? '3pl' : '3sg') : ['οι', 'τα'].includes(first) ? '3pl' : undefined);
      if (!person) return [`can't read the subject of «${ex.textWithGaps}»`];
      const { options, key } = choice(ex);
      const forms = [...ix.person.keys()];
      const strange = options.filter(o => !ix.person.has(o) && !forms.some(f => slipped(f, o))).map(o => `«${o}» is neither a verb form of the lexicon nor a slip of one`);
      return [...strange, ...one(options, o => ix.person.get(o)?.has(person) ?? false, key, `${person} form`)];
    },
    opposite(ex) {
      const word = read(ex.type === 'multiple-choice' ? ex.question : '', /^Κύκλωσε το αντίθετο της λέξης «(.+)»\.$/)[1];
      const { options, key } = choice(ex);
      const paired = (o: string) => ix.lex.opposites.some(p => p.pair.includes(word) && p.pair.includes(o) && o !== word);
      return [...unknown([word, ...options]), ...one(options, paired, key)];
    },
    synonym(ex) {
      const word = read(ex.type === 'multiple-choice' ? ex.question : '', /^Κύκλωσε τη λέξη που σημαίνει το ίδιο με τη λέξη «(.+)»\.$/)[1];
      const { options, key } = choice(ex);
      const paired = (o: string) => ix.lex.synonyms.some(p => p.pair.includes(word) && p.pair.includes(o) && o !== word);
      return [...unknown([word, ...options]), ...one(options, paired, key)];
    },
    // «… ανήκει στην οικογένεια της λέξης «…».», or the one that «δεν ανήκει στην ίδια οικογένεια με τις άλλες»
    family(ex) {
      const q = ex.type === 'multiple-choice' ? ex.question : '';
      const { options, key } = choice(ex);
      const errs = unknown(options);
      const m = q.match(/^Κύκλωσε τη λέξη που ανήκει στην οικογένεια της λέξης «(.+)»\.$/);
      if (m) {
        const fam = ix.lex.families.find(f => f.words.includes(m[1]));
        if (!fam) return [...errs, `«${m[1]}» has no family in the lexicon`];
        return [...errs, ...one(options, o => fam.words.includes(o) && o !== m[1], key)];
      }
      read(q, /^Κύκλωσε τη λέξη που δεν ανήκει στην ίδια οικογένεια με τις άλλες\.$/);
      const odd = (o: string) => ix.lex.families.some(f => !f.words.includes(o) && options.every(x => x === o || f.words.includes(x)));
      return [...errs, ...one(options, odd, key)];
    },
    // What a phrase means, as the book has it: the true-false «Η φράση «…» σημαίνει «…».», or a multiple choice
    meaning(ex) {
      const strip = (s: string) => s.replace(/\.$/, '');
      if (ex.type === 'true-false') {
        const [, phrase, said] = read(ex.question, /^Η φράση «(.+)» σημαίνει «(.+)»\.$/);
        const p = ix.lex.phrases.find(x => x.phrase === phrase);
        if (!p) return [`«${phrase}» is not a phrase of the lexicon`];
        if (![...p.means, ...p.not].includes(said)) return [`«${said}» is not a meaning the lexicon has for «${phrase}»`];
        const truth = p.means.includes(said);
        return ex.correctValue === truth ? [] : [`key ${ex.correctValue}, the lexicon says ${truth}`];
      }
      const phrase = read(ex.type === 'multiple-choice' ? ex.question : '', /^Τι σημαίνει εδώ η φράση «(.+)»;$/)[1];
      const p = ix.lex.phrases.find(x => x.phrase === phrase);
      if (!p) return [`«${phrase}» is not a phrase of the lexicon`];
      if (!(ex.body ?? '').includes(phrase)) return [`the body does not use «${phrase}»`];
      const { options, key } = choice(ex);
      const strange = options.filter(o => ![...p.means, ...p.not].includes(strip(o))).map(o => `«${o}» is not a meaning the lexicon has for «${phrase}»`);
      return [...strange, ...one(options, o => p.means.includes(strip(o)), key)];
    },
    // A simile or a proverb of the lexicon, its last word to choose
    saying(ex) {
      if (ex.type !== 'multiple-choice') return ['saying is a multiple choice'];
      const kind = read(ex.body ?? '', /^Συμπλήρωσε την (παρομοίωση|παροιμία)\.$/)[1];
      const s = ix.lex.sayings.find(x => x.text === ex.question);
      if (!s) return [`«${ex.question}» is not a saying of the lexicon`];
      const errs = s.kind === kind ? [] : [`«${ex.question}» is a ${s.kind}, the body says ${kind}`];
      return [...errs, ...unknown(ex.options), ...one(ex.options, o => o === s.answer, ex.correctIndex)];
    },
    // «σαν» before a verb means «όταν», before a noun «όπως» (τ44)
    san(ex) {
      const sentence = read(ex.type === 'multiple-choice' ? ex.question : '', /^Τι σημαίνει το «σαν» στην πρόταση «(.+)»;$/)[1];
      const ws = wordsOf(sentence);
      const i = ws.findIndex(w => lower(w) === 'σαν');
      const next = ws[i + 1] ?? '';
      const answer = posOf(next).has('ρήμα') ? 'όταν' : posOf(next).has('ουσιαστικό') || posOf(next).has('άρθρο') ? 'όπως' : undefined;
      if (i < 0 || !answer) return [`can't tell what «σαν» means before «${next}» (not in the lexicon)`];
      const { options, key } = choice(ex);
      if (!options.includes('όταν') || !options.includes('όπως')) return ['the options must have both «όταν» and «όπως»'];
      return one(options, o => o === answer, key);
    },
    // «.», «;» or «,»: a question (it starts with a question word) ends with «;»; a mark followed by a small
    // letter, inside a list, is «,»; «.» only after a sentence with no verb (a greeting, a title). In Greek a
    // yes/no question is a statement with «;» («Περνάμε υπέροχα στο χωριό;»), so a sentence with a verb and
    // no question word takes either mark, and «;» is always among the options
    punct(ex) {
      if (ex.type !== 'fill-blank') return ['punct is a fill-blank'];
      const { options, key } = choice(ex);
      if (options.length !== 3 || options.some(o => !['.', ';', ','].includes(o))) return [`options ${JSON.stringify(options)}: «.», «;» and «,»`];
      const [before, after] = ex.textWithGaps.split('{0}');
      let answer: string;
      if (after === '' && QUESTION_WORDS.has(lower(wordsOf(before)[0] ?? ''))) answer = ';';
      else if (after === '') {
        const ws = wordsOf(before);
        const verbs = ws.filter(w => posOf(w).has('ρήμα'));
        if (verbs.length) return [`«${before}» has a verb («${verbs.join('», «')}») and no question word: it can be asked too, so «;» is right as well as «.»`];
        const unread = ws.filter(w => !PREPOSITIONS.has(lower(w)) && !posOf(w).size);
        if (unread.length) return [`can't tell whether «${before}» has a verb: ${unread.map(w => `«${w}»`).join(', ')} not in the lexicon`];
        answer = '.';
      } else if (/^ \p{Ll}/u.test(after)) answer = ',';
      else return [`can't tell the mark before «${after}»`];
      return one(options, o => o === answer, key);
    },
    // «Κύκλωσε τη λέξη που είναι γραμμένη σωστά.»: one spelling of the lexicon, the rest one or two slips from it
    spell(ex) {
      read(ex.type === 'multiple-choice' ? ex.question : '', /^Κύκλωσε τη λέξη που είναι γραμμένη σωστά\.$/);
      const { options, key } = choice(ex);
      const errs = one(options, o => ix.known.has(o), key, 'spelling of the lexicon');
      for (const o of options) if (o !== options[key] && !ix.known.has(o) && !slipped(options[key], o)) errs.push(`«${o}» is not a slip of «${options[key]}»`);
      return errs;
    },
    // «Κύκλωσε τον χρόνο του ρήματος «…».», the sentence as body: the form's tense in the lexicon. The whole
    // form is asked («έχουν μολυνθεί», not «μολυνθεί»), and a form that is also a subjunctive or imperative has none
    tense(ex) {
      if (ex.type !== 'multiple-choice') return ['tense is a multiple choice'];
      const form = read(ex.question, /^Κύκλωσε τον χρόνο του ρήματος «(.+)»\.$/)[1];
      const body = ex.body ?? '';
      if (!contains(body, form)) return [`the sentence «${body}» does not have «${form}»`];
      const longer = [...ix.verbs.keys()].filter(f => f !== form && contains(f, form) && contains(body, f));
      if (longer.length) return [`«${form}» is part of «${longer[0]}» in the sentence: ask the whole form`];
      const readings = ix.verbs.get(form) ?? ix.verbs.get(lower(form)) ?? [];
      if (!readings.length) return [`«${form}» is not a verb form of the lexicon`];
      const other = readings.filter(r => r.mood !== 'οριστική');
      if (other.length) return [`«${form}» is also ${other[0].mood}: it has no tense to ask`];
      const tenses = [...new Set(readings.map(r => r.tense))];
      if (tenses.length !== 1) return [`«${form}» is ${tenses.join(' and ')} in the lexicon`];
      const { options, key } = choice(ex);
      const strange = options.filter(o => !(TENSES as readonly string[]).includes(o)).map(o => `«${o}» is not a tense`);
      return [...strange, ...one(options, o => o === tenses[0], key)];
    },
    // «Βάλε το ρήμα στον αόριστο: «…»»: the sentence has one verb form; the options are that verb's forms in
    // the same person, and one of them is in the asked tense
    retense(ex) {
      if (ex.type !== 'multiple-choice') return ['retense is a multiple choice'];
      const [, acc, sentence] = read(ex.question, /^Βάλε το ρήμα στον (.+?): «(.+)»$/);
      const asked = TENSE_ACC[acc];
      if (!asked) return [`«${acc}» is not a tense`];
      let found = [...ix.verbs.keys()].filter(f => contains(sentence, f));
      found = found.filter(f => !found.some(g => g !== f && contains(g, f)));
      if (found.length !== 1) return [`the sentence has ${found.length} verb forms of the lexicon (${found.join(', ') || 'none'}): one`];
      const readings = (ix.verbs.get(found[0]) ?? []).filter(r => r.mood === 'οριστική');
      const whose = [...new Set(readings.map(r => `${r.lemma} ${r.person}`))];
      if (whose.length !== 1) return [`«${found[0]}» reads as ${whose.join(', ')}`];
      const { lemma, person } = readings[0];
      if (readings.some(r => r.tense === asked)) return [`«${found[0]}» is already in the ${asked}`];
      const { options, key } = choice(ex);
      const same = (o: string) => (ix.verbs.get(o) ?? []).filter(r => r.lemma === lemma && r.person === person && r.mood === 'οριστική');
      const strange = options.filter(o => !same(o).length).map(o => `«${o}» is not a form of «${lemma}» (${person})`);
      return [...strange, ...one(options, o => same(o).some(r => r.tense === asked), key)];
    },
    // «Κύκλωσε την έγκλιση του ρήματος «…».», the sentence as body, options as the books' tables name them
    // («οριστική ενεστώτα», «συνοπτική προστακτική», …): after «να» or «μη(ν)» a subjunctive, without them
    // never; a form that is still two moods (ακούτε: indicative and imperative) is an error
    mood(ex) {
      if (ex.type !== 'multiple-choice') return ['mood is a multiple choice'];
      const form = read(ex.question, /^Κύκλωσε την έγκλιση του ρήματος «(.+)»\.$/)[1];
      const ws = wordsOf(ex.body ?? '').map(lower);
      const i = ws.indexOf(lower(form));
      if (i < 0) return [`the sentence «${ex.body ?? ''}» does not have «${form}»`];
      const particle = ['να', 'μη', 'μην'].includes(ws[i - 1] ?? '');
      const label = (r: VerbReading) => (r.mood === 'οριστική' ? `οριστική ${TENSE_GEN[r.tense]}` : r.mood);
      const labels = [...new Set((ix.verbs.get(lower(form)) ?? []).map(label))].filter(l => l.includes('υποτακτική') === particle);
      if (labels.length !== 1) return [`«${form}» ${particle ? 'after «να»/«μη»' : 'with no «να»/«μη»'} reads as ${labels.join(', ') || 'nothing in the lexicon'}`];
      const { options, key } = choice(ex);
      const strange = options.filter(o => !MOOD_LABELS.includes(o)).map(o => `«${o}» is not a mood of the books' tables`);
      return [...strange, ...one(options, o => o === labels[0], key)];
    },
    // A gap before a verb, options δε, δεν, μη, μην: δε(ν) with the indicative, μη(ν) with the subjunctive
    // (β26, γ142), and the -ν by the next word (γ55). After «να» the subjunctive; before «θα» or a past tense
    // the indicative; anything else could be either («Δεν/Μην ακούτε»), so it is an error
    negation(ex) {
      if (ex.type !== 'fill-blank') return ['negation is a fill-blank'];
      const { options, key } = choice(ex);
      if (options.length !== 4 || ['δε', 'δεν', 'μη', 'μην'].some(o => !options.includes(o))) return [`options ${JSON.stringify(options)}: δε, δεν, μη, μην`];
      const { words, at } = gapped(ex);
      const prev = lower(words[at - 1] ?? ''), next = lower(words[at + 1] ?? '');
      if (!next) return ['no word after the gap'];
      let indicative: boolean;
      if (prev === 'να') indicative = false;
      else if (next === 'θα') indicative = true;
      else {
        const readings = ix.verbs.get(next) ?? [];
        if (!readings.length) return [`«${next}» after the gap is not a verb form of the lexicon`];
        if (!readings.every(r => r.mood === 'οριστική' && PAST.includes(r.tense))) return [`«${next}» could follow δε(ν) or μη(ν): only after «να», before «θα» or before a past tense is it one`];
        indicative = true;
      }
      const answer = (indicative ? 'δε' : 'μη') + (KEEPS_N.test(next) ? 'ν' : '');
      return one(options, o => o === answer, key);
    },
    // «Κύκλωσε αυτό που φανερώνει χρόνο στην πρόταση.» (options are pieces of the sentence, each an expression of
    // the lexicon, one telling time) and «Τι είναι το «…» στην πρόταση;» (TIME_KINDS)
    time(ex) {
      if (ex.type !== 'multiple-choice') return ['time is a multiple choice'];
      const body = ex.body ?? '';
      const { options, key } = choice(ex);
      if (/^Κύκλωσε αυτό που φανερώνει χρόνο στην πρόταση\.$/.test(ex.question)) {
        const errs = options.filter(o => !contains(body, o)).map(o => `«${o}» is not in the sentence`);
        for (const o of options) {
          const e = ix.expressions.get(lower(o));
          if (!e) errs.push(`«${o}» is not an expression of the lexicon`);
          else if (e.shows.length > 1) errs.push(`«${o}» can tell ${e.shows.join(' or ')}`);
        }
        return [...errs, ...one(options, o => ix.expressions.get(lower(o))?.shows[0] === 'χρόνο', key)];
      }
      const piece = read(ex.question, /^Τι είναι το «(.+)» στην πρόταση;$/)[1];
      if (!contains(body, piece)) return [`«${piece}» is not in the sentence`];
      const e = ix.expressions.get(lower(piece));
      if (!e?.kind || !e.shows.includes('χρόνο')) return [`«${piece}» is not a time expression of the lexicon with its kind`];
      const strange = options.filter(o => !TIME_KINDS.includes(o)).map(o => `«${o}» is not one of ${TIME_KINDS.join(', ')}`);
      return [...strange, ...one(options, o => o === e.kind, key)];
    },
    // «Τι φανερώνει το επίρρημα «…» στην πρόταση;»: what the lexicon says it tells; a word that can tell two
    // things (αργά: time or manner) is never asked
    adverb(ex) {
      if (ex.type !== 'multiple-choice') return ['adverb is a multiple choice'];
      const word = read(ex.question, /^Τι φανερώνει το επίρρημα «(.+)» στην πρόταση;$/)[1];
      if (!contains(ex.body ?? '', word)) return [`«${word}» is not in the sentence`];
      const e = ix.expressions.get(lower(word));
      if (e?.kind !== 'επίρρημα') return [`«${word}» is not an adverb of the lexicon`];
      if (e.shows.length !== 1) return [`«${word}» can tell ${e.shows.join(' or ')}: never asked bare`];
      const { options, key } = choice(ex);
      const strange = options.filter(o => !SHOWS.includes(o)).map(o => `«${o}» is not one of ${SHOWS.join(', ')}`);
      return [...strange, ...one(options, o => o === e.shows[0], key)];
    },
    // «Κύκλωσε το τακτικό αριθμητικό του 7.», «Κύκλωσε το αναλογικό αριθμητικό.»: the lexicon's numerals
    numeral(ex) {
      if (ex.type !== 'multiple-choice') return ['numeral is a multiple choice'];
      const [, kind, n] = read(ex.question, /^Κύκλωσε το (απόλυτο|τακτικό|πολλαπλασιαστικό|αναλογικό|περιληπτικό) αριθμητικό(?: του (\d+))?\.$/);
      const num = (o: string) => (ix.lex.numerals ?? []).find(x => x.word === o);
      const { options, key } = choice(ex);
      const strange = options.filter(o => !num(o)).map(o => `«${o}» is not a numeral of the lexicon`);
      return [...strange, ...one(options, o => num(o)?.kind === kind && (n === undefined || num(o)?.value === Number(n)), key)];
    },
    // «Κύκλωσε τη σύνθετη λέξη με συνθετικά «A + B».», «Κύκλωσε τη λέξη που έχει α΄/β΄ συνθετικό τη λέξη «…».»:
    // the lexicon's compounds; a part it doesn't know can't be ruled out, unless the word has the asked one on its other side
    compound(ex) {
      if (ex.type !== 'multiple-choice') return ['compound is a multiple choice'];
      const comp = (o: string) => (ix.lex.compounds ?? []).find(c => c.word === o);
      const { options, key } = choice(ex);
      const errs = options.filter(o => !comp(o)).map(o => `«${o}» is not a compound of the lexicon`);
      if (errs.length) return errs;
      const both = ex.question.match(/^Κύκλωσε τη σύνθετη λέξη με συνθετικά «(.+) \+ (.+)»\.$/);
      if (both) {
        for (const o of options) if (comp(o)!.parts.includes(null)) errs.push(`«${o}»: a part the lexicon doesn't know can't be ruled out`);
        return [...errs, ...one(options, o => comp(o)!.parts[0] === both[1] && comp(o)!.parts[1] === both[2], key)];
      }
      const [, side, part] = read(ex.question, /^Κύκλωσε τη λέξη που έχει (α΄|β΄) συνθετικό τη λέξη «(.+)»\.$/);
      const i = side === 'α΄' ? 0 : 1;
      for (const o of options) {
        const p = comp(o)!.parts;
        if (p[i] === null && p[1 - i] !== part) errs.push(`«${o}»: its ${side} συνθετικό is not in the lexicon`);
      }
      return [...errs, ...one(options, o => comp(o)!.parts[i] === part, key)];
    },
    // «Κύκλωσε τη λέξη που ταιριάζει στον ορισμό: «…».»: the book's definitions; every option has one, and two
    // confusable words (αφετηρία, σταθμός, στάση, τέρμα) are never offered together
    define(ex) {
      if (ex.type !== 'multiple-choice') return ['define is a multiple choice'];
      const means = read(ex.question, /^Κύκλωσε τη λέξη που ταιριάζει στον ορισμό: «(.+)»\.$/)[1];
      const def = (o: string) => (ix.lex.definitions ?? []).find(d => d.word === o);
      const { options, key } = choice(ex);
      const errs = options.filter(o => !def(o)).map(o => `«${o}» has no definition in the lexicon`);
      for (const set of ix.lex.confusable ?? []) {
        const close = options.filter(o => set.includes(o));
        if (close.length > 1) errs.push(`${close.map(o => `«${o}»`).join(' and ')} are too close to pit against each other`);
      }
      return [...errs, ...one(options, o => def(o)?.means === means, key)];
    },
  };
}

const SPELLING_SKILLS = ['spell', 'capital'];

// ---------------------------------------------------------------------------
// What the child reads

function texts(ex: Plain): [string, string][] {
  const out: [string, string][] = [['title', ex.title]];
  if (ex.body) out.push(['body', ex.body]);
  if ('question' in ex) out.push(['question', ex.question]);
  if (ex.type === 'multiple-choice') ex.options.forEach((o, i) => out.push([`option ${i}`, o]));
  if (ex.type === 'fill-blank') { out.push(['text', ex.textWithGaps.replace('{0}', ex.correctAnswers[0] ?? '')]); ex.options.forEach((o, i) => out.push([`option ${i}`, o])); }
  if (ex.type === 'match-pairs') ex.pairs.forEach((p, i) => out.push([`pair ${i} left`, p.left], [`pair ${i} right`, p.right]));
  if (ex.type === 'ordering') ex.items.forEach((it, i) => out.push([`item ${i}`, it.content]));
  return out;
}

function textErrors(where: string, text: string): string[] {
  const errs: string[] = [];
  if (/undefined|NaN|null|\[object|\$\{|\bInfinity\b/.test(text)) errs.push(`${where}: template leftovers in «${text}»`);
  if (/ {2}|^ | $/.test(text)) errs.push(`${where}: stray spaces in «${text}»`);
  if (/ [,.;·!]/.test(text)) errs.push(`${where}: space before punctuation in «${text}»`);
  if (/[A-Za-z]/.test(text)) errs.push(`${where}: a Latin letter in «${text}» (a look-alike of a Greek one?)`);
  for (const w of genderedWords(text)) errs.push(`${where}: «${text}» says «${w}»: say it the same way to every child`);
  for (const w of wordsOf(text)) {
    if (/[’'\d]/.test(w) || !/\p{L}/u.test(w)) continue;
    if (syllables(w) >= 2 && !hasAccent(w) && !SYNIZESIS.has(lower(w))) errs.push(`${where}: «${w}» has no accent`);
  }
  return errs;
}

// ---------------------------------------------------------------------------

export interface LanguageAudit { errors: string[]; warnings: string[]; report: string[] }

/** The generated language items of these pools: the ones in Γλώσσα with a skill. */
export const generatedLanguage = (pools: Pool[]) => pools.flatMap(p => p.exercises.map(ex => ({ pool: p, ex })))
  .filter((x): x is { pool: Pool; ex: Plain } => x.ex.type !== 'problem' && x.ex.category === 'Γλώσσα' && typeof x.ex.generatorParams?.skill === 'string');

export function auditLanguage(pools: Pool[]): LanguageAudit {
  const errors: string[] = [], warnings: string[] = [], report: string[] = [];
  const allIds = new Map<string, number>();
  for (const p of pools) for (const ex of p.exercises) allIds.set(ex.id, (allIds.get(ex.id) ?? 0) + 1);
  const items = generatedLanguage(pools);
  const asked = new Set<string>();

  for (const grade of Object.keys(CURRICULUM).map(Number) as LanguageGrade[]) {
    const mine = items.filter(x => x.pool.grades.includes(grade));
    if (!mine.length) continue;
    const c = CURRICULUM[grade], lex = LEXICON[grade], ix = index(lex), solve = solvers(ix);
    errors.push(...lexiconErrors(grade, lex));
    const families = new Map<string, { n: number; skill: string; types: Set<string>; units: Set<number> }>();
    const types = new Map<string, number>();
    let trues = 0;

    for (const { pool, ex } of mine) {
      const err = (msg: string) => errors.push(`${ex.id}: ${msg}`);
      const fam = String(ex.generatorParams.family ?? ''), skill = String(ex.generatorParams.skill);
      // Who it is
      if (pool.grades.length !== 1) err(`its pool ${pool.file} is for grades ${pool.grades.join(', ')}: one grade per language pool`);
      if ((allIds.get(ex.id) ?? 0) > 1) err('duplicate id');
      if (!new RegExp(`^${PREFIX[grade]}-lang-${fam.replace(/-/g, '\\-')}-\\d{3}$`).test(ex.id)) err(`id is not ${PREFIX[grade]}-lang-${fam}-NNN`);
      if (ex.id.includes('-gen-')) err('«-gen-» in the id (the evidence helpers read it as a problem)');
      if (ex.stars !== 1) err(`⭐${ex.stars}: a language item pays ⭐1`);
      const place = ex.source ? placeOf(grade, ex.source) : undefined;
      if (!place) err(`source «${ex.source ?? ''}» is not a lesson page of the ${c.label} book (curriculum.ts)`);
      else {
        if (!c.units.includes(place.unit)) err(`source «${ex.source}» is in unit ${place.unit}, past units ${c.units.join(', ')}`);
        if (ex.generatorParams.unit !== place.unit) err(`generatorParams.unit ${ex.generatorParams.unit}, the source is in unit ${place.unit}`);
      }

      // What it shows
      for (const [where, text] of texts(ex)) errors.push(...textErrors(where, text).map(e => `${ex.id}: ${e}`));
      if (!/^[Α-ΩΆΈΉΊΌΎΏ]/.test(ex.title)) err('title does not start with a capital');
      if (ex.type === 'multiple-choice' || ex.type === 'fill-blank') {
        // A title that names some of the options and not the rest («Της ή τις;» over τις · της · των) rules the rest out
        const titleWords = new Set(wordsOf(ex.title).map(lower));
        const named = ex.options.filter(o => titleWords.has(lower(o)));
        if (named.length && named.length < ex.options.length) err(`the title «${ex.title}» names ${named.map(o => `«${o}»`).join(', ')} and not the other options: it rules them out`);
      }
      const ask = ex.type === 'match-pairs' || ex.type === 'ordering' || ex.type === 'fill-blank' ? ex.body ?? '' : ex.question;
      if (!/^[Α-ΩΆΈΉΊΌΎΏ]/.test(ask)) err(`«${ask}» does not start with a capital`);
      if (!/[.;!…]»?$/.test(ask)) err(`«${ask}» does not end with punctuation`);
      const key = JSON.stringify([ex.body ?? '', 'question' in ex ? ex.question : '', 'textWithGaps' in ex ? ex.textWithGaps : '',
        ex.type === 'ordering' ? ex.items.map(i => i.content).sort() : '', 'options' in ex ? [...ex.options].sort() : '']);
      if (asked.has(key)) err('the same item as another one');
      asked.add(key);

      // How it is answered
      types.set(ex.type, (types.get(ex.type) ?? 0) + 1);
      if (ex.type === 'true-false' && ex.correctValue) trues++;
      if (ex.type === 'number-input') err('a language item has no number to type');
      if (ex.type === 'multiple-choice' || ex.type === 'fill-blank') {
        const { options, key: k } = choice(ex);
        const right = options[k];
        if (new Set(options).size !== options.length) err(`repeated options ${JSON.stringify(options)}`);
        if (options.length < 3 || options.length > 5) err(`${options.length} options: a language item has 3 to 5`);
        if (right === undefined) err('the key is not one of the options');
        else {
          if (options.every(o => o === right || [...o].length < [...right].length)) err(`the right option «${right}» is the only longest: it gives itself away`);
          if (SPELLING_SKILLS.includes(skill)) {
            const total = (o: string) => options.reduce((s, x) => s + distance(o, x), 0);
            const best = Math.min(...options.map(total));
            if (total(right) === best && options.filter(o => total(o) === best).length === 1) err(`the right option «${right}» is the one closest to all the others: a letter-by-letter vote finds it`);
          }
        }
      }
      if (ex.type === 'fill-blank') {
        const gaps = ex.textWithGaps.match(/\{\d+\}/g) ?? [];
        if (gaps.length !== 1 || !ex.textWithGaps.includes('{0}') || ex.correctAnswers.length !== 1) err('a language fill-blank has exactly one gap, {0}');
        const [before, after] = ex.textWithGaps.split('{0}');
        const mark = ex.options.every(o => /^[.;,]$/.test(o));
        if (before.length + after.length > FILL_LINE_MAX) err(`the sentence has ${before.length + after.length} characters besides its gap: over ${FILL_LINE_MAX}, it breaks at the gap`);
        if (mark ? !/\p{L}$/u.test(before) || !/^( |$)/.test(after) : /\p{L}$/u.test(before) || /^\p{L}/u.test(after)) {
          err(mark ? 'a punctuation gap goes right after a word' : 'the gap is inside a word: a gap is a whole word');
        }
      }
      if (ex.type === 'match-pairs' && (ex.pairs.length < 3 || new Set(ex.pairs.map(p => p.left)).size !== ex.pairs.length || new Set(ex.pairs.map(p => p.right)).size !== ex.pairs.length)) err('repeated or too few pairs');
      if (ex.type === 'ordering' && (ex.items.length < 3 || new Set(ex.items.map(i => i.content)).size !== ex.items.length)) err('repeated or too few items');
      const shown = revealed(ex);
      if (shown.length > revealMax(ex)) err(`«Δείξε μου» would show ${shown.length} characters («${shown}»): keep it to ${revealMax(ex)} at most`);

      // The key, derived again from the lexicon and the rule
      const solver = solve[skill];
      if (!solver) err(`no solver for skill «${skill}»`);
      else {
        try {
          for (const e of solver(ex)) err(e);
        } catch (e) {
          err((e as Error).message);
        }
      }

      const f = families.get(fam) ?? { n: 0, skill, types: new Set<string>(), units: new Set<number>() };
      f.n++;
      f.types.add(ex.type);
      if (place) f.units.add(place.unit);
      families.set(fam, f);
    }

    // The grade's set
    const total = mine.length;
    const tfs = types.get('true-false') ?? 0, fills = types.get('fill-blank') ?? 0;
    if (total < MIN_ITEMS) errors.push(`grade ${grade}: ${total} language items, fewer than ${MIN_ITEMS}`);
    if (tfs > total * MAX_TRUE_FALSE) errors.push(`grade ${grade}: ${tfs} true-false items, over ${MAX_TRUE_FALSE * 100} % of ${total}`);
    if (fills > total * MAX_FILL_BLANK) errors.push(`grade ${grade}: ${fills} fill-blank items, over ${MAX_FILL_BLANK * 100} % of ${total}`);
    if (tfs && (trues / tfs < 0.4 || trues / tfs > 0.6)) errors.push(`grade ${grade}: ${trues} of ${tfs} true-false items are «Σωστό», outside 40–60 %`);
    report.push(`\nGrade ${grade} language: ${total} items in ${families.size} families; ${[...types].map(([t, n]) => `${t} ${n}`).join(', ')}; true-false «Σωστό» ${trues}/${tfs}`);
    for (const [id, f] of families) report.push(`  ${id.padEnd(22)} ${String(f.n).padStart(3)} items  ${f.skill.padEnd(9)} unit ${[...f.units].sort().join(', ').padEnd(8)} ${[...f.types].join(', ')}`);
  }
  return { errors, warnings, report };
}

/** The language items as she sees them, with the right answer, for reading: all of them, or n random per grade. */
export function languageSample(pools: Pool[], r: Rng, n: number): string {
  let md = '\n# Plain language to read\n';
  for (const grade of Object.keys(CURRICULUM).map(Number) as LanguageGrade[]) {
    const all = generatedLanguage(pools).filter(x => x.pool.grades.includes(grade)).map(x => x.ex);
    if (!all.length) continue;
    const shown = n >= all.length ? all : r.sample(all, n);
    md += `\n## Grade ${grade} (${shown.length} of ${all.length})\n`;
    for (const ex of shown) {
      md += `\n- **${ex.title}** · ${ex.id} · ${ex.type} · ${ex.source}\n`;
      if (ex.body) md += `  - ${ex.body}\n`;
      if ('question' in ex) md += `  - ${ex.question}\n`;
      if (ex.type === 'multiple-choice') md += `  - ${ex.options.map((o, i) => (i === ex.correctIndex ? `**${o}**` : o)).join(' · ')}\n`;
      if (ex.type === 'fill-blank') md += `  - ${ex.textWithGaps} · ${ex.options.map(o => (ex.correctAnswers.includes(o) ? `**${o}**` : o)).join(' · ')}\n`;
      if (ex.type === 'ordering') md += `  - (shuffled on screen) ${ex.items.map(i => i.content).join(' · ')}\n`;
      md += `  - ✔ ${revealed(ex)}\n`;
    }
  }
  return md;
}
