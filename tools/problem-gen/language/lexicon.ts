// The lexicon the language audit checks every item against: words and their forms typed
// out of the books at development time, each with the page it comes from («β38» is page 38
// of the student book, «τ25» of the workbook, «γ104» of a grammar book the grade's curriculum
// lists as a reference). Every form is written out in full; nothing here builds a form from a
// stem. Nothing reads materials/ at runtime.
//
// The families (g3.ts, e5.ts) don't read it: their items are typed literally, and check.ts
// derives each key again from this lexicon and the rule the item's skill names.
//
// Words on check-gender's list (frontend/scripts/gendered.mjs) are left out: φίλος, όλοι,
// έτοιμος (one of the book's -ιμος exceptions), μόνος…

import type { LanguageGrade } from './curriculum.ts';
import { G3_LEXICON } from './lexicon/g3.ts';
import { E5_LEXICON } from './lexicon/e5.ts';

export type Gender = 'm' | 'f' | 'n';
export type Case = 'nom' | 'gen' | 'acc' | 'voc';
export type Num = 'sg' | 'pl';
/** «f.gen.sg»: feminine, genitive, singular. */
export type Tag = `${Gender}.${Case}.${Num}`;
export type Person = '1sg' | '2sg' | '3sg' | '1pl' | '2pl' | '3pl';

/** A noun: its forms by case, [singular, plural] (a missing one is a form the items never ask for). */
export interface Noun {
  gender: Gender;
  at: string;
  /** A proper noun (κύριο όνομα): written with a capital. */
  proper?: true;
  forms: Partial<Record<Case, [string | null, string | null]>>;
}

/** An adjective: its forms by gender and case, [singular, plural]. */
export interface Adjective {
  at: string;
  forms: Record<Gender, Partial<Record<Case, [string, string]>>>;
}

/** The eight tenses, as the books name them (β9, γ133). */
export const TENSES = ['ενεστώτας', 'παρατατικός', 'αόριστος', 'παρακείμενος', 'υπερσυντέλικος',
  'εξακολουθητικός μέλλοντας', 'συνοπτικός μέλλοντας', 'συντελεσμένος μέλλοντας'] as const;
export type Tense = typeof TENSES[number];
/** The moods as the books' tables name them (β26, τ21): the subjunctive and imperative with their aspect; the indicative goes with a tense. */
export type Mood = 'οριστική' | 'εξακολουθητική υποτακτική' | 'συνοπτική υποτακτική' | 'εξακολουθητική προστακτική' | 'συνοπτική προστακτική';

/**
 * A verb in one tense and mood: its forms by person (indicative present unless `tense` or `mood`
 * says otherwise). A compound tense is one form («έχουν μολυνθεί», «θα γράψω»); a subjunctive form
 * is written without its «να» («πάρεις»). A non-indicative mood has no tense.
 */
export interface Verb {
  lemma: string;
  at: string;
  tense?: Tense;
  mood?: Mood;
  forms: Partial<Record<Person, string>>;
}

/** What a word, phrase or clause tells in its sentence (β9, β39, τ18, γ163). */
export type Shows = 'χρόνο' | 'τόπο' | 'τρόπο' | 'ποσό' | 'πρόσωπο ή πράγμα';
/** A piece of a sentence and what it tells; `shows` has two entries for a word that can tell either (αργά). */
export interface Expression {
  text: string;
  shows: Shows[];
  kind?: 'επίρρημα' | 'φράση με πρόθεση' | 'φράση σε αιτιατική' | 'χρονική πρόταση';
  at: string;
}

/** A compound word and its parts (α΄ and β΄ συνθετικό); a part the book doesn't print is null. */
export interface Compound { word: string; parts: [string | null, string | null]; at: string }

/** A numeral with its number and kind (β37, γ123–129). */
export interface Numeral {
  word: string;
  value: number;
  kind: 'απόλυτο' | 'τακτικό' | 'πολλαπλασιαστικό' | 'αναλογικό' | 'περιληπτικό';
  at: string;
}

/** A phrase and what it means; `not` are meanings the book offers that are wrong. */
export interface Phrase { phrase: string; means: string[]; not: string[]; at: string }

/** A simile or a proverb with its last word missing («…»), and that word. */
export interface Saying { text: string; answer: string; kind: 'παρομοίωση' | 'παροιμία'; at: string }

export interface Lexicon {
  nouns: Noun[];
  adjectives: Adjective[];
  verbs: Verb[];
  /** Words the book lists on a page (spelling lists, the words of an exercise), as written there. */
  words: { at: string; words: string[] }[];
  opposites: { pair: [string, string]; at: string }[];
  synonyms: { pair: [string, string]; at: string }[];
  /** Word families: words that share a piece and a meaning. */
  families: { words: string[]; at: string }[];
  phrases: Phrase[];
  sayings: Saying[];
  expressions?: Expression[];
  compounds?: Compound[];
  numerals?: Numeral[];
  /** The book's definitions, as it words them. */
  definitions?: { word: string; means: string; at: string }[];
  /** Words whose definitions are too close to pit against each other in one item. */
  confusable?: string[][];
}

export const LEXICON: Record<LanguageGrade, Lexicon> = { 3: G3_LEXICON, 5: E5_LEXICON };
