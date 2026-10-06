// Records a scenario on the dev stack as a PR's evidence: a screen video, and what it played.
// The browser's sound isn't in the video: every clip and sound played is logged (<out>.sound.json)
// and mix.sh lays them over the video after. A corner square flips every second to line the two up.
//
//   import { start } from '../kit.mjs';
//   const { page, caption, tap, pause, listen, finish } = await start('before-calc');
//   ...
//   await finish();
import { chromium } from 'playwright';
import fs from 'fs';

export const pause = ms => new Promise(r => setTimeout(r, ms));
export const APP = process.env.APP ?? 'http://localhost:5173';
export const API = process.env.API ?? 'http://localhost:3000';

// out: the file name without extension; size: the kiosk (1280×800) unless the change affects another
export async function start(out, { size = { width: 1280, height: 800 }, touch = true, video = true } = {}) {
  const log = (...a) => console.log(`[${out}]`, ...a);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({
    viewport: size, deviceScaleFactor: 1, hasTouch: touch, timezoneId: 'Europe/Athens', locale: 'el-GR',
    ...(video ? { recordVideo: { dir: `video-${out}`, size } } : {}),
  });
  await context.addInitScript(() => {
    window.__heard = [];
    const play = HTMLMediaElement.prototype.play, stop = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.play = function () {
      window.__heard.push({ src: this.src, at: Date.now(), ev: 'play' }); window.__playing = this;
      return play.call(this);
    };
    HTMLMediaElement.prototype.pause = function () {
      if (!this.paused) window.__heard.push({ src: this.src, at: Date.now(), ev: 'stop' });
      return stop.call(this);
    };
    // The screens' sounds (sound/sfx.ts tells what it plays)
    addEventListener('sfx', e => window.__heard.push({ src: `${location.origin}/sfx/${e.detail.name}.wav`, at: Date.now() + e.detail.delay, ev: 'play', sfx: true }));
    // The video's own clock, for mix.sh
    window.__sync = [];
    addEventListener('DOMContentLoaded', () => {
      const sq = document.createElement('div');
      sq.style.cssText = 'position:fixed;right:0;bottom:0;width:8px;height:8px;z-index:2147483647;pointer-events:none;background:#000';
      document.documentElement.appendChild(sq);
      let on = false;
      setInterval(() => { on = !on; sq.style.background = on ? '#fff' : '#000'; window.__sync.push(Date.now()); }, 1000);
    });
  });
  const t0 = Date.now();
  const page = await context.newPage();
  page.on('pageerror', e => log('page error:', e.message));

  // A caption across the top says what the viewer is watching
  const caption = async text => {
    log(text);
    await page.evaluate(t => {
      let el = document.getElementById('evidence-caption');
      if (!el) {
        el = document.createElement('div');
        el.id = 'evidence-caption';
        el.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;' +
          'background:rgba(0,0,0,0.85);color:#fff;font:600 17px system-ui,sans-serif;padding:7px 16px;border-radius:10px;max-width:90vw;text-align:center;border:1px solid #666';
        document.body.appendChild(el);
      }
      el.textContent = t;
    }, text);
  };
  const tap = async (loc, wait = 900) => { await loc.click(); await pause(wait); };
  // Waits for the clip playing (the owl's voice, an alarm) to end
  const listen = async (extra = 700) => {
    await pause(500);
    for (let i = 0; i < 60; i++) {
      if (await page.evaluate(() => !window.__playing || window.__playing.paused || window.__playing.ended)) break;
      await pause(250);
    }
    await pause(extra);
  };
  // Opens the kids' screen past "Click to Start"
  const open = async (path = '/') => {
    await page.goto(APP + path);
    await pause(1500);
    const overlay = page.locator('.interaction-overlay');
    if (await overlay.count()) await overlay.click();
  };
  const shot = async name => { await page.screenshot({ path: `${name}.png` }); log('screenshot', `${name}.png`); };
  const finish = async () => {
    await pause(1200);
    const heard = await page.evaluate(() => window.__heard);
    const sync = await page.evaluate(() => window.__sync);
    fs.writeFileSync(`${out}.sound.json`, JSON.stringify({
      said: heard.map(e => ({ ...e, src: new URL(e.src).pathname, at: e.at - t0 })),
      sync: sync.map(t => t - t0),
    }, null, 1));
    const v = page.video();
    await context.close();
    await browser.close();
    if (v) { fs.renameSync(await v.path(), `${out}.webm`); fs.rmSync(`video-${out}`, { recursive: true, force: true }); }
    log('done');
  };
  return { page, caption, tap, pause, listen, open, shot, finish, log };
}

// Today's assignments, to find the one a scenario plays
export const assignments = async () => (await fetch(`${API}/api/exercise-assignments`)).json();
