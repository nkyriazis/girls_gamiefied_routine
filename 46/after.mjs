// Issue #46, after: the same scenes as before.mjs. A routine or alarm that starts while
// something is open on the kids' screen comes over it, and what it covered is back as it was.
// Changed from before.mjs: the store and the drawer stay open under the routine, so the scenes
// end them by hand; the owl is tapped over the store and over the routine; every «Έτοιμο!» and
// «Ξυπνήσαμε!» on screen is checked for anything over its centre (the owl, a toast).
// Scene: tools/evidence/dev.sh clear-runs && tools/evidence/dev.sh plain
// Play:  OUT=after tools/evidence/record.sh .evidence/46/after.mjs
// The wake-up alarm is u1-morning-flow's rooster, an upload only piserve has: the scenario
// serves it from pub/uploads/, and the mp4 is mixed again with PUB=/repo/.evidence/46/pub.
import { start, API, APP, assignments } from '../../tools/evidence/kit.mjs';

const tag = process.env.OUT ?? 'after'; // record.sh passes no env into its container
const { page, caption, tap, pause, open, shot, finish, log } = await start(`${tag}-kiosk`);
await page.route('**/uploads/*.mp3', r => r.fulfill({ path: 'pub/uploads/1764012149103-rooster-crow-1-281011.mp3', contentType: 'audio/mpeg' }));

const post = async (path, body = {}) => {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  log('POST', path, res.status, text.slice(0, 120));
  return text;
};
const push = id => post('/api/hooks/push', { id });
// What the server holds (the same STATE every screen renders)
const server = () => page.evaluate(() => new Promise(resolve => {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.type !== 'STATE') return;
    ws.close();
    resolve(m.payload);
  };
}));
// Nothing running between scenes: alarms dismissed, routines closed, no group game
const clear = async () => {
  for (let i = 0; i < 3; i++) {
    const s = await server();
    for (const r of s.flowRuns) if (r.steps[r.stepIndex]?.type === 'alarm') await post(`/api/flow-runs/${r.id}/steps/${r.stepIndex}/dismiss`);
    await pause(400);
    for (const r of (await server()).routineRuns) await post(`/api/executions/${r.id}/close`);
    for (const g of s.exerciseSessions ?? []) await fetch(`${API}/api/exercises/sessions/${g.id}`, { method: 'DELETE' });
    await pause(600);
  }
};
// Is this element the one a finger at its centre would touch (not covered by anything)?
const onTop = async loc => {
  if (!(await loc.count())) return false;
  return loc.first().evaluate(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (el === hit || el.contains(hit));
  });
};
const dismiss = page.locator('.btn-dismiss-global');

// What a finger at the centre of each routine's or alarm's button would touch
const report = { occlusion: [], rightColumn: {} };
const occlusion = async label => {
  const found = await page.locator('.btn-done, .btn-dismiss-global').evaluateAll(els => els.map(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { button: el.textContent.trim(), onTop: !!hit && (el === hit || el.contains(hit)), hit: hit ? `${hit.tagName.toLowerCase()}.${[...hit.classList].join('.')}` : null };
  }));
  report.occlusion.push({ at: label, buttons: found });
  log('occlusion', label, JSON.stringify(found));
};
const rightColumn = async label => {
  report.rightColumn[label] = await page.locator('.match-item.right').allTextContents();
  log('right column', label, report.rightColumn[label].join(' | '));
};
const owl = page.locator('.help-anchor.floating .help-btn');
const exits = page.locator('.routine-slot .btn-exit');
// She closes every routine on screen with its ✕
const closeRoutines = async () => { while (await exits.count()) await tap(exits.first(), 1200); };

// A. The store
await open();
await clear();
await caption('A. Ηλέκτρα opens her store');
await tap(page.locator('.dock-avatar').first(), 1500);
await shot(`${tag}-a1-store`);
await caption('The owl starts explaining the store');
await tap(owl, 2500);
await shot(`${tag}-a1b-store-tour`);
await caption('Her evening routine starts (as at 20:00)');
await push('u1-assign-evening');
await pause(3000);
await caption('The routine comes over the store; the store\'s tour stops');
await pause(1500);
await shot(`${tag}-a2-routine-started`);
await occlusion('a2 routine over the store');
await caption('She taps the owl: it explains the routine, not the store under it');
await tap(owl, 3000);
await shot(`${tag}-a2b-owl-routine`);
await page.keyboard.press('Escape');
await pause(1000);
await caption('She closes the routine: her store is back as it was');
await closeRoutines();
await pause(1000);
await shot(`${tag}-a3-store-back`);
await pause(1000);
await tap(page.locator('.store-overlay .close-btn'), 1500);
await clear();
await pause(1000);

