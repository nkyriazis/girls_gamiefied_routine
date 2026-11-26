// Check a prepared lesson folder (lesson.json + images/) and zip it into a package for the parents' page
// («Μαθήματα» → «Εισαγωγή»). The checks are the Pi's own: backend/lesson.schema.json and lessonProblems
// (shared/lessons.ts), so a package that packs imports. Run through pack.sh (Node 24, in Docker).
//   node pack.mjs <folder> <out.zip>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { lessonProblems, lessonStars } from '../../shared/lessons.ts';
import { genderedWords } from '../../frontend/scripts/gendered.mjs';

const require = createRequire(path.resolve('backend/package.json'));
const Ajv = require('ajv');
const { zipSync } = require('fflate');

const [dir, out] = process.argv.slice(2);
if (!dir || !out) { console.error('usage: pack.mjs <folder> <out.zip>'); process.exit(2); }

const lesson = JSON.parse(fs.readFileSync(path.join(dir, 'lesson.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, discriminator: true });
const validate = ajv.compile(JSON.parse(fs.readFileSync('backend/lesson.schema.json', 'utf8')));
if (!validate(lesson)) {
  console.error('lesson.json does not fit backend/lesson.schema.json:');
  for (const e of validate.errors) console.error(`  ${e.instancePath || '/'} ${e.message}`);
  process.exit(1);
}
const list = sub => fs.existsSync(path.join(dir, sub)) ? fs.readdirSync(path.join(dir, sub)).map(f => `${sub}/${f}`) : [];
const images = [...list('images'), ...list('pages')];
const audio = Object.values(lesson.audio ?? {});
const problems = lessonProblems(lesson, new Set([...images, ...list('audio')]));
// What the lesson says to her (not the book's sentences, nor questions about the people in it) says the same to every child
for (const st of lesson.script) {
  const toHer = st.do === 'choose' ? [st.question, ...st.options.map(o => o.label)] : st.do === 'move' ? [st.text]
    : st.do === 'explain' ? [st.prompt, ...(st.stems ?? [])] : [];
  for (const t of toHer) for (const w of genderedWords(t)) problems.push(`«${t}» says «${w}» to her: say it the same way to every child`);
}
if (problems.length) {
  console.error('The lesson would not play:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
const used = new Set([...lesson.pieces.map(p => p.image?.file), ...lesson.script.flatMap(st => [st.question?.image, st.picture]), ...(lesson.pages ?? []).map(p => p.file)].filter(Boolean));
const unused = images.filter(f => !used.has(f));
if (unused.length) console.warn(`not used by any piece (left out): ${unused.join(', ')}`);

const files = { 'lesson.json': fs.readFileSync(path.join(dir, 'lesson.json')) };
for (const f of [...images.filter(f => !unused.includes(f)), ...new Set(audio)]) files[f] = fs.readFileSync(path.join(dir, f));
const zip = zipSync(files, { level: 6 });
fs.writeFileSync(out, zip);

const count = kind => lesson.script.filter(st => st.do === kind).length;
const words = lesson.pieces.reduce((n, p) => n + p.sentences.join(' ').split(/\s+/).length, 0);
const missing = lesson.audio ? '' : ' (no voice yet: tools/lessons/voice.sh)';
console.log(`${out}: «${lesson.title}», ${lesson.pieces.length} pieces (${words} words), ${count('ask')} questions, ${count('move')} moves, ` +
  `${count('explain')} explain, ${lessonStars(lesson)} stars, ${images.length - unused.length} images, ${new Set(audio).size} clips${missing}, ${(zip.length / 1024).toFixed(0)} KB`);
