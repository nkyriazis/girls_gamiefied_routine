// Issue #63, after the fix: a parent ends a kid's running routine from /parent («Τέλος» → «Σίγουρα;»).
// before.mjs's walk-through (kiosk 1280×800, Chromium), then what is new:
//   - the kids' screen while a parent ends her routine: her lane says «Ο γονιός έκλεισε τη ρουτίνα» for 3 s;
//   - a flow's routine: ending it moves the flow on (dev-only flow evidence-63-chain: her evening
//     routine, then Ιφιγένεια's morning one; her morning one was finished today, so a flow skips it, #58),
//     so the next routine starts at once;
//   - iPhone 13 (WebKit): its own running routine, so «Τέλος» and «Σίγουρα;» show on the phone.
// Scene: tools/evidence/dev.sh clear-runs && tools/evidence/dev.sh stars u1 100 u2 20
//        and the flow evidence-63-chain in backend/data.json (dev only, put back after)
// Play:  OUT=after tools/evidence/record.sh .evidence/63/after.mjs
import { start, API, APP, pause } from '../../tools/evidence/kit.mjs';
import fs from 'fs';

const tag = process.env.OUT ?? 'after';
const push = async id => {
  const res = await fetch(`${API}/api/hooks/push`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
  return `${res.status} ${await res.text()}`;
};
const logs = async (n = 8) => {
  const all = await (await fetch(`${API}/api/debug/logs`)).json();
  return (Array.isArray(all) ? all : all.logs ?? []).filter(l => /ROUTINE_CLOSED|TRIGGER|FLOW/.test(l.type)).slice(0, n)
    .map(l => `${l.timestamp} ${l.type} ${JSON.stringify(l.details)}`);
};
const record = { steps: [] };
// The caption at the bottom, so the parent page's toast (top) shows
const low = page => page.evaluate(() => { const c = document.getElementById('evidence-caption'); if (c) { c.style.top = 'auto'; c.style.bottom = '8px'; } });

// 1. The kiosk (1280×800): the same walk-through as before.mjs, now with «Τέλος» on her card
{
  const { page, caption, tap, open, shot, finish, log } = await start(`${tag}-kiosk`);
  record.steps.push({ push: await push('u1-assign-morning') });
  await open();
  await caption('Ηλέκτρα’s morning routine runs on the kids’ screen (started by mistake, or she left it)');
  await pause(2500);
  await shot(`${tag}-1-kiosk-running`);

  await page.goto(`${APP}/parent`);
  await pause(1500);
  await caption('The parent page, Σήμερα: her card shows the routine, 1/4, and «Τέλος» under it');
  await pause(2500);
  const card = page.locator('.p-kid').filter({ hasText: 'Ηλέκτρα' });
  await shot(`${tag}-2-parent-today`);
  record.steps.push({ card: await card.innerText(), buttonsInCard: await card.locator('button').count(), cardIsButton: await card.evaluate(el => el.tagName) });

  await caption('«Τέλος» asks once more: «Σίγουρα;» for 3 s');
  await tap(card.getByRole('button', { name: 'Τέλος' }), 1200);
  await shot(`${tag}-3-parent-confirm`);
  await caption('A second tap ends the routine: the toast says so, her card loses the line');
  await low(page);
  await tap(card.getByRole('button', { name: 'Σίγουρα;' }), 2000);
  await shot(`${tag}-4-parent-ended`);
  record.steps.push({ cardAfter: await card.innerText() });
  await open();
  await caption('The kids’ screen: the routine is gone, the clock is back');
  await pause(2500);
  await shot(`${tag}-5-kiosk-after`);
  log('steps', JSON.stringify(record.steps));
  await finish();
}

// 2. The kids' screen while a parent ends it (1280×800): the kiosk in the video, the parent page in a
//    second window of the same browser. Then a flow's routine: ending it moves the flow on.
{
  const { page, caption, open, shot, finish } = await start(`${tag}-kids`);
  const parent = await page.context().newPage();
  const end = async (name) => {
    await parent.goto(`${APP}/parent`);
    await pause(1500);
    const card = parent.locator('.p-kid').filter({ hasText: 'Ηλέκτρα' });
    await card.getByRole('button', { name: 'Τέλος' }).click();
    await pause(400);
    await card.getByRole('button', { name: 'Σίγουρα;' }).click();
    await pause(700);
    await parent.screenshot({ path: `${name}.png` });
  };

  record.steps.push({ push2: await push('u1-assign-morning') });
  await open();
  await caption('The kids’ screen: Ηλέκτρα’s routine runs; a parent ends it on another device');
  await pause(2500);
  await end(`${tag}-kids-1-parent-ends`);
  await caption('Her lane says a parent closed it, for 3 s, instead of just vanishing');
  await pause(300);
  await shot(`${tag}-kids-2-notice`);
  record.steps.push({ notice: await page.locator('.routine-ended').innerText().catch(() => null) });
  await pause(3500);
  await caption('Then the clock, as after her ✕');
  await pause(1500);
  await shot(`${tag}-kids-3-clock`);

  await caption('A flow: her evening routine, then Ιφιγένεια’s morning one (dev-only flow «evidence-63-chain»)');
  record.steps.push({ push3: await push('evidence-63-chain') });
  await pause(2500);
  await shot(`${tag}-kids-4-flow-running`);
  await end(`${tag}-kids-5-parent-ends-flow`);
  await caption('A parent ends hers: the flow moves on at once, Ιφιγένεια’s routine starts');
  await pause(500);
  await shot(`${tag}-kids-6-flow-moved-on`);
  record.steps.push({ lanes: await page.locator('.routine-slot').allInnerTexts() });
  await pause(3500);
  await shot(`${tag}-kids-7-flow-next`);
  // Leave nothing running: a parent ends Ιφιγένεια's too
  await caption('A parent ends Ιφιγένεια’s too: her lane says so, then the clock');
  await parent.goto(`${APP}/parent`);
  await pause(1500);
  const hers = parent.locator('.p-kid').filter({ hasText: 'Ιφιγένεια' });
  await hers.getByRole('button', { name: 'Τέλος' }).click();
  await pause(400);
  await hers.getByRole('button', { name: 'Σίγουρα;' }).click();
  await pause(4000);
  await finish();
}

// 3. The parents' page as on a phone (iPhone 13 in WebKit): its own running routine, «Τέλος», «Σίγουρα;»
{
  record.steps.push({ push4: await push('u1-assign-morning') });
  const { page, caption, shot, finish } = await start(`${tag}-phone`, { browser: 'webkit', device: 'iPhone 13', video: false });
  await page.goto(`${APP}/parent`);
  await pause(2500);
  await caption('On a phone: Σήμερα, her routine at 1/4, «Τέλος» under it');
  await low(page);
  await pause(500);
  await shot(`${tag}-6-phone-today`);
  const card = page.locator('.p-kid').filter({ hasText: 'Ηλέκτρα' });
  record.steps.push({ phoneButton: await card.getByRole('button', { name: 'Τέλος' }).boundingBox() });
  await card.getByRole('button', { name: 'Τέλος' }).tap();
  await caption('«Σίγουρα;» for 3 s');
  await low(page);
  await pause(500);
  await shot(`${tag}-7-phone-confirm`);
  await card.getByRole('button', { name: 'Σίγουρα;' }).tap();
  await caption('Ended: the toast says so, her card loses the line');
  await low(page);
  await pause(1500);
  await shot(`${tag}-8-phone-ended`);
  await finish();
}

record.log = await logs(14);
fs.writeFileSync(`${tag}.json`, JSON.stringify(record, null, 1));
