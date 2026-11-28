// Checks a built lesson against every rule a machine can decide (the rules a person or an agent must judge are the
// briefs in .claude/skills/lesson-package/briefs/; which rule lives where: its MAP.md), beyond what the Pi's own
// checks (pack) refuse: the shape of the script, the book's own words, help where the words are hard, a varied set
// of questions. With a case file, also what a person expected of that chapter before it was made.
//   node tools/lessons/test/check.mjs <work dir> [case.json]       (run by test.sh)
// The case file: { book: {from, to, firstPrinted}, hardWords: [...], minHardWords, types: [...] (question types that
// must appear), picturesFrom: [PDF pages a picture must come from] }. Prints one line per check; exits 1 on a FAIL.
//
// Three kinds of check. `check`: a FAIL stops the build. `check(…, true)`: a LOOK, for a person to judge. `pending`:
// a new check that fails nothing yet (PEND); the owner promotes it to `check` in a PR, once its findings are real.
// Each check has its why in the comment above it, and `how(…)` after it: what to do, printed under a line that
// doesn't pass, so whoever fixes the lesson needs nothing else.
// Guardrails (the skill, «Guardrails»): never loosen, skip or delete a check to make a lesson pass; fix the lesson
// or tell the owner. A check that changes keeps its cases in regress.mjs passing, and a new one adds its own there.
import fs from 'node:fs';
import path from 'node:path';

const [dir, casePath] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(path.join(dir, 'lesson.src.json'), 'utf8'));
const lesson = JSON.parse(fs.readFileSync(path.join(dir, 'package', 'lesson.json'), 'utf8'));
const expect = casePath ? JSON.parse(fs.readFileSync(casePath, 'utf8')) : {};
const results = [];
// A LOOK is for a person to judge (it may be the PDF's layout, not the lesson); it doesn't fail the build
const check = (name, ok, detail = '', look = false) => results.push({ name, ok, detail, look });
// Not enforced until the owner promotes it
const pending = (name, ok, detail = '') => results.push({ name, ok, detail, pending: true });
// What to do about the check just made, when it doesn't pass
const how = text => { results.at(-1).how = text; };

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
how('Attention fades on long text: one idea a piece. Too few: split a piece that holds two ideas. Too many: leave out the passage that matters least (never merge into a long piece).');
const long = lesson.pieces.filter(p => wc(p) > 75 || p.sentences.length > 4 || p.sentences.length < 2);
check('pieces of 2-4 sentences, at most ~70 words', !long.length, long.map(p => `${p.id}: ${p.sentences.length} sentences, ${wc(p)} words`).join('; '));
how("Split the piece at a change of idea, or cut a clause that only lists names nobody is asked about. Never rewrite the book's sentence to shorten it.");

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
  how('The script opens intro → choose → book (when: before): choosing lowers refusal, the pages tie the lesson to her book.');
  check(on + 'book (after) right before end', S.at(-1)?.do === 'end' && S.at(-2)?.do === 'book' && S.at(-2)?.when === 'after');
  how('The script closes book (when: after) → end.');
  const between = reads.map((r, k) => S.slice(r + 1, reads[k + 1] ?? S.length).filter(s => s.do === 'ask' && !s.review).length);
  check(on + '1-3 questions after every piece', between.every(n => n >= 1 && n <= 3), between.join(' '));
  how('Each read is followed by 1-3 ask steps on that piece (not review) before the next read, on this path: the answer comes at once, while the piece is fresh.');
  check(on + 'an explain', at('explain').length >= 1 && at('explain').length <= 2, `${at('explain').length}`);
  how('One or two explain steps a lesson, after a piece with a cause or a why (saying it to someone is what makes it stay).');
  const review = asks.filter(i => S[i].review);
  check(on + '2-4 review questions, the last starred', review.length >= 2 && review.length <= 4 && S[review.at(-1)]?.star, `${review.length}`);
  how('End with 2-4 ask steps with review: true (across the chapter: she forgets fast), star: true on the last.');
  const unstarred = reads.filter((r, k) => !S.slice(r + 1, reads[k + 1] ?? review[0] ?? S.length).some(s => s.star));
  check(on + 'a star on every piece', !unstarred.length, unstarred.map(i => S[i].piece).join(' '));
  how('star: true on the last step of each piece (its last ask, or its explain) on this path: effort is rewarded often, not only at the end.');
  const think = asks.filter(i => thinks(S[i], profile)).length;
  if (profile === 'adhd') {
    check(on + 'a warm-up move before the first piece', S.slice(0, reads[0]).some(s => s.do === 'move' && s.warmup));
    how('A move with warmup: true and for: "adhd" before the first read (exercise first helps self-control).');
    const gaps = [];
    let since = 0;
    for (const s of S) { if (s.do === 'read') since++; if (s.do === 'move') { if (since) gaps.push(since); since = 0; } }
    check(on + 'a move every 2-3 pieces', at('move').length >= 2 && gaps.slice(1).every(n => n <= 3) && since <= 3, `moves after ${gaps.join(',')} pieces, ${since} at the end`);
    how('A move (for: "adhd") after every 2-3 pieces: restlessness.');
    check(on + 'think-first on about one question in three', think >= Math.floor(asks.length / 5) && think <= Math.ceil(asks.length / 2), `${think} of ${asks.length}`);
    how('think: "adhd" on about one question in three, the easy ones (recall before recognition, against answering on impulse).');
  } else {
    check(on + 'no movement breaks', !at('move').length, `${at('move').length}`);
    how('Every move is for: "adhd": a plain reader takes it as an interruption.');
    check(on + 'no think-first', !think, `${think}`);
    how('think is "adhd", never true or "plain".');
  }

  // Questions
  const types = new Set(asks.map(i => S[i].question.type));
  check(on + 'at least 5 kinds of question', types.size >= 5, [...types].join(', '));
  how('Vary the question types across the lesson; sort where the chapter compares, spot where it shows.');
  const firstMain = asks.findIndex(i => S[i].question.type === 'find-sentence' && S[i].question.main);
  check(on + 'a «what matters most» find in the first two pieces', firstMain >= 0 && asks[firstMain] < (reads[2] ?? Infinity));
  how('A find-sentence with main: true after the first or second piece: the main idea is what an ADHD reader misses.');
  for (const t of expect.types ?? []) check(on + `a ${t} question`, types.has(t));
  const texts = v => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(texts) : v && typeof v === 'object' ? Object.values(v).flatMap(texts) : [];
  const numbers = asks.filter(i => texts(S[i].question).some(t => /\d/.test(t))).length;
  check(on + 'at most one question about a number', numbers <= 1, `${numbers}`);
  how('Ask about what the text says, causes, order, people and places; at most one question with a number in it.');
}

