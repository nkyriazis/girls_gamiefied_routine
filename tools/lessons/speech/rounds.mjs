// The rounds log (tools/lessons/work/rounds.jsonl) by round: a round ends when the owner's answers are applied.
// Each round's machine time (voice, review), the cards the owner got, and the owner's own time, so the next round
// can be compared with this one.   node tools/lessons/speech/rounds.mjs
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'work', 'rounds.jsonl');
const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const rounds = [[]];
for (const l of lines) { rounds.at(-1).push(l); if (l.step === 'apply') rounds.push([]); }
const min = s => `${(s / 60).toFixed(1)} min`;
rounds.filter(r => r.length).forEach((r, k) => {
  const voice = r.filter(l => l.step === 'voice'), review = r.findLast(l => l.step === 'review'), apply = r.find(l => l.step === 'apply');
  const span = voice.length ? (Date.parse(voice.at(-1).at) - Math.min(...voice.map(l => Date.parse(l.at) - l.secs * 1000))) / 1000 : 0;
  console.log(`round ${k + 1}  ${r[0].at.slice(0, 16)}`);
  console.log(`  voice: ${voice.length} lessons, ${min(span)} wall, ${voice.reduce((n, l) => n + (l.n.recorded ?? 0), 0)} recorded`);
  for (const st of r.filter(l => l.step.startsWith('stage:'))) console.log(`  ${st.step.slice(6)}${st.lesson !== '-' ? ' ' + st.lesson : ''}: ${min(st.secs)}`);
  if (review) console.log(`  cards: ${review.n.rules} rules, ${review.n.words} words`);
  console.log(apply ? `  owner: ${apply.n.answered}/${apply.n.cards} answered (${apply.n.ok} ✓) in ${min(apply.secs)}` : '  owner: waiting');
});
