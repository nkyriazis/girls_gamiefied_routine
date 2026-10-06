// The owl's tours, with her voice (recorded 2026-09-30 for the help owl's PR). An example of a scenario.
//   tools/evidence/record.sh tools/evidence/scenarios/owl-tours.mjs .evidence/owl   (SCENARIO=home|more|problem|marked|sounds, PORTRAIT=1)
// Set the scene first: dev.sh problem u2 g3-world-012; dev.sh problem u1 e5-gen-trip-costs-019; dev.sh clear-runs; dev.sh plain;
// and POST /api/help/reset, so every screen is new to them.
import { start, API } from '../kit.mjs';

const scenario = process.env.SCENARIO ?? 'home', portrait = process.env.PORTRAIT;
const out = `voice-${scenario}${portrait ? '-portrait' : ''}`;
const { page, caption, tap, pause, listen, open, finish } = await start(out, portrait ? { size: { width: 820, height: 1180 } } : {});
const readTour = async (per = 3000, during = {}) => {
  for (let i = 0; i < 20; i++) {
    if (during[i]) await during[i](); else await listen();
    const next = page.locator('.driver-popover-next-btn');
    if (!(await next.count())) return;
    await next.click();
  }
};
const owl = () => page.locator('.help-btn');
const check = async (wait = 2000) => { await page.locator('.problem-check').click(); await pause(wait); };

await open();

