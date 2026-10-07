// Issue #49 part 3b: the owner's ambiguity rules, as items the audit must refuse. Each line is a crafted Ε΄
// item that breaks one rule, audited next to the shipped pools; it must come back with an error. Run from the repo root:
//   docker run --rm -u $(id -u):$(id -g) -v $PWD:/w -w /w node:24-alpine node .evidence/49-language-e5/after-audit-guards.ts
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Exercise } from '../../shared/types.ts';
import { auditLanguage } from '../../tools/problem-gen/language/check.ts';

type Pool = { file: string; grades: number[]; exercises: Exercise[] };
const DIR = 'backend/exercise-pools';
const pools: Pool[] = readdirSync(DIR).filter(f => f.endsWith('.json')).map(file => ({ file, ...JSON.parse(readFileSync(path.join(DIR, file), 'utf-8')) }));
const e5 = pools.find(p => p.file === 'e-dimotikou-language.json')!;
const base = (fam: string, skill: string, unit: number, source: string) =>
  ({ category: 'Γλώσσα', stars: 1, source, generatorParams: { family: fam, unit, skill } });
const SRC1 = 'Γλώσσα Ε΄, ενότητα 1: Ο φίλος μας το περιβάλλον, μάθημα 2: Η φίλη μας η θάλασσα (βιβλίο, σ. 13)';
const SRC2 = 'Γλώσσα Ε΄, ενότητα 2: Η ζωή στην πόλη, μάθημα 1: Η γειτονιά της πόλης (βιβλίο, σ. 25)';
const SRC23 = 'Γλώσσα Ε΄, ενότητα 2: Η ζωή στην πόλη, μάθημα 3: Διαδρομές στην πόλη (βιβλίο, σ. 35)';
const SRC22 = 'Γλώσσα Ε΄, ενότητα 2: Η ζωή στην πόλη, μάθημα 2: Πόλη και πολιτισμός (βιβλίο, σ. 32)';

