// The smallest scenario: the kids' screen past the start overlay, a screenshot and a few seconds of video.
//   tools/evidence/record.sh tools/evidence/scenarios/smoke.mjs .evidence/smoke
import { start } from '../kit.mjs';

const { caption, pause, open, shot, finish } = await start('smoke');
await open();
await caption('The kids’ screen at the kiosk size');
await shot('smoke');
await pause(3000);
await finish();
