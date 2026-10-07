import type { PaintTarget } from '@shared/problems';
import type { PaintValue } from './problemFreeLogic';

// The frames on the story after a wrong painting, once the rung outlines (the second wrong try),
// drawn from the painting that was checked. Type imports only, so `npm test` loads it.

export interface PaintFrames { wrongWords: Set<number>; revealWords: Set<number> }

/**
 * In red, the unneeded facts she painted as needed and, behind «Έβαψες πολλά» (-1 in `wrong`),
 * the words counted as too much (`strays`: paintStrays of the painting checked); in a dashed
 * frame, the facts she missed (on "paint-all", an unneeded one left unpainted too).
 */
export function paintMarks(targets: PaintTarget[], wrong: number[] | undefined, painted: PaintValue, strays: number[]): PaintFrames {
  const wrongWords = new Set<number>(), revealWords = new Set<number>();
  targets.forEach((t, i) => {
    if (!wrong?.includes(i)) return;
    const asNeeded = t.role === 'extra' && t.words.some(w => painted[w] === 'known' || painted[w] === 'sought');
    const into = asNeeded ? wrongWords : revealWords;
    t.words.forEach(w => into.add(w));
  });
  if (wrong?.includes(-1)) strays.forEach(w => wrongWords.add(w));
  return { wrongWords, revealWords };
}

/** The words that point at the frames: only at frames on screen, by their colour. */
export function frameLine({ wrongWords, revealWords }: PaintFrames): string {
  const red = wrongWords.size > 0, yellow = revealWords.size > 0;
  if (red && yellow) return ' Κοίτα τις λέξεις με πλαίσιο.';
  if (red) return ' Κοίτα τις λέξεις με το κόκκινο πλαίσιο.';
  if (yellow) return ' Κοίτα τις λέξεις με το κίτρινο πλαίσιο.';
  return '';
}
