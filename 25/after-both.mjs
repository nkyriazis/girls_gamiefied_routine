// Issue #25, after: an alarm for both kids is one card naming both, in the slot of the kid in a
// routine. Dev has no such flow: the scene adds `issue25-together` to the dev data.json for the run
// (an alarm, then both kids' morning routines) and puts the file back after.
// Scene: tools/evidence/dev.sh clear-runs. Size: SIZE=390x844 for the phone, else the kiosk.
import { start, API } from '../../tools/evidence/kit.mjs';
const [width, height] = (process.env.SIZE ?? '1280x800').split('x').map(Number);
const tag = width < 800 ? 'after-phone' : 'after-both';
const { page, pause, open, shot, finish, log, tap } = await start(tag, { size: { width, height }, video: false });
await page.route('**/uploads/*.mp3', r => r.fulfill({ path: 'pub/uploads/1764012149103-rooster-crow-1-281011.mp3', contentType: 'audio/mpeg' }));
const push = async id => log('push', id, (await fetch(`${API}/api/hooks/push`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })).status);
const alarms = page.locator('.routine-slot .btn-dismiss-global');

await open();
await push('u1-assign-morning');
if (tag === 'after-phone') {
  // The kiosk scene's 07:00 moment, at phone width
  await push('morning-flow');
  await pause(3000);
  await shot(`${tag}-2-flow-started`);
  while (await alarms.count()) await tap(alarms.first(), 1500);
}
await push('issue25-together');
await pause(3000);
await shot(`${tag}-together`);
await tap(alarms.first(), 2000);
await shot(`${tag}-together-dismissed`);
await finish();
