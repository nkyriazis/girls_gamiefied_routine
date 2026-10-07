// Issue #63, blast radius: a kiosk that hasn't reloaded since the deploy (it still runs master's bundle)
// when a parent, on the new parent page, ends a kid's routine. The new backend sends
// ROUTINE_ENDED_BY_PARENT; master's Dashboard takes every event for a chore toast.
// Scene: master's frontend on :5174 (a second vite on master's src and shared, same dev backend),
//        tools/evidence/dev.sh clear-runs
// Play:  tools/evidence/record.sh .evidence/63/old-kiosk.mjs
process.env.APP = 'http://localhost:5174';            // the old kiosk (master's bundle)
const NEW = 'http://localhost:5173';                  // the new parent page (this branch)
const { start, API, pause } = await import('../../tools/evidence/kit.mjs');
import fs from 'fs';

const push = async id => {
  const res = await fetch(`${API}/api/hooks/push`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
  return `${res.status} ${await res.text()}`;
};
const low = page => page.evaluate(() => { const c = document.getElementById('evidence-caption'); if (c) { c.style.top = 'auto'; c.style.bottom = '8px'; } });
const record = { steps: [] };

const { page, caption, tap, open, shot, finish } = await start('old-kiosk');
const parent = await page.context().newPage();
record.steps.push({ push: await push('u1-assign-morning') });
await open();
await caption('A kiosk still on the old bundle (not reloaded since the deploy): Ηλέκτρα’s routine runs');
await low(page);
await pause(2500);
await shot('old-kiosk-1-running');
record.steps.push({ oldBundle: await page.evaluate(async () => !(await (await fetch('/src/components/Dashboard.tsx')).text()).includes('ROUTINE_ENDED_BY_PARENT')) });

await parent.goto(`${NEW}/parent`);
await pause(1500);
const card = parent.locator('.p-kid').filter({ hasText: 'Ηλέκτρα' });
await card.getByRole('button', { name: 'Τέλος' }).click();
await pause(400);
await card.getByRole('button', { name: 'Σίγουρα;' }).click();
await pause(700);
await caption('A parent ends it on the new parent page: the old kiosk shows an empty toast (top right) for 5 s');
await low(page);
await shot('old-kiosk-2-empty-toast');
const toast = page.locator('.toast');
record.steps.push({ toasts: await toast.count(), toastClass: await toast.first().getAttribute('class').catch(() => null), toastText: await toast.first().innerText().catch(() => null), toastBox: await toast.first().boundingBox().catch(() => null) });
await page.locator('.toast').first().screenshot({ path: 'old-kiosk-3-toast-close.png' }).catch(() => {});
await caption('Tapping it plays the «close» sound and it goes');
await low(page);
await tap(toast.first(), 1500);
record.steps.push({ toastsAfterTap: await toast.count() });
await shot('old-kiosk-4-after');
await finish();
fs.writeFileSync('old-kiosk.json', JSON.stringify(record, null, 1));
