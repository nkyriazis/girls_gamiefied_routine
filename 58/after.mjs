// Issue #58: a flow starts a routine the kid already did today. As on piserve: a parent starts
// Ηλέκτρα's (u1) morning routine by hand before 07:00 and she finishes it (40 ⭐). At 07:00 the
// schedule starts morning-flow (a wake-up alarm, then the morning routine, for each kid): her
// alarm rings, and dismissing it starts the same morning routine from its first task, stars again.
// Scene: tools/evidence/dev.sh clear-runs && tools/evidence/dev.sh stars u1 100 u2 20, and no execution of
// Ηλέκτρα's from today (scene-no-runs-today.js u1, copied into the backend container and run there), so the
// only run the flow can find done today is the one she starts in this take.
// Play:  tools/evidence/record.sh .evidence/58/after.mjs   (before.mjs, played after the fix #58: her alarm
// still rings, dismissing it starts nothing)
// The rooster is an upload that only piserve has: the scenario serves #25's stand-in beep
// (pub/uploads/), and the video's sound is mixed from pub/.
import { start, API } from '../../tools/evidence/kit.mjs';
import fs from 'fs';

const tag = process.env.OUT ?? 'after';
const { page, caption, tap, pause, open, shot, finish, log } = await start(`${tag}-kiosk`);
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
      stars: Object.fromEntries(m.payload.users.map(u => [u.id, u.stars])),
      flowRuns: m.payload.flowRuns.map(r => `${r.flowId} @${r.stepIndex} (${r.steps[r.stepIndex]?.type})${r.userIds ? ' for ' + r.userIds.join(',') : ''}`),
      routineRuns: m.payload.routineRuns.map(r => `${r.userId} ${r.routineId} task ${r.taskIndex}${r.finishedAt ? ' finished' : ''}`),
    });
  };
}));
const record = [];
const note = async label => { const s = await server(); record.push({ label, ...s }); log(label, JSON.stringify(s)); };
const slot = name => page.locator('.routine-slot').filter({ hasText: name });

const takeStart = new Date().toISOString();
await open();
await note('0 start');
await caption('Before 07:00: a parent starts Ηλέκτρα’s morning routine by hand (Ξεκίνα τώρα)');
await push('u1-assign-morning');
await pause(2500);
await caption('Ηλέκτρα does all four tasks: 40 ⭐');
const u1 = slot('Ηλέκτρα');
for (let i = 0; i < 4; i++) await tap(u1.locator('.btn-done'), 1300);
await pause(1500);
await shot(`${tag}-1-done-by-hand`);
await note('1 done by hand');
await caption('The reward shows, the routine closes. She is done for the morning');
await pause(6000);
await note('2 closed');

await caption('07:00: the schedule starts morning-flow (a wake-up alarm, then the morning routine, for each kid)');
await push('morning-flow');
await pause(3500);
await caption('Both wake-up alarms ring, Ηλέκτρα’s too: an alarm is never hidden (#25)');
await pause(2500);
await shot(`${tag}-2-flow-started`);
await note('3 flow started');

const mine = slot('Ηλέκτρα').locator('.btn-dismiss-global');
await caption('She dismisses it: her morning routine is done today, so nothing starts again');
await tap(mine, 3000);
await shot(`${tag}-3-nothing-again`);
await note('4 u1 dismissed');
await caption('Her lane stays free; her stars stay 140. Ιφιγένεια’s alarm still waits for her');
await pause(3000);
await shot(`${tag}-4-stars-stay`);
await note('5 u1 after');
await pause(2000);

const logs = await (await fetch(`${API}/api/debug/logs`)).json();
const runs = (Array.isArray(logs) ? logs : logs.logs ?? [])
  .filter(l => /TRIGGER|ALARM|ROUTINE_CLOSED|TASK_COMPLETE|SKIP/.test(l.type))
  .filter(l => l.timestamp >= takeStart).reverse();
// This take only: the run she started by hand, and the skip, which must name that run
const hand = runs.find(l => l.type === 'TRIGGER_ROUTINE' && l.details?.id === 'u1-assign-morning')?.details?.runId;
const skips = runs.filter(l => l.type === 'FLOW_ROUTINE_SKIPPED');
const check = { takeStart, handStartedRun: hand, skips: skips.length, skipNamesHandRun: skips.length === 1 && skips[0].details.executionId === hand };
log('check', JSON.stringify(check));
fs.writeFileSync(`${tag}-server.json`, JSON.stringify({ check, steps: record, log: runs.map(l => `${l.timestamp} ${l.type} ${JSON.stringify(l.details)}`) }, null, 1));
await finish();
