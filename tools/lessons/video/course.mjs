// A lesson played end to end on the kids' screen, paced for a parent watching, as a video: the package fresh in the
// library, the kid opens ✏️, finds it under 📖 Μαθήματα and plays it through (play.mjs). What she does on the way is
// worked out from the lesson itself (plan()), so any package plays with nobody choosing anything. Run by video.sh.
import fs from 'node:fs';
import { start, pause } from '../../evidence/kit.mjs';
import { lessonPlayer } from './play.mjs';

const GRADE = ['', 'Α΄', 'Β΄', 'Γ΄', 'Δ΄', 'Ε΄', 'ΣΤ΄'];
const WRONGABLE = ['multiple-choice', 'true-false', 'find-sentence', 'spot'];

// What the kid does, the same every time for the same lesson: a wrong try on every third question she can get wrong,
// both tries used up on one multiple choice in the middle (the answer shown), the first hard word in every other piece,
// «Πιο απλά» in the others, and in read mode 🔊 on a line of the 2nd and 5th piece.
export function plan(lesson, mode, profile) {
  const steps = lesson.script.map((s, i) => ({ s, i })).filter(({ s }) => !s.for || s.for === profile);
  const asks = steps.filter(({ s }) => s.do === 'ask' && WRONGABLE.includes(s.question.type)).map(({ i }) => i);
  const mistakes = {};
  asks.forEach((i, k) => { if (k % 3 === 1) mistakes[i] = 1; });
  const mcs = asks.filter(i => lesson.script[i].question.type === 'multiple-choice' && !mistakes[i]);
  if (mcs.length) mistakes[mcs[Math.floor(mcs.length / 2)]] = 2;
  const reads = steps.filter(({ s }) => s.do === 'read');
  const piece = s => lesson.pieces.find(p => p.id === s.piece);
  const words = reads.filter(({ s }, k) => k % 2 === 0 && piece(s).glossary?.length).map(({ i }) => i);
  const simpler = reads.filter(({ s }, k) => k % 2 === 1 && Object.keys(piece(s).easy ?? {}).length).map(({ i }) => i);
  const ear = mode === 'read' ? [reads[1], reads[4]].filter(Boolean).map(r => r.i) : [];
  return { mode, profile, mistakes, words, simpler, ear };
}

export async function course(id, mode) {
  const pkg = `/repo/tools/lessons/work/${id}/package`;
  const lesson = JSON.parse(fs.readFileSync(`${pkg}/lesson.json`, 'utf8'));
  const ctx = await start(id, { video: !process.env.DRY });
  const { page, caption, open } = ctx;
  const api = (method, path, data) => page.request.fetch(`http://localhost:5173/api${path}`, { method, data });
  await page.goto('http://localhost:5173/parent');
  await api('DELETE', `/admin/lessons/${id}`);
  const buffer = fs.readFileSync(`/repo/tools/lessons/work/${id}.zip`);
  const r = await page.request.post('http://localhost:5173/api/admin/lessons', { multipart: { file: { name: `${id}.zip`, mimeType: 'application/zip', buffer } } });
  if (!r.ok()) throw new Error(`import: ${await r.text()}`);
  const kid = (await (await api('GET', '/admin/data')).json()).users.find(u => u.grade === lesson.grade);
  if (!kid) throw new Error(`no kid of grade ${lesson.grade} in the dev data`);
  await api('POST', '/help/reset', { userId: kid.id });
  // Her path through the package, as her switch says (Παιδιά → Μαθήματα)
  const profile = kid.adhd ? 'adhd' : 'plain';
  const options = plan(lesson, mode, profile);
  console.log('plan', JSON.stringify(options));

  await open('/');
  const player = lessonPlayer(ctx, pkg, options);
  await caption(`${lesson.subject} ${GRADE[lesson.grade]}: «${lesson.title}». ${mode === 'read' ? 'Το παιδί διαβάζει μόνο του' : 'Η κουκουβάγια διαβάζει'}${profile === 'adhd' ? ', με βοήθεια για ΔΕΠΥ' : ''}. ✏️ → 📖 Μαθήματα`);
  await pause(3000);
  await player.touch(page.locator('.daily-exercises-fab'), { after: 1500 });
  const card = page.locator(`[data-lesson="${id}"]`).first();
  await card.scrollIntoViewIfNeeded();
  await pause(2000);
  await player.touch(card, { after: 1500 });
  await caption('');
  await page.evaluate(() => document.getElementById('evidence-caption')?.remove());
  await player.play();
  await ctx.shot(`${id}-end`);
  await ctx.finish();
}
