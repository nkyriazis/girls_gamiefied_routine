import type { Exercise } from '@shared/types';

// The right answer to a plain exercise, in words: what «Η σωστή απάντηση: …» says when
// the exercise closes after its tries (unforgiving) or «Δείξε μου» shows it (forgiving).
// A no-break space goes before every «→», so no line starts with one; a match is one pair
// per line (the card keeps the line breaks), «→» between its sides, never «–», which reads
// as a minus beside numbers (#72). tools/problem-gen/maths/check.ts revealed() says the same.
const ARROW = '\u00a0→ ';
export function answerText(exercise: Exercise): string {
  switch (exercise.type) {
    case 'multiple-choice': return exercise.options[exercise.correctIndex];
    case 'true-false': return exercise.correctValue ? 'Σωστό' : 'Λάθος';
    case 'number-input': return exercise.correctValue.toLocaleString('el-GR');
    case 'fill-blank': return exercise.textWithGaps.replace(/\{(\d+)\}/g, (_, i) => exercise.correctAnswers[Number(i)] ?? '…');
    case 'ordering': return exercise.items.map(i => i.content).join(ARROW);
    case 'match-pairs': return exercise.pairs.map(p => p.left + ARROW + p.right).join('\n');
    case 'problem': return '';
  }
}
