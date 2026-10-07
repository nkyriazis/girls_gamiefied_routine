// #29 after the fix: before.mjs, plus the parent then starting a routine for a kid already in one (the
// toast says «Ήδη σε ρουτίνα»). The phone's caption sits at the bottom so the toast at the top shows.
// The kiosk and a parent's phone (two videos). Both kids have an evening routine at 20:00; the parent
// starts only Ηλέκτρα's.
// Scene (from the repo root; the scenario rewrites data.json through the admin API, so keep a copy):
//   cp -p backend/data.json .evidence/29/data.json.orig
//   tools/evidence/dev.sh clear-runs
//   OUT=after tools/evidence/record.sh .evidence/29/after.mjs
//   rm backend/data.json && cp -p .evidence/29/data.json.orig backend/data.json && cmp backend/data.json .evidence/29/data.json.orig
//   tools/evidence/dev.sh clear-runs
import fs from 'fs';
import { start, API, APP } from '../../tools/evidence/kit.mjs';

const tag = process.env.OUT ?? 'after';

// Ιφιγένεια (u2) gets an evening routine too, on the same 20:00 schedule as her sister's
const config = await (await fetch(`${API}/api/admin/data`)).json();
const scene = {
  ...config,
  routineAssignments: [...config.routineAssignments.filter(a => a.id !== 'u2-assign-evening'),
    { id: 'u2-assign-evening', userId: 'u2', routineId: 'r-evening' }],
  schedules: [...config.schedules.filter(s => s.id !== 'sch-evening-u2'),
    { id: 'sch-evening-u2', cron: '0 20 * * *', type: 'routine', targetId: 'u2-assign-evening' }],
};
const saved = await fetch(`${API}/api/admin/data`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(scene) });
if (!saved.ok) throw new Error(`config not saved: ${saved.status} ${await saved.text()}`);
const since = new Date().toISOString();

const kiosk = await start(`${tag}-kiosk`);
const phone = await start(`${tag}-parent`, { size: { width: 390, height: 844 } });
const k = kiosk.page, p = phone.page;

// The phone's caption at the bottom: the parent's toast shows at the top
const phoneCaption = async text => {
  await phone.caption(text);
  await p.evaluate(() => { const el = document.getElementById('evidence-caption'); if (el) { el.style.top = 'auto'; el.style.bottom = '8px'; } });
};

await kiosk.open();
await p.goto(APP + '/parent?view=settings');
await phone.pause(1500);
const chips = p.locator('.p-chips', { has: p.locator('.p-chip', { hasText: 'Βραδινή' }) }).first();
await chips.scrollIntoViewIfNeeded();
await kiosk.caption('Nothing running. Both kids’ evening routines are scheduled at 20:00');
await phoneCaption('Ξεκίνα τώρα: the parent starts only «Ηλέκτρα: Βραδινή Ρουτίνα»');
await kiosk.pause(1500);
await kiosk.shot(`${tag}-1-kiosk-idle`);
await phone.shot(`${tag}-1-parent-start-now`);

const answer = p.waitForResponse(r => r.url().includes('/api/hooks/push'));
await phone.tap(p.locator('.p-chip', { hasText: 'Ηλέκτρα: Βραδινή Ρουτίνα' }), 2500);
const pushed = await (await answer).json();
await phone.shot(`${tag}-2-parent-started`);

await phoneCaption('Then «Ηλέκτρα: Πρωινή Ρουτίνα», while she is in her evening routine');
await phone.pause(800);
const answer2 = p.waitForResponse(r => r.url().includes('/api/hooks/push'));
await phone.tap(p.locator('.p-chip', { hasText: 'Ηλέκτρα: Πρωινή Ρουτίνα' }), 1200);
const skipped = await (await answer2).json();
await phone.shot(`${tag}-4-parent-skipped`);
console.log('second push answered', JSON.stringify(skipped));

const logs = (await (await fetch(`${API}/api/debug/logs`)).json()).filter(e => e.timestamp >= since);
const routines = logs.filter(e => e.type === 'TRIGGER_ROUTINE' || e.type === 'TRIGGER_FLOW').map(e => `${e.details.id} (${e.details.source})`);
const matched = logs.filter(e => e.type === 'SCHEDULE_MATCH').map(e => `${e.details.scheduleId} @ ${e.details.time}`);
fs.writeFileSync(`${tag}-api.json`, JSON.stringify({ response: pushed, skippedResponse: skipped, logs }, null, 1));
console.log('push answered', JSON.stringify(pushed));
console.log('started', routines.join(', '));
console.log('SCHEDULE_MATCH', matched.join(', '));

await kiosk.caption(`Started: ${routines.join(' + ') || 'nothing'}`);
await kiosk.pause(2500);
await kiosk.shot(`${tag}-2-kiosk-after-push`);
await kiosk.caption(matched.length ? `Log: SCHEDULE_MATCH ${matched.join(', ')} — logged at ${new Date().toLocaleTimeString('el-GR', { timeZone: 'Europe/Athens' })}` : 'Log: no SCHEDULE_MATCH');
await kiosk.pause(3000);
await kiosk.shot(`${tag}-3-kiosk-log`);

await Promise.all([kiosk.finish(), phone.finish()]);
