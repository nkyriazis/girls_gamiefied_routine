// Issue #30: the dock's star count sits below the screen.
// Scene: tools/evidence/dev.sh clear-runs   (the home screen, no routine or alarm up)
// Play:  tools/evidence/record.sh .evidence/30/after.mjs   (before.mjs is the same screens on master; the toasts and the full tour are new here, before-toasts.mjs gives master's toasts)
//
// 1. Each size: the home screen as the kid sees it, the dock's bottom strip close up, and the
//    measured boxes (<tag>-measure.json), again with the Install button offered (<tag>-install-*.png).
// 2. Kiosk size: the same screen with 60 px more page under it, the screen's edge drawn in red,
//    so what falls below it can be seen.
//    Then 1, 2 and 3 chore toasts in the top right corner (toast-probe.mjs): which side buttons
//    they cover (<tag>-toasts<n>-<size>.png at 1280x800, 1024x600 and 800x480).
// 3. The home tour, every step to the last, then ✕: .dashboard's scrollTop at each step, at every
//    size (<tag>-tour.json); at the kiosk size a video with the owl's voice.
import fs from 'fs';
import { start } from '../../tools/evidence/kit.mjs';
import { probeToasts, toastLine } from './toast-probe.mjs';

const tag = 'after';
const sizes = [[1280, 800], [1920, 1080], [800, 1280], [1024, 600], [800, 480], [390, 844]];

const measure = page => page.evaluate(() => {
  const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), left: +b.left.toFixed(1), right: +b.right.toFixed(1), height: +b.height.toFixed(1) }; };
  const dock = document.querySelector('.dock');
  return {
    viewport: { width: innerWidth, height: innerHeight },
    dock: r(dock),
    dockHeightCss: dock && getComputedStyle(dock).height,
    items: [...document.querySelectorAll('.dock-item')].map(it => {
      const stars = it.querySelector('.dock-stars');
      const s = stars.getBoundingClientRect();
      const hit = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2);
      return {
        name: it.querySelector('.dock-name').textContent,
        stars: stars.textContent,
        item: r(it), avatar: r(it.querySelector('.dock-avatar')), nameBox: r(it.querySelector('.dock-name')), starsBox: r(stars),
        starsOnScreen: s.top >= 0 && s.bottom <= innerHeight,
        hitAtStarsCentre: hit ? hit.className : null,
        starsHit: !!hit && stars.contains(hit),
        avatarAtLeast44: it.querySelector('.dock-avatar').getBoundingClientRect().height >= 44,
        // The emoji avatar: its box and font size (SmartIcon sizes it from the avatar's size)
        avatarIcon: (() => { const i = it.querySelector('.dock-avatar > *'); return i && { ...r(i), fontSize: getComputedStyle(i).fontSize }; })(),
        // Does any of the item hang off the dock? (px over its top / under its bottom)
        overDockTop: dock ? +Math.max(0, dock.getBoundingClientRect().top - it.getBoundingClientRect().top).toFixed(1) : null,
        underDockBottom: dock ? +Math.max(0, it.getBoundingClientRect().bottom - dock.getBoundingClientRect().bottom).toFixed(1) : null,
      };
    }),
    // The clock: on screen and clear of the dock?
    clock: (() => { const c = document.querySelector('.clock-container'); if (!c) return null; const b = c.getBoundingClientRect(); return { ...r(c), fitsAboveDock: b.top >= 0 && (!dock || b.bottom <= dock.getBoundingClientRect().top) }; })(),
    install: r(document.querySelector('.install-pwa-btn')),
    // The side buttons, for what a taller dock could cover: is each one what a tap at its centre hits?
    fabs: [...document.querySelectorAll('.daily-exercises-fab, .chores-fab, .bonus-fab, .exercise-fab')].map(f => {
      const b = f.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { fab: f.className, box: r(f), tapHitsIt: !!hit && f.contains(hit), hit: hit ? String(hit.className) : null, underDockTop: dock ? +(b.bottom - dock.getBoundingClientRect().top).toFixed(1) : null };
    }),
  };
});

