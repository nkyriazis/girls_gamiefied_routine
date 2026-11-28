// The checks checked: check.mjs must pass a good lesson and must still catch every mistake it was written for.
// One made-up lesson (our own text about a school garden, never a book's) passes every check, enforced and pending;
// each case below breaks it in one way and names the check that must say so. A check loosened, skipped or deleted
// turns a case red, so a lesson can't be made to pass by changing the checks.
//   docker run --rm -v "$PWD":/w -w /w node:24-alpine node tools/lessons/test/regress.mjs
// A correction from the owner that a machine can decide becomes a check (pending) and a case here, and the case
// stays for good: that is how a past mistake stays caught. Exits 1 when a case is not caught.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CHECK = path.join(path.dirname(new URL(import.meta.url).pathname), 'check.mjs');
const ID = 'demo-e-1';

function base() {
  const piece = (id, title, sentences, extra = {}) => ({ id, title, sentences, key: 0, ...extra });
  const pieces = [
    piece('p1', 'Ο κήπος μας', ['Το σχολείο μας έχει έναν μικρό κήπο πίσω από την αυλή.', 'Εκεί φυτεύουμε λαχανικά κάθε φθινόπωρο.'],
      { image: { file: 'images/kipos.jpg', caption: 'Ο κήπος' } }),
    piece('p2', 'Το χώμα θέλει φροντίδα', ['Πριν φυτέψουμε, σκαλίζουμε το χώμα με την τσάπα.', 'Μετά ρίχνουμε κομπόστ για να γίνει εύφορο.'],
      { glossary: [{ term: 'κομπόστ', meaning: 'λίπασμα από φλούδες και φύλλα' }, { term: 'εύφορο', meaning: 'χώμα που βγάζει πολλά φυτά' }] }),
    piece('p3', 'Οι σπόροι φυτρώνουν', ['Κάθε σπόρος μπαίνει σε μια μικρή λακκούβα.', 'Με νερό και ήλιο ο σπόρος βλασταίνει σε λίγες μέρες.'],
      { glossary: [{ term: 'βλασταίνει', meaning: 'βγάζει το πρώτο του φυλλαράκι' }] }),
    piece('p4', 'Ποιος ποτίζει', ['Κάθε τάξη ποτίζει τον κήπο μία μέρα την εβδομάδα.', 'Το καλοκαίρι τον φροντίζει ο επιστάτης του σχολείου.'],
      { glossary: [{ term: 'επιστάτης', meaning: 'αυτός που προσέχει το σχολείο' }] }),
    piece('p5', 'Η μέρα της συγκομιδής', ['Την άνοιξη μαζεύουμε τα λαχανικά όλοι μαζί.', 'Τα μισά τα τρώμε στο σχολείο και τα άλλα τα χαρίζουμε.']),
  ];
  const ask = (pieceId, question, extra = {}) => ({ do: 'ask', piece: pieceId, question, ...extra });
  const mc = (question, options, correctIndex, evidence) => ({ type: 'multiple-choice', question, options, correctIndex, evidence });
  const script = [
    { do: 'intro' },
    { do: 'choose', question: 'Πώς θες να το διαβάσεις;', options: [{ value: 'listen', label: 'Μου το διαβάζει η κουκουβάγια', icon: '🦉' }, { value: 'read', label: 'Το διαβάζω μόνο μου', icon: '👀' }] },
    { do: 'book', when: 'before' },
    { do: 'move', icon: '🤸', text: 'Πριν ξεκινήσεις: σήκω και κάνε δέκα αναπηδήσεις!', warmup: true, for: 'adhd' },
    { do: 'read', piece: 'p1' },
    ask('p1', { type: 'find-sentence', question: 'Ποια πρόταση λέει το πιο σημαντικό;', sentences: [0], main: true }),
    ask('p1', mc('Τι φυτεύουμε στον κήπο;', ['Λαχανικά', 'Δέντρα', 'Λουλούδια'], 0, [1]), { star: true }),
    { do: 'read', piece: 'p2' },
    ask('p2', { type: 'true-false', question: 'Ρίχνουμε κομπόστ πριν σκαλίσουμε.', correctValue: false, evidence: [0, 1] }, { think: 'adhd', star: true }),
    { do: 'move', icon: '🙆', text: 'Τέντωσε τα χέρια ψηλά και πάρε τρεις βαθιές ανάσες.', for: 'adhd' },
    { do: 'read', piece: 'p3' },
    ask('p3', { type: 'fill-blank', textWithGaps: 'Με νερό και {0} ο σπόρος βλασταίνει.', options: ['ήλιο', 'χιόνι'], correctAnswers: ['ήλιο'], evidence: [1] }, { star: true }),
    { do: 'read', piece: 'p4' },
    ask('p4', { type: 'sort', question: 'Ποιος φροντίζει τον κήπο και πότε;', bins: ['Τον χειμώνα', 'Το καλοκαίρι'],
      items: [{ text: 'Οι τάξεις', bin: 0 }, { text: 'Ο επιστάτης', bin: 1 }], evidence: [0, 1] }, { star: true }),
    { do: 'explain', piece: 'p4', prompt: 'Πες σε κάποιον με δικά σου λόγια: γιατί ρίχνουμε κομπόστ στο χώμα;', stems: ['Το κομπόστ κάνει το χώμα…'], star: true },
    { do: 'move', icon: '🚶', text: 'Κάνε πέντε βήματα επί τόπου, αργά αργά.', for: 'adhd' },
    { do: 'read', piece: 'p5' },
    ask('p5', { type: 'ordering', prompt: 'Βάλε τα στη σειρά.', items: [{ id: 'a', content: 'Φυτεύουμε' }, { id: 'b', content: 'Ποτίζουμε' }, { id: 'c', content: 'Μαζεύουμε' }], evidence: [0] }, { star: true }),
    { do: 'ask', review: true, question: { type: 'match-pairs', prompt: 'Ταίριαξε.', pairs: [{ left: 'Φθινόπωρο', right: 'φυτεύουμε' }, { left: 'Άνοιξη', right: 'μαζεύουμε' }, { left: 'Καλοκαίρι', right: 'ο επιστάτης' }] } },
    ask('p5', mc('Τι κάνουμε τα λαχανικά που δεν τρώμε;', ['Τα χαρίζουμε', 'Τα πουλάμε', 'Τα φυτεύουμε ξανά'], 0, [1]), { review: true, star: true }),
    { do: 'book', when: 'after' },
    { do: 'end' },
  ];
  const lesson = { format: 2, id: ID, grade: 5, subject: 'Δοκιμή', icon: '🌱', chapter: '1', title: 'Ο κήπος του σχολείου', source: 'Δικό μας κείμενο, για τους ελέγχους',
    pieces, script, talk: ['Τι θα φύτευες εσύ στον κήπο του σχολείου;'] };
  // What the source has besides the lesson (a case may also put an id, pages or audio here)
  const src = { book: { pdf: 'demo.pdf', from: 1, to: 1, firstPrinted: 1 }, pictures: { kipos: { page: 1, box: [0, 0, 10, 10] } } };
  return { lesson, src, pages: pieces.flatMap(p => p.sentences).join('\n') };
}

