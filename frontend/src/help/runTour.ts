import { driver, type DriveStep, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './help.css';
import { anchorSelector } from './anchors';
import { seenId, type HelpStep, type Tour } from './tour';
import { hasVoice, hush, isMuted, preload, setMuted, speak } from './voice';
import { sfx } from '../sound/sfx';
import { revealInLists } from './reveal';

// Plays a tour with driver.js: the screen dims around one widget at a time, the owl
// explains it in a bubble next to it, and a finger shows how to use it. The look is
// ours (help.css); driver.js only places things. The owl says each bubble aloud (voice.ts).

// A widget is there if it takes up room on screen
function onScreen(step: HelpStep): Element | null {
  if (!step.el) return null;
  const el = document.querySelector(anchorSelector(step.el));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' ? el : null;
}

/** The steps the owl will say now: the intro only if it hasn't been played. */
export function stepsNow(tour: Tour, seen: (id: string) => boolean): HelpStep[] {
  const intro = tour.intro && !seen(seenId(tour.intro.id, tour.user)) ? tour.intro : null;
  const steps = [...(intro?.steps ?? []), ...tour.steps, ...(intro?.after ?? [])];
  return steps.filter(s => !s.el || onScreen(s));
}

let finger: HTMLElement | null = null;
function showFinger(el: Element | undefined, demo: HelpStep['demo']) {
  hideFinger();
  if (!el || !demo) return;
  // A drag goes along the first line (a story wraps: its whole box isn't a line)
  const line = el.getClientRects()[0] ?? el.getBoundingClientRect();
  finger = document.createElement('div');
  finger.className = `help-finger ${demo}`;
  finger.textContent = '👆';
  finger.style.left = `${demo === 'swipe' ? line.left + 10 : line.left + line.width / 2}px`;
  finger.style.top = `${line.top + line.height / 2}px`;
  finger.style.setProperty('--swipe', `${Math.max(60, Math.min(line.width - 20, 320))}px`);
  document.body.appendChild(finger);
}
function hideFinger() {
  finger?.remove();
  finger = null;
}

let active: { driver: Driver; stop: () => void } | null = null;

/** Stops the tour on screen, if one plays, as not played: its screen went under another. */
export function stopTour() {
  active?.stop();
}

/**
 * Plays the tour. `onEnd` gets the ids to remember as played (the tour, and its intro if
 * it was said), however she ends it: finished or closed. Stopped (stopTour), none.
 */
export function playTour(tour: Tour, { seen, onEnd }: { seen: (id: string) => boolean; onEnd: (played: string[]) => void }) {
  const steps = stepsNow(tour, seen);
  if (!steps.length) return false;
  const introSaid = !!tour.intro && !seen(seenId(tour.intro.id, tour.user));
  let stopped = false;
  active?.driver.destroy();
  preload(steps);
  const total = steps.length;
  const d = driver({
    steps: steps.map((s, i): DriveStep => ({
      element: s.el && anchorSelector(s.el),
      data: { demo: s.demo },
      popover: {
        title: s.title,
        description: s.text,
        side: s.side,
        align: 'center',
        nextBtnText: i < total - 1 ? 'Επόμενο ▶' : 'Το βρήκα! 🎉',
      },
    })),
    popoverClass: 'help-pop',
    prevBtnText: '◀',
    showProgress: false,
    showButtons: ['next', 'previous', 'close'],
    overlayColor: '#05031a',
    overlayOpacity: 0.72,
    stagePadding: 8,
    stageRadius: 18,
    popoverOffset: 14,
    smoothScroll: true,
    allowKeyboardControl: true,
    // A tap anywhere moves on: easier than finding the button
    overlayClickBehavior: 'nextStep',
    onPopoverRender: (pop, { driver: dr }) => {
      const at = dr.getActiveIndex() ?? 0;
      // The owl says it again when she taps it
      const owl = document.createElement('button');
      owl.type = 'button';
      owl.className = 'help-owl';
      owl.textContent = '🦉';
      owl.setAttribute('aria-label', 'Πες το ξανά');
      owl.onclick = () => { if (isMuted()) setMuted(false); speak(steps[at]); sound.textContent = '🔊'; };
      pop.wrapper.prepend(owl);
      pop.closeButton.setAttribute('aria-label', 'Κλείσιμο');
      // Moving on turns a page (heard as each bubble opens, however she moved on); ✕ closes
      pop.closeButton.dataset.sound = 'close';
      pop.nextButton.dataset.sound = at < total - 1 ? 'none' : 'done';
      pop.previousButton.dataset.sound = 'none';
      owl.dataset.sound = 'none';
      const sound = document.createElement('button');
      sound.type = 'button';
      sound.className = 'help-sound';
      sound.textContent = isMuted() ? '🔇' : '🔊';
      sound.setAttribute('aria-label', 'Φωνή');
      sound.onclick = () => {
        const mute = !isMuted();
        setMuted(mute);
        sound.textContent = mute ? '🔇' : '🔊';
        if (!mute) speak(steps[at]);
      };
      if (hasVoice(steps[at])) pop.wrapper.appendChild(sound);
      const dots = document.createElement('div');
      dots.className = 'help-dots';
      for (let i = 0; i < total; i++) dots.appendChild(Object.assign(document.createElement('span'), { className: i === at ? 'on' : i < at ? 'past' : '' }));
      pop.footer.prepend(dots);
      if (at === 0) pop.previousButton.style.display = 'none';
    },
    // Before driver.js measures: a widget clipped by a list that scrolls comes into the list's view
    onHighlightStarted: el => { if (el) revealInLists(el); },
    onHighlighted: (el, step, { driver: dr }) => {
      if ((dr.getActiveIndex() ?? 0) > 0) sfx('page');
      showFinger(el, step.data?.demo);
      speak(steps[dr.getActiveIndex() ?? 0]);
    },
    onDeselected: () => { hideFinger(); hush(); },
    onDestroyed: () => {
      hideFinger();
      hush();
      if (active?.driver === d) active = null;
      onEnd(stopped ? [] : [seenId(tour.id, tour.user), ...(introSaid && tour.intro ? [seenId(tour.intro.id, tour.user)] : [])]);
    },
  });
  active = { driver: d, stop: () => { stopped = true; d.destroy(); } };
  d.drive();
  return true;
}
