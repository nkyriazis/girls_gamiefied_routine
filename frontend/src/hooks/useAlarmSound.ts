import { useEffect } from 'react';
import { type AlarmProps } from '@shared/types';
import { useAppSounds } from './useAppSounds';

// The sound an alarm plays, as a string: every STATE brings new props objects, so an
// effect that depended on the `sound` object restarted the rooster at every task tap.
export const alarmSoundKey = (props?: AlarmProps): string =>
  typeof props?.sound === 'object' && props.sound.type === 'upload' ? `upload:${props.sound.value}` : 'melody';

/**
 * Plays the alarm sound `key` (alarmSoundKey) in a loop until it is null or another one.
 * The Dashboard plays one for all the alarm cards on screen: one copy, not one per card.
 * 'beep' plays the melody too.
 */
export function useAlarmSound(key: string | null): void {
  const { playWakeUpLoop, stopWakeUpLoop, playCustomSound, stopCustomSound } = useAppSounds();
  useEffect(() => {
    if (!key) return;
    if (key.startsWith('upload:')) {
      playCustomSound(key.slice('upload:'.length), true);
      return () => stopCustomSound();
    }
    playWakeUpLoop();
    return () => stopWakeUpLoop();
  }, [key, playWakeUpLoop, stopWakeUpLoop, playCustomSound, stopCustomSound]);
}
