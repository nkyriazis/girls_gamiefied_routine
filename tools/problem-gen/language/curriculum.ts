// What each grade's language book holds, as committed data: its units and lessons, with
// the pages each lesson takes in the student book and in the workbook (from the books'
// contents, tools/edu-materials; pages as printed, one less than the PDF's page number).
// An item's `source` names one lesson and one page of it; the audit checks every source
// against this list, within the units the class has covered, without reading materials/.
//
// Keyed by grade. Γ΄ is «Τα απίθανα μολύβια», first volume (student book 10-0048, workbook
// 10-0049). Ε΄ is «Της γλώσσας ρόδι και ροδάνι», first volume (student book 10-0245, workbook
// 10-0111), with the grammar «Γραμματική Ε΄ και ΣΤ΄ Δημοτικού» (10-0138) as a reference the
// lexicon may cite («γ104»); an item cites only a lesson page of the student book or workbook.

import { CURRICULUM as BOOKS } from '../../../shared/curriculum.ts';

export type LanguageGrade = 3 | 5;

/** «βιβλίο» is the student book, «τετράδιο» the workbook, «γραμματική» a grammar book (reference only). */
export type Book = 'βιβλίο' | 'τετράδιο' | 'γραμματική';
export const BOOK_NAME: Record<Book, string> = { 'βιβλίο': 'βιβλίο', 'τετράδιο': 'τετράδιο εργασιών', 'γραμματική': 'γραμματική' };

export interface Lesson {
  unit: number;
  /** The lesson's number in its unit, as the contents number it; 0 is the unit's «Λεξιλόγιο». */
  n: number;
  title: string;
  /** First and last page in each book (printed numbers). */
  pages: Partial<Record<Book, [number, number]>>;
}

export interface LanguageCurriculum {
  /** "Γ΄": how the source names the grade. */
  label: string;
  /** The units the class has covered by the end of October: an item may come only from these. */
  units: number[];
  unitTitles: Record<number, string>;
  lessons: Lesson[];
  /** Pages of reference outside the lessons (a grammar summary or book), which the lexicon may cite. */
  reference: Partial<Record<Book, [number, number][]>>;
}

// The pages of each lesson (shared/curriculum.ts holds the lessons themselves, in book order, #71)
const PAGES: Record<LanguageGrade, Record<string, Partial<Record<Book, [number, number]>>>> = {
  3: {
    '1.1': { 'βιβλίο': [10, 11], 'τετράδιο': [8, 8] },
    '1.2': { 'βιβλίο': [12, 14], 'τετράδιο': [9, 9] },
    '1.3': { 'βιβλίο': [15, 17], 'τετράδιο': [10, 12] },
    '1.4': { 'βιβλίο': [18, 20], 'τετράδιο': [13, 15] },
    '1.5': { 'βιβλίο': [21, 24], 'τετράδιο': [16, 18] },
    '1.6': { 'βιβλίο': [25, 25] },
    '1.0': { 'βιβλίο': [26, 26] },
    '2.1': { 'βιβλίο': [28, 31], 'τετράδιο': [20, 21] },
    '2.2': { 'βιβλίο': [32, 35], 'τετράδιο': [22, 24] },
    '2.3': { 'βιβλίο': [36, 39], 'τετράδιο': [25, 30] },
    '2.4': { 'βιβλίο': [40, 42], 'τετράδιο': [31, 32] },
    '2.0': { 'βιβλίο': [43, 44] },
    '3.1': { 'βιβλίο': [46, 49], 'τετράδιο': [34, 35] },
    '3.2': { 'βιβλίο': [50, 52], 'τετράδιο': [36, 38] },
    '3.3': { 'βιβλίο': [53, 55], 'τετράδιο': [39, 40] },
    '3.4': { 'βιβλίο': [56, 58], 'τετράδιο': [41, 42] },
    '3.5': { 'βιβλίο': [59, 61], 'τετράδιο': [43, 44] },
    '3.0': { 'βιβλίο': [62, 62] },
    '4.1': { 'βιβλίο': [64, 67], 'τετράδιο': [46, 48] },
    '4.2': { 'βιβλίο': [68, 71], 'τετράδιο': [49, 52] },
    '4.3': { 'βιβλίο': [72, 75], 'τετράδιο': [53, 55] },
    '4.0': { 'βιβλίο': [76, 76] },
    '5.1': { 'βιβλίο': [78, 78] },
    '5.2': { 'βιβλίο': [79, 82] },
    '5.3': { 'βιβλίο': [83, 84] },
  },
  5: {
    '1.1': { 'βιβλίο': [8, 11] },
    '1.2': { 'βιβλίο': [12, 15] },
    '1.3': { 'βιβλίο': [16, 20] },
    '1.4': { 'τετράδιο': [7, 8] },
    '1.5': { 'τετράδιο': [9, 11] },
    '1.6': { 'τετράδιο': [12, 13] },
    '1.7': { 'τετράδιο': [14, 16] },
    '2.1': { 'βιβλίο': [24, 27] },
    '2.2': { 'βιβλίο': [28, 32] },
    '2.3': { 'βιβλίο': [33, 35] },
    '2.4': { 'βιβλίο': [36, 39] },
    '2.5': { 'τετράδιο': [17, 18] },
    '2.6': { 'τετράδιο': [19, 22] },
    '2.7': { 'τετράδιο': [23, 25] },
    '2.8': { 'τετράδιο': [26, 28] },
  },
};

