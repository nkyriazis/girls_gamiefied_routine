import clips from './voice/clips.json';
import { spoken } from './speech';
import type { HelpStep } from './tour';

// The owl's voice: every bubble has a recorded clip (made at development time by
// tools/help-voice, keyed by what the owl says: speech.ts). A step plays its clip when its
// bubble opens and stops when it closes. Muting is this device's own choice.

const CLIPS: Record<string, string> = clips;
const MUTED = 'help-voice-muted';

const loaded = new Map<string, HTMLAudioElement>();
let playing: HTMLAudioElement | null = null;

const clipOf = (step: HelpStep) => CLIPS[spoken(step)];

function audio(src: string) {
  let a = loaded.get(src);
  if (!a) {
    a = new Audio(`${import.meta.env.BASE_URL}${src}`);
    a.preload = 'auto';
    loaded.set(src, a);
  }
  return a;
}

export function isMuted() {
  try { return localStorage.getItem(MUTED) === '1'; } catch { return false; }
}

export function setMuted(muted: boolean) {
  try { localStorage.setItem(MUTED, muted ? '1' : '0'); } catch { /* the choice lasts this visit */ }
  if (muted) hush();
}

/** Fetch the tour's clips ahead, so each bubble speaks as it opens */
export function preload(steps: HelpStep[]) {
  if (isMuted()) return;
  for (const s of steps) { const src = clipOf(s); if (src) audio(src); }
}

export function speak(step: HelpStep) {
  hush();
  const src = clipOf(step);
  if (!src || isMuted()) return;
  const a = audio(src);
  a.currentTime = 0;
  playing = a;
  a.play().catch(err => { if (err.name !== 'AbortError') console.warn('Help: the owl could not speak', err); });
}

export function hush() {
  if (!playing) return;
  playing.pause();
  playing = null;
}

export const hasVoice = (step: HelpStep) => !!clipOf(step);
