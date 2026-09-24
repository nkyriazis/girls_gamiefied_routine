// Issue #42 evidence. Run: docker run --rm --network host -e URL=http://localhost:8080/ -e OUT=/w/out -v $PWD:/w -w /w mcr.microsoft.com/playwright:v1.55.0-noble node trace-close.js
// (needs `npm i playwright@1.55.0` in the mounted dir). Writes per-overlay traces and summary.json.
// In-page frame tracer: samples every overlay element once per rendered frame, AFTER all rAF
// callbacks (framer's included) have run, i.e. the state that gets painted. Also records every
// style-attribute mutation and mount/unmount via MutationObserver. Cannot skip frames.
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL, OUT = process.env.OUT;
const which = (process.env.WHICH || 'store,setup,chores,bonus,daily,assignment,game,alarm,routine').split(',');
const W = '.store-overlay,.store-card,.setup-overlay,.setup-card,.chores-backdrop,.chores-drawer,.exercises-backdrop,.exercises-drawer,.assignment-player,.game-container,.routine-slot';
const post = (p, b) => `fetch('/api${p}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(b)})})`;
const sc = {
  store:  { open: `document.querySelector('.dock-avatar').click()`, ready: '.store-card', close: `document.querySelector('.store-overlay').click()` },
  setup:  { open: `document.querySelector('.exercise-fab').click()`, ready: '.setup-card', close: `document.querySelector('.setup-overlay .close-btn-circle').click()` },
  chores: { open: `document.querySelector('.chores-fab').click()`, ready: '.chores-drawer', close: `document.querySelector('.chores-backdrop').click()` },
  bonus:  { open: `document.querySelector('.bonus-fab').click()`, ready: '.chores-drawer', close: `document.querySelector('.chores-backdrop').click()` },
  daily:  { open: `document.querySelector('.daily-exercises-fab').click()`, ready: '.exercises-drawer', close: `document.querySelector('.exercises-backdrop').click()` },
  assignment: { open: `document.querySelector('.daily-exercises-fab').click(); setTimeout(()=>document.querySelector('.assignment-card:not(:disabled)')?.click(), 900)`, ready: '.assignment-player', close: `document.querySelector('.assignment-player .exit-game-btn').click()`, after: `document.querySelector('.exercises-backdrop')?.click()` },
  game:   { open: `(async()=>{const u=await (await fetch('/api/users')).json(); const c=await (await fetch('/api/exercises/categories')).json(); await ${post('/exercises/sessions', '__B__').replace('"__B__"', '{playerIds:[u[0].id],categories:[(c[0]||{}).id].filter(Boolean),totalRounds:1,questionsPerRound:1}')};})()`, ready: '.game-container', close: `document.querySelector('.game-container .exit-game-btn').click()` },
  alarm:  { open: post('/hooks/push', { id: 'u1-morning-flow' }), ready: '.btn-dismiss-global', close: `document.querySelector('.btn-dismiss-global').click()`, after: `document.querySelectorAll('.btn-exit').forEach(b=>b.click())` },
  routine:{ open: post('/hooks/push', { id: 'morning-flow' }), ready: '.btn-exit', close: `document.querySelector('.btn-exit').click()`, after: `document.querySelectorAll('.btn-exit').forEach(b=>b.click())` },
};
(async () => {
  const browser = await chromium.launch({ channel: 'chromium', args: (process.env.ARGS||'').split(' ').filter(Boolean) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript((W) => {
    const T = window.__T = { on: false, f: 0, rows: [], muts: [], cancels: [], phase: 'task' };
    const tag = e => e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : e.tagName;
    const ids = new WeakMap(); let nid = 0; const idOf = e => { if (!ids.has(e)) ids.set(e, ++nid); return ids.get(e); };
    const snap = () => [...document.querySelectorAll(W)].map((e) => { const i = idOf(e); const c = getComputedStyle(e);
      return { el: tag(e) + '#' + i, op: +(+c.opacity).toFixed(4), inl: e.style.opacity, tf: c.transform, vis: c.visibility, dis: c.display, waapi: e.getAnimations().length }; });
    // Sample in a ResizeObserver callback: per the HTML event loop these run in every rendering update
    // AFTER all requestAnimationFrame callbacks (framer-motion's included) and style/layout, right
    // before paint -- i.e. exactly the state that gets painted in that frame.
    const sentinel = document.createElement('div'); sentinel.style.cssText = 'position:fixed;left:-10px;top:0;width:1px;height:1px;pointer-events:none';
    let flip = false;
    const pp = new MessageChannel(); pp.port1.onmessage = () => { T.phase = 'between-frames (after paint, before next rAF)'; };
    new ResizeObserver(() => { T.phase = 'pre-paint (after rAF+layout, before paint)'; pp.port2.postMessage(0); if (T.on) T.rows.push({ f: T.f, t: +(performance.now() - T.t0).toFixed(1), els: snap() }); }).observe(sentinel);
    const loop = () => { T.f++; T.phase = 'rAF'; flip = !flip; sentinel.style.width = flip ? '2px' : '1px'; requestAnimationFrame(loop); };
    const start = () => { document.documentElement.appendChild(sentinel); requestAnimationFrame(loop); };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
    // Record the element's state immediately after framer-motion cancels a finished WAAPI animation
    // (this is when the animation's fill stops applying), and which frame phase that happened in.
    const origCancel = Animation.prototype.cancel;
    Animation.prototype.cancel = function () { origCancel.call(this); const e = this.effect && this.effect.target;
      if (T.on && e && e.matches && e.matches(W)) T.cancels.push({ f: T.f, phase: T.phase, el: tag(e) + '#' + idOf(e), opAfterCancel: +(+getComputedStyle(e).opacity).toFixed(4), inline: e.style.opacity }); };
    new MutationObserver(ms => { if (!T.on) return; for (const m of ms) {
      if (m.type === 'attributes' && m.target.matches?.(W)) T.muts.push({ f: T.f, t: +(performance.now() - T.t0).toFixed(1), el: tag(m.target), style: m.target.getAttribute('style') });
      for (const n of m.addedNodes) if (n.matches?.(W) || n.querySelector?.(W)) T.muts.push({ f: T.f, el: tag(n), added: true });
      for (const n of m.removedNodes) if (n.matches?.(W) || n.querySelector?.(W)) T.muts.push({ f: T.f, el: tag(n), removed: true }); } })
      .observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  }, W);
  await page.goto(URL); await page.waitForTimeout(3000);
  if (process.env.THROTTLE) { const c = await page.context().newCDPSession(page); await c.send('Emulation.setCPUThrottlingRate', { rate: +process.env.THROTTLE }); }
  if (await page.locator('.interaction-overlay').count()) await page.locator('.interaction-overlay').click();
  const clean = async () => { for (let i = 0; i < 6 && await page.locator('.btn-exit, .btn-dismiss-global').count(); i++) { await page.locator('.btn-dismiss-global, .btn-exit').first().click(); await page.waitForTimeout(900); } };
  await clean();
  fs.mkdirSync(OUT, { recursive: true }); const summary = {};
  for (const name of which) {
    const s = sc[name];
    await page.evaluate(s.open);
    try { await page.waitForSelector(s.ready, { timeout: 5000 }); } catch { console.log(`== ${name}: could not open`); summary[name] = 'n/a'; await clean(); continue; }
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const T = window.__T; T.rows = []; T.muts = []; T.cancels = []; T.t0 = performance.now(); T.f0 = T.f; T.on = true; });
    await page.evaluate(s.close);
    await page.waitForTimeout(1500);
    const T = await page.evaluate(() => { window.__T.on = false; return window.__T; });
    // per element: opacity series; flash = opacity rises again by >0.05 after having fallen, while mounted
    const series = {};
    for (const r of T.rows) for (const e of r.els) (series[e.el] ||= []).push({ f: r.f - T.f0, t: r.t, ...e });
    const flashes = [];
    for (const [el, ser] of Object.entries(series)) { let min = 1; for (const p of ser) { if (p.op > min + 0.05) { flashes.push(`${el} frame ${p.f} (${p.t}ms): opacity ${min} -> ${p.op} (inline=${p.inl}, waapi=${p.waapi})`); } min = Math.min(min, p.op); } }
    summary[name] = flashes.length ? flashes : 'no flash';
    fs.writeFileSync(`${OUT}/${name}.json`, JSON.stringify({ series, muts: T.muts, cancels: T.cancels }, null, 1));
    summary[name] = { painted: summary[name], cancels: T.cancels };
    for (const c of T.cancels) console.log(`  cancel(): ${c.el} frame ${c.f - T.f0} phase=${c.phase} -> computed opacity right after cancel = ${c.opAfterCancel} (inline style ${c.inline})`);
    console.log(`== ${name}: ${flashes.length ? 'FLASH\n  ' + flashes.slice(0,3).join('\n  ') + (flashes.length>3?`\n  (+${flashes.length-3} more)`:'') : 'no flash'}`);
    for (const [el, ser] of Object.entries(series)) console.log(`  ${el}: ` + ser.map(p => `${p.f}:${p.op}${p.waapi ? '' : '*'}`).join(' '));
    if (s.after) await page.evaluate(s.after);
    await page.waitForTimeout(1200); await clean();
  }
  fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 1));
  await browser.close();
})();
