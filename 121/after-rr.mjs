// #121 review: a flow cycle through a routine. «rr» starts Ηλέκτρα's evening routine, then itself.
// configChecks used to say only «αυτή η ενέργεια δεν ξεκινά τίποτα», true only when her routine is skipped.
// Played on 7cb939e (before-rr) and on the fix (after-rr): the same steps. It shows the warning and what the engine does when her routine starts.
// Scene (from the repo root; the scenario rewrites data.json on disk, so keep a copy):
//   cp -p backend/data.json .evidence/121/data.json.rr-orig
//   tools/evidence/dev.sh clear-runs
//   tools/evidence/record.sh .evidence/121/after-rr.mjs   (or before-rr.mjs, a copy, with 7cb939e's configChecks.ts)
//   tools/evidence/dev.sh clear-runs
//   rm backend/data.json && cp -p .evidence/121/data.json.rr-orig backend/data.json && cmp backend/data.json .evidence/121/data.json.rr-orig
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { start, API, APP, pause } from '../../tools/evidence/kit.mjs';

const out = path.basename(fileURLToPath(import.meta.url), '.mjs');
const DATA = '/repo/backend/data.json';
const ORIG = '/repo/.evidence/121/data.json.rr-orig';
const result = {};
const get = async url => (await fetch(`${API}${url}`)).json();
const post = async (url, body) => {
  const r = await fetch(`${API}${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const writeData = async data => {
  fs.writeFileSync(`${DATA}.ev121`, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(`${DATA}.ev121`, DATA);
  await pause(5000); // the file watcher polls every 2 s
};
const appState = () => new Promise((resolve, reject) => {
  const ws = new WebSocket(`${API.replace(/^http/, 'ws')}/ws`);
  const timer = setTimeout(() => { ws.close(); reject(new Error('no STATE')); }, 5000);
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.type !== 'STATE') return;
    clearTimeout(timer); ws.close(); resolve(m.payload);
  };
});
const runs = async () => {
  const s = await appState();
  return { flows: s.flowRuns.map(f => `${f.flowId}@${f.stepIndex} ${f.id.slice(0, 8)}`), routines: s.routineRuns.map(r => `${r.userId}:${r.routineId} ${r.id.slice(0, 8)}`) };
};

const orig = JSON.parse(fs.readFileSync(ORIG, 'utf8'));
const scene = structuredClone(orig);
scene.flows.push({ id: 'rr', steps: [
  { type: 'parallel', actions: [{ type: 'routine', userId: 'u1', routineId: 'u1-assign-evening' }] },
  { type: 'parallel', actions: [{ type: 'flow', flowId: 'rr' }] },
] });
await writeData(scene);
result.warnings = (await get('/api/admin/validation-status')).warnings?.filter(w => w.kind === 'flow-cycle').map(w => ({ path: w.path, message: w.message }));

const { page, caption, tap, shot, finish, log, open } = await start(out);

// 1. Σήμερα: the warning, with both outcomes
await page.goto(`${APP}/parent`);
await pause(2500);
await caption(`«rr»: Ηλέκτρα's evening routine, then rr. Σήμερα: ${out.startsWith('before') ? 'only «αυτή η ενέργεια δεν ξεκινά τίποτα»' : 'what happens when her routine is skipped, and when it starts'}`);
await pause(4000);
await shot(`${out}-parent-today`);

// 2. push rr: her routine starts
result.push = await post('/api/hooks/push', { id: 'rr' });
result.afterPush = await runs();
await open('/');
await pause(2500);
await caption(`push rr: ${JSON.stringify(result.push.body)}; her routine is on screen (${result.afterPush.routines.join(', ')})`);
await pause(3500);
await shot(`${out}-routine`);

// 3. She leaves it with ✕: rr starts over, and her routine is back
await tap(page.locator('.btn-exit').first(), 1000);
await tap(page.getByRole('button', { name: 'Ναι' }), 3000);
result.afterExit = await runs();
await caption(`✕ → Ναι: rr started over (${result.afterExit.flows.join(', ')}) and her routine is back (${result.afterExit.routines.join(', ')})`);
await pause(4000);
await shot(`${out}-again`);
await finish();

// The phone, the parents' usual screen: the same warning
{
  const phone = await start(`${out}-phone`, { size: { width: 390, height: 844 }, video: false });
  await phone.page.goto(`${APP}/parent`);
  await pause(2500);
  await phone.page.getByText(/ξεκινά τον εαυτό της \(rr/).first().scrollIntoViewIfNeeded();
  await pause(500);
  await phone.shot(`${out}-phone-today`);
  await phone.finish();
}

// Take rr out of the file first: with rr gone, closing her routine ends the flow instead of restarting it
await writeData(orig);
for (const r of (await appState()).routineRuns) await post(`/api/executions/${r.id}/close`, {});
result.atEnd = await runs();
fs.writeFileSync(`${out}-log.json`, JSON.stringify(result, null, 1));
log('done', JSON.stringify(result).slice(0, 3000));
