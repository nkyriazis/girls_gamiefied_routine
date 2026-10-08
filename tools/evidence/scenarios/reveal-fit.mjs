// What the held «Η σωστή απάντηση: …» card fits (#72), measured on the card on screen: the numbers behind
// tools/problem-gen/maths/check.ts REVEAL_MAX, REVEAL_PAIR_MAX and REVEAL_PAIRS. Rerun it after any change
// to the card's size (.feedback-overlay.answer in frontend/src/components/AssignmentPlayer.tsx) and move
// the caps to what it finds.
//   tools/evidence/dev.sh clear-runs
//   tools/evidence/dev.sh exercise u2 g3-math-tables-match-a-005     a Γ΄ match in Ιφιγένεια's maths slot, fresh
//   tools/evidence/record.sh tools/evidence/scenarios/reveal-fit.mjs .evidence/<issue>
// It makes her one wrong try over the API (the dev kids are on the forgiving rung, so «Δείξε μου» shows),
// opens the answer at 1280×800, then resizes to 800×480 and 390×844 (the card is sized by the viewport
// alone). At each size it puts test answers into the card's answer span (the same span, font and box),
// counts its line boxes and checks that the card doesn't scroll and «Εντάξει» stays hittable. Out:
// reveal-fit.json and reveal-fit-<w>x<h>.png. The reveal uses the assignment up: set the scene again
// before another run.
import { start, API } from '../kit.mjs';
import fs from 'fs';

const EX = 'g3-math-tables-match-a-005';
const SIZES = [[1280, 800], [800, 480], [390, 844]];
const CAPS = { run: 120, pairLine: 21, pairs: 4 };

const all = await (await fetch(`${API}/api/exercise-assignments`)).json();
const day = all.map(x => x.date).sort().pop();
const a = all.find(x => x.date === day && x.userId === 'u2' && x.exerciseId === EX && !x.extra);
if (!a || a.status !== 'pending') throw new Error(`set the scene first: tools/evidence/dev.sh exercise u2 ${EX}`);
if (a.attempts === 0) {
  await fetch(`${API}/api/exercise-assignments/${a.id}/answer`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answer: [] }),
  });
}

const { page, pause, open, shot, finish, log } = await start('reveal-fit', { video: false });
await open();
await page.locator('.dock-avatar').nth(1).click(); await pause(1500);
await page.locator(`[data-assignment="${a.id}"]`).first().click(); await pause(1500);
await page.locator('.exercise-show').click();
await page.locator('.feedback-overlay.answer').waitFor({ state: 'visible' }); await pause(1000);

const out = { item: EX, caps: CAPS, sizes: {} };
for (const [w, h] of SIZES) {
  await page.setViewportSize({ width: w, height: h }); await pause(800);
  await shot(`reveal-fit-${w}x${h}`);
  out.sizes[`${w}×${h}`] = await page.evaluate(async caps => {
    const span = document.querySelector('.feedback-answer'), text = document.querySelector('.feedback-overlay.answer .feedback-text');
    const ok = document.querySelector('.answer-ok');
    const real = span.textContent;
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const lines = () => new Set([...span.getClientRects()].map(r => Math.round(r.top))).size;
    const scrolls = () => text.scrollHeight > text.clientHeight + 1;
    const okInView = () => { const b = ok.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) === ok; };
    const put = async s => { span.textContent = s; await frame(); return { lines: lines(), scrolls: scrolls(), ok: okInView() }; };
    const NB = ' → ';
    const cs = getComputedStyle(span);
    const m = { real: { text: real, ...(await put(real)) }, font: cs.fontSize, lineHeight: cs.lineHeight };
    // The longest run of Greek words, and of numbers in order, that stays on one line
    const words = 'τριακόσια πενήντα εφτά χιλιάδες διακόσια σαράντα έξι εκατομμύρια οχτακόσια ενενήντα δύο τετρακόσια εξήντα ένα πεντακόσια ογδόντα τρία';
    const nums = Array.from({ length: 12 }, (_, i) => (1234567 + i * 1111111).toLocaleString('el-GR')).join(NB);
    const longest = async src => { let best = 0; for (let n = 5; n <= src.length; n++) { if (src[n] !== ' ' && n !== src.length) continue; if ((await put(src.slice(0, n))).lines === 1) best = n; } return best; };
    m.lineWords = await longest(words);
    m.lineNumbers = await longest(nums);
    // Pair lines: a times table, and numbers in words (the number-words families are multiple choice)
    m.pairLines = {};
    for (const p of ['10 × 10 → 100', 'εξακόσια εξήντα → 660', 'εξακόσια σαράντα εννιά → 649', 'δύο εκατομμύρια δύο χιλιάδες → 2.002.000']) {
      m.pairLines[`${p} (${p.length})`] = (await put(p)).lines;
    }
    // Lines of a times table before the card scrolls or «Εντάξει» leaves the screen
    let fit = 0;
    for (let n = 1; n <= 20; n++) { const r = await put(Array.from({ length: n }, (_, i) => `${i + 2} × 7${NB}${(i + 2) * 7}`).join('\n')); if (r.scrolls || !r.ok || r.lines !== n) break; fit = n; }
    m.linesBeforeScroll = fit;
    // At the caps: a run of long words, ten 7-digit numbers in order, a match of REVEAL_PAIRS lines of REVEAL_PAIR_MAX
    const run = (src, max) => { let s = ''; for (const w of src.split(' ')) { if ((s ? s + ' ' + w : w).length > max) break; s = s ? s + ' ' + w : w; } return s; };
    const longWords = 'πολλαπλασιασμός αφαιρετέος πολλαπλασιαστής διαιρετέος προσθετέος υπολογισμός στρογγυλοποίηση αποτέλεσμα';
    // (21, 21, 20, 20 characters: the longest pair lines the cap allows, in words, the widest letters)
    const pairs = [['εξακόσια εξήντα', 660], ['διακόσια είκοσι', 220], ['εφτακόσια εφτά', 707], ['οχτακόσια οχτώ', 808]]
      .map(([l, r]) => `${l}${NB}${r}`).filter(p => p.length <= caps.pairLine).slice(0, caps.pairs);
    m.atCaps = {};
    for (const [name, s, want] of [
      ['run of long words', run(`${longWords} ${longWords}`, caps.run)],
      ['ten 7-digit numbers in order', Array.from({ length: 10 }, (_, i) => (9876543 - i * 876543).toLocaleString('el-GR')).join(NB)],
      ['match', pairs.join('\n'), pairs.length],
    ]) {
      const r = await put(s);
      m.atCaps[`${name} (${s.length}${want ? '; lines ' + s.split('\n').map(l => l.length).join(', ') : ''})`] = { ...r, fits: !r.scrolls && r.ok && (!want || r.lines === want) };
    }
    await put(real);
    return m;
  }, CAPS);
  log(`${w}×${h}`, JSON.stringify(out.sizes[`${w}×${h}`]));
}
fs.writeFileSync('reveal-fit.json', JSON.stringify(out, null, 1));
const misfits = Object.entries(out.sizes).flatMap(([size, m]) => Object.entries(m.atCaps).filter(([, r]) => !r.fits).map(([k]) => `${size}: ${k}`));
log(misfits.length ? `over the caps' room: ${misfits.join('; ')}` : 'everything at the caps fits at every size');
await page.locator('.answer-ok').click(); await pause(800);
await finish();
