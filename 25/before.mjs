// Issue #25: the wake-up alarm for a kid already in a routine is hidden, rings when her routine
// closes, and dismissing it starts the same routine a second time. As on piserve: a parent starts
// Ηλέκτρα's (u1) morning routine by hand before 07:00, then the 07:00 schedule starts morning-flow
// (an alarm, then the morning routine, for each kid).
// Scene: tools/evidence/dev.sh clear-runs
// Play:  tools/evidence/record.sh .evidence/25/before.mjs   (same scenario after the fix: OUT=after)
// The rooster is an upload that only piserve has: the scenario serves a stand-in beep
// (pub/uploads/, made with ffmpeg), and the video's sound is mixed from pub/ (see the brief).
import { start, API } from '../../tools/evidence/kit.mjs';
import fs from 'fs';

const tag = process.env.OUT ?? 'before';
const { page, caption, tap, pause, listen, open, shot, finish, log } = await start(`${tag}-kiosk`);
await page.route('**/uploads/*.mp3', r => r.fulfill({ path: 'pub/uploads/1764012149103-rooster-crow-1-281011.mp3', contentType: 'audio/mpeg' }));

const push = async id => {
  const res = await fetch(`${API}/api/hooks/push`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
  log('push', id, res.status, await res.text());
};
// What the server holds (the same STATE every screen renders)
const server = () => page.evaluate(() => new Promise(resolve => {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.type !== 'STATE') return;
    ws.close();
    resolve({
      flowRuns: m.payload.flowRuns.map(r => `${r.flowId} @${r.stepIndex} (${r.steps[r.stepIndex]?.type})`),
      routineRuns: m.payload.routineRuns.map(r => `${r.userId} ${r.routineId} task ${r.taskIndex}${r.finishedAt ? ' finished' : ''}`),
    });
  };
}));
const record = [];
const note = async label => { const s = await server(); record.push({ label, ...s }); log(label, JSON.stringify(s)); };
const slot = name => page.locator('.routine-slot').filter({ hasText: name });

await open();
await caption('Before 07:00: a parent starts Ηλέκτρα’s morning routine by hand');
await push('u1-assign-morning');
await pause(2500);
await shot(`${tag}-1-by-hand`);
await note('1 by hand');

await caption('07:00: the schedule starts morning-flow (a wake-up alarm for each kid)');
await push('morning-flow');
await pause(3500);
await caption('Only Ιφιγένεια’s alarm shows. Ηλέκτρα’s waits on the server, hidden');
await pause(2000);
await shot(`${tag}-2-flow-started`);
await note('2 flow started');

await caption('Ιφιγένεια wakes up: her morning routine starts');
await tap(page.locator('.routine-slot .btn-dismiss-global'), 2500);
await note('3 u2 dismissed');

await caption('Ηλέκτρα finishes the morning routine she was already doing');
const u1 = slot('Ηλέκτρα');
for (let i = 0; i < 4; i++) await tap(u1.locator('.btn-done'), 1300);
await pause(1500);
await shot(`${tag}-3-u1-finished`);
await caption('The reward shows, the routine closes …');
await pause(5000);
await caption(tag === 'before' ? '… and now the wake-up alarm rings for Ηλέκτρα' : 'Ηλέκτρα’s routine closed');
await pause(3000);
await shot(`${tag}-4-alarm-after`);
await note('4 u1 closed');

const late = page.locator('.routine-slot').filter({ has: page.locator('.btn-dismiss-global') });
if (await late.count()) {
  await caption('She dismisses it: the morning routine starts again, from the first task');
  await tap(late.locator('.btn-dismiss-global'), 3000);
  await shot(`${tag}-5-routine-again`);
  await note('5 u1 dismissed');
}
await pause(2000);

const logs = await (await fetch(`${API}/api/debug/logs`)).json();
const runs = (Array.isArray(logs) ? logs : logs.logs ?? [])
  .filter(l => /TRIGGER|ALARM|ROUTINE_CLOSED/.test(l.type))
  .map(l => `${l.timestamp} ${l.type} ${JSON.stringify(l.details)}`).reverse();
fs.writeFileSync(`${tag}-server.json`, JSON.stringify({ steps: record, log: runs.slice(-12) }, null, 1));
await finish();
