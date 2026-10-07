// Issue #63: a parent can't end a kid's running routine from /parent. Ηλέκτρα's (u1) morning
// routine runs on the kiosk; the parent page's Σήμερα shows it on her card (task 1/4) with nothing
// to end it: tapping the card opens only the stars sheet, and Ρυθμίσεις → Ρουτίνες refuses changes
// to its tasks while it runs. The only way out is the ✕ on the kids' screen.
// Scene: tools/evidence/dev.sh clear-runs && tools/evidence/dev.sh stars u1 100 u2 20
// Play:  tools/evidence/record.sh .evidence/63/before.mjs   (same scenario after the fix: OUT=after)
import { start, API, APP, pause } from '../../tools/evidence/kit.mjs';
import fs from 'fs';

const tag = process.env.OUT ?? 'before';
const push = async id => {
  const res = await fetch(`${API}/api/hooks/push`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
  return `${res.status} ${await res.text()}`;
};
const runs = async () => {
  const logs = await (await fetch(`${API}/api/debug/logs`)).json();
  return (Array.isArray(logs) ? logs : logs.logs ?? []).filter(l => /ROUTINE_CLOSED|TRIGGER/.test(l.type)).slice(0, 6)
    .map(l => `${l.timestamp} ${l.type} ${JSON.stringify(l.details)}`);
};
const record = { steps: [] };

// 1. The kiosk (1280×800): the routine runs on the kids' screen, then the parent page at the same size
{
  const { page, caption, tap, open, shot, finish, log } = await start(`${tag}-kiosk`);
  record.steps.push({ push: await push('u1-assign-morning') });
  await open();
  await caption('Ηλέκτρα’s morning routine runs on the kids’ screen (started by mistake, or she left it)');
  await pause(2500);
  await shot(`${tag}-1-kiosk-running`);

  await page.goto(`${APP}/parent`);
  await pause(1500);
  await caption('The parent page, Σήμερα: her card shows the routine and its task, 1/4');
  await pause(2500);
  const card = page.locator('.p-kid').filter({ hasText: 'Ηλέκτρα' });
  await shot(`${tag}-2-parent-today`);
  record.steps.push({ card: await card.innerText(), buttonsInCard: await card.locator('button').count(), cardIsButton: await card.evaluate(el => el.tagName) });

  if (await page.getByRole('button', { name: /Τέλος/ }).count()) {
    await caption('«Τέλος» on her card asks once more, then ends the routine');
    await tap(page.getByRole('button', { name: /Τέλος/ }), 1200);
    await shot(`${tag}-3-parent-confirm`);
    await tap(page.getByRole('button', { name: /Σίγουρα|Τέλος/ }), 2000);
    await shot(`${tag}-4-parent-ended`);
    await open();
    await caption('The kids’ screen: the routine is gone');
    await pause(2500);
    await shot(`${tag}-5-kiosk-after`);
  } else {
    await caption('Tapping the card opens only the stars: nothing ends the routine');
    await tap(card, 1800);
    await shot(`${tag}-3-parent-card-tapped`);
    await page.keyboard.press('Escape');
    await pause(800);
    await caption('Ρυθμίσεις → Ρουτίνες: its tasks can’t change while it runs, and nothing here ends it either');
    await page.goto(`${APP}/parent?view=settings`);
    await pause(1500);
    const item = page.locator('.p-section').filter({ has: page.getByRole('heading', { name: 'Ρουτίνες', exact: true }) }).locator('.p-row').filter({ hasText: 'Πρωινή Ρουτίνα' });
    await item.scrollIntoViewIfNeeded();
    await tap(item, 1500);
    const hint = page.getByText(/Τρέχει τώρα για/);
    if (await hint.count()) await hint.scrollIntoViewIfNeeded();
    await pause(1500);
    await shot(`${tag}-4-parent-routine-locked`);
    await page.keyboard.press('Escape');
    await open();
    await caption('Back on the kiosk: still running. Only her ✕ there ends it');
    await pause(2500);
    await shot(`${tag}-5-kiosk-still-running`);
  }
  log('steps', JSON.stringify(record.steps));
  await finish();
}

// 2. The parents' page as on a phone (iPhone 13 in WebKit): Σήμερα with the routine running
{
  const { page, caption, shot, finish } = await start(`${tag}-phone`, { browser: 'webkit', device: 'iPhone 13', video: false });
  await page.goto(`${APP}/parent`);
  await pause(2500);
  await caption('On a phone: Σήμερα, her routine at 1/4, no way to end it');
  await pause(500);
  await shot(`${tag}-6-phone-today`);
  if (await page.getByRole('button', { name: /Τέλος/ }).count()) {
    await page.getByRole('button', { name: /Τέλος/ }).click();
    await pause(800);
    await shot(`${tag}-7-phone-confirm`);
  }
  await finish();
}

record.log = await runs();
fs.writeFileSync(`${tag}.json`, JSON.stringify(record, null, 1));
