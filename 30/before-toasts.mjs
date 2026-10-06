// Issue #30, master only: where the chore toasts leave the side buttons before the fix, for the
// comparison in the PR (after.mjs runs the same probe, toast-probe.mjs, on the branch).
// Scene: tools/evidence/dev.sh clear-runs, with master checked out.
// Play:  tools/evidence/record.sh .evidence/30/before-toasts.mjs
import fs from 'fs';
import { start } from '../../tools/evidence/kit.mjs';
import { probeToasts, toastLine } from './toast-probe.mjs';

const tag = 'before';
const sizes = [[1280, 800], [1920, 1080], [800, 1280], [1024, 600], [800, 480], [390, 844]];
const shown = { '1280x800': { 1: 1, 2: 1, 3: 1 }, '1024x600': { 1: 1, 2: 1, 3: 1 }, '800x480': { 1: 1, 2: 1, 3: 1 } };
const results = {};
for (const [width, height] of sizes) {
  const size = `${width}x${height}`;
  const { page, pause, open, finish } = await start(`${tag}-toasts-${size}`, { size: { width, height }, video: false });
  await open();
  await pause(2000);
  results[size] = await probeToasts(page, pause, { shotAt: shown[size], tag, size });
  console.log(size, toastLine(results[size]));
  await finish();
}
fs.writeFileSync(`${tag}-toasts.json`, JSON.stringify(results, null, 1));
