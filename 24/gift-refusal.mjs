// Issue #24, review: the kids' gift form when the server refuses a gift the screen thought she could afford.
// Staged like after-refusal.mjs: the kiosk's WebSocket holds back STATE messages, a gift of all her 100 ⭐
// is made "on another screen" (a request), so the form still offers 100; she sends 100 more.
// A native alert() never shows in a screenshot, so the scenario logs it and captions it on the video.
// Scene: tools/evidence/dev.sh clear-runs; tools/evidence/dev.sh stars u1 100 u2 20
// Play:  tools/evidence/record.sh .evidence/24/gift-refusal.mjs (records "after"; with the file
//        gift-refusal.tag-before next to it, "before": record.sh passes no env)
import { start, API } from '../../tools/evidence/kit.mjs';
import { existsSync } from 'node:fs';

const tag = existsSync('gift-refusal.tag-before') ? 'before' : 'after';
const kiosk = await start(`${tag}-gift-refusal`);
const k = kiosk.page;

const alerts = [];
k.on('dialog', async d => { alerts.push(d.message()); console.log('alert()', JSON.stringify(d.message())); await d.dismiss(); });

let hold = false, held = null, toPage = null;
await k.routeWebSocket(url => new URL(url).pathname === '/ws', ws => {
  const server = ws.connectToServer();
  ws.onMessage(m => server.send(m));
  toPage = ws;
  server.onMessage(m => {
    if (hold && typeof m === 'string' && m.includes('"type":"STATE"')) { held = m; return; }
    ws.send(m);
  });
});

await kiosk.open();
await kiosk.tap(k.locator('.dock-avatar').nth(0), 2500);
await kiosk.caption('Ηλέκτρα’s store: ⭐ 100, all of it free. She opens «Δώσε Αστέρια»');
await kiosk.tap(k.locator('.transfer-btn'), 1200);
await k.locator('.transfer-form select').selectOption('u2');
await k.locator('.transfer-form input[type=number]').fill('100');
await kiosk.pause(1200);

hold = true;
const gift = await (await fetch(`${API}/api/transfers`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fromUserId: 'u1', toUserId: 'u2', amount: 100 })
})).json();
console.log('gift', gift.status, gift.amount);
await kiosk.caption('Meanwhile, on another screen, she gives all 100 ⭐ (this screen hasn’t heard yet)');
await kiosk.pause(2500);

await kiosk.caption('She taps «Στείλε ⭐ 100»: the server refuses');
await kiosk.tap(k.locator('.send-transfer-btn'), 900);
if (alerts.length) await kiosk.caption(`A browser alert() popped up (dismissed): «${alerts.at(-1)}»`);
await kiosk.shot(`${tag}-gift-refusal`);
await kiosk.pause(2000);

hold = false;
if (held) toPage.send(held);
await kiosk.caption('The screen catches up: available ⭐ 0');
await kiosk.pause(2500);
await kiosk.shot(`${tag}-gift-refusal-caught-up`);
console.log('alerts', JSON.stringify(alerts));
console.log('users', JSON.stringify((await (await fetch(`${API}/api/users`)).json()).map(u => [u.id, u.stars, u.available])));
console.log('transfers', JSON.stringify((await (await fetch(`${API}/api/transfers`)).json()).filter(t => t.status === 'pending').map(t => [t.fromUserId, t.toUserId, t.amount])));
await kiosk.finish();
