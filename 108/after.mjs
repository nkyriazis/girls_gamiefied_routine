// #108: Αρχεία, tapping a file to copy its name, on localhost and on a LAN address (like the Pi's http://<pi>/).
// The same scenario plays before and after the fix; the captions report what happened, they don't assume it.
//   tools/evidence/record.sh .evidence/108/after.mjs
// After the fix, beyond before.mjs: the phone again in WebKit as an iPhone (Linux WebKit only approximates
// iOS Safari), and the kiosk with a browser that refuses to copy, to show the failure toast.
// Scene: one uploaded file, «…-rooster.wav» (uploaded here if missing; backend/uploads is git-ignored).
// LAN: the dev stack through the machine's private address, not a secure context (no navigator.clipboard).
import fs from 'fs';
import { start, API, pause } from '../../tools/evidence/kit.mjs';

const LAN = process.env.LAN ?? 'http://192.168.122.1:5173';
const LOCAL = 'http://localhost:5173';
const out = process.env.OUT ?? 'after';

// The scene: an uploaded sound to tap
let files = await (await fetch(`${API}/api/admin/uploads/list`)).json();
if (!files.some(f => f.endsWith('-rooster.wav'))) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync('/repo/frontend/public/sfx/done.wav')], { type: 'audio/wav' }), 'rooster.wav');
  const r = await fetch(`${API}/api/admin/upload`, { method: 'POST', body: form });
  console.log('uploaded', r.status, await r.text());
  files = await (await fetch(`${API}/api/admin/uploads/list`)).json();
}
const name = files.find(f => f.endsWith('-rooster.wav'));

const report = {};
async function play(tag, size, video, { browser, device, refuse } = {}) {
  const { page, caption: say, shot, finish } = await start(`${out}-${tag}`, { size, touch: true, video, browser, device });
  // A browser that refuses every copy: no clipboard, execCommand('copy') false
  if (refuse) await page.addInitScript(() => { document.execCommand = () => false; });
  // The caption at the bottom: the parents' toasts show at the top
  const caption = async t => { await say(t); await page.evaluate(() => { const c = document.getElementById('evidence-caption'); c.style.top = 'auto'; c.style.bottom = '80px'; }); };
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const tapOn = async (origin, label) => {
    await page.goto(`${origin}/parent?view=advanced`);
    await page.getByRole('tab', { name: 'Αρχεία' }).click();
    const row = page.locator('.p-row', { hasText: name });
    await row.waitFor();
    const ctx = await page.evaluate(() => ({ secure: window.isSecureContext, clipboard: typeof navigator.clipboard }));
    if (browser === 'webkit') ctx.userAgent = await page.evaluate(() => navigator.userAgent);
    await caption(`${label}: ${origin} · isSecureContext ${ctx.secure} · navigator.clipboard ${ctx.clipboard}`);
    await pause(1800);
    errors.length = 0;
    await row.click();
    await pause(700);
    const toasts = await page.locator('.p-toast').allTextContents();
    // What the clipboard got: paste it into a fresh field
    const pasted = await page.evaluate(() => {
      const t = document.createElement('textarea'); t.id = 'evidence-paste';
      t.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(t); t.focus(); return true;
    }).then(() => page.keyboard.press('Control+V')).then(() => pause(300))
      .then(() => page.evaluate(() => { const t = document.getElementById('evidence-paste'); const v = t.value; t.remove(); return v; }));
    const result = { origin, ...ctx, toasts, errors: [...errors], pasted };
    console.log(JSON.stringify(result));
    await caption(`${label}, tapped «${name}» → toast: ${toasts.length ? toasts.join(' | ') : 'none'} · ` +
      `page error: ${errors.length ? errors.join(' | ') : 'none'} · pasted: ${pasted ? `«${pasted}»` : 'nothing'}`);
    return result;
  };
  // Clear the clipboard first, so a paste shows only what this tap copied
  report[tag] = {};
  if (tag === 'kiosk') {
    await page.goto(`${LOCAL}/parent`);
    await page.evaluate(() => navigator.clipboard.writeText('')).catch(() => {});
    report[tag].localhost = await tapOn(LOCAL, 'localhost');
    await shot(`${out}-kiosk-localhost`);
    await pause(2500);
    await page.goto(`${LOCAL}/parent`);
    await page.evaluate(() => navigator.clipboard.writeText('')).catch(() => {});
  }
  const ua = browser === 'webkit' ? `WebKit as ${device}` : refuse ? 'a browser that refuses to copy' : 'LAN address (as on the Pi)';
  report[tag].lan = await tapOn(LAN, browser || refuse ? `${ua}, LAN address` : ua);
  if (browser === 'webkit') await caption(`${await page.locator('#evidence-caption').textContent()} · user agent: ${report[tag].lan.userAgent}`);
  await shot(`${out}-${tag}-lan`);
  await pause(3500);
  await finish();
}

await play('kiosk', { width: 1280, height: 800 }, true);
await play('phone', { width: 390, height: 844 }, false);
await play('phone-webkit', { width: 390, height: 844 }, false, { browser: 'webkit', device: 'iPhone 13' });
await play('kiosk-refused', { width: 1280, height: 800 }, false, { refuse: true });
fs.writeFileSync(`${out}.json`, JSON.stringify({ file: name, ...report }, null, 1));