const results = {};
for (const [width, height] of sizes) {
  const size = `${width}x${height}`;
  const { page, pause, open, shot, finish } = await start(`${tag}-home-${size}`, { size: { width, height }, video: false });
  await open();
  await pause(2000);            // the dock slides up
  results[size] = await measure(page);
  await shot(`${tag}-home-${size}`);
  // Chore toasts in the corner the column moves up to on short screens
  const shown = { '1280x800': { 1: 1, 2: 1, 3: 1 }, '1024x600': { 1: 1, 2: 1, 3: 1 }, '800x480': { 1: 1, 2: 1, 3: 1 } };
  results[size].withToasts = await probeToasts(page, pause, { shotAt: shown[size], tag, size });
  // The same with the Install button offered (top right, where the toasts come too): is every
  // side button still what a tap at its centre hits?
  await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = async () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); dispatchEvent(e); });
  await pause(800);
  results[size].withInstall = await measure(page);
  await shot(`${tag}-install-${size}`);
  // The dock's strip, close up: from 60 px over the dock to the screen's bottom edge
  const dock = results[size].dock;
  const y = Math.max(0, Math.floor(dock.top) - 60);
  await page.screenshot({ path: `${tag}-dock-${size}.png`, clip: { x: 0, y, width, height: height - y } });
  await finish();
}
fs.writeFileSync(`${tag}-measure.json`, JSON.stringify(results, null, 1));
for (const [size, m] of Object.entries(results))
  console.log(size, 'dock', m.dock.top, '-', m.dock.bottom, m.items.map(i => `${i.name} ${i.stars} at ${i.starsBox.top}-${i.starsBox.bottom} ${i.starsOnScreen ? 'ON' : 'OFF'} screen`).join('; '),
    '| side buttons a tap misses:', m.fabs.filter(f => !f.tapHitsIt).map(f => `${f.fab} (hits ${f.hit})`).join(', ') || 'none',
    '| with Install:', m.withInstall.fabs.filter(f => !f.tapHitsIt).map(f => `${f.fab} (hits ${f.hit})`).join(', ') || 'none',
    '| avatars', m.items.map(i => i.avatar.height).join('/'), '| clock', m.clock?.top, '-', m.clock?.bottom, m.clock?.fitsAboveDock ? 'fits' : 'DOES NOT FIT',
    '| hangs off dock', m.items.map(i => `${i.overDockTop}/${i.underDockBottom}`).join(' '),
    '| toasts:', toastLine(m.withToasts));

// 2. Below the edge: an 800 px screen drawn in a page 60 px taller, the edge in red
{
  const { page, pause, open, caption, finish } = await start(`${tag}-below-edge-1280x800`, { size: { width: 1280, height: 860 }, video: false });
  await open();
  await page.addStyleTag({ content: `
    .dashboard { height: 800px !important; overflow: visible !important; }
    html, body { background: #111 !important; overflow: visible !important; }
    #edge { position: fixed; left: 0; right: 0; top: 800px; height: 0; border-top: 2px dashed red; z-index: 2147483646; pointer-events: none; }
    #edge span { position: absolute; left: 12px; top: 6px; color: #ff6b6b; font: 600 16px system-ui, sans-serif; white-space: nowrap; }
  ` });
  await page.evaluate(() => { const e = document.createElement('div'); e.id = 'edge'; e.innerHTML = '<span>the bottom edge of a 1280×800 screen: everything under this line is not seen</span>'; document.body.appendChild(e); });
  await pause(2000);
  await caption('Diagnostic view: the kiosk screen (1280×800) with the 60 px under its edge shown');
  await pause(300);
  await page.screenshot({ path: `${tag}-below-edge-1280x800.png`, clip: { x: 0, y: 560, width: 1280, height: 300 } });
  await page.screenshot({ path: `${tag}-below-edge-full-1280x800.png` });
  await finish();
}

