// Issue #36 (part 1, the kids), after the fix: a parent edits and adds a kid from a phone, and the
// kiosk (1280×800) shows it at once. Then a save that another screen beat (409, #33).
// 1. Ιφιγένεια's sheet on the phone: renamed Ίφη, an emoji avatar, green. Saved; the kiosk's dock follows.
// 2. + Νέο παιδί: Αποθήκευση is off until she has a name; Νεφέλη, 🐼, the free theme colour. The dock shows three kids.
// 3. Ηλέκτρα's sheet open on the phone while the JSON is saved elsewhere (her class 5 → 4):
//    her new colour is refused, the sheet shows her current values.
// It changes data.json: copy it aside first and put it back after (rm, cp, cmp).
// Scene: tools/evidence/dev.sh clear-runs. Play: tools/evidence/record.sh .evidence/36-kids/after-save.mjs
import { start, pause, APP, API } from '../../tools/evidence/kit.mjs';

const kiosk = await start('after-save-kiosk');
const k = kiosk.page;
await kiosk.open('/');
await pause(1500);
await kiosk.caption('The kiosk: the dock with two kids');
await kiosk.shot('after-save-1-dock');

const phone = await start('after-save-phone', { size: { width: 390, height: 844 } });
const p = phone.page;
await p.goto(APP + '/parent?view=settings');
await pause(2500);
const kids = p.locator('.p-section', { has: p.getByRole('heading', { name: 'Παιδιά' }) });
await kids.scrollIntoViewIfNeeded();
await p.evaluate(() => [...document.querySelectorAll('h2')].find(h => h.textContent === 'Παιδιά')?.scrollIntoView({ block: 'start' }));
await pause(800);
await phone.caption('Παιδιά on a phone');
await phone.shot('after-save-2-phone-kids');

// 1. Edit Ιφιγένεια
await phone.tap(kids.getByRole('button', { name: /Ιφιγένεια/ }), 1200);
const sheet = p.getByRole('dialog');
await sheet.getByLabel('Όνομα').fill('Ίφη');
await sheet.getByPlaceholder(/Emoji/).fill('🦄');
await phone.tap(sheet.getByRole('button', { name: 'Πράσινο' }), 600);
await phone.caption('Renamed Ίφη, an emoji, green');
await phone.shot('after-save-3-phone-edit');
await phone.tap(sheet.getByRole('button', { name: 'Αποθήκευση' }), 1500);
await phone.caption('Saved');
await phone.shot('after-save-4-phone-saved');
await pause(1000);
await kiosk.caption('The kiosk, untouched: Ίφη, 🦄, green, at once');
await kiosk.shot('after-save-5-dock-edited');

// 2. Add a kid
await phone.tap(kids.getByRole('button', { name: /Νέο παιδί/ }), 1200);
await phone.caption('Νέο παιδί: Αποθήκευση waits for a name');
await phone.shot('after-save-6-phone-new-blank');
await sheet.getByLabel('Όνομα').fill('Νεφέλη');
await sheet.getByPlaceholder(/Emoji/).fill('🐼');
await pause(600);
await phone.caption('Νεφέλη, 🐼, the theme colour no kid has');
await phone.shot('after-save-7-phone-new');
await phone.tap(sheet.getByRole('button', { name: 'Αποθήκευση' }), 1500);
await phone.caption('Added');
await phone.shot('after-save-8-phone-added');
await pause(1000);
await kiosk.caption('Three kids in the dock (1280×800); Νεφέλη starts at 0 stars');
await kiosk.shot('after-save-9-dock-three');

// 3. A save another screen beat
await phone.tap(kids.getByRole('button', { name: /Ηλέκτρα/ }), 1200);
await phone.tap(sheet.getByRole('button', { name: 'Πορτοκαλί' }), 600);
await phone.caption('Ηλέκτρα\'s sheet, orange picked, not saved yet');
await phone.shot('after-save-10-phone-stale-before');
const res = await fetch(`${API}/api/admin/data`);
const version = res.headers.get('x-config-version');
const data = await res.json();
data.users = data.users.map(u => (u.id === 'u1' ? { ...u, grade: 4 } : u));
const saved = await fetch(`${API}/api/admin/data?${new URLSearchParams({ version, source: 'advanced' })}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
});
console.log('meanwhile, the JSON saved elsewhere:', saved.status, await saved.text());
await pause(1500);
await phone.tap(sheet.getByRole('button', { name: 'Αποθήκευση' }), 1500);
await phone.caption('Refused (409): the sheet shows her current values, Δ΄ and gold');
await p.evaluate(() => { const c = document.getElementById('evidence-caption'); c.style.top = 'auto'; c.style.bottom = '96px'; }); // off the toast
await phone.shot('after-save-11-phone-stale');
await pause(1500);
await kiosk.caption('The kiosk: Ηλέκτρα still gold');
await kiosk.shot('after-save-12-dock-after-stale');

await phone.finish();
await kiosk.finish();
