// Issue #24, after the fix: the same scene as before.mjs, the balance stays at or above zero. The kiosk and a parent's phone side by side (two videos):
// Ηλέκτρα (u1) gives all her 100 ⭐ to Ιφιγένεια (pending), the parent takes 50 away (the sheet allows
// it: it looks at the total, not at the stars locked in the gift), then approves the gift: −50.
// Scene: tools/evidence/dev.sh clear-runs; tools/evidence/dev.sh stars u1 100 u2 20
// Play:  tools/evidence/record.sh .evidence/24/after.mjs   (before.mjs with the after captions; record.sh passes no OUT)
import { start, APP } from '../../tools/evidence/kit.mjs';

const tag = process.env.OUT ?? 'after';
const kiosk = await start(`${tag}-kiosk`);
const phone = await start(`${tag}-parent`, { size: { width: 390, height: 844 } });
const k = kiosk.page, p = phone.page;

await kiosk.open();
await phone.page.goto(APP + '/parent');
await phone.pause(1500);
await kiosk.caption('Ηλέκτρα has ⭐ 100');
await kiosk.shot(`${tag}-1-kiosk-start`);
await phone.caption('The parent’s phone: Σήμερα');
await phone.shot(`${tag}-1-parent-start`);

// The kid gives all her stars to her sister: they are locked until a parent decides
await kiosk.tap(k.locator('.dock-avatar').nth(0), 2500);
await kiosk.caption('She gives all 100 ⭐ to Ιφιγένεια');
await kiosk.tap(k.locator('.transfer-btn'), 1500);
await k.locator('.transfer-form select').selectOption('u2');
await k.locator('.amount-input input').fill('100');
await kiosk.pause(800);
await kiosk.tap(k.locator('.send-transfer-btn'), 3500);
await kiosk.caption('Gift pending: ⭐ 100, available ⭐ 0 («θα δεσμευτούν»)');
await kiosk.shot(`${tag}-2-kiosk-gift-pending`);

// The parent takes 50 away: the sheet checks the total (100), not what is free (0)
await phone.caption('The parent takes 50 ⭐ away from Ηλέκτρα');
await phone.tap(p.locator('.p-kid').nth(0), 1200);
await phone.tap(p.locator('.p-chips button', { hasText: /^50$/ }), 600);
await phone.shot(`${tag}-3-parent-take-50`);
const take = p.locator('.p-actions .p-btn.ghost');
console.log('take-away button enabled:', await take.isEnabled());
if (await take.isEnabled()) await phone.tap(take, 2000);
else { await phone.caption('«− Αφαίρεση 50» is off: the 100 are promised in the gift'); await phone.pause(3000); await p.keyboard.press('Escape'); await phone.pause(800); }
await phone.shot(`${tag}-4-parent-after-take`);
await kiosk.caption('On the kiosk: still ⭐ 100, available ⭐ 0');
await kiosk.shot(`${tag}-4-kiosk-after-take`);

// Then approves the gift
await phone.caption('Then approves the gift (Έγκριση): the toast confirms');
await phone.tap(p.locator('.p-inbox .p-btn.primary', { hasText: 'Έγκριση' }).first(), 1200);
await phone.shot(`${tag}-5-parent-after-approve`);
await kiosk.caption(tag === 'before' ? 'Ηλέκτρα ends below zero' : 'Ηλέκτρα’s balance after the parent decided');
await kiosk.pause(1500);
await kiosk.shot(`${tag}-5-kiosk-after-approve`);
console.log('users', JSON.stringify((await (await fetch('http://localhost:3000/api/users')).json()).map(u => [u.id, u.stars])));

await Promise.all([kiosk.finish(), phone.finish()]);
