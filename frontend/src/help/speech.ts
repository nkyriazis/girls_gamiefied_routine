import type { HelpStep } from './tour';

// What the owl says for a step: its title and text as written, without the emoji (the
// bubble's decoration), or the step's own `say` when the bubble leans on symbols. The
// recorded clips are keyed by this text (voice/clips.json), so an edited bubble goes
// silent until it's recorded again (scripts/help-lines.mjs --check tells).

// Emoji that only decorate; the others mean something (🟢 a brush, ✅ done) and need a `say`
const DECORATION = /🦉|🎉|👀|👆|\u{FE0F}/gu;

export function spoken(step: Pick<HelpStep, 'title' | 'text' | 'say'>): string {
  const tidy = (s: string) => s.replace(DECORATION, '').replace(/\s+/g, ' ').trim();
  if (step.say) return tidy(step.say);
  const title = tidy(step.title);
  return tidy(`${/[.!;…]$/.test(title) ? title : `${title}.`} ${tidy(step.text)}`);
}

/** Letters, digits and the punctuation a voice reads; anything else needs a `say` */
export const unreadable = (said: string) => said.match(/[^\p{Script=Greek}\p{Script=Latin}\d\s.,;:!?…’'«»()\-–]/gu) ?? [];
