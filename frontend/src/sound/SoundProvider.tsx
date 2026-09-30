import React, { useEffect } from 'react';
import { loadSounds, sfx, type SoundName } from './sfx';
import sounds from './sounds.json';

// Everything she can press on the kids' screens sounds: a button, a link, a field taps
// ("tap"), or makes the sound it names ({...sound('open')}); a button she can't press
// right now says so softly ("nope"); choosing from a list selects, typing ticks.
// Only what she does here sounds: nothing plays for what happens elsewhere (a parent's
// approval, a chore running out) until the screen can show why.
// (npm run check-sound fails when something she can touch is neither.)

const PRESSABLE = 'button, [role="button"], a[href], label, input[type="checkbox"], input[type="radio"]';

const named = (el: Element): SoundName | 'none' | null => {
  const s = el.getAttribute('data-sound');
  return s === 'none' || (s && s in sounds) ? (s as SoundName | 'none') : null;
};

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    void loadSounds();  // decoding needs no touch; playing does, and waits for it
    const start = () => void loadSounds();
    const click = (e: MouseEvent) => {
      // The nearest thing that sounds decides: a plain button inside a sounding card taps
      const el = (e.target as Element).closest(`[data-sound], ${PRESSABLE}`);
      if (!el) return;
      const name = el.hasAttribute('data-sound') ? named(el) : 'tap';
      if (name && name !== 'none') sfx(name);
    };
    // A disabled button gets no click, so it's heard as it's pressed
    const down = (e: PointerEvent) => {
      const b = (e.target as Element).closest('button');
      if (b?.disabled || b?.getAttribute('aria-disabled') === 'true') sfx('nope');
    };
    const quiet = (t: EventTarget | null) => !(t instanceof Element) || !!t.closest('[data-sound="none"]');
    const change = (e: Event) => { if (!quiet(e.target) && e.target instanceof HTMLSelectElement) sfx('select'); };
    const typed = (e: Event) => { if (!quiet(e.target) && e.target instanceof HTMLInputElement) sfx('key'); };
    window.addEventListener('pointerdown', start, { once: true, capture: true });
    document.addEventListener('click', click, true);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('change', change, true);
    document.addEventListener('input', typed, true);
    return () => {
      window.removeEventListener('pointerdown', start, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('change', change, true);
      document.removeEventListener('input', typed, true);
    };
  }, []);
  return <>{children}</>;
};