if (scenario === 'home') {
  await caption('First time on this screen: the owl wiggles and offers to show');
  await pause(5000);
  await caption('She taps it: a tour of the home screen');
  await tap(page.locator('.help-offer'), 400);
  await readTour(3200);
  await caption('Played once: the owl calms down (still there, with a “?”)');
  await pause(3000);
  await caption('Her own screen is new: the owl offers again');
  await tap(page.locator('.dock-avatar').nth(1), 4500);
  await tap(owl(), 400);
  await caption('What this screen does, widget by widget');
  await readTour(3000, {
    1: async () => {
      await pause(1800);
      await caption('🔇 hushes the owl (this device remembers)');
      await tap(page.locator('.help-sound'), 1800);
      await caption('🔊 and she speaks again, from the start');
      await tap(page.locator('.help-sound'), 400);
      await listen();
    },
    2: async () => {
      await listen(300);
      await caption('Tap the owl in the bubble: she says it again');
      await page.locator('.driver-popover .help-owl').click({ force: true }); await pause(400);
      await listen();
      await caption('What this screen does, widget by widget');
    },
  });
  await tap(page.locator('.store-card > .close-btn'), 1200);
  await caption('The chores drawer has its own tour');
  await tap(page.locator('.chores-fab'), 3500);
  await tap(owl(), 400);
  await readTour(3000);
  await caption('A tap outside the bubble also moves on; ✕ stops');
  await pause(2500);
} else if (scenario === 'more') {
  await tap(page.locator('.dock-avatar').nth(1), 2500);
  await caption('A popup on her screen has its own tour: giving stars');
  await tap(page.locator('.transfer-btn'), 2500);
  await tap(owl(), 400);
  await readTour(3000);
  await caption('She sends her sister a star, as the owl said');
  await page.locator('.transfer-dialog select').selectOption({ index: 1 }); await pause(700);
  await tap(page.locator('.send-transfer-btn'), 3200);
  await caption('Now there is activity: its popup has a tour too');
  await tap(page.locator('.activity-toggle-btn'), 2500);
  await tap(owl(), 400);
  await readTour(3400);
  await caption('A gift that waits can be taken back');
  await tap(page.locator('.cancel-transfer-btn').first(), 1500);
  await tap(page.locator('.activity-popup .popup-close-btn'), 1000);
  await caption('A plain exercise: how to answer this kind, and the first time, the frame');
  const a = (await (await fetch(`${API}/api/exercise-assignments`)).json())
    .find(x => x.userId === 'u2' && x.exercise?.type === 'multiple-choice');
  await tap(page.locator(`.store-card [data-assignment="${a.id}"]`), 2500);
  await tap(owl(), 400);
  await readTour(3000);
  await tap(page.locator('.exit-game-btn'), 1200);
  await tap(page.locator('.store-card > .close-btn'), 1200);
  await caption('The group game: its setup has a tour too');
  await tap(page.locator('.exercise-fab'), 2500);
  await tap(owl(), 400);
  await readTour(3000);
} else if (scenario === 'problem' || scenario === 'marked') {
  const u = scenario === 'problem' ? 1 : 0;
  const a = (await (await fetch(`${API}/api/exercise-assignments`)).json())
    .find(x => x.userId === `u${u + 1}` && x.exercise?.type === 'problem' && !x.extra);
  const ex = a.exercise;
  await tap(page.locator('.dock-avatar').nth(u), 2200);
  await caption(scenario === 'problem' ? 'Ιφιγένεια (reading rung: paint all) opens a problem' : 'Ηλέκτρα (reading rung: marked phrases) opens a problem');
  await tap(page.locator(`.store-card [data-assignment="${a.id}"]`), 1000);
  await caption('The owl moves into the header and offers to show');
  await pause(4000);
  await tap(owl(), 400);
  await caption('First problem: the four phases, the story, then what this step needs');
  await readTour(3400);

  if (scenario === 'problem') {
    const T = ex.steps.find(s => s.kind === 'paint').targets;
    const center = async i => { const b = await page.locator(`.paint-word[data-w="${i}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const stroke = async (from, to) => {
      const first = await center(from);
      await page.mouse.move(first.x, first.y, { steps: 6 }); await page.mouse.down();
      for (let i = from + 1; i <= to; i++) { const c = await center(i); await page.mouse.move(c.x, c.y, { steps: 5 }); await pause(90); }
      await page.mouse.up(); await pause(500);
    };
    const brush = async name => { await tap(page.locator('.tag-brush', { hasText: name }), 450); };
    await caption('She paints the way the owl showed');
    await brush('Το ξέρω'); for (const t of T.filter(t => t.role === 'known')) await stroke(t.span[0], t.span[1]);
    await brush('Το ψάχνω'); for (const t of T.filter(t => t.role === 'sought')) await stroke(t.span[0], t.span[1]);
    await brush('Δεν χρειάζεται'); for (const t of T.filter(t => t.role === 'extra')) await stroke(t.span[0], t.span[1]);
    await check(2600);
    await caption('A new kind of step: the owl offers again («!»)');
    await pause(3500);
    await tap(owl(), 400);
    await caption('Only this step’s widgets now: the intro was played already');
    await readTour(3400);
    const chip = v => page.locator('.calc-chip').filter({ hasText: new RegExp(`^${v}(\\s|$)`) }).first();
    const key = k => page.locator('.calc-key').filter({ hasText: new RegExp(`^${/\d/.test(k) ? k : '\\' + k}$`) }).first();
    const line = async (x, op, y, r) => {
      await tap(chip(x), 450); await tap(page.locator('.calc-key.op', { hasText: op }), 400); await tap(chip(y), 450);
      for (const d of String(r)) await tap(key(d), 250);
      await check(2600);
    };
    await caption('She works it out');
    await line(55, '−', 37, 18);
    await line(18, ':', 6, 3);
    await caption('The check step: the owl offers; she knows this one and just answers');
    await pause(3000);
    await tap(page.locator('.choice-btn').nth(ex.steps[2].correctIndex), 700);
    await check(3000);
  } else {
    await caption('She taps the phrases, as the owl showed');
    const phrases = page.locator('.story-phrase.tappable');
    const roles = [...ex.story.matchAll(/\[[^\]|]+\|(known|sought|extra)\]/g)].map(m => m[1]);
    await tap(page.locator('.tag-brush', { hasText: 'Το ξέρω' }), 400);
    for (let i = 0; i < roles.length; i++) if (roles[i] === 'known') await tap(phrases.nth(i), 450);
    await tap(page.locator('.tag-brush', { hasText: 'Το ψάχνω' }), 400);
    for (let i = 0; i < roles.length; i++) if (roles[i] === 'sought') await tap(phrases.nth(i), 450);
    await check(2600);
    await caption('Filling numbers is new: the owl offers again');
    await pause(3500);
    await tap(owl(), 400);
    await readTour(3400);
    const rows = ex.steps[1].rows;
    for (let i = 0; i < rows.length; i++) {
      await tap(page.locator('.numbers-box').nth(i), 350);
      for (const d of String(rows[i].answer)) await tap(page.locator('.numbers-key').filter({ hasText: new RegExp(`^${d}$`) }), 230);
    }
    await check(2600);
    await caption('Choosing is new too; the owl waits in the header if she wants it');
    await pause(3000);
    await tap(page.locator('.choice-btn').nth(ex.steps[2].correctIndex), 700);
    await check(3000);
  }
}
if (scenario === 'sounds') {
  const mine = (await (await fetch(`${API}/api/exercise-assignments`)).json()).filter(x => x.userId === 'u2' && !x.extra);
  await caption('Every touch has its sound: her screen opens with a whoosh');
  await tap(page.locator('.dock-avatar').nth(1), 2200);
  if (await page.locator('.reward-item.disabled').count()) {
    await caption('A reward she can’t afford yet: a soft “not yet”');
    await tap(page.locator('.reward-item.disabled').first(), 1500);
  }
  const mc = mine.find(x => x.exercise?.type === 'multiple-choice');
  if (mc && mc.status !== 'completed') {
    await caption('An exercise: a wrong answer is a gentle “uh-oh”…');
    await tap(page.locator(`.store-card [data-assignment="${mc.id}"]`), 2200);
    await tap(page.locator('.option-btn').nth(mc.exercise.correctIndex === 0 ? 1 : 0), 2600);
    await caption('…the right one sparkles, and her stars jingle in');
    await tap(page.locator('.option-btn').nth(mc.exercise.correctIndex), 3200);
  }
  const tf = mine.find(x => x.exercise?.type === 'true-false');
  if (tf && tf.status !== 'completed') {
    await caption('True or false: choosing, then the result');
    await tap(page.locator(`.store-card [data-assignment="${tf.id}"]`), 2200);
    await tap(page.locator(tf.exercise.correctValue ? '.tf-btn.true' : '.tf-btn.false'), 3200);
  }
  await caption('Giving stars: + and − tick up and down, sending flies away');
  await tap(page.locator('.transfer-btn'), 1500);
  await page.locator('.transfer-dialog select').selectOption({ index: 1 }); await pause(900);
  await tap(page.locator('.amount-btn').nth(1), 600);
  await tap(page.locator('.amount-btn').nth(1), 600);
  await tap(page.locator('.amount-btn').nth(0), 900);
  await tap(page.locator('.send-transfer-btn'), 2600);
  await caption('…and taking it back');
  await tap(page.locator('.activity-toggle-btn'), 1500);
  await tap(page.locator('.cancel-transfer-btn').first(), 1500);
  await tap(page.locator('.activity-popup .popup-close-btn'), 1000);
  await tap(page.locator('.store-card > .close-btn'), 1500);
  await caption('The group game: picking players and subjects');
  await tap(page.locator('.exercise-fab'), 2200);
  const players = page.locator('.player-select-item');
  for (let i = 0; i < await players.count(); i++) await tap(players.nth(i), 500);
  await tap(players.nth(0), 500); await tap(players.nth(0), 500);
  await tap(page.locator('.category-chip').first(), 600);
  await tap(page.locator('.counter-controls button').nth(1), 450);
  await tap(page.locator('.counter-controls button').nth(0), 700);
  await caption('Start: each question with its own sounds');
  await tap(page.locator('.start-game-btn'), 3000);
  for (let q = 0; q < 3; q++) {
    const opt = page.locator('.option-btn, .tf-btn.true');
    const key = page.locator('.numpad-key');
    if (await key.count()) {
      await caption('A keypad: digits tick, ⌫ takes one back');
      for (const k of ['1', '2', '⌫', '3']) await tap(key.filter({ hasText: new RegExp(`^${k}$`) }).first(), 350);
      await tap(key.filter({ hasText: 'OK' }), 2600);
    } else if (await opt.count()) {
      await tap(opt.first(), 2800);
    } else {
      await pause(1500);
    }
  }
  await tap(page.locator('.exit-game-btn'), 1500);
}
await caption('Done');
await finish();
