// End-to-end check of the redesigned parent dashboard (#15) on piserve's data.
// A kids' dashboard, a parent on a phone and a parent on a tablet (three
// devices). Every parent task is done in the phone's UI, and each step waits
// until the kids' dashboard (and the other parent device) shows the result.
// Kids' actions are done in the kids' UI and must reach the parent.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://frontend';
const OUT = '/e2e/shots';
const E = 'Ηλέκτρα';
let I = 'Ιφιγένεια';

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s]`, ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function until(desc, fn, timeout = 10000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try { last = await fn(); if (last) { log(`  ok  ${desc}  (${Date.now() - start} ms)`); return last; } }
    catch (e) { last = e.message.split('\n')[0]; }
    await sleep(100);
  }
  throw new Error(`TIMEOUT: ${desc} (last: ${last})`);
}

async function rest(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

const num = t => Number(t.replace(/[^\d-]/g, ''));
const visible = (p, sel, opts) => p.locator(sel, opts).first().isVisible();
const count = (p, sel, opts) => p.locator(sel, opts).count();

const browser = await chromium.launch();
async function client(path, label, viewport, mobile = false) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, locale: 'el-GR', timezoneId: 'Europe/Athens' });
  const page = await context.newPage();
  page.on('pageerror', e => log(`PAGE ERROR (${label}):`, e.message));
  await page.goto(BASE + path);
  if (path === '/') await page.locator('.interaction-overlay').click();
  log(`opened ${label} at ${path} (${viewport.width}x${viewport.height})`);
  return page;
}

// full: grow the window to the whole page first, so the fixed nav bar ends up at the bottom
async function shot(page, name, full = true, keepToasts = false) {
  await sleep(600); // let animations settle so the screenshot is readable
  for (let i = 0; !keepToasts && i < 40 && (await count(page, '.p-toast')) > 0; i++) await sleep(100); // toasts cover the header
  const viewport = page.viewportSize();
  const height = full ? await page.evaluate(() => document.documentElement.scrollHeight) : 0;
  if (height > viewport.height) { await page.setViewportSize({ ...viewport, height }); await sleep(400); }
  await page.screenshot({ path: `${OUT}/${name}.png` });
  if (height > viewport.height) await page.setViewportSize(viewport);
  log(`  shot ${name}.png`);
}

const kids = await client('/', 'kids dashboard', { width: 1280, height: 800 });
const phone = await client('/parent', 'parent on a phone', { width: 390, height: 844 }, true);
const tablet = await client('/parent', 'parent on a tablet', { width: 1180, height: 820 }, true);

// Balances as each device shows them
const kidStars = name => kids.locator('.dock-item', { hasText: name }).locator('.dock-stars').innerText({ timeout: 300 }).then(num);
const parentStars = (p, name) => p.locator('.p-kid', { hasText: name }).locator('.p-kid-stars').innerText({ timeout: 300 }).then(num);
async function everywhere(name, stars) {
  await until(`${name} ⭐${stars} on kids, phone and tablet`, async () =>
    (await kidStars(name)) === stars && (await parentStars(phone, name)) === stars && (await parentStars(tablet, name)) === stars);
}
const balances = {};
async function expectStars(name, delta) {
  balances[name] += delta;
  await everywhere(name, balances[name]);
}

// Parent navigation and helpers
const go = (p, label) => p.locator('.p-nav-item', { hasText: label }).click();
const card = (p, text) => p.locator('.p-inbox-card', { hasText: text });
const confirmTwice = async locator => { await locator.click(); await locator.click(); }; // the ConfirmButton asks "Σίγουρα;"
const inboxCount = p => count(p, '.p-inbox-card');
async function badge(p) { return (await visible(p, '.p-badge')) ? num(await p.locator('.p-badge').innerText()) : 0; }

// Kids' store
const openStore = async name => { await kids.locator('.dock-item', { hasText: name }).locator('.dock-avatar').click(); await kids.locator('.store-card').waitFor(); };
const closeStore = () => kids.getByRole('button', { name: 'Κλείσιμο', exact: true }).click();
async function kidsPendingSpendings(name) {
  await openStore(name);
  await kids.locator('.activity-toggle-btn').click();
  await kids.locator('.activity-popup').waitFor();
  const n = await kids.locator('.activity-popup .pending-item:not(.done):not(.transfer-incoming):not(.transfer-outgoing)').count();
  await kids.locator('.popup-close-btn').click();
  await closeStore();
  return n;
}

let status = 0;
try {
  log('== 0. Kids\' dashboard (unchanged by this PR) and the parent views on piserve\'s data');
  await shot(kids, 'kids-dashboard', false);
  await openStore(E);
  await shot(kids, 'kids-store', false);
  await closeStore();
  for (const name of [E, I]) balances[name] = await until(`${name}'s balance on kids`, () => kidStars(name));
  await everywhere(E, balances[E]);
  await everywhere(I, balances[I]);
  const waiting = await until('phone lists what is waiting (piserve: 4 purchases, 1 star gift)', async () => (await inboxCount(phone)) === 5 && 5);
  await until('badge shows the count on phone and tablet', async () => (await badge(phone)) === waiting && (await badge(tablet)) === waiting);
  await shot(phone, 'phone-1-today');
  await shot(tablet, 'tablet-1-today');

  log('== 1. Rewards: mark one given, revoke another (stars go back)');
  const pendingBefore = await kidsPendingSpendings(E);
  const given = card(phone, E).filter({ hasText: 'Εξαργύρωση' }).first();
  const givenTitle = await given.locator('h3').innerText();
  await given.getByRole('button', { name: 'Δόθηκε' }).click();
  await until('phone and tablet: one fewer waiting', async () => (await inboxCount(phone)) === waiting - 1 && (await inboxCount(tablet)) === waiting - 1);
  await until(`kids: ${E}'s "${givenTitle}" is no longer pending`, async () => (await kidsPendingSpendings(E)) === pendingBefore - 1, 15000);
  const revoked = card(phone, 'Εξαργύρωση').first();
  const revokedCost = num(await revoked.locator('.p-inbox-stars').innerText());
  const revokedKid = (await revoked.locator('.p-who').innerText()).includes(E) ? E : I;
  await confirmTwice(revoked.getByRole('button', { name: /Ακύρωση|Σίγουρα/ }));
  await until('phone: two fewer waiting', async () => (await inboxCount(phone)) === waiting - 2);
  await expectStars(revokedKid, revokedCost);

  log('== 2. Star gift waiting since June: approve it');
  const gift = card(phone, 'Δώρο αστεριών');
  const giftAmount = num(await gift.locator('.p-inbox-stars').innerText());
  await gift.getByRole('button', { name: 'Έγκριση' }).click();
  await expectStars(I, -giftAmount);
  await expectStars(E, giftAmount);

  log('== 3. Kids buy a reward -> it waits on both parent devices');
  await openStore(E);
  const reward = kids.locator('.reward-item:not(.disabled)').first();
  const rewardTitle = await reward.locator('.reward-title').innerText();
  const rewardCost = num(await reward.locator('.reward-cost').innerText());
  await reward.click();
  await sleep(2500); // the purchase celebration
  await closeStore();
  await until(`phone and tablet list "${rewardTitle}" from ${E}`, async () =>
    (await card(phone, rewardTitle).filter({ hasText: E }).filter({ hasText: 'μόλις τώρα' }).count()) > 0 && (await card(tablet, rewardTitle).count()) > 0);
  await expectStars(E, -rewardCost);

  log('== 4. Kids give stars -> parent rejects the gift -> the kid sees it gone, balances unchanged');
  await openStore(E);
  await kids.locator('.transfer-btn').click();
  await kids.locator('.transfer-form select').selectOption({ label: I });
  await kids.locator('.amount-input input').fill('5');
  await kids.locator('.send-transfer-btn').click();
  await sleep(1500);
  await closeStore().catch(() => undefined);
  await until('phone lists the gift', () => visible(phone, '.p-inbox-card', { hasText: `${E} → ${I}` }));
  await shot(phone, 'phone-2-today-waiting', false);
  await confirmTwice(card(phone, `${E} → ${I}`).getByRole('button', { name: /Απόρριψη|Σίγουρα/ }));
  await until('phone and tablet: the gift is gone', async () => (await card(phone, `${E} → ${I}`).count()) === 0 && (await card(tablet, `${E} → ${I}`).count()) === 0);
  await openStore(E);
  await kids.locator('.activity-toggle-btn').click();
  await until('kids: no outgoing gift pending', async () => (await count(kids, '.transfer-outgoing')) === 0);
  await kids.locator('.popup-close-btn').click();
  await closeStore();
  await everywhere(E, balances[E]);
  await everywhere(I, balances[I]);

  log('== 5. Stars by hand: +20, then -5');
  await phone.locator('.p-kid', { hasText: E }).click();
  await phone.locator('.p-chip', { hasText: /^20$/ }).click();
  await shot(phone, 'phone-3-stars-sheet', false);
  await phone.getByRole('button', { name: '+ Προσθήκη 20' }).click();
  await expectStars(E, 20);
  await tablet.locator('.p-kid', { hasText: E }).click();
  await tablet.locator('.p-chip', { hasText: /^5$/ }).click();
  await shot(tablet, 'tablet-3-stars-sheet', false);
  await tablet.getByRole('button', { name: '− Αφαίρεση 5' }).click();
  await expectStars(E, -5);

  log('== 6. Rewards form: add, change a price, delete -> the kids\' store follows');
  await go(phone, 'Ρυθμίσεις');
  await go(tablet, 'Ρυθμίσεις');
  await shot(phone, 'phone-4-settings');
  await shot(tablet, 'tablet-4-settings');
  await phone.getByRole('button', { name: '+ Νέο δώρο' }).click();
  await phone.getByLabel('Όνομα', { exact: true }).fill('Παγωτό');
  await phone.getByLabel('Εικονίδιο', { exact: true }).fill('🍦');
  await phone.getByLabel('Κόστος σε αστέρια').fill('120');
  await shot(phone, 'phone-5-reward-form', false);
  await phone.getByRole('button', { name: 'Αποθήκευση' }).click();
  await openStore(I);
  await until('kids store lists "Παγωτό" ⭐120', () => visible(kids, '.reward-item', { hasText: 'Παγωτό' }));
  await closeStore();
  await tablet.locator('.p-row', { hasText: 'Έξοδος για Κρέπες' }).click();
  await tablet.getByLabel('Κόστος σε αστέρια').fill('300');
  await shot(tablet, 'tablet-5-reward-form', false);
  await tablet.getByRole('button', { name: 'Αποθήκευση' }).click();
  await until('phone shows Κρέπες at 300 (parent -> parent)', () => visible(phone, '.p-row', { hasText: /Κρέπες.*300/s }));
  await openStore(I);
  await until('kids store shows Κρέπες at ⭐300', async () => (await kids.locator('.reward-item', { hasText: 'Κρέπες' }).innerText()).includes('300'));
  await closeStore();
  await phone.locator('.p-row', { hasText: 'Παγωτό' }).click();
  await confirmTwice(phone.getByRole('button', { name: /Διαγραφή|Σίγουρα/ }));
  await openStore(I);
  await until('kids store no longer lists "Παγωτό"', async () => (await count(kids, '.reward-item', { hasText: 'Παγωτό' })) === 0);
  await closeStore();

  log('== 7. Schedule form: the school-morning flow at 07:10 instead of 07:05');
  await phone.locator('.p-row', { hasText: '07:05' }).click();
  await phone.locator('input[type=time]').fill('07:10');
  await shot(phone, 'phone-6-schedule-form', false);
  await phone.getByRole('button', { name: 'Αποθήκευση' }).click();
  await until('phone lists "07:10 Δευ–Παρ"', () => visible(phone, '.p-row', { hasText: '07:10 Δευ–Παρ' }));
  const cron = await until('server config has cron "10 7 * * 1-5"', async () => {
    const s = (await rest('GET', '/admin/data')).schedules.find(x => x.id === 'sch-morning-school');
    return s.cron === '10 7 * * 1-5' && s.cron;
  });
  const next = (await rest('GET', '/debug/schedule')).schedules[0];
  log(`  scheduler: ${cron} -> next run ${next.nextRunLocal}`);

  log('== 8. Chores form: two new chores, available in two minutes (the minute cron makes them)');
  const at = new Date(Date.now() + 120000).toLocaleTimeString('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit' });
  for (const [title, icon, stars] of [['Στρώσε το κρεβάτι', '🛏️', '15'], ['Πότισμα λουλουδιών', '🌻', '10']]) {
    await phone.getByRole('button', { name: '+ Νέα δουλειά' }).click();
    await phone.getByLabel('Όνομα', { exact: true }).fill(title);
    await phone.getByLabel('Εικονίδιο', { exact: true }).fill(icon);
    await phone.getByLabel('Αστέρια', { exact: true }).fill(stars);
    await phone.locator('.p-sheet input[type=time]').fill(at);
    if (stars === '15') await shot(phone, 'phone-7-chore-form', false);
    await phone.getByRole('button', { name: 'Αποθήκευση' }).click();
    await until(`phone lists "${title}"`, () => visible(phone, '.p-row', { hasText: title }));
  }
  log(`  both available daily at ${at}`);
  await until('kids: chore badge (both chores available)', () => visible(kids, '.chores-fab-badge'), 150000);

  log('== 9. Kids do the chores -> parent confirms one (+1 star on top), rejects the other');
  await kids.locator('.chores-fab').click();
  for (const [title, name] of [['Στρώσε το κρεβάτι', E], ['Πότισμα λουλουδιών', I]]) {
    const c = kids.locator('.chore-card', { hasText: title });
    await c.locator('.user-claim-btn', { hasText: name }).click();
    await c.locator('.done-btn').click();
  }
  await go(phone, 'Σήμερα');
  await go(tablet, 'Σήμερα');
  await until('phone and tablet list both chores', async () =>
    (await card(phone, 'Δουλειά').count()) === 2 && (await card(tablet, 'Δουλειά').count()) === 2);
  const bed = card(phone, 'Στρώσε το κρεβάτι');
  await bed.getByRole('button', { name: 'Περισσότερα' }).click();
  await shot(phone, 'phone-8-today-chores', false);
  await bed.getByRole('button', { name: 'Επιβεβαίωση' }).click();
  await until('kids: confirmation toast "+16"', () => visible(kids, '.toast-confirmed', { hasText: '16' }));
  await confirmTwice(card(phone, 'Πότισμα').getByRole('button', { name: /Απόρριψη|Σίγουρα/ }));
  await until('kids: rejection toast', () => visible(kids, '.toast-rejected'));
  await shot(kids, 'kids-chore-toasts', false);
  await kids.locator('.chores-drawer .close-btn').first().click();
  await expectStars(E, 16);
  await everywhere(I, balances[I]);

  log('== 10. Start the school-morning flow now -> alarms on the kids\' dashboard -> progress on the parent');
  await go(phone, 'Ρυθμίσεις');
  await phone.locator('.p-chip', { hasText: '▶ morning-school-flow' }).click();
  await until('kids show both wake-up alarms', async () => (await count(kids, '.global-alarm-container')) >= 1);
  await shot(kids, 'kids-flow-alarms', false);
  await kids.locator('.btn-dismiss-global').first().click();
  await go(phone, 'Σήμερα');
  const runner = await until('phone and tablet show a kid on "Πρωινό · 1/7"', async () => {
    for (const name of [E, I]) {
      if ((await phone.locator('.p-kid', { hasText: name }).innerText()).includes('Πρωινό · 1/7') &&
          (await tablet.locator('.p-kid', { hasText: name }).innerText()).includes('Πρωινό · 1/7')) return name;
    }
  });
  await kids.locator('.inline-player', { hasText: runner }).locator('.btn-done').click();
  await until(`phone shows ${runner} on task 2/7`, async () => (await phone.locator('.p-kid', { hasText: runner }).innerText()).includes('2/7'));
  balances[runner] += 10; // the kids' dock is hidden while routines run; it is checked after they close
  await until(`phone and tablet show ${runner} ⭐${balances[runner]}`, async () =>
    (await parentStars(phone, runner)) === balances[runner] && (await parentStars(tablet, runner)) === balances[runner]);
  await shot(phone, 'phone-9-today-routine', false);
  await shot(tablet, 'tablet-9-today-routine');
  // tidy up: the other alarm, then close the routines
  while (await visible(kids, '.btn-dismiss-global')) { await kids.locator('.btn-dismiss-global').first().click(); await sleep(500); }
  while (await visible(kids, '.btn-exit')) { await kids.locator('.btn-exit').first().click(); await sleep(500); }
  await until('parent: no routine progress shown', async () => (await count(phone, '.p-kid-run')) === 0);
  await everywhere(runner, balances[runner]);

  log('== 11. Raw JSON (advanced): rename a kid; an invalid edit is refused and changes nothing');
  await go(phone, 'Προχωρημένα');
  await go(tablet, 'Προχωρημένα');
  const setJson = async (p, edit) => {
    await p.locator('.monaco-editor').first().waitFor({ timeout: 30000 });
    await p.evaluate(src => {
      const model = window.monaco.editor.getModels()[0];
      const doc = JSON.parse(model.getValue());
      new Function('doc', src)(doc);
      model.setValue(JSON.stringify(doc, null, 2));
    }, edit);
  };
  await setJson(phone, `doc.users.find(u => u.name === '${I}').name = '${I} ✨';`);
  await phone.getByRole('button', { name: 'Αποθήκευση' }).click();
  I = `${I} ✨`;
  balances[I] = balances['Ιφιγένεια'];
  await until(`kids dock shows "${I}" ⭐${balances[I]}`, async () => (await kidStars(I)) === balances[I]);
  await shot(tablet, 'tablet-10-advanced-config');
  await setJson(tablet, `doc.rewards[0].cost = -1;`);
  await tablet.getByRole('button', { name: 'Αποθήκευση' }).click();
  await until('tablet shows why it was refused', () => visible(tablet, '.p-errors', { hasText: 'cost' }));
  await shot(tablet, 'tablet-10b-advanced-invalid');
  const cost0 = (await rest('GET', '/admin/data')).rewards[0].cost;
  log(`  server still has rewards[0].cost = ${cost0}`);
  if (cost0 < 1) throw new Error('invalid config was saved');
  await shot(phone, 'phone-10-advanced-config', false);
  for (const [i, panel] of ['Ασκήσεις (JSON)', 'Κατάσταση (JSON)', 'Αρχεία', 'Καταγραφή'].entries()) {
    await phone.locator('.p-chip', { hasText: panel }).click();
    await tablet.locator('.p-chip', { hasText: panel }).click();
    await sleep(1500);
    const n = `${11 + i}-advanced-${['exercises', 'state', 'uploads', 'log'][i]}`;
    await shot(phone, `phone-${n}`, panel === 'Καταγραφή' ? false : true);
    await shot(tablet, `tablet-${n}`, false);
  }
  const types = (await rest('GET', '/debug/logs')).filter(l => new Date(l.timestamp) >= new Date(t0)).map(l => l.type);
  const seen = ['SPENDING_DONE', 'SPENDING_REVOKED', 'TRANSFER_APPROVED', 'TRANSFER_REJECTED', 'AWARD_STARS', 'CHORE_CONFIRMED', 'CHORE_REJECTED', 'PUSH_HOOK']
    .map(t => `${t} ${types.filter(x => x === t).length}`);
  log(`  action log since the start of this run: ${seen.join(', ')}`);

  log('== 12. A broken data.json on disk: banner on both parents, forms refuse to save over it, kids keep the last valid config');
  const DATA = '/stack/data.json';
  const good = fs.readFileSync(DATA, 'utf-8');
  const replace = text => { fs.writeFileSync(`${DATA}.e2e`, text); fs.renameSync(`${DATA}.e2e`, DATA); };
  replace(good.replace(/}\s*$/, ''));
  await until('phone and tablet show the config error banner', async () => (await visible(phone, '.p-banner')) && (await visible(tablet, '.p-banner')), 15000);
  await go(phone, 'Ρυθμίσεις');
  await phone.locator('.p-row', { hasText: 'Κρέπες' }).click();
  await phone.getByLabel('Κόστος σε αστέρια').fill('1');
  await phone.getByRole('button', { name: 'Αποθήκευση' }).click();
  await until('phone refuses: "Το data.json δεν είναι έγκυρο"', () => visible(phone, '.p-toast.error', { hasText: 'data.json' }));
  await shot(phone, 'phone-17-config-error', false, true);
  await phone.getByRole('button', { name: 'Κλείσιμο' }).click();
  if (fs.readFileSync(DATA, 'utf-8') === good) throw new Error('the broken file was overwritten');
  log('  the broken file on disk is untouched');
  await openStore(E);
  await until('kids store still shows Κρέπες at ⭐300', async () => (await kids.locator('.reward-item', { hasText: 'Κρέπες' }).innerText()).includes('300'));
  await closeStore();
  replace(good);
  await until('banner gone after the fix', async () => !(await visible(phone, '.p-banner')) && !(await visible(tablet, '.p-banner')), 15000);

  log('== 13. History');
  await go(phone, 'Ιστορικό');
  await go(tablet, 'Ιστορικό');
  await until('history lists the rejected gift and the confirmed chore', async () =>
    (await visible(phone, '.p-row.undone', { hasText: 'Απορρίφθηκε' })) && (await visible(phone, '.p-row', { hasText: 'Επιβεβαιώθηκε' })));
  await shot(phone, 'phone-15-history', false);
  await shot(tablet, 'tablet-15-history', false);

  log('== 14. Final balances agree everywhere');
  await go(phone, 'Σήμερα');
  await go(tablet, 'Σήμερα');
  await everywhere(E, balances[E]);
  await everywhere(I, balances[I]);
  const users = await rest('GET', '/users');
  log(`  server: ${users.map(u => `${u.name} ⭐${u.stars}`).join(', ')}`);
  await shot(phone, 'phone-16-today-end');
  log('PASS: every parent task reached the kids\' dashboard, and every kids\' action reached the parent');
} catch (e) {
  status = 1;
  log('FAIL:', e.message);
  for (const [p, n] of [[kids, 'kids'], [phone, 'phone'], [tablet, 'tablet']]) await p.screenshot({ path: `${OUT}/zz-fail-${n}.png` }).catch(() => undefined);
}
await browser.close();
process.exit(status);
