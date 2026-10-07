// #110: which icon the page names for its tab (and for a phone's home screen).
// A headless browser has no tab strip, so the scenario draws one at the top of the page from the
// page's own <link rel="icon"> and its title, and a panel listing every icon link the page has, each
// with the picture its URL serves. Play it as is before the fix; copy it to after.mjs for the after
// (the file's name prefixes the outputs).
//   tools/evidence/record.sh .evidence/110/before.mjs
import { start, APP } from '../../tools/evidence/kit.mjs';
import path from 'path';
import fs from 'fs';

const when = path.basename(new URL(import.meta.url).pathname, '.mjs');
const LAN = 'http://192.168.122.1:5173'; // the parents' phone reaches the dev stack over the LAN, as the Pi's http://<pi>/

// Draws the tab and the panel from what the page's <head> says; returns the links it found
const showIcons = page => page.evaluate(() => {
  const links = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')]
    .map(l => ({ rel: l.rel, type: l.type || '', sizes: l.getAttribute('sizes') || '', href: l.getAttribute('href'), url: l.href }));
  const icons = links.filter(l => l.rel.split(' ').includes('icon'));
  // The tab: the SVG icon when there is one (what current browsers pick), else the first icon link
  const tabIcon = icons.find(l => l.type === 'image/svg+xml') ?? icons[0];
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(10,10,20,0.92);font:15px system-ui,sans-serif;color:#eee;overflow:auto';
  box.innerHTML = `
    <div style="display:flex;align-items:flex-end;height:44px;background:#202124;padding:0 12px">
      <div style="display:flex;align-items:center;gap:8px;height:34px;padding:0 14px;background:#35363a;border-radius:8px 8px 0 0;max-width:240px;min-width:0">
        ${tabIcon ? `<img src="${tabIcon.url}" width="16" height="16" style="flex:none">` : '<span style="width:16px;height:16px;border:1px dashed #888;flex:none"></span>'}
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${document.title}</span>
        <span style="color:#999;margin-left:6px">✕</span>
      </div>
    </div>
    <div style="padding:14px 16px">
      <div style="color:#aaa;margin-bottom:10px">Tab drawn from the page’s own &lt;head&gt; (${location.host}${location.pathname}). Icon links:</div>
      ${links.map(l => `
        <div style="display:flex;align-items:center;gap:14px;margin:0 0 12px;flex-wrap:wrap">
          <img src="${l.url}" width="72" height="72" style="background:#fff;border-radius:10px;padding:4px;flex:none">
          <img src="${l.url}" width="16" height="16" style="flex:none">
          <code style="font-size:14px;word-break:break-all">&lt;link rel="${l.rel}"${l.type ? ` type="${l.type}"` : ''}${l.sizes ? ` sizes="${l.sizes}"` : ''} href="${l.href}"&gt;</code>
        </div>`).join('')}
    </div>`;
  document.body.appendChild(box);
  return links;
});

const found = {};

// The kiosk, 1280×800
{
  const { page, pause, open, shot, finish } = await start(`${when}-kiosk`, { video: false });
  await open();
  await pause(800);
  found.kiosk = await showIcons(page);
  await pause(800);
  await shot(`${when}-kiosk`);
  await finish();
}

// The parents' page on a phone (WebKit as an iPhone, over the LAN address)
{
  const { page, pause, shot, finish } = await start(`${when}-phone`, { video: false, browser: 'webkit', device: 'iPhone 13' });
  await page.goto(`${process.env.APP ? APP : LAN}/parent`);
  await pause(2000);
  found.phone = await showIcons(page);
  await pause(800);
  await shot(`${when}-phone`);
  await finish();
}

// What each icon URL serves
for (const l of found.kiosk) {
  const r = await fetch(l.url);
  l.status = r.status; l.contentType = r.headers.get('content-type'); l.bytes = (await r.arrayBuffer()).byteLength;
}
fs.writeFileSync(`${when}.json`, JSON.stringify(found, null, 1));
console.log(JSON.stringify(found.kiosk, null, 1));
