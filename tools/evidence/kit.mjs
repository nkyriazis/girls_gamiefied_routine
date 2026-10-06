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
  // What the page plays and the corner square's colour, kept here (Node side): a page's own
  // variables start over at each navigation, the recording doesn't
  const heard = [], square = [];
  await context.exposeBinding('__evidence', (_source, kind, e) => (kind === 'square' ? square : heard).push(e));
  await context.addInitScript(() => {
    const log = (kind, e) => window.__evidence?.(kind, e);
    const play = HTMLMediaElement.prototype.play, stop = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.play = function () {
      log('heard', { src: this.src, at: Date.now(), ev: 'play' }); window.__playing = this;
      return play.call(this);
    };
    HTMLMediaElement.prototype.pause = function () {
      if (!this.paused) log('heard', { src: this.src, at: Date.now(), ev: 'stop' });
      return stop.call(this);
    };
    // The screens' sounds (sound/sfx.ts tells what it plays)
    addEventListener('sfx', e => log('heard', { src: `${location.origin}/sfx/${e.detail.name}.wav`, at: Date.now() + e.detail.delay, ev: 'play', sfx: true }));
    // Web Audio tones (the alarm's built-in melody, the time-up beeps) have no file: each one
    // that sounds is logged with its wave, pitch and length (at its stop()), and mix.sh makes it again
    const toneStart = OscillatorNode.prototype.start, toneStop = OscillatorNode.prototype.stop;
    OscillatorNode.prototype.start = function (when = 0) {
      const now = this.context.currentTime;
      this.__tone = { from: Math.max(when, now), at: Date.now() + Math.max(0, when - now) * 1000, freq: this.frequency.value, type: this.type };
      return toneStart.apply(this, arguments);
    };
    OscillatorNode.prototype.stop = function (when = 0) {
      const t = this.__tone;
      if (t && this.context.state === 'running') {
        const secs = Math.max(0.05, Math.max(when, this.context.currentTime) - t.from);
        log('heard', { src: `${location.origin}/tone/${t.type}/${Math.round(t.freq)}`, at: t.at, ev: 'play', sfx: true, tone: { secs } });
      }
      return toneStop.apply(this, arguments);
    };
    // The video's own clock, for mix.sh: the square shows the page clock's second (white when odd),
    // so it keeps its phase across navigations. It goes in as soon as the document has a root, before
    // the first paint, and every colour it shows is logged.
    const sq = document.createElement('div');
    sq.style.cssText = 'position:fixed;right:0;bottom:0;width:8px;height:8px;z-index:2147483647;pointer-events:none';
    const paint = () => {
      const on = Math.floor(Date.now() / 1000) % 2 === 1;
      sq.style.background = on ? '#fff' : '#000';
      log('square', { at: Date.now(), on });
    };
    const place = () => {
      if (!document.documentElement || sq.isConnected) return !!document.documentElement;
      document.documentElement.appendChild(sq);
      paint();
      setTimeout(() => { paint(); setInterval(paint, 1000); }, 1000 - (Date.now() % 1000) + 5);
      return true;
    };
    if (!place()) {
      const watch = new MutationObserver(() => { if (place()) watch.disconnect(); });
      watch.observe(document, { childList: true });
    }
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
    // The square's flips in page time, from the first one to white (as mix.sh counts them in the video)
    const sync = [];
    square.forEach((e, i) => { if (i && e.on !== square[i - 1].on && (sync.length || e.on)) sync.push(e.at); });
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