// The book's words
const loose = [];
for (const p of lesson.pieces) p.sentences.forEach((s, k) => { const f = fromBook(s); if (f < 0.85) loose.push(`${p.id}[${k}] ${Math.round(f * 100)}%: ${s.slice(0, 60)}`); });
check('every sentence is the book\'s own (≥85% of its words in runs of the pages; a caption, table or source made into a sentence is not)', !loose.length, loose.join(' | '), true);
how("Look at the page (page-N.png). If the sentence is yours (a caption, a table or a source turned into a sentence, a rewording), put the book's own sentence back or drop it. If it is the PDF's layout (a caption printed inside the sentence), leave it and say so to the owner.");
const glossed = lesson.pieces.flatMap(p => (p.glossary ?? []).map(g => g.term.toLowerCase()));
check('hard words explained (at least one piece in two has some)', lesson.pieces.filter(p => p.glossary?.length).length * 2 >= lesson.pieces.length, `${glossed.length} terms`);
how("Gloss the words she would stop at (the book's footnotes first, then learned, old or technical words), each as it is written in the sentence.");
// Only the words she would stop at: a piece that needs more than 4 is too hard for her (cut it or leave it out), and
// glossing words she knows buries the ones she doesn't
const heavy = lesson.pieces.filter(p => (p.glossary?.length ?? 0) > 4);
check('at most 4 hard words a piece', !heavy.length, heavy.map(p => `${p.id}: ${p.glossary.length}`).join(', '));
how('Keep only the words she would stop at. A piece that truly needs more than 4 is too hard: cut its hardest clause, or leave the passage out.');
check('about 3 hard words a piece or fewer, over the lesson', glossed.length <= 3 * lesson.pieces.length, `${glossed.length} for ${lesson.pieces.length} pieces`);
how('Drop the glosses of everyday words, of names the text explains and of words whose meaning the sentence gives: they bury the words that matter.');
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
how('Cut that picture into "pictures" and put it on the piece (image), or leave the sentence out: without it she reads about something she can\'t see.');
const easy = lesson.pieces.reduce((n, p) => n + Object.keys(p.easy ?? {}).length, 0);
const longSentences = lesson.pieces.flatMap(p => p.sentences.map((s, k) => ({ p, k, n: s.split(/\s+/).length }))).filter(x => x.n >= 20);
const unhelped = longSentences.filter(x => !x.p.easy?.[x.k]);
check('every long sentence (20+ words) has «Πιο απλά»', !unhelped.length, `${easy} given; missing: ${unhelped.map(x => `${x.p.id}[${x.k}]`).join(' ')}`);
how("Add the sentence to the piece's easy, by its index: the same facts in plain everyday Greek, a whole sentence or two, nothing added and nothing left out that a question asks about.");
check('the book\'s questions kept for the parent (talk)', (lesson.talk ?? []).length >= 1, `${(lesson.talk ?? []).length}`);
how("Put the book's open questions («Πώς εξηγείτε…») in talk, in the singular («Πώς εξηγείς…»).");

