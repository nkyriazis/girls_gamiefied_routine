// #26: the group game (📚). Played before the fix and after it, the same way.
// Scene (from the repo root):
//   tools/evidence/dev.sh stars u1 100 u2 100
//   tools/evidence/dev.sh game u1,u2 math-tp-1,math-mc-1,lang-tf-1 | tee .evidence/26/scene.txt
//   tools/evidence/record.sh .evidence/26/before.mjs
// after.mjs: before.mjs played after the fix, plus the results card at 390×844 and the frames of the last tap.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { start, API, pause as wait } from '../../tools/evidence/kit.mjs';

const out = path.basename(fileURLToPath(import.meta.url), '.mjs');
const sessionId = fs.readFileSync('scene.txt', 'utf-8').match(/game (\S+)/)[1];
const balance = async id => (await (await fetch(`${API}/api/users`)).json()).find(u => u.id === id).stars;
const answer = async (userId, exerciseId, ans) => {
  const r = await fetch(`${API}/api/exercises/sessions/${sessionId}/answer`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, exerciseId, answer: ans }),
  });
  const body = await r.json();
  if (!r.ok) console.log(`[answer] ${userId} ${exerciseId}: ${r.status} ${body.error}`);
  return r.ok ? `+${body.earnedStars}` : `${r.status}`;
};

const { page, caption, tap, pause, open, shot, finish, log } = await start(out);
const pairs = [['5 + 5', '10'], ['3 + 4', '7'], ['8 + 2', '10']];
const matchAll = async () => {
  for (const [l, r] of pairs) {
    await tap(page.locator('.match-item.left', { hasText: l }), 500);
    // The right column pulses while a left item is chosen: never «stable» for Playwright
    await page.locator('.match-item.right:not(.matched)', { hasText: new RegExp(`^${r}$`) }).first().click({ force: true });
    await pause(500);
  }
};
const turn = async () => (await page.locator('.player-puck.active-turn .player-puck-name').textContent())?.trim();

await open();
// The caption at the bottom: at the top it would hide the players' scores
await page.addStyleTag({ content: '#evidence-caption { top: auto !important; bottom: 72px !important; }' });
await pause(1500);
await caption('Ομαδικό παιχνίδι: 3 ερωτήσεις (ζευγάρια, πρόσθεση, σωστό/λάθος), Ηλέκτρα και Ιφιγένεια');
await shot(`${out}-1-start`);
await pause(1500);

// 1. Q1, match-pairs: Ηλέκτρα matches every pair, then it's Ιφιγένεια's turn on the same pairs
await caption('Q1 ζευγάρια: η Ηλέκτρα ταιριάζει όλα τα ζευγάρια');
await matchAll();
await pause(2500);
const open1 = await page.locator('.match-item.left:not([disabled])').count();
log('Q1, turn of', await turn(), '- left items she can tap:', open1);
await caption(`Σειρά της Ιφιγένειας (${await turn()}): κουμπιά που μπορεί να πατήσει: ${open1}`);
await pause(2000);
await shot(`${out}-2-pairs-second-player`);
await pause(1500);
if (open1 === 0) {
  log('u2 answers Q1 by request (stuck on screen):', await answer('u2', 'math-tp-1', pairs.map(([left, right]) => ({ left, right }))));
} else {
  await matchAll();
}
await pause(2500);

// 2. Q2, 5 stars: Ηλέκτρα's right answer sent five times (a second screen, a quick double tap)
const before = await balance('u1');
const replies = [];
for (let i = 0; i < 5; i++) replies.push(await answer('u1', 'math-mc-1', 1));
const after = await balance('u1');
log('u1 five answers to math-mc-1:', replies.join(' '), 'balance', before, '→', after);
await pause(1200);
await caption(`Q2 (5 ⭐): η ίδια σωστή απάντηση της Ηλέκτρας 5 φορές: ${replies.join(' ')} · υπόλοιπό της ${before} → ${after}`);
await pause(2500);
await shot(`${out}-3-paid-five-times`);
await pause(1500);
await caption(`Σειρά: ${await turn()}. Η Ιφιγένεια απαντάει στην Q2`);
await tap(page.locator('.option-btn', { hasText: '27' }), 2800);

// 3. Q3, the last one
const t3 = await turn();
log('Q3, turn of', t3);
await caption(`Q3, η τελευταία: σειρά έχει ${t3}` + (t3 === 'Ηλέκτρα' ? '' : ' (η Ηλέκτρα δεν παίζει: οι παραπάνω απαντήσεις της μέτρησαν εδώ)'));
await pause(2500);
await shot(`${out}-4-last-question`);
// Every player still to answer taps «Σωστό» (after the fix: Ηλέκτρα, then Ιφιγένεια)
for (let i = 0; i < 2 && await page.locator('.tf-btn.true').count() && !await page.locator('.results-screen').count(); i++) {
  log('Q3 answered by', await turn(), 'at', Date.now());
  await tap(page.locator('.tf-btn.true'), 2800);
}
await pause(1000);
const results = await page.locator('.results-screen').count();
log('results screen shown:', results);
await caption(results ? 'Τέλος του παιχνιδιού: «Μπράβο! 🎉» με τα αστέρια του καθενός' : 'Τέλος του παιχνιδιού: πού είναι το «Μπράβο! 🎉» με τα αστέρια;');
await pause(1500);
await shot(`${out}-5-after-the-end`);
await pause(2500);
if (results) {
  // The same results on a phone (390×844): a second screen, no video
  const phone = await start(`${out}-phone`, { size: { width: 390, height: 844 }, video: false });
  await phone.open();
  await wait(2000);
  const fit = await phone.page.evaluate(() => {
    const r = document.querySelector('.results-card')?.getBoundingClientRect();
    return r && { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom),
      scrollWidth: document.documentElement.scrollWidth };
  });
  phone.log('results card at 390×844:', JSON.stringify(fit));
  await phone.shot(`${out}-5-results-390`);
  await phone.finish();

  await caption('«Επιστροφή στο Ταμπλό» κλείνει το παιχνίδι');
  await pause(1200);
  await tap(page.locator('.finish-btn'), 2500);
  log('game still on screen after «Επιστροφή»:', await page.locator('.game-container').count());
  await shot(`${out}-7-back-home`);
}
await pause(1000);
await finish();