const cases: [string, any][] = [
  ['δε(ν)/μη(ν) before a present form: «Δεν/Μην ακούτε» are both right', {
    id: 'e5-lang-arnisi-901', type: 'fill-blank', title: 'Δε(ν) και μη(ν)', body: 'Συμπλήρωσε τη λέξη που ταιριάζει.',
    textWithGaps: 'Εσείς {0} ακούτε μουσική δυνατά.', options: ['μην', 'μη', 'δεν', 'δε'], correctAnswers: ['μην'], ...base('arnisi', 'negation', 2, SRC2) }],
  ['the masculine genitive of an -ης adjective, with the everyday -ή offered as wrong', {
    id: 'e5-lang-epitheta-is-es-901', type: 'fill-blank', title: 'Επίθετα σε -ης, -ες', body: 'Συμπλήρωσε τη λέξη που ταιριάζει.',
    textWithGaps: 'Η συναυλία του {0} καλλιτέχνη αναβλήθηκε.', options: ['διεθνούς', 'διεθνή', 'διεθνής', 'διεθνείς'], correctAnswers: ['διεθνούς'], ...base('epitheta-is-es', 'agree', 2, SRC22) }],
  ['two close definitions in one item (αφετηρία, σταθμός)', {
    id: 'e5-lang-orismoi-901', type: 'multiple-choice', title: 'Λέξεις και ορισμοί',
    question: 'Κύκλωσε τη λέξη που ταιριάζει στον ορισμό: «το σημείο από όπου ξεκινάει σε τακτά διαστήματα ένα μεταφορικό μέσο».',
    options: ['αφετηρία', 'σταθμός', 'οικολογία'], correctIndex: 0, ...base('orismoi', 'define', 2, SRC23) }],
  ['an adverb that can tell two things, asked bare (αργά)', {
    id: 'e5-lang-epirrimata-901', type: 'multiple-choice', title: 'Επιρρήματα: πότε, πού, πώς;', body: 'Ο χρόνος έπεφτε αργά μαζί με τις νιφάδες.',
    question: 'Τι φανερώνει το επίρρημα «αργά» στην πρόταση;', options: ['τρόπο', 'χρόνο', 'τόπο'], correctIndex: 0, ...base('epirrimata', 'adverb', 1, SRC1) }],
  ['a mood item on a form that is two moods with no «να»/«μη» (ακούτε: indicative and imperative)', {
    id: 'e5-lang-egkliseis-901', type: 'multiple-choice', title: 'Οι εγκλίσεις του ρήματος', body: 'Ακούτε μουσική με τον ήχο χαμηλά.',
    question: 'Κύκλωσε την έγκλιση του ρήματος «ακούτε».', options: ['οριστική ενεστώτα', 'εξακολουθητική προστακτική', 'συνοπτική υποτακτική'], correctIndex: 0, ...base('egkliseis', 'mood', 2, SRC2) }],
  ['a tense asked on part of a compound form («πλησιάσει» in «θα έχει πλησιάσει»)', {
    id: 'e5-lang-xronoi-901', type: 'multiple-choice', title: 'Οι χρόνοι του ρήματος', body: 'Ως το βράδυ το πλοίο θα έχει πλησιάσει το λιμάνι.',
    question: 'Κύκλωσε τον χρόνο του ρήματος «έχει πλησιάσει».', options: ['παρακείμενος', 'υπερσυντέλικος', 'αόριστος'], correctIndex: 0, ...base('xronoi', 'tense', 1, SRC1) }],
  ['a proverb with a word of check-gender\'s list («Όποιος …»)', {
    id: 'e5-lang-paroimies-901', type: 'multiple-choice', title: 'Παροιμίες για τους μύλους', body: 'Συμπλήρωσε την παροιμία.',
    question: 'Όποιος αέρας κι αν φυσά, ο μύλος πάντα …', options: ['αλέθει', 'σταματά', 'γυρίζει'], correctIndex: 0, ...base('paroimies', 'saying', 1, SRC1) }],
  ['an item citing the grammar book (items cite only β/τ lesson pages)', {
    id: 'e5-lang-thilyka-os-901', type: 'fill-blank', title: 'Θηλυκά σε -ος', body: 'Συμπλήρωσε τη λέξη που ταιριάζει.',
    textWithGaps: 'Η {0} Αλεξάνδρας είναι ανοιχτή.', options: ['λεωφόρος', 'λεωφόρο', 'λεωφόρου'], correctAnswers: ['λεωφόρος'],
    ...base('thilyka-os', 'agree', 2, 'Γλώσσα Ε΄, ενότητα 2: Η ζωή στην πόλη, μάθημα 3: Διαδρομές στην πόλη (γραμματική, σ. 80)') }],
  ['a fill-blank sentence longer than a line (FILL_LINE_MAX)', {
    id: 'e5-lang-epitheta-is-es-902', type: 'fill-blank', title: 'Επίθετα σε -ης, -ες', body: 'Συμπλήρωσε τη λέξη που ταιριάζει.',
    textWithGaps: 'Η ορχήστρα θα παίξει στην {0} αίθουσα συναυλιών του Μεγάρου Μουσικής.', options: ['πολυτελή', 'πολυτελής', 'πολυτελές'], correctAnswers: ['πολυτελή'], ...base('epitheta-is-es', 'agree', 2, SRC22) }],
  ['the grammar book\'s «προθετική φράση» on her screen (her books say «φράση με πρόθεση», β9/τ8)', {
    id: 'e5-lang-xronos-901', type: 'multiple-choice', title: 'Λέξεις που φανερώνουν χρόνο', body: 'Στο τέλος συνάντησα τον αργυροπελεκάνο στην Κερκίνη.',
    question: 'Τι είναι το «στο τέλος» στην πρόταση;', options: ['προθετική φράση', 'φράση σε αιτιατική', 'χρονική πρόταση', 'επίρρημα'], correctIndex: 0,
    ...base('xronos', 'time', 1, 'Γλώσσα Ε΄, ενότητα 1: Ο φίλος μας το περιβάλλον, μάθημα 6: Πάρτι στη... λάσπη (τετράδιο εργασιών, σ. 12)') }],
  ['xronos-005 without «φράση σε αιτιατική»: «φράση με πρόθεση» would be the only longest option', {
    id: 'e5-lang-xronos-902', type: 'multiple-choice', title: 'Λέξεις που φανερώνουν χρόνο', body: 'Στο τέλος συνάντησα τον αργυροπελεκάνο στην Κερκίνη.',
    question: 'Τι είναι το «στο τέλος» στην πρόταση;', options: ['φράση με πρόθεση', 'χρονική πρόταση', 'επίρρημα'], correctIndex: 0,
    ...base('xronos', 'time', 1, 'Γλώσσα Ε΄, ενότητα 1: Ο φίλος μας το περιβάλλον, μάθημα 6: Πάρτι στη... λάσπη (τετράδιο εργασιών, σ. 12)') }],
];

let refused = 0;
for (const [why, ex] of cases) {
  const changed = pools.map(p => (p !== e5 ? p : { ...p, exercises: [...p.exercises, ex] }));
  const errs = auditLanguage(changed).errors.filter(e => e.startsWith(`${ex.id}: `));
  if (errs.length) refused++;
  console.log(`${errs.length ? '✔ refused' : '✘ PASSED '} ${why}\n    ${errs.map(e => e.slice(ex.id.length + 2)).join('\n    ') || '(no error)'}`);
}
console.log(`\n${refused} of ${cases.length} crafted items refused`);
if (refused !== cases.length) process.exit(1);
