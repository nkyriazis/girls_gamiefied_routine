import type { HelpAnchor } from './anchors';

// What a tour is. Each screen's tour lives next to it (Screen.help.ts) and is passed to
// <HelpScreen>. A step points at a widget by its anchor name (none: a note in the middle
// of the screen); steps whose widget isn't on screen are left out, so one tour fits every
// state of its screen. Every step has a stable key (its anchor, or its id), so things
// keyed per step, like a recorded voice, survive edits to the text.

interface StepText {
  title: string;
  text: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** A finger shows how: a tap on the widget, or a drag across its first line */
  demo?: 'tap' | 'swipe';
  /** What the owl says aloud, when the bubble has symbols a voice can't read (🟢, ⌫) */
  say?: string;
}

export type HelpStep = StepText & ({ el: HelpAnchor; id?: undefined } | { el?: undefined; id: string });

export const stepKey = (step: HelpStep) => step.el ?? step.id;

export interface Tour {
  /** Names the tour ("store", "problem-calc"); the same for every kid */
  id: string;
  /** Set for a kid's own screen: it is remembered per kid */
  user?: string;
  steps: HelpStep[];
  /** Said only the first time, before and after the tour's own steps, and remembered on its own */
  intro?: { id: string; steps: HelpStep[]; after?: HelpStep[] };
  /** A time-pressed screen (routines, alarms): the owl wiggles with its «!» but offers no «Να σου δείξω;» bubble */
  quiet?: boolean;
}

/** How a tour is remembered as played (see HelpSeen in shared/types.ts) */
export const seenId = (id: string, user?: string) => (user ? `${id}@${user}` : id);
