// Issue #42 evidence: samples the overlay at the start of every frame (rAF) and records a CDP screencast
// (everyNthFrame=1) while it closes. Env: URL, OUT, WHICH=store,setup, CHANNEL=chromium, ARGS='--enable-gpu ...'.
// Needs playwright@1.55.0 and pngjs.
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const fs = require('fs');
const URL = process.env.URL || 'http://host.docker.internal:8142/';
const OUT = process.env.OUT || '/w/out';
const which = (process.env.WHICH || 'store').split(',');

function lum(buf) { const p = PNG.sync.read(buf); let s = 0, n = 0;
  for (let i = 0; i < p.data.length; i += 4 * 97) { s += 0.3*p.data[i] + 0.59*p.data[i+1] + 0.11*p.data[i+2]; n++; } return s / n; }

const scenarios = {
  store: { sel: '.store-overlay', open: p => p.locator('.dock-avatar').first().click(), close: p => p.mouse.click(15, 400) },
  chores: { sel: '.chores-backdrop', open: p => p.locator('.chores-fab').click(), close: p => p.mouse.click(15, 400) },
  setup: { sel: '.setup-overlay', open: p => p.locator('.exercise-fab').click(), close: p => p.locator('.setup-overlay .close-btn-circle').click() },
};

(async () => {
  const browser = await chromium.launch({ channel: process.env.CHANNEL || undefined, headless: process.env.HEADED ? false : true, args: ['--autoplay-policy=no-user-gesture-required', ...(process.env.ARGS||'').split(' ').filter(Boolean)] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL); await page.waitForTimeout(2500);
  const io = page.locator('.interaction-overlay'); if (await io.count()) await io.click();
  await page.waitForTimeout(800);
  for (let i=0;i<5 && await page.locator('.btn-exit').count();i++){ await page.locator('.btn-exit').first().click(); await page.waitForTimeout(800);} 
  fs.mkdirSync(OUT, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  for (const name of which) {
    const sc = scenarios[name];
    await sc.open(page); await page.waitForTimeout(1200);
    await page.evaluate((sel) => { window.__log = []; const t0 = performance.now();
      const f = () => { const els = document.querySelectorAll(sel);
        window.__log.push([Math.round(performance.timeOrigin + performance.now() - window.__tc), els.length, els[0] ? getComputedStyle(els[0]).opacity + '/inline=' + els[0].style.opacity + '/anims=' + els[0].getAnimations().length : '-']);
        if (performance.now() - t0 < 3000) requestAnimationFrame(f); }; requestAnimationFrame(f); }, sc.sel);
    const frames = [];
    cdp.on('Page.screencastFrame', async (e) => { frames.push({ t: e.metadata.timestamp, d: e.data }); await cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(()=>{}); });
    await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 640, maxHeight: 400 });
    await page.waitForTimeout(300);
    const tClose = Date.now() / 1000;
    await page.evaluate(t => window.__tc = t, tClose*1000);
    await sc.close(page);
    await page.waitForTimeout(1200);
    await cdp.send('Page.stopScreencast'); cdp.removeAllListeners('Page.screencastFrame');
    const log = await page.evaluate(() => window.__log);
    const dir = `${OUT}/${name}`; fs.mkdirSync(dir, { recursive: true });
    const rows = frames.map((f, i) => { const b = Buffer.from(f.d, 'base64'); const ms = Math.round((f.t - tClose) * 1000);
      fs.writeFileSync(`${dir}/f${String(i).padStart(3,'0')}_${ms}ms.png`, b); return `${i}\t${ms}ms\tlum=${lum(b).toFixed(1)}`; });
    fs.writeFileSync(`${dir}/frames.txt`, rows.join('\n'));
    fs.writeFileSync(`${dir}/dom.txt`, log.map(r => r.join('\t')).join('\n'));
    console.log(`== ${name}\n` + rows.join('\n'));
    const trans = log.filter((r, i) => i === 0 || r[1] !== log[i-1][1] || r[2] !== log[i-1][2]);
    console.log('DOM transitions:', JSON.stringify(trans));
  }
  await browser.close();
})();
