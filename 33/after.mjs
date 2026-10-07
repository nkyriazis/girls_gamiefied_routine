// Issue #33, after the fix: the same two parents as before.mjs, the same six screens, then the ways out.
// A (the kiosk, 1280×800, on video) has Προχωρημένα → Ρυθμίσεις (JSON) open.
// B (a phone, 390×844, screenshots) changes a reward's price in Ρυθμίσεις → Δώρα.
// 1. A's editor opens: «1 Ώρα Τηλεόραση» costs 50.
// 2. B sets it to 70 from the phone's form: «Αποθηκεύτηκε».
// 3. A's editor shows a banner: the settings changed meanwhile, Φόρτωσε ξανά.
// 4. A changes something else (Γλυκό 30 → 40) and presses Αποθήκευση anyway: refused (409), nothing saved.
// 5. B's phone: the TV still costs 70.
// 7. A presses Φόρτωσε ξανά (TV 70 now), changes TV to 60 and Γλυκό to 40, saves: no banner after its own save.
//    A MutationObserver on A's page counts every appearance of the banner, however short, from the
//    reload until the next screen (and again around A's save in 10): it must stay at 0.
//    Meanwhile B had the TV's sheet open on the phone (opened at 70).
// 8. B types 75 and saves: refused (409); the sheet reloads with the current 60. 9. B saves 75 again: saved.
// 10-11. The phone's own Ρυθμίσεις (JSON): A saves from the kiosk, B's editor shows the banner; B saves: 409.
// 6. Καταγραφή: every save is in the log (CONFIG_SAVED), and every refused one (CONFIG_SAVE_STALE).
// It changes backend/data.json: copy it aside first and put it back after (see brief.json).
// Scene: none (the dev data as it is). Play: tools/evidence/record.sh .evidence/33/after.mjs
import fs from 'fs';
import { start, pause, APP, API } from '../../tools/evidence/kit.mjs';

const tag = 'after';

const editorReady = async page => {
  await page.waitForFunction(() => window.monaco?.editor.getEditors().length === 1 &&
    window.monaco.editor.getEditors()[0].getModel()?.getValue().includes('"rewards"'), null, { timeout: 60000 });
  await pause(2500);
};

// The cost of the reward titled `name`, in the open document: shown in the middle, and changed when `to` is given
const cost = (page, name, to) => page.evaluate(({ name, to }) => {
  const ed = window.monaco.editor.getEditors()[0], model = ed.getModel();
  const m = new RegExp(`"title": "${name}",[\\s\\S]*?"cost": (\\d+)`).exec(model.getValue());
  const at = m.index + m[0].length - m[1].length;
  const s = model.getPositionAt(at), e = model.getPositionAt(at + m[1].length);
  if (to !== undefined) {
    ed.executeEdits('evidence', [{ range: new window.monaco.Range(s.lineNumber, s.column, e.lineNumber, e.column), text: String(to) }]);
  }
  ed.revealLineInCenter(s.lineNumber);
  ed.setSelection(new window.monaco.Range(s.lineNumber, s.column, s.lineNumber, s.column + String(to ?? m[1]).length));
  return Number(m[1]);
}, { name, to });

const rewards = async () => (await (await fetch(`${API}/api/admin/data`)).json()).rewards.map(r => `${r.title}: ${r.cost}`);
const banner = page => page.locator('.p-stale');

// Every appearance of the banner from now on, however short (a STATE that lags its save's answer by
// a few ms would flash it), and whether it is up now
const watch = page => page.evaluate(() => {
  window.__banners = 0;
  let up = !!document.querySelector('.p-stale');
  new MutationObserver(() => {
    const on = !!document.querySelector('.p-stale');
    if (on && !up) window.__banners++;
    up = on;
  }).observe(document.body, { childList: true, subtree: true });
});
const appeared = page => page.evaluate(() => window.__banners + (document.querySelector('.p-stale') ? ' (up now)' : ''));
const ownSaves = [];

// The captions go at the bottom, so the toasts at the top stay readable
const low = (run, bottom) => {
  const caption = async text => {
    await run.caption(text);
    await run.page.evaluate(b => Object.assign(document.getElementById('evidence-caption').style, { top: 'auto', bottom: b }), bottom);
  };
  return { ...run, caption };
};
const began = Date.now();
const kiosk = low(await start(`${tag}-kiosk`), '12px');
const k = kiosk.page;
const phone = low(await start(`${tag}-phone`, { size: { width: 390, height: 844 }, video: false }), '84px');
const p = phone.page;

await k.goto(APP + '/parent?view=advanced');
await editorReady(k);
const tvBefore = await cost(k, '1 Ώρα Τηλεόραση');
await kiosk.caption(`After: parent A opens Ρυθμίσεις (JSON). 1 Ώρα Τηλεόραση costs ${tvBefore}`);
await kiosk.shot(`${tag}-1-editor-open`);

await p.goto(APP + '/parent?view=settings');
await pause(2000);
await phone.tap(p.getByRole('button', { name: /1 Ώρα Τηλεόραση/ }), 800);
await p.getByLabel('Κόστος σε αστέρια').fill('70');
await phone.tap(p.getByRole('button', { name: 'Αποθήκευση' }), 1500);
await phone.caption('Parent B, on a phone: 1 Ώρα Τηλεόραση now costs 70');
await phone.shot(`${tag}-2-phone-form-saved`);

