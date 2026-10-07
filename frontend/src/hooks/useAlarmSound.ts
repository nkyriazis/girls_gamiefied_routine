import { useEffect } from 'react';
import { useAppSounds } from './useAppSounds';
import { startAlarmSound } from './alarmSound';

export { alarmSoundKey } from './alarmSound';

/**
 * Plays the alarm sound `key` (alarmSoundKey) in a loop until it is null or another one.
 * The Dashboard plays one for all the alarm cards on screen: one copy, not one per card.
 * 'beep' plays the melody too, and so does an upload that can't play (startAlarmSound).
 */
export function useAlarmSound(key: string | null): void {
  const { playWakeUpLoop, stopWakeUpLoop, playCustomSound, stopCustomSound } = useAppSounds();
  useEffect(() => {
    if (!key) return;
    return startAlarmSound(key, { playWakeUpLoop, stopWakeUpLoop, playCustomSound, stopCustomSound });
  }, [key, playWakeUpLoop, stopWakeUpLoop, playCustomSound, stopCustomSound]);
}
