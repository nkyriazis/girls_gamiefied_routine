// Probe: does a STATE that changes nothing about the alarm restart its sound?
import { start, API } from '../../tools/evidence/kit.mjs';
import fs from 'fs';
const { page, pause, open, finish, log } = await start('probe-restart', { video: false });
await page.route('**/uploads/*.mp3', r => r.fulfill({ path: 'pub/uploads/1764012149103-rooster-crow-1-281011.mp3', contentType: 'audio/mpeg' }));
const push = async id => log('push', id, (await fetch(`${API}/api/hooks/push`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })).status);
await open();
await push('u2-morning-flow');
await pause(3000);
log('--- now an unrelated STATE: u1 evening routine starts');
await push('u1-assign-evening');
await pause(3000);
log('--- now a STATE that changes no layout: u1 completes a task');
await page.locator('.routine-slot .btn-done').first().click();
await pause(3000);
await finish();
const d = JSON.parse(fs.readFileSync('probe-restart.sound.json'));
for (const e of d.said) console.log(e.at, e.ev, e.src);