const lessons = (grade: LanguageGrade): Lesson[] => BOOKS[grade].language.chapters.map(l => ({
  unit: l.unit, n: Number(l.id.split('.')[1]), title: l.title, pages: PAGES[grade][l.id] ?? {},
}));

export const CURRICULUM: Record<LanguageGrade, LanguageCurriculum> = {
  3: {
    label: 'Γ΄',
    units: [1, 2, 3],
    unitTitles: BOOKS[3].language.unitTitles!,
    lessons: lessons(3),
    // «Η γραμματική μου»: the volume's grammar summary (declensions, είμαι, the spelling rules)
    reference: { 'βιβλίο': [[85, 87]] },
  },
  5: {
    label: 'Ε΄',
    // Units 1–2 hold the autumn grammar (tenses, time words, moods, -ος feminines, -ης/-ες
    // adjectives, numerals, adverbs, compounds); unit 3 (28η Οκτωβρίου) has no grammar box.
    // A lesson is a student-book text, under the heading the book prints; the workbook's sections
    // don't follow the book's texts, so each is a lesson too, numbered after the book's
    units: [1, 2],
    unitTitles: BOOKS[5].language.unitTitles!,
    lessons: lessons(5),
    // The grammar book's pages for what units 1–2 use but don't print in full: τελικό -ν (γ55),
    // θηλυκά σε -ος (γ79–80), επίθετα σε -ης/-ες (γ104), αριθμητικά (γ122–129), the verb: χρόνοι,
    // εγκλίσεις and the conjugation tables (γ131–152), επιρρήματα (γ162–165)
    reference: { 'γραμματική': [[55, 55], [79, 80], [104, 104], [122, 129], [131, 152], [162, 165]] },
  },
};

/** Where an item comes from: «2.2 τ23» is unit 2, lesson 2, workbook page 23 («2.0 β43»: the unit's Λεξιλόγιο). */
export interface Place { unit: number; n: number; book: Book; page: number }

export function parsePlace(at: string): Place {
  const m = at.match(/^(\d)\.(\d) ([βτ])(\d+)$/);
  if (!m) throw new Error(`«${at}» is not a place like «2.2 τ23»`);
  return { unit: Number(m[1]), n: Number(m[2]), book: m[3] === 'β' ? 'βιβλίο' : 'τετράδιο', page: Number(m[4]) };
}

/** The lesson a place names, if its page is within that lesson in that book. */
export function lessonAt(grade: LanguageGrade, p: Place): Lesson | undefined {
  const l = CURRICULUM[grade].lessons.find(x => x.unit === p.unit && x.n === p.n);
  const range = l?.pages[p.book];
  return range && p.page >= range[0] && p.page <= range[1] ? l : undefined;
}

/** «Γλώσσα Γ΄, ενότητα 2: Στο σπίτι και στη γειτονιά, μάθημα 2: Η φίλη μας η Αργυρώ (τετράδιο εργασιών, σ. 23)». */
export function sourceOf(grade: LanguageGrade, at: string): string {
  const c = CURRICULUM[grade], p = parsePlace(at), l = lessonAt(grade, p);
  if (!l) throw new Error(`${at}: no such lesson and page in the ${c.label} book`);
  const lesson = l.n ? `μάθημα ${l.n}: ${l.title}` : l.title;
  return `Γλώσσα ${c.label}, ενότητα ${l.unit}: ${c.unitTitles[l.unit]}, ${lesson} (${BOOK_NAME[p.book]}, σ. ${p.page})`;
}

/** The place a source names, if it names a lesson and page of this grade's books exactly as sourceOf writes it. */
export function placeOf(grade: LanguageGrade, source: string): Place | undefined {
  const m = source.match(/^Γλώσσα .+?, ενότητα (\d+): .+, (?:μάθημα (\d+): .+|Λεξιλόγιο) \((βιβλίο|τετράδιο εργασιών), σ\. (\d+)\)$/);
  if (!m) return undefined;
  const at = `${m[1]}.${m[2] ?? 0} ${m[3] === 'βιβλίο' ? 'β' : 'τ'}${m[4]}`;
  try {
    return sourceOf(grade, at) === source ? parsePlace(at) : undefined;
  } catch {
    return undefined;
  }
}

/** Whether a page exists in this grade's books (a lesson's or a reference page): what the lexicon may cite. */
export function pageExists(grade: LanguageGrade, book: Book, page: number): boolean {
  const c = CURRICULUM[grade];
  const ranges = [...c.lessons.map(l => l.pages[book]), ...(c.reference[book] ?? [])].filter((r): r is [number, number] => !!r);
  return ranges.some(([a, b]) => page >= a && page <= b);
}
