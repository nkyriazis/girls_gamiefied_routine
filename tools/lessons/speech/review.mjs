// What waits for the owner's ear, from every lesson listened to (work/<id>/speech.json), as one page to sign off
// on a phone (tools/lessons/speech/README.md): each speech rule a lesson uses and that isn't signed off for this
// voice, with a few of its uses; each word heard otherwise that no signed-off case covers, with where it comes.
// Short snippets and the sentence go in the page as data, so it needs nothing beside it.
//   node tools/lessons/speech/review.mjs <out.html> <items.json> [work dir…]   (default: every lesson in work/)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [out, itemsOut, ...given] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const work = path.join(here, '..', 'work');
const dirs = given.length ? given : fs.readdirSync(work).map(d => path.join(work, d))
  .filter(d => !path.basename(d).startsWith('run') && fs.existsSync(path.join(d, 'speech.json')) && fs.existsSync(path.join(d, 'package', 'lesson.json')));
const registry = JSON.parse(fs.readFileSync(path.join(here, 'rules.json'), 'utf8'));
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const uri = f => `data:audio/mpeg;base64,${fs.readFileSync(f).toString('base64')}`;
// The few words around the spot, the spot marked: [before, the words, after], cut at word edges
function around(text, at) {
  if (!at) return ['', text, ''];
  const [a, b] = at, W = 32;
  const pre = a > W ? '…' + text.slice(a - W).slice(0, W).replace(/^\S*\s/, '') : text.slice(0, a);
  const post = text.length - b > W ? text.slice(b, b + W).replace(/\s\S*$/, '') + '…' : text.slice(b);
  return [pre, text.slice(a, b), post];
}

const rules = Object.fromEntries(registry.rules.map(r => [r.id, { ...r, examples: [] }]));
const cases = {};
const voices = new Set();
for (const dir of dirs) {
  const id = path.basename(dir);
  const speech = JSON.parse(fs.readFileSync(path.join(dir, 'speech.json'), 'utf8'));
  const lesson = JSON.parse(fs.readFileSync(path.join(dir, 'package', 'lesson.json'), 'utf8'));
  const live = new Set(Object.values(lesson.audio ?? {}));
  voices.add(speech.voice);
  const ok = new Set(registry.cases.filter(c => c.voice === speech.voice).map(c => c.key));
  for (const [clip, c] of Object.entries(speech.clips)) {
    if (!live.has(clip)) continue;
    const full = path.join(dir, 'package', clip);
    const ex = (snip, o) => ({ lesson: id, ...o, context: around(c.spoken, o.at), snip: path.join(dir, 'speech', snip), size: fs.statSync(full).size });
    for (const u of c.uses) {
      const r = rules[u.rule];
      if (r && !(r.status === 'approved' && r.voice === speech.voice)) r.examples.push(ex(u.snip, { shown: u.shown, said: u.said, heard: u.heard }));
    }
    for (const o of c.odd) if (!ok.has(o.key)) (cases[o.key] ??= []).push(ex(o.snip, { said: o.said, heard: o.heard }));
  }
}
if (voices.size > 1) { console.error(`lessons recorded in ${voices.size} voices: record them again first`); process.exit(1); }
const voice = [...voices][0];

// A few examples each, from as many lessons as there are, shortest sentences first
function pick(list, n) {
  const sorted = [...list].sort((a, b) => a.size - b.size);
  const chosen = [], lessons = new Set();
  for (const e of sorted) if (chosen.length < n && !lessons.has(e.lesson)) { chosen.push(e); lessons.add(e.lesson); }
  for (const e of sorted) if (chosen.length < n && !chosen.includes(e)) chosen.push(e);
  return chosen.map(e => ({ lesson: e.lesson, context: e.context, shown: e.shown, said: e.said, heard: e.heard, snip: uri(e.snip) }));
}
const items = [
  ...Object.values(rules).filter(r => r.examples.length).map(r => ({
    id: 'r' + hash(`${r.id}|${r.match}|${r.say}|${voice}`), kind: 'rule', rule: r.id, match: r.match, say: r.say, why: r.why,
    count: r.examples.length, examples: pick(r.examples, 2) })),
  ...Object.entries(cases).sort((a, b) => b[1].length - a[1].length).map(([key, list]) => ({
    id: 'c' + hash(`${key}|${voice}`), kind: 'case', key, count: list.length, examples: pick(list, 1) })),
];
const page = fs.readFileSync(path.join(here, 'review.template.html'), 'utf8')
  .replace('/*ITEMS*/[]', JSON.stringify({ voice, items }).replace(/</g, '\\u003c'));
fs.writeFileSync(out, page);
fs.writeFileSync(itemsOut, JSON.stringify({ voice, items: items.map(({ examples, ...i }) => i) }, null, 1));
const log = path.join(work, 'rounds.jsonl');
const n = { rules: items.filter(i => i.kind === 'rule').length, words: items.filter(i => i.kind === 'case').length, lessons: dirs.length };
fs.appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), step: 'review', lesson: '-', secs: Math.round(process.uptime()), n }) + '\n');
console.log(`${items.filter(i => i.kind === 'rule').length} rules and ${items.filter(i => i.kind === 'case').length} words to hear, ` +
  `from ${dirs.length} lessons; page ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
