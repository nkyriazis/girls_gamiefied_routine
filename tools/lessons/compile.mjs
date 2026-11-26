// The lesson's source (work/<id>/lesson.src.json) to the package's lesson.json, and the list of what to cut from the
// book for it. The source is lesson.json as the Pi reads it (shared/lessons.ts), plus where its pictures come from:
//   "book":     { "pdf": "<file under materials/pdf>", "from": <first PDF page>, "to": <last>, "firstPrinted": <number printed on the first> }
//   "pictures": { "<name>": { "page": <PDF page>, "box": [x, y, w, h] } }   (pixels of page-N.png, 150 dpi)
// A piece or a `spot` question names a picture as images/<name>.jpg. `pages` (the book steps) is written from `book`.
// Run by build.sh:  node tools/lessons/compile.mjs <work dir>   writes <work dir>/package/lesson.json and prints the jobs.
import fs from 'node:fs';
import path from 'node:path';
import { spokenLines } from '../../shared/lessons.ts';

const dir = process.argv[2];
const src = JSON.parse(fs.readFileSync(path.join(dir, 'lesson.src.json'), 'utf8'));
const { book, pictures = {}, ...lesson } = src;
const fail = msg => { console.error(`lesson.src.json: ${msg}`); process.exit(1); };

if (!book?.pdf || !Number.isInteger(book.from) || !Number.isInteger(book.to) || book.to < book.from || !Number.isInteger(book.firstPrinted))
  fail('"book" needs pdf, from, to (PDF pages) and firstPrinted (the number printed on the first)');
if (!fs.existsSync(path.join('materials/pdf', book.pdf))) fail(`no materials/pdf/${book.pdf}`);

const jobs = [];
const pages = [];
for (let p = book.from; p <= book.to; p++) {
  pages.push({ file: `pages/page-${p}.jpg`, page: String(book.firstPrinted + p - book.from) });
  jobs.push(`page ${p} pages/page-${p}.jpg`);
}
for (const [name, pic] of Object.entries(pictures)) {
  if (!/^[a-z0-9-]+$/.test(name)) fail(`picture name «${name}»: lowercase latin, digits and -`);
  const [x, y, w, h] = pic.box ?? [];
  if (!Number.isInteger(pic.page) || ![x, y, w, h].every(n => Number.isInteger(n) && n >= 0) || !w || !h)
    fail(`picture «${name}» needs page and box [x, y, w, h] in pixels of page-N.png`);
  jobs.push(`crop ${pic.page} ${x} ${y} ${w} ${h} images/${name}.jpg`);
}
// Every picture the lesson names is one this file cuts
const named = [...lesson.pieces.map(p => p.image?.file), ...lesson.script.flatMap(s => [s.question?.image, s.picture])].filter(Boolean);
for (const f of named) if (!Object.keys(pictures).some(n => f === `images/${n}.jpg`)) fail(`${f} is not in "pictures"`);

// Clips already recorded stay until voice.sh writes the list again (it keeps a line whose clip exists)
const out = path.join(dir, 'package', 'lesson.json');
const before = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
const compiled = { ...lesson, pages };
if (before.audio) {
  const said = new Set(spokenLines(compiled));
  compiled.audio = Object.fromEntries(Object.entries(before.audio).filter(([text]) => said.has(text)));
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(compiled, null, 2) + '\n');
console.log(`pdf materials/pdf/${book.pdf}`);
for (const j of jobs) console.log(j);
