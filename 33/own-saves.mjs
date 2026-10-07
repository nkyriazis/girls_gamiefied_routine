// Issue #33, review note: does an editor's own save (or its own load) ever show the stale banner?
// A MutationObserver records every time `.p-stale` (the banner) appears and for how long.
// 1. The kiosk (1280×800) opens Προχωρημένα → Ρυθμίσεις (JSON) and saves 10 times in a row, each time
//    changing Γλυκό's cost. Then, as a control, another writer (this script, POST /api/admin/data with
//    the current version) changes Γλυκό: that one must raise the banner, and keep it up.
//    Two rounds: as the dev stack answers (localhost), then with every STATE message held back 150 ms
//    on its way to the page (page.routeWebSocket), as a Pi 4 behind nginx and Wi-Fi might.
// 2. Ασκήσεις (JSON) opened just after another writer saved exercises.json, with STATE held back 400 ms:
//    the editor's GET answers with the new version before the STATE does. Opening it must not show the
//    banner. Control: another writer saves again while it is open: the banner must come up.
// Writes own-saves.txt (rename it after the run, by the code it ran against).
// It changes backend/data.json and backend/exercises.json: copy both aside first and put them back after.
// Play: tools/evidence/record.sh .evidence/33/own-saves.mjs
import fs from 'fs';
import { start, pause, APP, API } from '../../tools/evidence/kit.mjs';

const ready = (page, key) => page.waitForFunction(key => window.monaco?.editor.getEditors().length === 1 &&
  window.monaco.editor.getEditors()[0].getModel()?.getValue().includes(key), key, { timeout: 60000 });
const setCost = (page, name, to) => page.evaluate(({ name, to }) => {
  const ed = window.monaco.editor.getEditors()[0], model = ed.getModel();
  const m = new RegExp(`"title": "${name}",[\\s\\S]*?"cost": (\\d+)`).exec(model.getValue());
  const at = m.index + m[0].length - m[1].length;
  const s = model.getPositionAt(at), e = model.getPositionAt(at + m[1].length);
  ed.executeEdits('evidence', [{ range: new window.monaco.Range(s.lineNumber, s.column, e.lineNumber, e.column), text: String(to) }]);
}, { name, to });

// Another writer: GET the file and its version, change it, POST it back with that version
const elsewhere = async (file, change) => {
  const res = await fetch(`${API}/api/admin/${file}`);
  const version = res.headers.get('X-Config-Version'), doc = await res.json();
  change(doc);
  const saved = await fetch(`${API}/api/admin/${file}?replace=1&version=${version}&source=api`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(doc) });
  if (saved.status !== 200) throw new Error(`${file}: ${saved.status} ${await saved.text()}`);
};

// Every appearance of the banner, with how long it stayed (ms)
const watch = page => page.evaluate(() => {
  window.__banners = [];
  let shown = null;
  const check = () => {
    const on = !!document.querySelector('.p-stale');
    if (on && shown === null) shown = performance.now();
    if (!on && shown !== null) { window.__banners.push(+(performance.now() - shown).toFixed(1)); shown = null; }
  };
  new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
  window.__bannerOpen = () => shown !== null;
});
const seen = page => page.evaluate(() => ({ n: window.__banners.length, last: window.__banners.at(-1), open: window.__bannerOpen() }));
const told = (before, after) => after.n > before.n ? `appeared for ${after.last} ms` : after.open ? 'appeared, and is still up' : 'never appeared';

const open = async delay => {
  const run = await start(`own-saves-${delay}`, { video: false });
  if (delay) {
    await run.page.routeWebSocket(/\/ws$/, ws => {
      const server = ws.connectToServer();
      server.onMessage(m => setTimeout(() => ws.send(m), delay));
      ws.onMessage(m => server.send(m));
    });
  }
  await run.page.goto(APP + '/parent?view=advanced');
  await ready(run.page, '"rewards"');
  await pause(2000);
  await watch(run.page);
  return run;
};

const ownSaves = async (label, delay) => {
  const run = await open(delay), { page } = run;
  const lines = [];
  let own = 0;
  for (let i = 1; i <= 10; i++) {
    await setCost(page, 'Γλυκό', 40 + i);
    const before = await seen(page);
    await page.getByRole('button', { name: 'Αποθήκευση' }).click();
    await pause(1500);
    const after = await seen(page);
    if (after.n > before.n || after.open) own++;
    lines.push(`  own save ${i} (Γλυκό ${40 + i}): banner ${told(before, after)}`);
  }
  const before = await seen(page);
  await elsewhere('data', d => { d.rewards.find(r => r.title === 'Γλυκό').cost = 39; });
  await pause(1500);
  lines.push(`  control, another writer sets Γλυκό 39: banner ${told(before, await seen(page))}`);
  await run.shot(`own-saves-${delay}`);
  await run.finish();
  return [`${label}: the banner appeared after ${own} of 10 own saves`, ...lines];
};

const exercisesOpen = async delay => {
  const run = await open(delay), { page } = run;
  const lines = [];
  let before = await seen(page);
  await elsewhere('exercises', d => { d.exercises[0].stars += 1; });
  await page.getByRole('tab', { name: 'Ασκήσεις (JSON)' }).click(); // at once: its STATE is still on its way
  await ready(page, '"exercises"');
  await pause(2000);
  lines.push(`  opened just after another writer's save: banner ${told(before, await seen(page))}`);
  before = await seen(page);
  await elsewhere('exercises', d => { d.exercises[0].stars -= 1; });
  await pause(2000);
  lines.push(`  control, another writer saves again while it is open: banner ${told(before, await seen(page))}`);
  await run.shot(`own-saves-exercises-${delay}`);
  await run.finish();
  return [`Ασκήσεις (JSON), STATE held back ${delay} ms`, ...lines];
};

const out = [
  ...(await ownSaves('Ρυθμίσεις (JSON), localhost, STATE as it comes', 0)),
  '',
  ...(await ownSaves('Ρυθμίσεις (JSON), STATE held back 150 ms (routeWebSocket)', 150)),
  '',
  ...(await exercisesOpen(400)),
  '',
];
fs.writeFileSync('own-saves.txt', out.join('\n'));
console.log(out.join('\n'));
