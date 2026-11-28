// Checks a built lesson against what the skill asks of it (.claude/skills/lesson-package/SKILL.md), beyond what the
// Pi's own checks (pack) refuse: the shape of the script, the book's own words, help where the words are hard, a
// varied set of questions. With a case file, also what a person expected of that chapter before it was made.
//   node tools/lessons/test/check.mjs <work dir> [case.json]       (run by test.sh)
// The case file: { book: {from, to, firstPrinted}, hardWords: [...], minHardWords, types: [...] (question types that
// must appear), picturesFrom: [PDF pages a picture must come from] }. Prints one line per check; exits 1 on a FAIL.
import fs from 'node:fs';
import path from 'node:path';

const [dir, casePath] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(path.join(dir, 'lesson.src.json'), 'utf8'));
const lesson = JSON.parse(fs.readFileSync(path.join(dir, 'package', 'lesson.json'), 'utf8'));
const expect = casePath ? JSON.parse(fs.readFileSync(casePath, 'utf8')) : {};
const results = [];
// A LOOK is for a person to judge (it may be the PDF's layout, not the lesson); it doesn't fail the build
const check = (name, ok, detail = '', look = false) => results.push({ name, ok, detail, look });

// The book's text, the way the sentences may quote it: hyphenated line ends joined, bullets and spacing flattened
const norm = t => t.normalize('NFC').replace(/-\s*\n\s*/g, '').replace(/(\p{L})-\s+(\p{Ll})/gu, '$1$2').replace(/[•W]\s/g, ' ').replace(/[’'`]/g, '’')
  .replace(/[«»"“”]/g, '"').replace(/\s+/g, ' ').toLowerCase();
const pageText = fs.readdirSync(path.join(dir, 'pages-text')).map(f => fs.readFileSync(path.join(dir, 'pages-text', f), 'utf8')).join('\n');
const book = norm(pageText);
const words = t => norm(t).replace(/[.,;:!?·()"…—–]/g, ' ').split(' ').filter(Boolean);
const bookWords = words(pageText);
const grams = new Set(bookWords.slice(2).map((w, i) => `${bookWords[i]} ${bookWords[i + 1]} ${w}`));
function fromBook(sentence) {
  const w = words(sentence);
  if (w.length < 3) return w.every(x => book.includes(x)) ? 1 : 0;
  // A word counts as the book's when a run of three around it is in the pages; a clause cut out leaves both sides counted
  const covered = new Set();
  for (let i = 0; i + 2 < w.length; i++) if (grams.has(`${w[i]} ${w[i + 1]} ${w[i + 2]}`)) [i, i + 1, i + 2].forEach(k => covered.add(k));
  return covered.size / w.length;
}

const wc = p => p.sentences.join(' ').split(/\s+/).length;
check('5-8 pieces', lesson.pieces.length >= 5 && lesson.pieces.length <= 8, `${lesson.pieces.length}`);
const long = lesson.pieces.filter(p => wc(p) > 75 || p.sentences.length > 4 || p.sentences.length < 2);
check('pieces of 2-4 sentences, at most ~70 words', !long.length, long.map(p => `${p.id}: ${p.sentences.length} sentences, ${wc(p)} words`).join('; '));

// Each path is a lesson of its own (shared/lessons.ts LessonProfile): the steps without `for`, and those for it.
// What differs: the ADHD path moves and thinks first; the plain one has neither.
const plays = (s, profile) => !s.for || s.for === profile;
const thinks = (s, profile) => s.think === true || s.think === profile;
for (const profile of ['adhd', 'plain']) {
  const S = lesson.script.filter(s => plays(s, profile));
  const on = `[${profile}] `;
  const at = kind => S.map((s, i) => s.do === kind ? i : -1).filter(i => i >= 0);
  const reads = at('read');
  const asks = at('ask');

  // Shape
  check(on + 'intro, choose, book (before) open the lesson', S[0]?.do === 'intro' && S[1]?.do === 'choose' && S.slice(2, 4).some(s => s.do === 'book' && s.when === 'before'));
  check(on + 'book (after) right before end', S.at(-1)?.do === 'end' && S.at(-2)?.do === 'book' && S.at(-2)?.when === 'after');
  const between = reads.map((r, k) => S.slice(r + 1, reads[k + 1] ?? S.length).filter(s => s.do === 'ask' && !s.review).length);
  check(on + '1-3 questions after every piece', between.every(n => n >= 1 && n <= 3), between.join(' '));
  check(on + 'an explain', at('explain').length >= 1 && at('explain').length <= 2, `${at('explain').length}`);
  const review = asks.filter(i => S[i].review);
  check(on + '2-4 review questions, the last starred', review.length >= 2 && review.length <= 4 && S[review.at(-1)]?.star, `${review.length}`);
  const unstarred = reads.filter((r, k) => !S.slice(r + 1, reads[k + 1] ?? review[0] ?? S.length).some(s => s.star));
  check(on + 'a star on every piece', !unstarred.length, unstarred.map(i => S[i].piece).join(' '));
  const think = asks.filter(i => thinks(S[i], profile)).length;
  if (profile === 'adhd') {
    check(on + 'a warm-up move before the first piece', S.slice(0, reads[0]).some(s => s.do === 'move' && s.warmup));
    const gaps = [];
    let since = 0;
    for (const s of S) { if (s.do === 'read') since++; if (s.do === 'move') { if (since) gaps.push(since); since = 0; } }
    check(on + 'a move every 2-3 pieces', at('move').length >= 2 && gaps.slice(1).every(n => n <= 3) && since <= 3, `moves after ${gaps.join(',')} pieces, ${since} at the end`);
    check(on + 'think-first on about one question in three', think >= Math.floor(asks.length / 5) && think <= Math.ceil(asks.length / 2), `${think} of ${asks.length}`);
  } else {
    check(on + 'no movement breaks', !at('move').length, `${at('move').length}`);
    check(on + 'no think-first', !think, `${think}`);
  }

  // Questions
  const types = new Set(asks.map(i => S[i].question.type));
  check(on + 'at least 5 kinds of question', types.size >= 5, [...types].join(', '));
  const firstMain = asks.findIndex(i => S[i].question.type === 'find-sentence' && S[i].question.main);
  check(on + 'a «what matters most» find in the first two pieces', firstMain >= 0 && asks[firstMain] < (reads[2] ?? Infinity));
  for (const t of expect.types ?? []) check(on + `a ${t} question`, types.has(t));
  const texts = v => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(texts) : v && typeof v === 'object' ? Object.values(v).flatMap(texts) : [];
  const numbers = asks.filter(i => texts(S[i].question).some(t => /\d/.test(t))).length;
  check(on + 'at most one question about a number', numbers <= 1, `${numbers}`);
}

// The book's words
const loose = [];
for (const p of lesson.pieces) p.sentences.forEach((s, k) => { const f = fromBook(s); if (f < 0.85) loose.push(`${p.id}[${k}] ${Math.round(f * 100)}%: ${s.slice(0, 60)}`); });
check('every sentence is the book\'s own (≥85% of its words in runs of the pages; a caption, table or source made into a sentence is not)', !loose.length, loose.join(' | '), true);
const glossed = lesson.pieces.flatMap(p => (p.glossary ?? []).map(g => g.term.toLowerCase()));
check('hard words explained (at least one piece in two has some)', lesson.pieces.filter(p => p.glossary?.length).length * 2 >= lesson.pieces.length, `${glossed.length} terms`);
// Only the words she would stop at: a piece that needs more than 4 is too hard for her (cut it or leave it out), and
// glossing words she knows buries the ones she doesn't
const heavy = lesson.pieces.filter(p => (p.glossary?.length ?? 0) > 4);
check('at most 4 hard words a piece', !heavy.length, heavy.map(p => `${p.id}: ${p.glossary.length}`).join(', '));
check('about 3 hard words a piece or fewer, over the lesson', glossed.length <= 3 * lesson.pieces.length, `${glossed.length} for ${lesson.pieces.length} pieces`);
if (expect.hardWords) {
  const hit = expect.hardWords.filter(h => glossed.some(g => g.startsWith(h.toLowerCase().slice(0, Math.max(4, h.length - 3)))));
  check(`the expected hard words explained (${expect.minHardWords} of ${expect.hardWords.length})`, hit.length >= expect.minHardWords,
    `got ${hit.join(', ')}; missing ${expect.hardWords.filter(h => !hit.includes(h)).join(', ')}`);
}
// A sentence that points at a picture («στην αριστερή φωτογραφία», «εικόνα 13.2», «ο χάρτης») reads wrong with
// no picture beside it: a caption made into a piece, or a picture left behind
const POINTS = /φωτογραφί|εικόν(α|ες|ας)\b|χάρτ(η|ης|ες)\b|πίνακ(α|ας|ες)\b|σκίτσ/i;
const pointing = lesson.pieces.flatMap(p => p.image ? [] : p.sentences.map((s, k) => ({ p, k, s })).filter(x => POINTS.test(x.s)));
check('a sentence that points at a picture has the picture on its piece', !pointing.length, pointing.map(x => `${x.p.id}[${x.k}]: ${x.s.slice(0, 60)}`).join(' | '));
const easy = lesson.pieces.reduce((n, p) => n + Object.keys(p.easy ?? {}).length, 0);
const longSentences = lesson.pieces.flatMap(p => p.sentences.map((s, k) => ({ p, k, n: s.split(/\s+/).length }))).filter(x => x.n >= 20);
const unhelped = longSentences.filter(x => !x.p.easy?.[x.k]);
check('every long sentence (20+ words) has «Πιο απλά»', !unhelped.length, `${easy} given; missing: ${unhelped.map(x => `${x.p.id}[${x.k}]`).join(' ')}`);
check('the book\'s questions kept for the parent (talk)', (lesson.talk ?? []).length >= 1, `${(lesson.talk ?? []).length}`);

// Where it comes from
if (expect.book) for (const k of ['from', 'to', 'firstPrinted']) check(`book.${k} = ${expect.book[k]}`, src.book?.[k] === expect.book[k], `${src.book?.[k]}`);
if (expect.picturesFrom) {
  const pages = Object.values(src.pictures ?? {}).map(p => p.page);
  for (const pg of expect.picturesFrom) check(`a picture from PDF page ${pg}`, pages.includes(pg), pages.join(','));
}

for (const r of results) console.log(`${r.ok ? 'PASS' : r.look ? 'LOOK' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
const failed = results.filter(r => !r.ok && !r.look).length;
console.log(`${results.length - failed}/${results.length} pass`);
process.exit(failed ? 1 : 0);
