// The owl's lines: every step of every tour (src/help/allTours.ts), as the owl says it.
//   node scripts/help-lines.mjs            prints them as JSON, for tools/help-voice
//   node scripts/help-lines.mjs --check    fails if a line can't be read aloud or has no clip
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT = path.resolve(import.meta.dirname, '..');
const vite = await createServer({ root: ROOT, logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
let lines;
try {
  const { allTours } = await vite.ssrLoadModule('/src/help/allTours.ts');
  const { spoken, unreadable } = await vite.ssrLoadModule('/src/help/speech.ts');
  const { stepKey } = await vite.ssrLoadModule('/src/help/tour.ts');
  const byText = new Map();
  for (const tour of allTours()) {
    for (const step of [...(tour.intro?.steps ?? []), ...tour.steps, ...(tour.intro?.after ?? [])]) {
      const say = spoken(step);
      const line = byText.get(say) ?? { say, id: crypto.createHash('sha1').update(say).digest('hex').slice(0, 12), where: [], unreadable: unreadable(say) };
      line.where.push(`${tour.id}/${stepKey(step)}`);
      byText.set(say, line);
    }
  }
  lines = [...byText.values()];
} finally {
  await vite.close();
}

if (!process.argv.includes('--check')) {
  process.stdout.write(JSON.stringify(lines, null, 1) + '\n');
  process.exit(0);
}
const clipsFile = path.join(ROOT, 'src/help/voice/clips.json');
const clips = fs.existsSync(clipsFile) ? JSON.parse(fs.readFileSync(clipsFile, 'utf8')) : {};
const problems = [];
for (const l of lines) {
  if (l.unreadable.length) problems.push(`${l.where[0]}: the voice can't read "${l.unreadable.join('')}" (give the step a say)`);
  const clip = clips[l.say];
  if (!clip) problems.push(`${l.where[0]}: no recording of «${l.say}» (run tools/help-voice)`);
  else if (!fs.existsSync(path.join(ROOT, 'public', clip))) problems.push(`${l.where[0]}: ${clip} is missing`);
}
if (problems.length) {
  console.error(`check-voice: ${problems.length} problem(s)\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`check-voice: ${lines.length} lines, all recorded`);
