// Screenshots of the parent dashboard before the redesign (origin/overhaul),
// on piserve's data: every tab at phone and tablet/desktop width, plus the kids' dashboard.
import { chromium } from 'playwright';

const BASE = 'http://frontend';
const TABS = ['Dashboard', '📝 Ασκήσεις', '📅 Schedule', 'Config (data.json)', 'State (state.json)', 'Debug Time', 'Logs'];
const VIEWPORTS = { phone: { width: 390, height: 844 }, tablet: { width: 1180, height: 820 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  const page = await browser.newPage({ viewport, locale: 'el-GR', timezoneId: 'Europe/Athens' });
  await page.goto(`${BASE}/parent`);
  for (const [i, tab] of TABS.entries()) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await sleep(1500);
    await page.screenshot({ path: `/e2e/shots/${name}-${i + 1}-${tab.replace(/[^a-z]/gi, '').toLowerCase() || 'exercises'}.png`, fullPage: true });
    console.log(`shot ${name} ${tab}`);
  }
  await page.close();
}
const kids = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'el-GR', timezoneId: 'Europe/Athens' });
await kids.goto(BASE + '/');
await kids.locator('.interaction-overlay').click();
await sleep(1500);
await kids.screenshot({ path: '/e2e/shots/kids-dashboard.png' });
await kids.locator('.dock-item').first().locator('.dock-avatar').click();
await sleep(1200);
await kids.screenshot({ path: '/e2e/shots/kids-store.png' });
console.log('shot kids');
await browser.close();
