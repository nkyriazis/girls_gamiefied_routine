// End-to-end check of client sync (issue #14): two kids' dashboards (two
// devices) and a parent dashboard, against the prod images (nginx + backend).
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://frontend';
const BACKEND = 'http://backend:3000';
const OUT = '/e2e/shots';
const SIGNAL = '/e2e/signal';
const STACK_DATA = '/stack/data.json';
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

async function mcp(name, args) {
  const res = await fetch(`${BACKEND}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
  });
  const json = await res.json();
  log(`MCP  ${name} ${JSON.stringify(args)} -> ${JSON.stringify(json.result.structuredContent)}`);
  return json.result.structuredContent;
}

async function rest(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json();
  log(`REST ${method} ${path}${body && path !== '/admin/data' ? ' ' + JSON.stringify(body) : ''} -> ${res.status} ${JSON.stringify(json).slice(0, 120)}`);
  return json;
}

const num = t => Number(t.replace(/[^\d]/g, ''));
const kidStars = (p, name) => p.locator('.dock-item', { hasText: name }).locator('.dock-stars').innerText({ timeout: 300 }).then(num);
const parentStars = (p, name) => p.locator('.user-row', { hasText: name }).locator('.stars').innerText({ timeout: 300 }).then(num);
const visible = (p, sel, opts) => p.locator(sel, opts).first().isVisible();

async function shot(page, name) {
  await sleep(700); // let enter animations finish so the screenshot is readable
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log(`  shot ${name}.png`);
}

const browser = await chromium.launch();
async function client(path, label, height = 900) {
  const context = await browser.newContext({ viewport: { width: 1280, height }, locale: 'el-GR', timezoneId: 'Europe/Athens' });
  const page = await context.newPage();
  page.sockets = 0;
  page.on('websocket', () => { page.sockets++; });
  page.on('pageerror', e => log(`PAGE ERROR (${label}):`, e.message));
  await page.goto(BASE + path);
  if (path === '/') await page.locator('.interaction-overlay').click();
  log(`opened ${label} at ${path}`);
  return page;
}

const kidA = await client('/', 'kids dashboard A');
const kidB = await client('/', 'kids dashboard B (another device)');
const parent = await client('/parent', 'parent dashboard', 1100);

// The dock cuts the star count off at the bottom of the screen; the store header shows it.
async function storeShot(page, name, stars, file) {
  await page.locator('.dock-item', { hasText: name }).locator('.dock-avatar').click();
  await until(`store header shows ${name} ⭐${stars}`, async () =>
    num(await page.locator('.store-header .user-balance').innerText({ timeout: 300 })) === stars);
  await shot(page, file);
  await page.getByRole('button', { name: 'Κλείσιμο' }).click();
}

const T = ['Πλύσιμο Δοντιών', 'Πλύσιμο Προσώπου', 'Ντύσιμο', 'Πρωινό']; // the morning routine's tasks
const player = (p, name) => p.locator('.inline-player', { hasText: name });
const alarm = (p, name) => p.locator('.global-alarm-container', { hasText: name });
const taskOf = (p, name) => player(p, name).locator('.task-name').innerText({ timeout: 300 });
const timerOf = (p, name) => player(p, name).locator('.timer').innerText({ timeout: 300 })
  .then(t => { const [m, sec] = t.split(':').map(Number); return m * 60 + sec; });
async function bothShowTask(name, task) {
  await until(`kids A and B show ${name} on "${task}"`, async () => (await taskOf(kidA, name)) === task && (await taskOf(kidB, name)) === task);
}

// Ask the host (run-e2e.sh) to act on the backend container and wait for it.
async function host(command, done, timeout = 30000) {
  if (command) fs.writeFileSync(SIGNAL, command);
  await until(`host: ${done}`, () => fs.readFileSync(SIGNAL, 'utf-8').trim() === done, timeout);
}

async function everywhere(name, stars) {
  await until(`${name} ⭐${stars} on kids A, kids B and parent`, async () =>
    (await kidStars(kidA, name)) === stars && (await kidStars(kidB, name)) === stars && (await parentStars(parent, name)) === stars);
}

try {
  log('== 1. Initial state arrives over the socket on connect');
  await everywhere(E, 0);
  await everywhere(I, 0);
  await shot(kidA, '01-kids-initial');

  log('== 2. MCP change reaches every client');
  await mcp('award_stars', { userId: 'u1', amount: 100 });
  await everywhere(E, 100);
  await shot(parent, '02-parent-after-mcp-award');

  log('== 3. Kids: complete a task -> parent sees the stars');
  await rest('POST', '/hooks/push', { id: 'u1-assign-morning' });
  await until('routine player open on kids A and B (server state)', async () => (await visible(kidA, '.btn-done')) && (await visible(kidB, '.btn-done')));
  await shot(kidA, '03-kids-routine');
  await kidA.locator('.btn-done').click();
  await until(`parent shows ${E} ⭐110`, async () => (await parentStars(parent, E)) === 110);
  await kidB.locator('.btn-exit').click(); // ✕ on one device closes it on both
  await until('routine closed on kids A and B', async () => !(await visible(kidA, '.inline-player')) && !(await visible(kidB, '.inline-player')));
  await everywhere(E, 110);

  log('== 4. Kids: buy a reward -> parent sees it pending; parent marks it done -> kids see it done');
  await kidB.locator('.dock-item', { hasText: E }).locator('.dock-avatar').click();
  await kidA.locator('.dock-item', { hasText: E }).locator('.dock-avatar').click();
  await kidA.locator('.reward-item', { hasText: 'Γλυκό' }).click();
  await until('parent lists the pending spending', () => visible(parent, '.spending-row', { hasText: 'Γλυκό' }));
  await everywhere(E, 80);
  await shot(kidA, '04-kids-store-purchase');
  await shot(parent, '04-parent-pending-spending');
  await until('kids B store shows the activity button', () => visible(kidB, '.activity-toggle-btn'));
  await kidB.locator('.activity-toggle-btn').click();
  await until('kids B activity: Γλυκό pending', () => visible(kidB, '.pending-item:not(.done)', { hasText: 'Γλυκό' }));
  await parent.locator('.spending-row', { hasText: 'Γλυκό' }).getByRole('button', { name: 'Ολοκληρώθηκε' }).click();
  await until('parent: no pending spendings', () => visible(parent, '.spending-list .empty', { hasText: 'Καμία εκκρεμότητα' }));
  await until('kids B activity: Γλυκό moved to history (done)', () => visible(kidB, '.pending-item.done', { hasText: 'Γλυκό' }));
  await shot(kidB, '04-kidsB-spending-done');
  await kidB.locator('.popup-close-btn').click();
  await kidB.getByRole('button', { name: 'Κλείσιμο' }).click();

  log('== 5. Kids: give stars -> parent approves -> both balances update everywhere');
  await kidA.locator('.transfer-btn').click();
  await kidA.locator('.transfer-form select').selectOption('u2');
  await kidA.locator('.amount-input input').fill('10');
  await kidA.locator('.send-transfer-btn').click();
  await until('parent lists the pending transfer', () => visible(parent, '.transfer-row', { hasText: '⭐ 10' }));
  await shot(parent, '05-parent-pending-transfer');
  await parent.locator('.transfer-row', { hasText: '⭐ 10' }).getByRole('button', { name: '✓ Έγκριση' }).click();
  await everywhere(E, 70);
  await everywhere(I, 10);
  await kidA.getByRole('button', { name: 'Κλείσιμο' }).click();
  await storeShot(kidB, I, 10, '05-kidsB-store-after-transfer-approved');

  log('== 6. Chore: REST makes it available -> kids A claims and marks done -> parent confirms -> kids get toast + stars');
  await rest('POST', '/debug/time', { time: '12:00' });
  await until('chore badge on kids A and B', async () => (await visible(kidA, '.chores-fab-badge')) && (await visible(kidB, '.chores-fab-badge')));
  await kidA.locator('.chores-fab').click();
  await kidB.locator('.chores-fab').click();
  await kidA.locator('.user-claim-btn', { hasText: E }).first().click();
  await until(`kids B sees the chore claimed by ${E}`, () => visible(kidB, '.claimed-by', { hasText: E }));
  await kidA.locator('.done-btn').first().click();
  await until('parent lists the chore for confirmation', () => visible(parent, '.chore-row', { hasText: 'Βραδινή Δουλειά' }));
  await shot(kidB, '06-kidsB-chore-attempted');
  await shot(parent, '06-parent-chore-awaiting');
  await parent.locator('.chore-row', { hasText: 'Βραδινή Δουλειά' }).getByRole('button', { name: '✓ Επιβεβαίωση' }).click();
  await until('confirmation toast on kids A and B (CHORE_CONFIRMED event)', async () =>
    (await visible(kidA, '.toast-confirmed', { hasText: '+5' })) && (await visible(kidB, '.toast-confirmed', { hasText: '+5' })));
  await shot(kidA, '06-kids-chore-confirmed');
  for (const p of [kidA, kidB]) await p.locator('.chores-drawer .close-btn').first().click();
  await everywhere(E, 75);

  log('== 7. Config edit (the admin save the parent editor uses) reaches every view');
  const cfg = await rest('GET', '/admin/data');
  cfg.rewards.push({ id: 'rew-e2e', title: 'Βιβλίο E2E', cost: 5, icon: { type: 'emoji', value: '📘' } });
  cfg.users.find(u => u.id === 'u2').name = I = 'Ιφιγένεια ✨';
  cfg.schedules.push({ id: 'sch-e2e', cron: '30 16 * * *', type: 'routine', targetId: 'u2-assign-morning' });
  await rest('POST', '/admin/data', cfg);
  await everywhere(I, 10);
  await until('parent trigger list shows sch-e2e', () => visible(parent, '.trigger-section button', { hasText: 'sch-e2e' }));
  await shot(parent, '07-parent-after-config-edit');
  await kidA.locator('.dock-item', { hasText: E }).locator('.dock-avatar').click();
  await until('kids A store lists the new reward', () => visible(kidA, '.reward-item', { hasText: 'Βιβλίο E2E' }));
  await shot(kidA, '07-kids-store-new-reward');
  await kidA.getByRole('button', { name: 'Κλείσιμο' }).click();

  log('== 8. Invalid data.json on disk: parent shows the error, everyone keeps the last valid config');
  const good = fs.readFileSync(STACK_DATA, 'utf-8');
  const replace = text => { fs.writeFileSync(`${STACK_DATA}.e2e`, text); fs.renameSync(`${STACK_DATA}.e2e`, STACK_DATA); };
  replace(good.replace(/}\s*$/, ''));
  await until('parent shows the config error banner', () => visible(parent, '.validation-banner'), 15000);
  await everywhere(I, 10);
  await shot(parent, '08-parent-config-error');
  replace(good);
  await until('banner gone after the fix', async () => !(await visible(parent, '.validation-banner')), 15000);

  log('== 9. A flow started by the push hook runs on the server; both kids\' dashboards follow it in lockstep');
  await rest('POST', '/hooks/push', { id: 'morning-flow' });
  await until('kids A and B each show both alarms', async () =>
    (await kidA.locator('.global-alarm-container').count()) === 2 && (await kidB.locator('.global-alarm-container').count()) === 2);
  await shot(kidB, '09-kidsB-flow-alarms');
  await alarm(kidA, E).locator('.btn-dismiss-global').click();
  await until(`kids A and B: ${E}'s routine started, ${I}'s alarm still up`, async () =>
    (await player(kidA, E).isVisible()) && (await player(kidB, E).isVisible()) && (await alarm(kidA, I).isVisible()) && (await alarm(kidB, I).isVisible()));
  await alarm(kidB, I).locator('.btn-dismiss-global').click();
  await bothShowTask(E, T[0]);
  await bothShowTask(I, T[0]);
  await player(kidB, E).locator('.btn-done').click(); // on device B
  await bothShowTask(E, T[1]);
  await until(`parent shows ${E} ⭐85`, async () => (await parentStars(parent, E)) === 85);
  log('  both devices tap "done" at the same moment: the task completes once');
  await Promise.all([player(kidA, E).locator('.btn-done').click(), player(kidB, E).locator('.btn-done').click()]);
  await bothShowTask(E, T[2]);
  await sleep(500);
  await until(`parent shows ${E} ⭐95 (one award, not two)`, async () => (await parentStars(parent, E)) === 95);
  await shot(kidA, '09-kidsA-flow-routines');
  await shot(kidB, '09-kidsB-flow-routines');

  log('== 10. Reloading a kids\' dashboard mid-routine resumes it');
  await kidA.reload();
  await kidA.locator('.interaction-overlay').click();
  await bothShowTask(E, T[2]);
  await bothShowTask(I, T[0]);
  const [ta, tb] = [await timerOf(kidA, I), await timerOf(kidB, I)];
  log(`  ${I}'s countdown after the reload: kids A ${ta}s, kids B ${tb}s`);
  if (Math.abs(ta - tb) > 1) throw new Error('countdowns differ');
  await shot(kidA, '10-kidsA-after-reload');

  log('== 11. Kill and restart the backend mid-routine');
  let before = [kidA.sockets, kidB.sockets, parent.sockets];
  await host('kill', 'killed');
  await sleep(2000);
  await bothShowTask(E, T[2]); // last state stays on screen during the outage
  await host(null, 'started', 60000);
  await mcp('award_stars', { userId: 'u2', amount: 7 }); // a change right after the restart
  await until(`parent shows ${I} ⭐17`, async () => (await parentStars(parent, I)) === 17);
  await until('every client opened a new socket', () =>
    kidA.sockets > before[0] && kidB.sockets > before[1] && parent.sockets > before[2]);
  log(`  sockets opened per client (before -> after): ${before.join(',')} -> ${[kidA.sockets, kidB.sockets, parent.sockets].join(',')}`);
  await bothShowTask(E, T[2]);
  await bothShowTask(I, T[0]);
  await player(kidA, E).locator('.btn-done').click(); // the restarted server still runs the routine
  await bothShowTask(E, T[3]);
  await until(`parent shows ${E} ⭐105`, async () => (await parentStars(parent, E)) === 105);
  await shot(kidB, '11-kidsB-after-restart');
  await shot(parent, '11-parent-after-restart');

  log('== 12. Heartbeat: a link that goes silent (backend paused) is noticed and the clients reconnect');
  before = [kidA.sockets, kidB.sockets, parent.sockets];
  await host('pause', 'paused');
  const pausedAt = Date.now();
  await until('every client gave up on the silent socket and opened a new one', () =>
    kidA.sockets > before[0] && kidB.sockets > before[1] && parent.sockets > before[2], 45000);
  log(`  noticed and reconnecting after ${((Date.now() - pausedAt) / 1000).toFixed(1)} s (heartbeat 10 s, stale after 25 s, retry 3 s)`);
  await host('unpause', 'unpaused');
  await mcp('award_stars', { userId: 'u1', amount: 1 });
  await until(`parent shows ${E} ⭐106`, async () => (await parentStars(parent, E)) === 106, 15000);
  await player(kidB, E).locator('.btn-done').click(); // last task
  await until('reward shown on kids A and B', async () =>
    (await visible(kidA, '.reward-overlay')) && (await visible(kidB, '.reward-overlay')));
  await shot(kidA, '12-kidsA-routine-finished');
  await until(`${E}'s routine closed on both after the reward`, async () =>
    !(await player(kidA, E).isVisible()) && !(await player(kidB, E).isVisible()), 10000);
  await player(kidA, I).locator('.btn-exit').click(); // ✕ ends the last routine, so the flow ends
  await until('kids A and B back to the clock', async () =>
    (await visible(kidA, '.clock-container')) && (await visible(kidB, '.clock-container')));
  await everywhere(E, 116);
  await everywhere(I, 17);
  await shot(kidB, '12-kidsB-flow-ended');

  log('PASS: every step converged on all clients');
} catch (err) {
  log('FAIL:', err.message);
  for (const [p, n] of [[kidA, 'kidA'], [kidB, 'kidB'], [parent, 'parent']]) await p.screenshot({ path: `${OUT}/fail-${n}.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
