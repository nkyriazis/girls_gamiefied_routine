// Issue #36 (part 1, the kids): a kid's name, avatar and colour have no form; only the raw JSON changes them.
// The kiosk (1280×800, on video) and a phone (390×844, screenshots) open Ρυθμίσεις.
// 1. Ρυθμίσεις: Δώρα, Πρόγραμμα, Ξεκίνα τώρα, Δουλειές & έξτρα, Σχολείο. No section for the kids.
// 2. Σχολείο: a kid's class, problems and mistakes, one select each, spread over three groups. No name, avatar or colour.
// 3. Προχωρημένα → Ρυθμίσεις (JSON): the "users" block is the only place to rename a kid, change the avatar
//    or the colour (a CSS value such as var(--color-accent), typed by hand), or add a kid.
// 4. The phone: the same, with Monaco on a phone.
// <tag>-sections.txt lists the section titles each size shows, and whether a kids' section is among them.
// It reads only: data.json is not changed. Scene: tools/evidence/dev.sh clear-runs.
// Play: tools/evidence/record.sh .evidence/36-kids/before.mjs (after the fix: after.mjs, the same with tag 'after')
import fs from 'fs';
import { start, pause, APP } from '../../tools/evidence/kit.mjs';

const tag = process.env.OUT ?? 'after';
const title = tag === 'after' ? 'After' : 'Before';
const KIDS = /^Παιδιά/;
const out = [];

const sections = async page => page.locator('.p-section h2').allTextContents();
// Monaco (bundled since #35, no window.monaco): find the text with the editor's own search, which scrolls to it and selects it
const reveal = async (page, text) => {
  await page.locator('.monaco-editor .view-lines').first().click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('Control+f');
  await pause(400);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await pause(300);
  await page.keyboard.press('Escape');
  await pause(500);
};
const editorReady = async page => {
  await page.waitForFunction(() => [...document.querySelectorAll('.monaco-editor .view-lines')].some(e => e.textContent.includes('"users"') || e.textContent.length > 20), null, { timeout: 60000 });
  await pause(2500);
};

const kiosk = await start(`${tag}-kiosk`);
const k = kiosk.page;
await k.goto(APP + '/parent?view=settings');
await pause(2500);
const kSections = await sections(k);
out.push(`kiosk 1280x800, Ρυθμίσεις sections: ${kSections.join(' | ')}`);
out.push(`kiosk: a kids' section (Παιδιά): ${kSections.some(s => KIDS.test(s)) ? 'yes' : 'no'}`);
await kiosk.caption(`${title}: Ρυθμίσεις. Δώρα, Πρόγραμμα, Ξεκίνα τώρα, Δουλειές … : is there a place for the kids?`);
await kiosk.shot(`${tag}-1-settings-top`);

const school = k.getByRole('heading', { name: 'Σχολείο' });
await school.scrollIntoViewIfNeeded();
await k.evaluate(() => [...document.querySelectorAll('h2')].find(h => h.textContent === 'Σχολείο')?.scrollIntoView({ block: 'start' }));
await pause(1200);
await kiosk.caption(tag === 'after'
  ? 'Σχολείο: the daily numbers; each kid\'s class, problems and mistakes are in the kid\'s form'
  : 'Σχολείο: class, problems, mistakes per kid. Name, avatar, colour: nowhere in Ρυθμίσεις');
await kiosk.shot(`${tag}-2-settings-school`);

const kidsHeading = k.getByRole('heading', { name: KIDS });
if (await kidsHeading.count()) {
  await kidsHeading.scrollIntoViewIfNeeded();
  await pause(800);
  await kiosk.caption('Παιδιά: one row per kid');
  await kiosk.shot(`${tag}-3-kids`);
  // her row in Παιδιά (Ξεκίνα τώρα has buttons with her name too, which start a routine)
  await kiosk.tap(k.locator('.p-section', { has: kidsHeading }).getByRole('button', { name: /Ιφιγένεια/ }), 1200);
  await kiosk.caption('A kid\'s sheet: name, avatar, colour, class, problems, mistakes');
  await kiosk.shot(`${tag}-4-kid-sheet`);
  await k.keyboard.press('Escape');
  await pause(800);
}

await k.goto(APP + '/parent?view=advanced');
await editorReady(k);
await reveal(k, '"users"');
await pause(1500);
await kiosk.caption(tag === 'after'
  ? 'Προχωρημένα → JSON still has "users", for anything the form leaves out'
  : 'The only place to rename a kid, change the avatar or colour, or add a kid: the raw JSON');
await kiosk.shot(`${tag}-5-json-users`);
await pause(1500);
await reveal(k, '"color": "var(--color-secondary)"');
await kiosk.caption(tag === 'after'
  ? 'The colour in JSON: the form picks it from the theme instead'
  : 'A colour is a CSS value typed by hand');
await pause(2500);
await kiosk.shot(`${tag}-6-json-color`);
await kiosk.finish();

const phone = await start(`${tag}-phone`, { size: { width: 390, height: 844 }, video: false });
const p = phone.page;
await p.goto(APP + '/parent?view=settings');
await pause(2500);
const pSections = await sections(p);
out.push(`phone 390x844, Ρυθμίσεις sections: ${pSections.join(' | ')}`);
out.push(`phone: a kids' section (Παιδιά): ${pSections.some(s => KIDS.test(s)) ? 'yes' : 'no'}`);
await phone.caption(`${title}: Ρυθμίσεις on a phone`);
await phone.shot(`${tag}-7-phone-settings`);
await p.evaluate(() => [...document.querySelectorAll('h2')].find(h => h.textContent === 'Σχολείο')?.scrollIntoView({ block: 'start' }));
await pause(1000);
await phone.caption('Σχολείο on a phone');
await phone.shot(`${tag}-8-phone-school`);
await phone.finish();

fs.writeFileSync(`${tag}-sections.txt`, out.join('\n') + '\n');
console.log(out.join('\n'));
