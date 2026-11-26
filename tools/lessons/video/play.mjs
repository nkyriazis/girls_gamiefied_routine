// Plays a lesson the way a child would, for a video you can follow: a visible finger goes to what she taps and
// rests there a moment, she listens to the owl to the end, thinks before answering, and gets a few wrong on purpose
// (`mistakes`: step index → 1 wrong try, or 2: her tries run out and the answer is shown). Answers come from the
// lesson's own lesson.json, so the scenario plays whatever the package holds.
import fs from 'node:fs';
import { pause } from '../../evidence/kit.mjs';

export function lessonPlayer(ctx, packageDir, { mode = 'listen', profile = 'plain', mistakes = {}, captions = {}, ear = [], words = [], simpler = [] } = {}) {
  const { page, caption } = ctx;
  page.on('crash', () => console.log('PAGE CRASHED'));
  page.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()); });
  const lesson = JSON.parse(fs.readFileSync(`${packageDir}/lesson.json`, 'utf8'));

  // The finger: a soft dot that glides to a target, presses, and stays where it was
  async function finger() {
    await page.evaluate(() => {
      if (document.getElementById('ev-finger')) return;
      const f = document.createElement('div');
      f.id = 'ev-finger';
      f.style.cssText = 'position:fixed;left:640px;top:760px;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;' +
        'background:rgba(255,255,255,0.55);border:3px solid rgba(255,255,255,0.95);box-shadow:0 2px 10px rgba(0,0,0,0.5);' +
        'z-index:2147483646;pointer-events:none;transition:left .7s cubic-bezier(.3,.7,.3,1),top .7s cubic-bezier(.3,.7,.3,1),transform .15s';
      document.body.appendChild(f);
    });
  }
  async function touch(locator, { rest = 450, after = 700, force = false } = {}) {
    await finger();
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox();
    await page.evaluate(([x, y]) => { const f = document.getElementById('ev-finger'); f.style.left = `${x}px`; f.style.top = `${y}px`; },
      [box.x + box.width / 2, box.y + box.height / 2]);
    await pause(750 + rest);
    await page.evaluate(() => { document.getElementById('ev-finger').style.transform = 'scale(0.7)'; });
    await locator.click({ force });
    await pause(150);
    await page.evaluate(() => { document.getElementById('ev-finger').style.transform = 'scale(1)'; });
    await pause(after);
  }
  // Until the owl has said everything it started (one clip after another, a short gap between)
  async function owlDone(max = 120_000) {
    const t0 = Date.now();
    let quiet = 0;
    while (Date.now() - t0 < max) {
      const playing = await page.evaluate(() => !!window.__playing && !window.__playing.paused && !window.__playing.ended);
      quiet = playing ? 0 : quiet + 1;
      if (quiet >= 4) return;
      await pause(250);
    }
  }
  const wordCount = text => text.split(/\s+/).length;
  const next = name => page.locator('.lp-next', { hasText: name });

  async function wrongFor(q, i) {
    switch (q.type) {
      case 'multiple-choice': return touch(page.locator('.option-btn', { hasText: q.options[(q.correctIndex + 1 + i) % q.options.length] }));
      case 'true-false': return touch(page.locator(q.correctValue ? '.tf-btn.false' : '.tf-btn.true'));
      case 'find-sentence': {
        const n = await page.locator('.lp-sentence.pick').count();
        const wrong = [...Array(n).keys()].filter(k => !q.sentences.includes(k))[i];
        return touch(page.locator('.lp-sentence.pick').nth(wrong));
      }
      case 'spot': return touch(page.locator('.lp-spot-region').nth([...q.regions.keys()].filter(k => k !== q.correct)[i]));
      default: throw new Error(`no planned mistake for ${q.type}`);
    }
  }
  async function right(q) {
    switch (q.type) {
      case 'multiple-choice': return touch(page.locator('.option-btn', { hasText: q.options[q.correctIndex] }));
      case 'true-false': return touch(page.locator(q.correctValue ? '.tf-btn.true' : '.tf-btn.false'));
      case 'find-sentence': return touch(page.locator('.lp-sentence.pick').nth(q.sentences[0]));
      case 'spot': return touch(page.locator('.lp-spot-region').nth(q.correct));
      case 'fill-blank':
        for (const a of q.correctAnswers) await touch(page.locator('.fb-word').filter({ hasText: new RegExp(`^\\s*${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first(), { after: 400 });
        return touch(page.locator('.fb-check'));
      case 'sort':
        for (let i = 0; i < q.items.length; i++) await touch(page.locator('.lp-sort-row').nth(i).locator('.lp-sort-bin').nth(q.items[i].bin), { rest: 250, after: 350 });
        return touch(page.locator('.lp-check'));
      case 'match-pairs':
        for (const p of q.pairs) {
          await touch(page.locator('.match-item.left', { hasText: p.left }), { after: 300 });
          await touch(page.locator('.match-item.right', { hasText: p.right }), { after: 400, force: true });
        }
        return touch(page.locator('.match-check'));
      case 'ordering': {
        await finger();
        for (let i = 0; i < q.items.length; i++) {
          const items = page.locator('.reorder-item');
          const from = await items.filter({ hasText: q.items[i].content }).boundingBox();
          const to = await items.nth(i).boundingBox();
          if (Math.abs(from.y - to.y) < 4) continue;
          const sx = from.x + 40, sy = from.y + from.height / 2, ty = to.y + to.height / 2 - (to.y < from.y ? 8 : -8);
          await page.evaluate(([x, y]) => { const f = document.getElementById('ev-finger'); f.style.left = `${x}px`; f.style.top = `${y}px`; }, [sx, sy]);
          await pause(900);
          await page.evaluate(() => { const f = document.getElementById('ev-finger'); f.style.transition = 'none'; });
          await page.mouse.move(sx, sy);
          await page.mouse.down();
          for (let k = 1; k <= 20; k++) {
            const y = sy + (ty - sy) * k / 20;
            await page.mouse.move(sx, y);
            await page.evaluate(([x, yy]) => { const f = document.getElementById('ev-finger'); f.style.left = `${x}px`; f.style.top = `${yy}px`; }, [sx, y]);
            await pause(35);
          }
          await page.mouse.up();
          await page.evaluate(() => { const f = document.getElementById('ev-finger'); f.style.transition = 'left .7s cubic-bezier(.3,.7,.3,1),top .7s cubic-bezier(.3,.7,.3,1),transform .15s'; });
          await pause(600);
        }
        return touch(page.locator('.submit-order-btn'));
      }
    }
  }

  async function play() {
    for (let i = 0; i < lesson.script.length; i++) {
      const s = lesson.script[i];
      if (s.for && s.for !== profile) continue;   // not on her path: the player passes it over
      console.log(`[step ${i}] ${s.do}${s.piece ? ' ' + s.piece : ''}`);
      if (captions[i]) await caption(captions[i]);
      await page.locator('.lp-stage').first().waitFor();
      await pause(500);
      switch (s.do) {
        case 'intro': await pause(3500); await touch(next('Ξεκίνα')); break;
        case 'choose': await pause(2500); await touch(page.locator('.lp-choice').nth(s.options.findIndex(o => o.value === mode)), { rest: 900 }); break;
        case 'move':
          await owlDone(); await pause(s.warmup ? 4000 : 3000); await touch(next('Το έκανα')); break;
        case 'read': {
          const piece = lesson.pieces.find(p => p.id === s.piece);
          if (mode === 'listen') await owlDone();
          else {
            await pause(Math.min(9000, 1500 + wordCount(piece.sentences.join(' ')) * 180));
            if (ear.includes(i)) { await touch(page.locator('.lp-ear').nth(1), { after: 300 }); await owlDone(); }
          }
          await pause(1200);
          // She checks a hard word, and asks for a sentence said more simply
          if (words.includes(i) && await page.locator('.lp-hard').count()) {
            await touch(page.locator('.lp-hard').first(), { after: 400 }); await owlDone(); await pause(1500);
          }
          if (simpler.includes(i) && await page.locator('.lp-easy-btn').count()) {
            await touch(page.locator('.lp-easy-btn').first(), { after: 400 }); await owlDone(); await pause(2000);
          }
          await touch(next('Διάβασα'));
          break;
        }
        case 'ask': {
          const q = s.question;
          if (mode === 'listen') await owlDone(); else await pause(1500 + wordCount('question' in q ? q.question : q.prompt ?? '') * 150);
          if (s.think === true || s.think === profile) { await pause(3000); await touch(next('Το σκέφτηκα')); await pause(800); }
          const tries = mistakes[i] ?? 0;
          for (let k = 0; k < tries; k++) { await pause(900); await wrongFor(q, k); await pause(2600); }
          if (tries >= 2) { await pause(1500); await touch(page.locator('.lp-verdict .lp-next')); }
          else { await pause(700); await right(q); }
          await pause(s.star ? 2600 : 1400);
          break;
        }
        case 'book': {
          await owlDone(); await pause(2500);
          const n = await page.locator('.lp-book-nav').count();
          if (s.when === 'before') {
            await touch(page.locator('.lp-book-page'), { rest: 300, after: 2500 });   // zoom in on the title
            await touch(page.locator('.lp-book-page'), { after: 1200 });
            if (n) { await touch(page.locator('.lp-book-nav').last(), { after: 3000 }); }
          } else {
            await pause(2000);
            if (n) { await touch(page.locator('.lp-book-nav').last(), { after: 2500 }); }
          }
          await touch(next('Συνέχεια'));
          break;
        }
        case 'explain': await owlDone(); await pause(5000); await touch(next('Το εξήγησα')); await pause(2400); break;
        case 'end': await pause(4500); break;
      }
    }
  }
  return { lesson, play, touch, owlDone, finger };
}
