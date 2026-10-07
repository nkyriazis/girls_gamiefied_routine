// The lexicon the language audit checks every item against: words and their forms typed
// out of the books at development time, each with the page it comes from («β38» is page 38
// of the student book, «τ25» of the workbook). Every form is written out in full; nothing
// here builds a form from a stem. Nothing reads materials/ at runtime.
//
// The families (g3.ts) don't read it: their items are typed literally, and check.ts derives
// each key again from this lexicon and the rule the item's skill names.
//
// Words on check-gender's list (frontend/scripts/gendered.mjs) are left out: φίλος, όλοι,
// έτοιμος (one of the book's -ιμος exceptions), μόνος…

import type { LanguageGrade } from './curriculum.ts';
import { G3_LEXICON } from './lexicon/g3.ts';

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

/** A verb in one tense: its forms by person (present unless `tense` says otherwise). */
export interface Verb {
  lemma: string;
  at: string;
  tense?: 'αόριστος';
  forms: Partial<Record<Person, string>>;
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
}

export const LEXICON: Record<LanguageGrade, Lexicon> = { 3: G3_LEXICON };