// 3. The owl's home tour, every step to the last, at every size; at the kiosk size on video.
//    Before the fix, to light the dock item it scrolled the whole screen (overflow: hidden still
//    scrolls by script) up by what hung below the edge, and left it there.
const tours = {};
for (const [width, height] of sizes) {
  const size = `${width}x${height}`;
  const kiosk = size === '1280x800';
  const { page, pause, open, caption: say, listen, tap, shot, finish } = await start(`${tag}-tour-${size}`, { size: { width, height }, video: kiosk });
  const caption = kiosk ? say : async () => {};
  const where = () => page.evaluate(() => {
    const d = document.querySelector('.dashboard'), s = document.querySelector('.dock-stars').getBoundingClientRect();
    return { dashboardScrollTop: d.scrollTop, windowScrollY: scrollY, dockTop: document.querySelector('.dock').getBoundingClientRect().top, starsTop: +s.top.toFixed(1), starsBottom: +s.bottom.toFixed(1) };
  });
  const seen = {};
  await open();
  await pause(1500);
  seen.beforeTour = await where();
  await caption(`The kids’ home screen at the kiosk size (1280×800): ${seen.beforeTour.starsBottom > height ? 'names, no star counts' : 'names and star counts'}`);
  if (kiosk) { await pause(1500); await shot(`${tag}-tour-start-${size}`); }
  await caption('The owl’s tour of this screen');
  await tap(page.locator('.help-btn'), 400);
  seen.steps = [];
  for (let i = 0; i < 20; i++) {
    await listen(kiosk ? 700 : 200);
    const step = await page.evaluate(() => ({
      title: document.querySelector('.driver-popover-title')?.textContent ?? null,
      lit: document.querySelector('.driver-active-element')?.className?.toString().split(' ')[0] ?? null,
      next: document.querySelector('.driver-popover-next-btn')?.textContent ?? null,
    }));
    const w = await where();
    seen.steps.push({ step: i + 1, ...step, dashboardScrollTop: w.dashboardScrollTop, windowScrollY: w.windowScrollY, starsBottom: w.starsBottom });
    if (step.lit === 'dock-item' && !seen.atKidStep) {
      seen.atKidStep = w;
      await caption(w.dashboardScrollTop ? '“Your corner”: to light the whole item the tour scrolls the screen up; the star count shows' : '“Your corner”: the whole item is lit where it stands, nothing scrolls');
      if (kiosk) { await pause(1500); await shot(`${tag}-tour-kid-${size}`); }
    }
    if (!step.next || step.next.includes('Το βρήκα')) break;   // the last step
    await page.locator('.driver-popover-next-btn').click();
  }
  await listen(kiosk ? 1500 : 300);
  await caption('The tour stopped (✕)');
  await page.locator('.driver-popover-close-btn').click();
  await pause(2000);
  seen.afterTour = await where();
  seen.maxScrollTop = Math.max(...seen.steps.map(s => s.dashboardScrollTop), seen.afterTour.dashboardScrollTop);
  seen.maxScrollY = Math.max(...seen.steps.map(s => s.windowScrollY), seen.afterTour.windowScrollY);
  await caption(seen.afterTour.dashboardScrollTop ? 'After the tour the screen stays scrolled up'
    : seen.afterTour.starsBottom <= height ? 'After the tour nothing has moved, and the star counts are still on screen'
    : 'After the tour the screen is back: the star count is gone again');
  if (kiosk) { await pause(2500); await shot(`${tag}-tour-after-${size}`); }
  tours[size] = seen;
  console.log('tour', size, `${seen.steps.length} steps:`, seen.steps.map(s => `${s.step} «${s.title}» ${s.dashboardScrollTop}`).join(' | '), '| after ✕', seen.afterTour.dashboardScrollTop, '| max scrollTop', seen.maxScrollTop, 'scrollY', seen.maxScrollY);
  await finish();
}
fs.writeFileSync(`${tag}-tour.json`, JSON.stringify(tours, null, 1));
