import sounds from './sounds.json';

// The kids' screens' sounds: a small palette of named sounds (sounds.json, chosen and made
// by tools/sfx), played through Web Audio so a tap answers at once. Everything she can
// press sounds by itself (SoundProvider); an element names a sound other than "tap" with
// {...sound('open')}, and outcomes (right, wrong, stars) are played where they happen: sfx('correct').

export type SoundName = keyof typeof sounds;

// Small taps vary a little in pitch, so a run of them sounds alive rather than mechanical
const JITTER: Partial<Record<SoundName, number>> = { tap: 0.06, key: 0.08, paint: 0.1, select: 0.04, unselect: 0.04, pick: 0.05, place: 0.05, page: 0.05 };
// The same sound again this soon is one sound (a drag paints many words at once)
const GAP: Partial<Record<SoundName, number>> = { paint: 90, key: 30 };

let ctx: AudioContext | null = null;
const buffers = new Map<SoundName, AudioBuffer>();
const last = new Map<SoundName, number>();
let loading: Promise<void> | null = null;

function context() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Fetch and decode every sound (once, on her first touch: a page can't make sound before) */
export function loadSounds() {
  loading ??= Promise.all((Object.keys(sounds) as SoundName[]).map(async name => {
    const res = await fetch(`${import.meta.env.BASE_URL}${sounds[name].file}`);
    buffers.set(name, await context().decodeAudioData(await res.arrayBuffer()));
  })).then(() => undefined, err => { loading = null; console.warn('Sounds: not loaded', err); });
  return loading;
}

export function sfx(name: SoundName, { delay = 0, volume = 1 }: { delay?: number; volume?: number } = {}) {
  const now = performance.now();
  if (now - (last.get(name) ?? -Infinity) < (GAP[name] ?? 0)) return;
  last.set(name, now);
  const buffer = buffers.get(name);
  if (!buffer) { void loadSounds(); return; }
  const c = context();
  const src = c.createBufferSource();
  src.buffer = buffer;
  const j = JITTER[name];
  if (j) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * j;
  const gain = c.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(c.destination);
  src.start(c.currentTime + delay / 1000);
  // Anyone listening (the demos) hears what played, when
  window.dispatchEvent(new CustomEvent('sfx', { detail: { name, delay } }));
}

/** The sound an element makes when pressed; 'none' when its handler plays its own */
export const sound = (name: SoundName | 'none') => ({ 'data-sound': name });
