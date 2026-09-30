import { useCallback, useRef } from 'react';
import { sfx } from '../sound/sfx';

export const useAppSounds = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume context if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playTone = (freq: number, type: OscillatorType, duration: number) => {
    const audioCtx = getAudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  };

  // Right, wrong and finished are the palette's (sound/sfx.ts), like every other sound
  const playSuccess = useCallback(() => sfx('correct'), []);
  const playError = useCallback(() => sfx('wrong'), []);
  const playComplete = useCallback(() => sfx('done'), []);

  const playAlarm = useCallback(() => {
    playTone(440, 'square', 0.5);
    setTimeout(() => playTone(440, 'square', 0.5), 600);
  }, []);

  // Alarm Loop Ref
  const alarmIntervalRef = useRef<any>(null);

  const playWakeUpLoop = useCallback(() => {
    if (alarmIntervalRef.current) return;

    const playMelody = () => {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      // Simple "Morning" melody: C4 E4 G4 C5
      [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0.15, now + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.4);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + i * 0.2);
        osc.stop(now + i * 0.2 + 0.5);
      });
    };

    playMelody();
    alarmIntervalRef.current = setInterval(playMelody, 2000);
  }, []);

  const stopWakeUpLoop = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  }, []);

  // Audio element for MP3 playback
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const playCustomSound = useCallback((filename: string, loop: boolean = false) => {
    // Stop any existing audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    const audio = new Audio(`/uploads/${filename}`);
    audio.loop = loop;
    audio.volume = 0.7;
    audioElementRef.current = audio;

    audio.play().catch(err => {
      console.error('Failed to play custom sound:', err);
    });

    return audio;
  }, []);

  const stopCustomSound = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      audioElementRef.current = null;
    }
  }, []);

  return {
    playSuccess,
    playError,
    playComplete,
    playAlarm,
    playWakeUpLoop,
    stopWakeUpLoop,
    playCustomSound,
    stopCustomSound
  };
};
