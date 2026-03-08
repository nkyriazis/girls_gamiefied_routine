import { useCallback, useRef } from 'react';

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

  const playClick = useCallback(() => {
    playTone(800, 'sine', 0.1);
  }, []);

  const playSuccess = useCallback(() => {
    // Play a major triad arpeggio
    const ctx = getAudioContext();
    
    [440, 554, 659, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.5);
    });
  }, []);

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

  const playError = useCallback(() => {
    // Play a low descending tone
    const ctx = getAudioContext();
    [220, 164].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.3);
    });
  }, []);

  const playComplete = useCallback(() => {
    // Play an uplifting C major scale fragment
    const ctx = getAudioContext();
    [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.4);
    });
  }, []);

  return {
    playClick,
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