// What the agent writes is written the way the owl says it (the skill's «Words»): no brackets, abbreviations or unit
// symbols in it; the book's own sentences keep theirs (the speech rules say them)
const bookSentences = new Set(lesson.pieces.flatMap(p => p.sentences));
const strings = v => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];
const own = [
  ...lesson.pieces.flatMap(p => [...Object.values(p.easy ?? {}), ...(p.glossary ?? []).map(g => g.meaning)]),
  ...lesson.script.flatMap(s => strings({ ...s, piece: undefined, picture: undefined, do: undefined, for: undefined, when: undefined })),
].filter(t => !bookSentences.has(t) && !/^images\//.test(t));
const UNSAID = /[()/]|\b\p{L}{1,3}\.\p{L}{1,2}\.|\d\s*(?:μ\.|χλμ|οC|°)/u;
const unsaid = own.filter(t => UNSAID.test(t));
check('your own text is written as it is said (no brackets, abbreviations or unit symbols)', !unsaid.length, unsaid.map(t => t.slice(0, 50)).join(' | '));
how("The owl says all of it aloud. Write it as it is said: «μέτρα», «μετά Χριστόν»; a thing in brackets becomes its own short sentence, or goes. (The book's own sentences keep theirs: the speech rules say them.)");

// --- Pending: rules of the skill a machine can decide, written down 2026-11 when the skill became briefs + checks.
// They fail nothing until the owner promotes them (pending → check).

// The build writes these two; an `audio` left in the source would carry clips that are not this lesson's
pending('the source has no pages and no audio (the build writes them)', !('pages' in src) && !('audio' in src));
how('Delete "pages" and "audio" from lesson.src.json.');
pending('the id is the folder\'s name: <subject>-<grade letter>-<chapter>, lowercase ascii', src.id === path.basename(path.resolve(dir)) && /^[a-z]+(-[a-z0-9]+)+$/.test(src.id ?? ''), `${src.id}`);
how('e.g. istoria-e-14, geografia-e-26, kpa-e-a4; the folder under work/ has the same name.');
// The ⭐ sentence is how she finds the main idea, which is what an ADHD reader misses
const keyless = lesson.pieces.filter(p => p.key === undefined);
pending('every piece marks its key sentence', !keyless.length, keyless.map(p => p.id).join(' '));
how('key: the index of the sentence that says what matters most in the piece.');
const titled = lesson.pieces.filter(p => { const n = p.title.trim().split(/\s+/).length; return n < 2 || n > 5; });
pending('piece titles of 2-5 words', !titled.length, titled.map(p => `${p.id}: ${p.title}`).join(' | '));
how('A title says what the piece is about in 2-5 words.');
// A piece ends on a whole thought: a sentence that announces what the book says next leaves her hanging
const hanging = lesson.pieces.filter(p => /[:;,]\s*$/.test(p.sentences.at(-1)));
pending('no piece ends on a sentence that announces what comes next', !hanging.length, hanging.map(p => p.id).join(' '));
how('Take the next sentence too, or neither.');
pending('a picture or more from the book, and none cut that nothing shows', (() => {
  const used = new Set([...lesson.pieces.map(p => p.image?.file), ...lesson.script.flatMap(s => [s.picture, s.question?.image])].filter(Boolean));
  const cut = Object.keys(src.pictures ?? {}).map(n => `images/${n}.jpg`);
  return cut.length >= 1 && cut.every(f => used.has(f));
})(), Object.keys(src.pictures ?? {}).join(', '));
how('Pick the 1-3 pictures that carry meaning (a map, a diagram, a photo the text talks about) and name each on a piece (image) or a question (picture, or a spot\'s image). Drop one nothing uses.');

const asksAll = lesson.script.map((s, i) => ({ s, i, q: s.question })).filter(x => x.s.do === 'ask');
const where = x => `script[${x.i}]`;
const bad = (name, list, fix) => { pending(name, !list.length, list.map(where).join(' ')); how(fix); };
bad('multiple choice has 3 options', asksAll.filter(x => x.q.type === 'multiple-choice' && x.q.options.length !== 3),
  'Three options, one right; the wrong ones from the same text: each a thing the chapter says or a near miss of the answer, never one nobody would pick.');
bad('a fill-blank word bank has 1-2 extra words', asksAll.filter(x => x.q.type === 'fill-blank' && ![1, 2].includes(x.q.options.length - x.q.correctAnswers.length)),
  'The bank holds the answers and 1-2 words more.');
bad('an ordering has 3-5 items', asksAll.filter(x => x.q.type === 'ordering' && (x.q.items.length < 3 || x.q.items.length > 5)), '3-5 events.');
bad('a match-pairs has 3-4 pairs', asksAll.filter(x => x.q.type === 'match-pairs' && (x.q.pairs.length < 3 || x.q.pairs.length > 4)), '3-4 pairs, short right sides.');
// Each region covers its place and none overlap, or a tap counts for the wrong place
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
bad('a spot\'s regions are inside the picture and don\'t overlap', asksAll.filter(x => x.q.type === 'spot' && (
  x.q.regions.some(r => r.x < 0 || r.y < 0 || r.w <= 0 || r.h <= 0 || r.x + r.w > 100 || r.y + r.h > 100)
  || x.q.regions.some((a, i) => x.q.regions.some((b, j) => i < j && overlap(a, b))))),
  'Regions are in % of the picture. Draw them (tools/lessons/regions.sh <id>), look, and move the boxes.');
// Working memory: a wrong try lights the sentences that hold the answer, so a question on a piece's text names them.
// None where no sentence holds it: a find-sentence, a spot, a question on a picture, a review across pieces.
bad('a question on a piece\'s text names its evidence', asksAll.filter(x => x.s.piece && !x.s.picture && !['find-sentence', 'spot'].includes(x.q.type) && !x.q.evidence?.length),
  'evidence: the indexes of the piece\'s sentence(s) that hold the answer.');
bad('every question names its piece (a review across pieces may not)', asksAll.filter(x => !x.s.piece && !x.s.review), 'piece: the id of the piece it asks about.');
// What the book shows besides its text is learning too, but she must see it while answering and know where to look
const SHOWS = /φωτογραφί|εικόν|χάρτ|πίνακ|σκίτσ|ψηφιδωτ|διάγραμμ|σχεδιάγραμμ|γραμμή του χρόνου|χρονογραμμ|κοίτα|δες /i;
bad('a question on a picture has no evidence and says what to look at', asksAll.filter(x => x.s.picture && (x.q.evidence?.length || !SHOWS.test(x.q.question ?? x.q.prompt ?? ''))),
  'Start it with what to look at («Κοίτα τον χάρτη…», «Στη φωτογραφία…»); no evidence (no sentence holds the answer).');
bad('a star on every explain', lesson.script.map((s, i) => ({ s, i })).filter(x => x.s.do === 'explain' && !x.s.star), 'star: true on each explain.');
// The questions for the parent are asked of one child
const plural = (lesson.talk ?? []).filter(t => /(?<![\p{L}])\p{L}+(?:είτε|άτε|ήσετε|ήσατε|ούσατε|είστε|έστε)(?![\p{L}])|(?<![\p{L}])(?:εσείς|σας)(?![\p{L}])/iu.test(t.replace(/(?<![\p{L}])είτε(?![\p{L}])/giu, '')));
pending('the questions to talk about are in the singular', !plural.length, plural.map(t => t.slice(0, 40)).join(' | '));
how('«Πώς εξηγείς…», «Τι θα έκανες…», not «εξηγείτε», «κάνατε».');
// No clock, no race: time pressure costs an ADHD reader accuracy and calm (docs/research/adhd-long-text-study.md)
const toHer = lesson.script.flatMap(s => s.do === 'move' ? [s.text] : s.do === 'explain' ? [s.prompt, ...(s.stems ?? [])] : s.do === 'choose' ? [s.question, ...s.options.map(o => o.label)] : []);
const clocked = toHer.filter(t => /χρονόμετρ|δευτερόλεπτ|(?<![\p{L}])λεπτ(?:ό|ά)(?![\p{L}])|γρήγορα|προλάβ|πρόλαβ|πριν τελειώσει/iu.test(t));
pending('nothing said to her sets a clock or a race', !clocked.length, clocked.map(t => t.slice(0, 40)).join(' | '));
how('Count things, not time: «κάνε 10 αναπηδήσεις», «μέτρα ως το 10». Never a timer, a countdown or «όσο πιο γρήγορα».');
// The two checks above read word edges with \b, which JavaScript knows only for latin letters: «στον χάρτη» and
// «π.χ.» pass them. The same checks with Greek word edges, pending so the owner sees what they find first.
const EDGE = '(?![\\p{L}])';
const POINTS2 = new RegExp(`φωτογραφί|εικόν(?:α|ες|ας)${EDGE}|χάρτ(?:η|ης|ες)${EDGE}|πίνακ(?:α|ας|ες)${EDGE}|σκίτσ`, 'iu');
const pointing2 = lesson.pieces.flatMap(p => p.image ? [] : p.sentences.map((s, k) => ({ p, k, s })).filter(x => POINTS2.test(x.s)));
pending('a sentence that points at a picture has the picture on its piece (Greek word edges)', !pointing2.length, pointing2.map(x => `${x.p.id}[${x.k}]: ${x.s.slice(0, 60)}`).join(' | '));
how('As the check of the same name. If the sentence only names a map or a table in passing, say so to the owner.');
const UNSAID2 = /[()/]|(?<![\p{L}])\p{L}{1,3}\.\p{L}{1,2}\.|\d\s*(?:μ\.|χλμ|οC|°)/u;
const unsaid2 = own.filter(t => UNSAID2.test(t));
pending('your own text is written as it is said (Greek word edges: «π.χ.», «κ.ά.»)', !unsaid2.length, unsaid2.map(t => t.slice(0, 50)).join(' | '));
how('As the check of the same name.');

// Where it comes from
if (expect.book) for (const k of ['from', 'to', 'firstPrinted']) check(`book.${k} = ${expect.book[k]}`, src.book?.[k] === expect.book[k], `${src.book?.[k]}`);
if (expect.picturesFrom) {
  const pages = Object.values(src.pictures ?? {}).map(p => p.page);
  for (const pg of expect.picturesFrom) check(`a picture from PDF page ${pg}`, pages.includes(pg), pages.join(','));
}

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : r.pending ? 'PEND' : r.look ? 'LOOK' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
  if (!r.ok && r.how) console.log(`      → ${r.how}`);
}
const enforced = results.filter(r => !r.pending), waiting = results.filter(r => r.pending);
const failed = enforced.filter(r => !r.ok && !r.look).length;
console.log(`${enforced.length - failed}/${enforced.length} pass`);
console.log(`pending (not enforced until the owner promotes them): ${waiting.filter(r => r.ok).length}/${waiting.length} pass`);
process.exit(failed ? 1 : 0);
