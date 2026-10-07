import type { AlarmProps } from '@shared/types';

// The alarm's sound, apart from React and the browser's audio, so a test can play it
// (alarmSound.test.ts, `npm test`). useAlarmSound runs it in an effect.

// The sound an alarm plays, as a string: every STATE brings new props objects, so an
// effect that depended on the `sound` object restarted the rooster at every task tap.
export const alarmSoundKey = (props?: AlarmProps): string =>
  typeof props?.sound === 'object' && props.sound.type === 'upload' ? `upload:${props.sound.value}` : 'melody';

/** What makes the sounds (useAppSounds on the page, a fake in the test) */
export interface AlarmSounds {
  playWakeUpLoop(): void;
  stopWakeUpLoop(): void;
  /** onFail: called once if the file can't play (missing, broken); never for the autoplay rule */
  playCustomSound(filename: string, loop: boolean, onFail?: () => void): unknown;
  stopCustomSound(): void;
}

/** Plays the alarm sound `key` (alarmSoundKey) in a loop; the function it returns stops it */
export function startAlarmSound(key: string, s: AlarmSounds): () => void {
  if (key.startsWith('upload:')) {
    // A missing or broken upload rings the melody instead of nothing. Only while this alarm
    // lasts: a load that fails after it was dismissed must not start a melody nobody stops.
    let ringing = true;
    s.playCustomSound(key.slice('upload:'.length), true, () => { if (ringing) s.playWakeUpLoop(); });
    return () => { ringing = false; s.stopCustomSound(); s.stopWakeUpLoop(); };
  }
  s.playWakeUpLoop();
  return () => s.stopWakeUpLoop();
}
