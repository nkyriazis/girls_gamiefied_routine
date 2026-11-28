// The owl says nothing a person hasn't heard: every clip of a lesson was listened to word by word, every speech
// rule it uses is signed off for this voice, and every word Whisper heard otherwise is a signed-off case
// (tools/lessons/speech/README.md). Exits 1 with what still waits for the owner.
//   node tools/lessons/speech/gate.mjs tools/lessons/work/<id>
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const registry = JSON.parse(fs.readFileSync(new URL('./rules.json', import.meta.url), 'utf8'));
const lesson = JSON.parse(fs.readFileSync(path.join(dir, 'package', 'lesson.json'), 'utf8'));
const speechFile = path.join(dir, 'speech.json');
const speech = fs.existsSync(speechFile) ? JSON.parse(fs.readFileSync(speechFile, 'utf8')) : { clips: {} };
const rule = Object.fromEntries(registry.rules.map(r => [r.id, r]));
const ok = new Set(registry.cases.filter(c => c.voice === speech.voice).map(c => c.key));

const waits = [];
for (const [text, clip] of Object.entries(lesson.audio ?? {})) {
  const c = speech.clips[clip];
  if (!c) { waits.push(`not listened to: «${text.slice(0, 60)}» (tools/lessons/voice.sh)`); continue; }
  for (const id of c.rules) {
    const r = rule[id];
    if (!r || r.status !== 'approved' || r.voice !== speech.voice) waits.push(`rule ${id} (${r?.status ?? 'gone'}) in «${text.slice(0, 50)}»`);
  }
  for (const o of c.odd) if (!ok.has(o.key)) waits.push(`«${o.said}» heard «${o.heard}» in «${text.slice(0, 50)}»`);
}
if (waits.length) {
  console.error(`The owl's words wait for the owner (${waits.length}): tools/lessons/signoff.sh page, then apply`);
  for (const w of [...new Set(waits)].slice(0, 15)) console.error(`  ${w}`);
  if (waits.length > 15) console.error(`  … and ${waits.length - 15} more`);
  process.exit(1);
}
console.log(`the owl's words: all ${Object.keys(lesson.audio ?? {}).length} clips signed off`);
