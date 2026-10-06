import type { Exercise } from '@shared/types';

// The right answer to a plain exercise, in words: what «Η σωστή απάντηση: …» says when
// the exercise closes after its tries (unforgiving) or «Δείξε μου» shows it (forgiving).
export function answerText(exercise: Exercise): string {
  switch (exercise.type) {
    case 'multiple-choice': return exercise.options[exercise.correctIndex];
    case 'true-false': return exercise.correctValue ? 'Σωστό' : 'Λάθος';
    case 'number-input': return exercise.correctValue.toLocaleString('el-GR');
    case 'fill-blank': return exercise.textWithGaps.replace(/\{(\d+)\}/g, (_, i) => exercise.correctAnswers[Number(i)] ?? '…');
    case 'ordering': return exercise.items.map(i => i.content).join(' → ');
    case 'match-pairs': return exercise.pairs.map(p => `${p.left} – ${p.right}`).join(', ');
    case 'problem': return '';
  }
}
