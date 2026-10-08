// Issue #129: on the small kiosk, are the match's «Έλεγχος Ζευγαριών» and «Δείξε μου» on screen and
// hittable with no scrolling? Scene first: .evidence/129/scene.sh. Play at each size:
//   OUT=before|after SIZE=800x480 tools/evidence/record.sh .evidence/129/fit.mjs   (APP picks the dev server)
import { start, API } from '../../tools/evidence/kit.mjs';
import fs from 'fs';
const ex = 'g3-math-tables-match-a-005';
const [w, h] = (process.env.SIZE ?? '800x480').split('x').map(Number);
const all = await (await fetch(`${API}/api/exercise-assignments`)).json();
const d = all.map(x => x.date).sort().pop();
const a = all.find(x => x.date === d && x.userId === 'u2' && x.exerciseId === ex && !x.extra);
if (!a || a.status !== 'pending' || a.attempts !== 1) throw new Error('run .evidence/129/scene.sh first');
const out = `${process.env.OUT ?? 'before'}-${w}x${h}`;
const { page, pause, open, shot, finish, log, caption } = await start(out, { size: { width: w, height: h } });
await open();
await page.locator('.dock-avatar').nth(1).click(); await pause(1800);
await page.locator(`[data-assignment="${a.id}"]`).first().click(); await pause(2000);
const fit = await page.evaluate(() => {
  const one = sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), height: Math.round(b.height),
      onScreen: b.top >= 0 && b.bottom <= innerHeight, hit: !!hit && (hit === e || e.contains(hit)) }; };
  const box = document.querySelector('.assignment-split');
  return { check: one('.match-check'), show: one('.exercise-show'), question: one('.assignment-question'),
    scrollable: box ? box.scrollHeight - box.clientHeight : null, innerHeight };
});
log(JSON.stringify(fit));
await caption(`${w}×${h}: «Έλεγχος» ${fit.check?.onScreen && fit.check?.hit ? 'on screen' : 'NOT on screen'}, «Δείξε μου» ${fit.show?.onScreen && fit.show?.hit ? 'on screen' : 'NOT on screen'}`);
await shot(out);
fs.writeFileSync(`${out}.json`, JSON.stringify(fit, null, 1));
await finish();
