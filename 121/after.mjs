// #121, after the fix: the same file and the same steps as before.mjs, with captions saying what happens now.
// Scene (from the repo root; the scenario rewrites data.json on disk and the chore form saves it, so keep a copy):
//   cp -p backend/data.json .evidence/121/data.json.orig
//   tools/evidence/dev.sh clear-runs
//   tools/evidence/record.sh .evidence/121/before.mjs
//   tools/evidence/dev.sh clear-runs
//   rm backend/data.json && cp -p .evidence/121/data.json.orig backend/data.json && cmp backend/data.json .evidence/121/data.json.orig
// Name the output with the file's name (before / after): the after run copies this file as after.mjs.
//
// The mistakes (each passes the schema, and #104's checks don't see the first two):
//   flow cycles     «loop» starts itself; «ping» starts «pong», which starts «ping»
//   reserved id     an assignment «alarm» (Ηλέκτρα's evening routine); then, alone, a flow «alarm»
//   missing kid     chore «Σκούπισμα» limited to u3 (no such kid): #104 warns, the form can't clear it
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { start, API, APP, pause } from '../../tools/evidence/kit.mjs';

const out = path.basename(fileURLToPath(import.meta.url), '.mjs');
const DATA = '/repo/backend/data.json';
const ORIG = '/repo/.evidence/121/data.json.orig';
const result = {};
const get = async url => (await fetch(`${API}${url}`)).json();
const post = async (url, body) => {
  const r = await fetch(`${API}${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const writeData = async data => {
  // beside, then rename: after a form save the file is root's
  fs.writeFileSync(`${DATA}.ev121`, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(`${DATA}.ev121`, DATA);
  await pause(5000); // the file watcher polls every 2 s
};
// The AppState every screen gets (the first STATE on /ws)
const appState = () => new Promise((resolve, reject) => {
  const ws = new WebSocket(`${API.replace(/^http/, 'ws')}/ws`);
  const timer = setTimeout(() => { ws.close(); reject(new Error('no STATE')); }, 5000);
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.type !== 'STATE') return;
    clearTimeout(timer); ws.close(); resolve(m.payload);
  };
});
const flowRuns = async () => (await appState()).flowRuns;
const clearRuns = async () => {
  // what dev.sh clear-runs does, through the API: close every routine on screen, dismiss every alarm
  for (let i = 0; i < 5; i++) {
    const s = await appState();
    for (const r of s.routineRuns ?? []) await post(`/api/executions/${r.id}/close`, {});
    for (const f of s.flowRuns ?? []) if (f.steps[f.stepIndex]?.type === 'alarm') await post(`/api/flow-runs/${f.id}/steps/${f.stepIndex}/dismiss`, {});
  }
};

const orig = JSON.parse(fs.readFileSync(ORIG, 'utf8'));
const vacuum = orig.chores.findIndex(c => c.id === 'chore-vacuum');
const phase1 = structuredClone(orig);
phase1.flows.push(
  { id: 'loop', steps: [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'loop' }] }] },
  { id: 'ping', steps: [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'pong' }] }] },
  { id: 'pong', steps: [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'ping' }] }] },
);
phase1.schedules.push({ id: 'sch-ping', cron: '7 19 * * *', type: 'flow', targetId: 'ping' });
phase1.routineAssignments.push({ id: 'alarm', userId: 'u1', routineId: orig.routineAssignments.find(a => a.id === 'u1-assign-evening').routineId });
phase1.chores[vacuum] = { ...phase1.chores[vacuum], eligibleUsers: ['u3'] };

result.validate = (await post('/api/admin/validate', phase1)).body;
await writeData(phase1);
result.status1 = await get('/api/admin/validation-status');

const { page, caption, tap, shot, finish, log, open } = await start(out);
const toast = async () => (await page.locator('.p-toast-text').allTextContents()).join(' | ');

// 1. The parents' page: what it says about the file
await page.goto(`${APP}/parent`);
await pause(2500);
await caption(`The same data.json. Σήμερα lists ${result.status1.warnings?.length ?? 0} problems: the chore for u3, the cycles loop→loop and ping→pong→ping, the assignment «alarm»`);
await pause(3500);
await shot(`${out}-parent-today`);

// 2. Ξεκίνα τώρα on the cycles
await page.goto(`${APP}/parent?view=settings`);
await pause(2500);
const startNow = page.locator('section, .p-section').filter({ hasText: 'Ξεκίνα τώρα' }).last();
await startNow.scrollIntoViewIfNeeded();
await caption('Ρυθμίσεις → Ξεκίνα τώρα: no chip for the assignment «alarm», its warning instead. ▶ loop');
await tap(page.getByRole('button', { name: '▶ loop' }), 1500);
result.pushLoopToast = await toast();
await page.evaluate(() => document.getElementById('evidence-caption')?.remove()); // the toast is under it
await shot(`${out}-start-loop`);
await caption(`▶ loop: «${result.pushLoopToast}», no error; now ▶ ping`);
await pause(2500);
await tap(page.getByRole('button', { name: '▶ ping' }), 1500);
result.pushPingToast = await toast();
await caption(`▶ ping: «${result.pushPingToast}»; nothing left running`);
await pause(2500);
result.pushLoop = await post('/api/hooks/push', { id: 'loop' });
result.pushPing = await post('/api/hooks/push', { id: 'ping' });
result.flowRunsAfterCycles = await flowRuns();

// 3. The schedule «sch-ping» at 19:07: what the log says, and what the parents' page says
const t0 = Date.now();
result.debugTime = await post('/api/debug/time', { time: '19:07' });
const logs = await get('/api/debug/logs');
result.scheduleLog = (Array.isArray(logs) ? logs : logs.logs ?? []).filter(l => /SCHEDULE_(MATCH|ERROR)|FLOW_CYCLE|TRIGGER_FLOW/.test(l.type) && new Date(l.timestamp).getTime() >= t0 - 1000)
  .map(l => ({ type: l.type, details: l.details }));
await page.goto(`${APP}/parent`);
await pause(2500);
const fromMatch = result.scheduleLog.slice().reverse().filter((l, i, all) => i >= all.findIndex(x => x.type === 'SCHEDULE_MATCH'));
await caption(`Schedule «sch-ping» at 19:07, the log: ${fromMatch.map(l => l.type + (l.details?.chain ? ` ${l.details.chain.join('→')}` : '')).join(', ')}; no SCHEDULE_ERROR`);
await pause(3500);
await shot(`${out}-parent-after-schedule`);

// 4. push «alarm» with an assignment «alarm»: a routine starts instead of the alarm
await clearRuns();
result.pushAlarmAssignment = await post('/api/hooks/push', { id: 'alarm' });
await open('/');
await pause(2000);
await caption(`push «alarm» with the assignment «alarm» still there: ${JSON.stringify(result.pushAlarmAssignment.body)}, the plain alarm`);
await pause(3500);
await shot(`${out}-alarm-assignment`);
await clearRuns();

// 5. The chore form: «Σκούπισμα» is for u3 only, no such kid
await page.goto(`${APP}/parent?view=settings`);
await pause(2500);
const vacuumRow = page.locator('.p-row').filter({ hasText: 'Σκούπισμα' });
await vacuumRow.scrollIntoViewIfNeeded();
await tap(vacuumRow, 1200);
const kids = page.getByRole('group', { name: /Ποια παιδιά/ });
await page.getByText(/που δεν υπάρχει\. Πάτα ένα παιδί/).scrollIntoViewIfNeeded();
await caption('Δουλειές → Σκούπισμα, eligibleUsers ["u3"]: a line says u3 does not exist; «Για όλα» is not pressed');
await pause(3000);
await shot(`${out}-chore-form`);
await tap(kids.getByRole('button', { name: 'Ηλέκτρα' }), 600);
await tap(page.getByRole('button', { name: 'Αποθήκευση' }), 2500);
result.choreAfterTap1 = (await get('/api/admin/data')).chores.find(c => c.id === 'chore-vacuum').eligibleUsers;
await caption(`Tap Ηλέκτρα, Αποθήκευση: eligibleUsers ${JSON.stringify(result.choreAfterTap1)}, u3 gone`);
await pause(3000);
await page.keyboard.press('Escape');
await page.goto(`${APP}/parent?view=settings`);
await pause(2500);
await tap(page.locator('.p-row').filter({ hasText: 'Σκούπισμα' }), 1200);
await tap(page.getByRole('group', { name: /Ποια παιδιά/ }).getByRole('button', { name: 'Ηλέκτρα' }), 600);
await tap(page.getByRole('button', { name: 'Αποθήκευση' }), 2500);
result.choreAfterTap2 = (await get('/api/admin/data')).chores.find(c => c.id === 'chore-vacuum').eligibleUsers;
await page.goto(`${APP}/parent?view=settings`);
await pause(2500);
await tap(page.locator('.p-row').filter({ hasText: 'Σκούπισμα' }), 1200);
await page.getByRole('button', { name: 'Αποθήκευση' }).scrollIntoViewIfNeeded();
await caption(`Tap Ηλέκτρα again, Αποθήκευση: eligibleUsers ${JSON.stringify(result.choreAfterTap2) ?? 'none'}, every kid: «Για όλα» pressed`);
await pause(3000);
await shot(`${out}-chore-saved`);
await page.keyboard.press('Escape');

// 6. A flow «alarm» alone (no assignment «alarm»): its own alarm and routine never come
const phase2 = structuredClone(orig);
phase2.flows.push({
  id: 'alarm', steps: [
    { type: 'alarm', props: { sound: 'beep', title: 'Ώρα για το βραδινό!', icon: '🌙', dismissText: 'Πάμε!' } },
    { type: 'parallel', actions: [{ type: 'routine', userId: 'u1', routineId: 'u1-assign-evening' }] },
  ],
});
await writeData(phase2);
result.status2 = await get('/api/admin/validation-status');
result.pushAlarmFlow = await post('/api/hooks/push', { id: 'alarm' });
result.alarmFlowRun = (await flowRuns())?.map(f => ({ flowId: f.flowId, steps: f.steps.length, title: f.steps[0]?.props?.title ?? null }));
await open('/');
await pause(2500);
await caption(`Flow «alarm» alone. push «alarm» rings the plain alarm, by design: «alarm» always means it`);
await pause(4000);
await shot(`${out}-alarm-flow`);
await tap(page.locator('.btn-dismiss-global'), 2500);
result.routinesAfterDismiss = (await appState()).routineRuns.length;
await caption(`Dismissed: ${result.routinesAfterDismiss} routine(s); the plain alarm has none. Σήμερα says why, next`);
await pause(3500);
await shot(`${out}-alarm-flow-dismissed`);
await page.goto(`${APP}/parent`);
await pause(2500);
await caption(`Σήμερα with the flow «alarm»: ${result.status2.warnings?.length ?? 0} problem, it needs another id`);
await pause(3500);
await shot(`${out}-alarm-flow-warning`);
await finish();

// The phone, the parents' usual screen: Σήμερα with phase 1's file, and the chore form
await writeData(phase1);
{
  const phone = await start(`${out}-phone`, { size: { width: 390, height: 844 }, video: false });
  await phone.page.goto(`${APP}/parent`);
  await pause(2500);
  await phone.shot(`${out}-phone-today`);
  await phone.page.goto(`${APP}/parent?view=settings`);
  await pause(2500);
  await phone.page.locator('.p-row').filter({ hasText: 'Σκούπισμα' }).click();
  await pause(1200);
  await phone.page.getByText(/που δεν υπάρχει\. Πάτα ένα παιδί/).scrollIntoViewIfNeeded();
  await pause(500);
  await phone.shot(`${out}-phone-chore-form`);
  await phone.finish();
}

fs.writeFileSync(`${out}-log.json`, JSON.stringify(result, null, 1));
log('done', JSON.stringify(result).slice(0, 2000));
