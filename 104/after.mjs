// #104: mistakes data.schema.json can't see get into data.json, and nobody is told. Played before the fix and after it.
// after.mjs is before.mjs with three additions for the new screen: the editor's amber list scrolled into view
// before its shot, the phone also saving in the editor (390×844), and the full banner on the phone.
// Scene (from the repo root; the scenario saves data.json through the Advanced editor and on disk, so keep a copy):
//   cp -p backend/data.json .evidence/104/data.json.orig
//   tools/evidence/dev.sh clear-runs && tools/evidence/dev.sh stars u1 100 u2 20
//   tools/evidence/record.sh .evidence/104/before.mjs
//   rm backend/data.json && cp -p .evidence/104/data.json.orig backend/data.json && cmp backend/data.json .evidence/104/data.json.orig
// Name the output with the file's name (before / after): the after run copies this file as after.mjs.
//
// The mistakes (each passes the schema):
//   colour typo        users[u2].color «var(--color-secondry)»
//   blank name         a kid u4 named «  »
//   duplicate id       a third kid with id «u1» (Τρίτη); reward «reward-1» twice
//   links to nothing   routineAssignments → kid u3; routineTasks → task «t-missing»;
//                      schedules → flow «no-such-flow»; a flow step → assignment «u2-assign-mornin»;
//                      chores[0].eligibleUsers → u3
// Two ways in: 1. Προχωρημένα → Ρυθμίσεις (JSON), pasted and saved; 2. on disk (a hand edit, piserve's live file).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { start, API, APP, pause } from '../../tools/evidence/kit.mjs';

const out = path.basename(fileURLToPath(import.meta.url), '.mjs');
const DATA = '/repo/backend/data.json';
const ORIG = '/repo/.evidence/104/data.json.orig';
const result = {};
const get = async url => (await fetch(`${API}${url}`)).json();
const post = async (url, body) => {
  const r = await fetch(`${API}${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};

const orig = JSON.parse(fs.readFileSync(ORIG, 'utf8'));
const emoji = value => ({ type: 'emoji', value });
const bad = structuredClone(orig);
bad.users = bad.users.map(u => (u.id === 'u2' ? { ...u, color: 'var(--color-secondry)' } : u));
bad.users.push({ id: 'u1', name: 'Τρίτη', avatar: emoji('🐼'), color: 'var(--color-success)' });
bad.users.push({ id: 'u4', name: '  ', avatar: emoji('🦉'), color: 'var(--color-warning)' });
bad.rewards[1] = { ...bad.rewards[1], id: bad.rewards[0].id };
bad.routineAssignments.push({ id: 'u3-assign-morning', userId: 'u3', routineId: 'r-morning' });
bad.routineTasks[0] = { ...bad.routineTasks[0], taskId: 't-missing' };
bad.schedules.push({ id: 'sch-ghost', cron: '0 18 * * *', type: 'flow', targetId: 'no-such-flow' });
bad.flows = bad.flows.map(f => (f.id !== 'u2-morning-flow' ? f : {
  ...f, steps: f.steps.map(s => (s.type !== 'parallel' ? s : { ...s, actions: s.actions.map(a => ({ ...a, routineId: 'u2-assign-mornin' })) })),
}));
bad.chores[0] = { ...bad.chores[0], eligibleUsers: ['u3'] };

result.validate = await post('/api/admin/validate', bad);

const { page, caption, tap, shot, finish, log } = await start(out);

// 1. The Advanced editor: paste the file with the mistakes and save it
await page.goto(`${APP}/parent?view=advanced`);
await pause(3000);
await caption('1. Προχωρημένα → Ρυθμίσεις (JSON): pasting data.json with a colour typo, a blank name, duplicate ids, links to nothing');
const editor = page.locator('.p-json-editor .monaco-editor').first();
await editor.click();
await page.keyboard.press('Control+A');
// Pasted, as a parent would (typed text would get Monaco's auto-closed brackets)
await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
await page.evaluate(text => navigator.clipboard.writeText(text), JSON.stringify(bad, null, 2));
await page.keyboard.press('Control+V');
await pause(1500);
// Show the kids, where three of the mistakes are
await page.keyboard.press('Control+F');
await page.keyboard.insertText('secondry');
await page.keyboard.press('Escape');
await pause(1500);
await shot(`${out}-editor`);
await tap(page.getByRole('button', { name: 'Αποθήκευση' }), 2500);
const saved = await get('/api/admin/data');
result.editorSave = { liveHasMistakes: saved.users.length === bad.users.length };
const listed = await page.locator('.p-errors li').allTextContents();
result.editorSave.listed = listed;
await caption(`After Αποθήκευση: ${result.editorSave.liveHasMistakes ? 'saved and live' : 'not saved'}; the editor lists ${listed.length} problem(s)`);
// The list is under the editor: bring it into view
const list = page.locator('.p-errors.warn');
if (await list.count()) await list.scrollIntoViewIfNeeded();
await pause(3500);
await shot(`${out}-editor-saved`);

// 2. On disk, as a hand edit would (write beside, then rename: the file may be root's after the admin save)
fs.writeFileSync(`${DATA}.ev104`, JSON.stringify(bad, null, 2) + '\n');
fs.renameSync(`${DATA}.ev104`, DATA);
await pause(5000); // the file watcher polls every 2 s
result.status = await get('/api/admin/validation-status');

await page.goto(`${APP}/parent`);
await pause(2500);
await caption(`2. data.json on disk has the same mistakes (a hand edit). Parent → Σήμερα: ${result.status.warnings?.length ?? 0} warning(s) from the server`);
await pause(3500);
await shot(`${out}-parent-today`);

// What the kids see: the dock
await page.goto(APP);
await pause(1500);
const overlay = page.locator('.interaction-overlay');
if (await overlay.count()) await overlay.click();
await pause(2000);
await caption('The kids\' dock: Ιφιγένεια\'s colour is gone, a kid with no name, «Τρίτη» shares Ηλέκτρα\'s id and stars');
await pause(4000);
await shot(`${out}-dock`);
await finish();

// The phone, the parents' usual screen: Σήμερα with the same file live
{
  const phone = await start(`${out}-phone`, { size: { width: 390, height: 844 }, video: false });
  await phone.page.goto(`${APP}/parent`);
  await pause(2500);
  await phone.shot(`${out}-phone-today`);
  await phone.page.screenshot({ path: `${out}-phone-today-full.png`, fullPage: true });
  // The editor on the phone: Αποθήκευση of the same text lists the warnings and saves
  await phone.page.goto(`${APP}/parent?view=advanced`);
  await pause(3000);
  await phone.tap(phone.page.getByRole('button', { name: 'Αποθήκευση' }), 2500);
  const warn = phone.page.locator('.p-errors.warn');
  if (await warn.count()) await warn.scrollIntoViewIfNeeded();
  await pause(1000);
  await phone.shot(`${out}-phone-editor-saved`);
  await phone.finish();
}

fs.writeFileSync(`${out}-log.json`, JSON.stringify(result, null, 1));
log('done', JSON.stringify({ validate: result.validate.body, editorSave: result.editorSave, warnings: result.status.warnings?.length }));