const step = (L, f) => L.script.find(f);
const q = (L, type) => step(L, s => s.question?.type === type).question;
const SPOT = { type: 'spot', question: 'Πάτα πάνω στον κήπο.', image: 'images/kipos.jpg', correct: 0, regions: [{ x: 0, y: 0, w: 40, h: 40 }, { x: 50, y: 50, w: 40, h: 40 }] };
// name of the mistake → [what breaks the good lesson, the start of the check that must not pass]
const CASES = [
  ['a ninth piece', ({ lesson: L }) => { for (let i = 6; i <= 9; i++) L.pieces.push({ ...L.pieces[4], id: `p${i}` }); }, '5-8 pieces'],
  ['a piece of one sentence', ({ lesson: L }) => { L.pieces[4].sentences.pop(); }, 'pieces of 2-4 sentences'],
  ['no way to choose', ({ lesson: L }) => { L.script.splice(1, 1); }, '[adhd] intro, choose, book'],
  ['no pages after', ({ lesson: L }) => { L.script.splice(-2, 1); }, '[plain] book (after)'],
  ['a piece nobody asks about', ({ lesson: L }) => { L.script = L.script.filter(s => !(s.do === 'ask' && s.piece === 'p3')); }, '[adhd] 1-3 questions after every piece'],
  ['no explain', ({ lesson: L }) => { L.script = L.script.filter(s => s.do !== 'explain'); }, '[plain] an explain'],
  ['one review question', ({ lesson: L }) => { L.script = L.script.filter(s => !(s.review && !s.star)); }, '[adhd] 2-4 review questions'],
  ['a piece without its star', ({ lesson: L }) => { delete step(L, s => s.piece === 'p3' && s.star).star; }, '[plain] a star on every piece'],
  ['no warm-up', ({ lesson: L }) => { L.script = L.script.filter(s => !s.warmup); }, '[adhd] a warm-up move'],
  ['one move only', ({ lesson: L }) => { L.script = L.script.filter(s => s.do !== 'move' || s.warmup); }, '[adhd] a move every 2-3 pieces'],
  ['no think-first', ({ lesson: L }) => { delete step(L, s => s.think).think; }, '[adhd] think-first'],
  ['a move on the plain path', ({ lesson: L }) => { delete step(L, s => s.do === 'move' && !s.warmup).for; }, '[plain] no movement breaks'],
  ['think-first on the plain path', ({ lesson: L }) => { step(L, s => s.think).think = true; }, '[plain] no think-first'],
  ['every question a multiple choice', ({ lesson: L }) => { for (const s of L.script) if (s.do === 'ask' && s.piece && !s.question.main) s.question = { ...q(L, 'multiple-choice') }; }, '[adhd] at least 5 kinds'],
  ['no «what matters most»', ({ lesson: L }) => { delete q(L, 'find-sentence').main; }, '[plain] a «what matters most» find'],
  ['two questions about numbers', ({ lesson: L }) => { q(L, 'multiple-choice').question = 'Πόσα είναι τα 3 λαχανικά;'; }, '[adhd] at most one question about a number'],
  // a LOOK: it never fails the build, and must still be said
  ['a sentence of ours among the book\'s', ({ lesson: L }) => { L.pieces[0].sentences[1] = 'Ο πίνακας δείχνει ότι οι ντομάτες ωριμάζουν πρώτες από όλα τα υπόλοιπα.'; L.pieces[0].image = { file: 'images/kipos.jpg' }; }, 'every sentence is the book'],
  ['no hard words', ({ lesson: L }) => { for (const p of L.pieces) delete p.glossary; }, 'hard words explained'],
  ['five hard words in a piece', ({ lesson: L }) => { L.pieces[1].glossary = ['Πριν', 'φυτέψουμε', 'σκαλίζουμε', 'χώμα', 'τσάπα'].map(term => ({ term, meaning: 'κάτι' })); }, 'at most 4 hard words a piece'],
  ['every other word glossed', ({ lesson: L }) => { for (const p of L.pieces) p.glossary = p.sentences[0].split(' ').slice(0, 4).map(term => ({ term, meaning: 'κάτι' })); }, 'about 3 hard words a piece'],
  // The owner, 2026-11: a caption made into a piece spoke of «την αριστερή φωτογραφία» with no photo beside it
  ['a sentence about a photo that isn\'t there', ({ lesson: L, T }) => { L.pieces[2].sentences[0] = T('Στην αριστερή φωτογραφία ο σπόρος μπαίνει σε μια λακκούβα.'); }, 'a sentence that points at a picture has the picture on its piece'],
  ['a sentence about a map that isn\'t there', ({ lesson: L, T }) => { L.pieces[2].sentences[0] = T('Στον χάρτη φαίνεται πού μπαίνει κάθε σπόρος.'); }, 'a sentence that points at a picture has the picture on its piece (Greek'],
  ['a long sentence with no «Πιο απλά»', ({ lesson: L, T }) => { L.pieces[4].sentences[0] = T('Την άνοιξη, όταν πια ο καιρός έχει ζεστάνει και οι μέρες έχουν μεγαλώσει αρκετά, μαζεύουμε με προσοχή όλα τα λαχανικά όλοι μαζί.'); }, 'every long sentence'],
  ['nothing to talk about', ({ lesson: L }) => { L.talk = []; }, 'the book\'s questions kept'],
  // The owner, 2026-11: the owl stumbles on brackets and abbreviations in what the agent wrote
  ['brackets in a question', ({ lesson: L }) => { q(L, 'multiple-choice').options[1] = 'Δέντρα (ψηλά)'; }, 'your own text is written as it is said (no brackets'],
  ['an abbreviation in a meaning', ({ lesson: L }) => { L.pieces[1].glossary[0].meaning = 'λίπασμα, π.χ. από φλούδες'; }, 'your own text is written as it is said (Greek'],
  ['pages written by hand', ({ src }) => { src.pages = []; }, 'the source has no pages and no audio'],
  ['an id that is not the folder', ({ src }) => { src.id = 'Demo_E_1'; }, 'the id is the folder'],
  ['a piece with no key', ({ lesson: L }) => { delete L.pieces[2].key; }, 'every piece marks its key'],
  ['a title of seven words', ({ lesson: L }) => { L.pieces[2].title = 'Οι σπόροι που φυτρώνουν μέσα στο χώμα'; }, 'piece titles of 2-5 words'],
  ['a piece that ends on «:»', ({ lesson: L, T }) => { L.pieces[4].sentences[1] = T('Τα λαχανικά που μαζεύουμε είναι τα εξής:'); }, 'no piece ends on a sentence that announces'],
  ['a picture nothing shows', ({ src }) => { src.pictures.xoma = { page: 1, box: [0, 0, 5, 5] }; }, 'a picture or more from the book'],
  ['four options', ({ lesson: L }) => { q(L, 'multiple-choice').options.push('Τίποτα'); }, 'multiple choice has 3 options'],
  ['a word bank with no extra word', ({ lesson: L }) => { q(L, 'fill-blank').options.pop(); }, 'a fill-blank word bank'],
  ['an ordering of two', ({ lesson: L }) => { q(L, 'ordering').items.pop(); }, 'an ordering has 3-5 items'],
  ['five pairs', ({ lesson: L }) => { const p = q(L, 'match-pairs').pairs; p.push({ left: 'Χειμώνας', right: 'ξεκουράζεται' }, { left: 'Κάθε μέρα', right: 'ποτίζουμε' }); }, 'a match-pairs has 3-4 pairs'],
  ['regions that overlap', ({ lesson: L }) => { step(L, s => s.piece === 'p1' && s.star).question = { ...SPOT, regions: [SPOT.regions[0], { x: 30, y: 30, w: 40, h: 40 }] }; }, 'a spot\'s regions'],
  ['a question with no evidence', ({ lesson: L }) => { delete q(L, 'true-false').evidence; }, 'a question on a piece\'s text names its evidence'],
  ['a question on no piece', ({ lesson: L }) => { delete step(L, s => s.question?.type === 'true-false').piece; }, 'every question names its piece'],
  ['a picture question that doesn\'t say where to look', ({ lesson: L }) => { const s = step(L, s => s.piece === 'p1' && s.star); s.picture = 'images/kipos.jpg'; delete s.question.evidence; }, 'a question on a picture'],
  ['an explain with no star', ({ lesson: L }) => { delete step(L, s => s.do === 'explain').star; }, 'a star on every explain'],
  ['a question for the parent in the plural', ({ lesson: L }) => { L.talk = ['Τι θα φυτεύατε εσείς στον κήπο;']; }, 'the questions to talk about are in the singular'],
  // The research rejects every clock: time pressure costs an ADHD reader accuracy and calm
  ['a move against the clock', ({ lesson: L }) => { step(L, s => s.do === 'move' && !s.warmup).text = 'Τρέξε επί τόπου για ένα λεπτό, όσο πιο γρήγορα μπορείς!'; }, 'nothing said to her sets a clock'],
];

