// Words that speak to a kid as a girl or a boy: «έτοιμη», «σε ποια», «όλοι». Every child uses the
// kids' screens, so what they read and hear says the same to all. check-gender.mjs looks for them
// in frontend/src; tools/problem-gen/maths/check.ts in the generated maths items.
export const GENDERED = [
  'έτοιμη', 'έτοιμος', 'έτοιμες', 'έτοιμοι', 'σίγουρη', 'σίγουρος', 'μόνη', 'μόνος', 'κουρασμένη', 'κουρασμένος',
  'αδερφή', 'αδερφός', 'αδερφές', 'αδελφή', 'αδελφός', 'κορίτσι', 'κορίτσια', 'αγόρι', 'αγόρια',
  'καθεμιά', 'καθεμία', 'καθένας', 'όποια', 'όποιος', 'ποιος', 'όλες', 'όλοι', 'όλους', 'νικήτρια', 'νικητής', 'φίλη', 'φίλος',
];

export const accentless = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The gendered words in a text (accents and case ignored). */
export function genderedWords(text) {
  const word = new RegExp(`(?<!\\p{L})(${GENDERED.map(accentless).join('|')})(?!\\p{L})`, 'gu');
  return [...accentless(text).matchAll(word)].map(m => m[1]);
}
