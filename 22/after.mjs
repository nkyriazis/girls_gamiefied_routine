// #22: a chore on «Δευ Τρί Τετ Παρ» never becomes available. Played before the fix and after it, the same way.
// Scene (from the repo root; the scenario rewrites data.json through the admin API, so keep a copy):
//   cp -p backend/data.json .evidence/22/data.json.orig
//   tools/evidence/dev.sh clear-runs
//   tools/evidence/record.sh .evidence/22/after.mjs
//   rm backend/data.json && cp -p .evidence/22/data.json.orig backend/data.json && cmp backend/data.json .evidence/22/data.json.orig
// Name the output with the file's name (before / after).
//
// Two chores at the same minute, a few seconds ahead, both on today's weekday. The days are worked out from
// today, so any day it runs shows the same shape (before.mjs ran on a Wednesday: 1-5 and 1-3,5):
//   five days in a row, today among them           e.g. «Δευ–Παρ»          M H * * 1-5
//   three days in a row with today, plus one apart  e.g. «Δευ Τρί Τετ Παρ»  M H * * 1-3,5  (as the parent form writes it)
// The real scheduler tick (every minute) decides; nothing is simulated.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { start, API, pause } from '../../tools/evidence/kit.mjs';

const out = path.basename(fileURLToPath(import.meta.url), '.mjs');
const TZ = 'Europe/Athens';
const athens = d => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hour12: false }).format(d);

// The minute the chores are due: at least 50 s ahead, for the parent's part
const due = new Date(Math.ceil((Date.now() + 50_000) / 60_000) * 60_000);
const [hh, mm] = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
  .format(due).split(':').map(Number);
const run = Date.now().toString(36);
const chore = (id, title, emoji, days) => ({
  id: `ev22-${id}-${run}`, title, icon: { type: 'emoji', value: emoji }, defaultStars: 10,
  availabilityCron: `${mm} ${hh} * * ${days}`, expirationHours: 1, category: 'chore',
});
// Today's weekday in Athens, 0 = Sunday, and the form's way of writing days (frontend/src/components/parent/cron.ts)
const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' }).format(due));
const DAY_LABELS = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'], WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
function daysField(days) {
  const sorted = [...days].sort((a, b) => a - b), parts = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j - i >= 2 ? `${sorted[i]}-${sorted[j]}` : sorted.slice(i, j + 1).join(','));
    i = j;
  }
  return parts.join(',');
}
const label = days => WEEK_ORDER.filter(d => days.includes(d)).map(d => DAY_LABELS[d]).join(' ');
const a = Math.min(Math.max(today - 2, 0), 2), run5 = [a, a + 1, a + 2, a + 3, a + 4];
const r = Math.max(today - 2, 0), four = [r, r + 1, r + 2, r + 4 <= 6 ? r + 4 : r - 2];
const weekdays = chore('weekdays', `Πότισμα (${daysField(run5) === '1-5' ? 'Δευ–Παρ' : `${DAY_LABELS[a]}–${DAY_LABELS[a + 4]}`})`, '🪴', daysField(run5));
const fourDays = chore('four', `Στρώσιμο κρεβατιού (${label(four)})`, '🛏️', daysField(four));
if (![run5, four].every(days => days.includes(today)) || !/-/.test(daysField(four)) || !/,/.test(daysField(four))) throw new Error('day lists');

// Only these two chores in the config, so the drawer shows nothing else
const config = await (await fetch(`${API}/api/admin/data`)).json();
const saved = await fetch(`${API}/api/admin/data`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ...config, chores: [weekdays, fourDays] }),
});
if (!saved.ok) throw new Error(`config not saved: ${saved.status} ${await saved.text()}`);

const { page, caption, tap, open, shot, finish, log } = await start(out);
log('due', athens(due), weekdays.availabilityCron, fourDays.availabilityCron);

// 1. The parent's form: four days ticked, and the cron it wrote
await page.goto('http://localhost:5173/parent?view=settings');
await pause(1500);
const row = page.locator('.p-row', { hasText: 'Στρώσιμο κρεβατιού' });
await row.scrollIntoViewIfNeeded();
await caption(`Parent → Ρυθμίσεις: two chores due at ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} today (${athens(new Date()).split(',')[0]})`);
await pause(2500);
await shot(`${out}-parent-list`);
await tap(row, 1200);
await caption(`The form ticks ${label(four)} and writes availabilityCron "${fourDays.availabilityCron}"`);
await pause(2500);
await shot(`${out}-parent-form`);

// 2. The kids' screen, through the due minute and the scheduler's tick
await open();
while (Date.now() < due.getTime() + 15_000) {
  const left = Math.ceil((due.getTime() - Date.now()) / 1000);
  await caption(left > 0
    ? `Kids' screen, ${athens(new Date())}: both chores become available in ${left} s`
    : `${athens(new Date())}: the scheduler has ticked at ${athens(due)}`);
  await pause(1000);
}

// 3. The chores drawer: what became available
await tap(page.locator('.chores-fab'), 1500);
const logs = await (await fetch(`${API}/api/debug/logs`)).json();
const appeared = logs.filter(e => JSON.stringify(e).includes(run) && JSON.stringify(e).includes('CHORE_AVAILABLE'));
const which = c => appeared.some(e => JSON.stringify(e).includes(c.id));
const verdict = [weekdays, fourDays].map(c => `${c.availabilityCron.split(' ')[4]} ${which(c) ? 'available' : 'NOT available'}`).join(' · ');
fs.writeFileSync(`${out}-log.json`, JSON.stringify({ due: due.toISOString(), chores: [weekdays, fourDays], CHORE_AVAILABLE: appeared }, null, 1));
await caption(`🧹 drawer after ${athens(due)}: ${verdict}`);
await pause(3000);
await shot(`${out}-drawer`);
log(verdict);
await finish();