await banner(k).waitFor({ timeout: 10000 });
await pause(800);
await cost(k, '1 Ώρα Τηλεόραση');
await kiosk.caption(`Meanwhile parent B saved 70. A's editor still has ${tvBefore}, and a banner says the settings changed`);
await kiosk.shot(`${tag}-3-editor-stale`);

await cost(k, 'Γλυκό', 40);
await kiosk.caption('Parent A changes something else anyway, Γλυκό 30 → 40, and presses Αποθήκευση');
await pause(1500);
await kiosk.tap(k.getByRole('button', { name: 'Αποθήκευση' }), 2000);
await kiosk.caption('Refused (409): the old text would undo B\'s save. Nothing was written');
await kiosk.shot(`${tag}-4-editor-saved`);

await pause(1000);
await phone.caption(`Parent B's phone: 1 Ώρα Τηλεόραση still costs 70`);
await phone.shot(`${tag}-5-phone-reverted`);

// The ways out: B opens the TV's sheet (at 70); A reloads, and saves TV 60 and Γλυκό 40
await phone.tap(p.getByRole('button', { name: /1 Ώρα Τηλεόραση/ }), 800);
await kiosk.tap(banner(k).getByRole('button', { name: 'Φόρτωσε ξανά' }), 500);
await editorReady(k);
await watch(k);
await cost(k, 'Γλυκό', 40);
await cost(k, '1 Ώρα Τηλεόραση', 60);
await kiosk.caption('A presses Φόρτωσε ξανά: the editor has 70 now. A sets the TV to 60 and Γλυκό to 40, and saves');
await pause(1500);
await kiosk.tap(k.getByRole('button', { name: 'Αποθήκευση' }), 2500);
ownSaves.push(`A's save after Φόρτωσε ξανά (TV 60, Γλυκό 40): the banner appeared ${await appeared(k)} times`);
await kiosk.caption(`Saved, and the banner never showed (appearances watched: ${await appeared(k)}): the editor holds its own save's version`);
await kiosk.shot(`${tag}-7-editor-reloaded-saved`);

await p.getByLabel('Κόστος σε αστέρια').fill('75');
await phone.tap(p.getByRole('button', { name: 'Αποθήκευση' }), 1500);
await phone.caption('B\'s sheet was open from before A\'s save: 75 is refused, and the sheet shows the current 60');
await phone.shot(`${tag}-8-phone-form-stale`);
await pause(4000);
await p.getByLabel('Κόστος σε αστέρια').fill('75');
await phone.tap(p.getByRole('button', { name: 'Αποθήκευση' }), 1500);
await phone.caption('B makes the change again on the current values: saved');
await phone.shot(`${tag}-9-phone-form-saved-again`);

// The phone's own Advanced editor: A saves from the kiosk while it is open
await p.goto(APP + '/parent?view=advanced');
await editorReady(p);
await k.reload();
await editorReady(k);
await watch(k);
await cost(k, 'Γλυκό', 45);
await kiosk.tap(k.getByRole('button', { name: 'Αποθήκευση' }), 2500);
ownSaves.push(`A's save of Γλυκό 45 (B's editor open on the phone): on A's kiosk the banner appeared ${await appeared(k)} times`);
await banner(p).waitFor({ timeout: 10000 });
await pause(800);
await phone.caption('B\'s Ρυθμίσεις (JSON) on the phone: A saved from the kiosk, so a banner offers to reload');
await phone.shot(`${tag}-10-phone-editor-stale`);
await phone.tap(p.getByRole('button', { name: 'Αποθήκευση' }), 2000);
await p.locator('.p-errors').evaluate(el => el.scrollIntoView({ block: 'center' }));
await pause(500);
await phone.caption('B saves anyway: refused (409), with the reason under the editor');
await phone.shot(`${tag}-11-phone-editor-409`);

await kiosk.tap(k.getByRole('tab', { name: 'Καταγραφή' }), 2000);
await kiosk.caption('Καταγραφή (the action log): every save (CONFIG_SAVED) and every refused one (CONFIG_SAVE_STALE)');
await kiosk.shot(`${tag}-6-log`);

const logs = await (await fetch(`${API}/api/debug/logs`)).json();
const recent = logs.filter(l => Date.parse(l.timestamp) >= began);
fs.writeFileSync(`${tag}-api.txt`, [
  `# After: B's form save (TV 50 -> 70), A's stale editor save (refused), A's save after reloading (TV 60, Γλυκό 40),`,
  `# B's stale sheet (refused) and its second try (TV 75), A's Γλυκό 45 under B's open editor, B's stale save (refused)`,
  `GET /api/admin/data -> rewards: ${(await rewards()).join(' | ')}`,
  `GET /api/debug/logs -> ${logs.length} entries; during this scenario: ${recent.length}`,
  ...recent.map(l => `  ${l.timestamp} ${l.type} ${JSON.stringify(l.details)}`),
  `config-related entries (type matching /CONFIG/): ${logs.filter(l => /CONFIG/.test(l.type)).length}`,
  `# The kiosk's own saves: a MutationObserver on .p-stale, from the editor's load to 2.5 s after the save`,
  ...ownSaves,
  '',
].join('\n'));

await phone.finish();
await kiosk.finish();
