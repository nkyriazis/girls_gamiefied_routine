import { driver, type DriveStep, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './help.css';
import type { HelpStep, Tour } from './tours';

// Plays a tour with driver.js: the screen dims around one widget at a time, the owl
// explains it in a bubble next to it, and a finger shows how to use it. The look is
// ours (help.css); driver.js only places things.

const SEEN_KEY = 'help-seen';

// Per device: which tours were played. A convenience only, so a blocked storage just
// means the owl offers again.
function seenSet(): Record<string, true> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') ?? {}; } catch { return {}; }
}
export function isSeen(id: string): boolean {
  return !!seenSet()[id];
}
function markSeen(ids: string[]) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ ...seenSet(), ...Object.fromEntries(ids.map(id => [id, true])) })); } catch { /* not remembered */ }
}

// A widget is there if it takes up room on screen
function onScreen(sel: string): Element | null {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' ? el : null;
}

/** The steps the owl will actually say now (the intro only the first time). */
export function stepsNow(tour: Tour): HelpStep[] {
  const intro = tour.intro && !isSeen(tour.intro.id) ? tour.intro : null;
  const steps = [...(intro?.steps ?? []), ...tour.steps, ...(intro?.after ?? [])];
  return steps.filter(s => !s.el || onScreen(s.el));
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

let active: Driver | null = null;

/** Plays the tour; `onEnd` runs however it ends (finished or closed). */
export function playTour(tour: Tour, onEnd?: () => void) {
  const steps = stepsNow(tour);
  if (!steps.length) return;
  active?.destroy();
  const total = steps.length;
  const d = driver({
    steps: steps.map((s, i): DriveStep => ({
      element: s.el,
      data: { demo: s.demo },
      popover: {
        title: s.title,
        description: s.text,
        side: s.side,
        align: 'center',
        nextBtnText: i === total - 1 ? 'Το βρήκα! 🎉' : 'Επόμενο ▶',
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
      const owl = document.createElement('div');
      owl.className = 'help-owl';
      owl.textContent = '🦉';
      pop.wrapper.prepend(owl);
      pop.closeButton.setAttribute('aria-label', 'Κλείσιμο');
      const at = dr.getActiveIndex() ?? 0;
      const dots = document.createElement('div');
      dots.className = 'help-dots';
      for (let i = 0; i < total; i++) dots.appendChild(Object.assign(document.createElement('span'), { className: i === at ? 'on' : i < at ? 'past' : '' }));
      pop.footer.prepend(dots);
      if (at === 0) pop.previousButton.style.display = 'none';
    },
    onHighlighted: (el, step) => showFinger(el, step.data?.demo),
    onDeselected: hideFinger,
    onDestroyed: () => {
      hideFinger();
      markSeen([tour.id, ...(tour.intro ? [tour.intro.id] : [])]);
      if (active === d) active = null;
      onEnd?.();
    },
  });
  active = d;
  d.drive();
}