// B. An exercise half done, and her wake-up alarm
const mine = (await assignments()).find(a => a.userId === 'u1' && a.status === 'pending' && a.exercise?.type === 'match-pairs');
await caption('B. Ηλέκτρα starts an exercise from «Ασκήσεις της Ημέρας»');
await tap(page.locator('.daily-exercises-fab'), 1200);
await tap(page.locator(`[data-assignment="${mine.id}"]`).first(), 1500);
await tap(page.locator('.match-item.left').first(), 600);
await page.locator('.match-item.right').first().click({ force: true }); // it pulses, never 'stable'
await pause(900);
await caption('She has matched one pair: a half-finished answer');
await pause(1500);
await shot(`${tag}-b1-half-done`);
await rightColumn('b1 half done');
await caption('07:00: her wake-up alarm starts, over the exercise');
await push('u1-morning-flow');
await pause(3500);
await shot(`${tag}-b2-alarm-over`);
await occlusion('b2 alarm over the exercise');
await pause(1500);
await caption('She taps «Ξυπνήσαμε!»: her morning routine starts, still on top');
await tap(dismiss.first(), 3000);
await shot(`${tag}-b3-routine`);
await occlusion('b3 morning routine over the exercise');
await caption('She closes the routine: back to her exercise, the pair still matched');
await closeRoutines();
await clear();
await pause(2000);
await shot(`${tag}-b4-exercise-again`);
await rightColumn('b4 exercise again');
await pause(1500);
for (const sel of ['.assignment-player .exit-game-btn', '.exercises-drawer .close-btn'])
  if (await onTop(page.locator(sel))) await tap(page.locator(sel), 900);
await clear();

// C. The chores drawer
await caption('C. Ιφιγένεια opens the chores drawer');
await tap(page.locator('.chores-fab'), 1500);
await caption('Her morning routine starts, over the drawer and its shade');
await push('u2-assign-morning');
await pause(3000);
await shot(`${tag}-c1-drawer`);
await occlusion('c1 routine over the drawer');
await pause(1500);
await caption('She closes the routine: the drawer is back');
await closeRoutines();
await pause(1200);
await shot(`${tag}-c2-drawer-back`);
const choresClose = page.locator('.chores-drawer .close-btn');
if (await onTop(choresClose)) await tap(choresClose.first(), 1200);
await clear();
await pause(1000);

// D. The group game, from the moment the screen loads
await post('/api/exercises/sessions', { playerIds: ['u1', 'u2'], categories: ['Μαθηματικά'], totalRounds: 1, questionsPerRound: 3 });
await page.goto(APP + '/');
await pause(2500);
await caption('D. The screen loads while a group game runs: «Click to Start» is over the game');
await pause(1500);
await shot(`${tag}-d1-game-over-start`);
await caption('Her wake-up alarm starts (heard here only because the recorder lets pages play sound)');
await push('u1-morning-flow');
await pause(3500);
await shot(`${tag}-d2-alarm-under-start`);
await caption('A tap on «Click to Start»: the alarm is over the game');
await tap(page.locator('.interaction-overlay'), 2000);
await shot(`${tag}-d2b-alarm-over-game`);
await occlusion('d2b alarm over the game');
await pause(1500);
await caption('She taps «Ξυπνήσαμε!» and closes her routine: the game is back');
await tap(dismiss.first(), 2500);
await closeRoutines();
await pause(1500);
await shot(`${tag}-d3-game-back`);
await pause(1500);
const s = await server();
for (const g of s.exerciseSessions ?? []) await fetch(`${API}/api/exercises/sessions/${g.id}`, { method: 'DELETE' });
await clear();
const fs = await import('fs');
fs.writeFileSync(`${tag}-checks.json`, JSON.stringify(report, null, 1));
await finish();