function run(mutate) {
  const made = base();
  // T: a sentence put in a piece that the "book" (pages-text) has too, so only the mistake under test shows
  const added = [];
  mutate?.({ ...made, T: s => { added.push(s); return s; } });
  const src = { ...made.lesson, ...made.src };
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-regress-')), ID);
  fs.mkdirSync(path.join(dir, 'package'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'pages-text'));
  fs.writeFileSync(path.join(dir, 'lesson.src.json'), JSON.stringify(src));
  fs.writeFileSync(path.join(dir, 'package', 'lesson.json'), JSON.stringify({ ...made.lesson, pages: [{ file: 'pages/page-1.jpg', page: '1' }] }));
  fs.writeFileSync(path.join(dir, 'pages-text', 'page-1.txt'), [made.pages, ...added].join('\n'));
  const out = spawnSync(process.execPath, [CHECK, dir], { encoding: 'utf8' });
  fs.rmSync(path.dirname(dir), { recursive: true });
  return (out.stdout + out.stderr).split('\n');
}

let red = 0;
const good = run().filter(l => /^(FAIL|LOOK|PEND)/.test(l) || !/^(PASS| {6}→|\d+\/\d+ pass|pending \(.*\d+\/\d+ pass|$)/.test(l));
if (good.length) { red++; console.log(`RED   the good lesson no longer passes:\n  ${good.join('\n  ')}`); }
else console.log('ok    the good lesson passes every check');
for (const [name, mutate, must] of CASES) {
  const lines = run(mutate);
  const caught = lines.some(l => /^(FAIL|LOOK|PEND)  /.test(l) && l.slice(6).startsWith(must));
  if (!caught) { red++; console.log(`RED   ${name}: «${must}…» did not catch it`); }
  else console.log(`ok    ${name}`);
}
console.log(red ? `${red} not caught: a check was loosened or lost (tools/lessons/test/check.mjs)` : `all ${CASES.length} mistakes caught`);
process.exit(red ? 1 : 0);
