import type { Exercise } from '@shared/types';
import type { HelpStep } from '../../help/tour';

// How to answer each kind of exercise: the same widgets on her own and in the group game.

export const answerSteps = (type: Exercise['type'] | undefined): HelpStep[] => {
  switch (type) {
    case 'multiple-choice': return [
      { el: 'answer.options', title: 'Διάλεξε', text: 'Μία απάντηση είναι σωστή. Πάτα αυτή που ταιριάζει.', side: 'left', demo: 'tap' },
    ];
    case 'true-false': return [
      { el: 'answer.truefalse', title: 'Σωστό ή λάθος;', text: 'Διάβασε την πρόταση. Αν ισχύει, πάτα ✅. Αν όχι, ❌.', side: 'left', demo: 'tap', say: 'Σωστό ή λάθος; Διάβασε την πρόταση. Αν ισχύει, πάτα το πράσινο τικ. Αν όχι, το κόκκινο Χ.' },
    ];
    case 'match-pairs': return [
      { el: 'answer.match-left', title: 'Πρώτα από εδώ', text: 'Πάτα ένα από τα αριστερά…', side: 'right', demo: 'tap', say: 'Πρώτα, πάτα ένα από τα αριστερά…' },
      { el: 'answer.match-right', title: '…και μετά το ταίρι του', text: '…και μετά αυτό που του ταιριάζει δεξιά. Όταν ταιριάξουν όλα, τελειώνεις.', side: 'left', demo: 'tap', say: 'Και μετά, αυτό που του ταιριάζει δεξιά. Όταν ταιριάξουν όλα, τελειώνεις!' },
    ];
    case 'ordering': return [
      { el: 'answer.order', title: 'Βάλε σειρά', text: 'Σύρε κάθε κουτί με το δάχτυλο στη θέση του, από πάνω προς τα κάτω.', side: 'left', demo: 'swipe' },
      { el: 'answer.order-submit', title: 'Τελείωσες;', text: 'Όταν είναι όλα στη σειρά, πάτα εδώ.', side: 'top' },
    ];
    case 'fill-blank': return [
      { el: 'answer.blank', title: 'Τα κενά', text: 'Πάτα ένα κενό…', side: 'bottom', demo: 'tap' },
      { el: 'answer.words', title: 'Οι λέξεις', text: '…και μετά τη λέξη που ταιριάζει. Πάτα ξανά μια λέξη στο κενό για να τη βγάλεις.', side: 'top', demo: 'tap', say: 'Και μετά, τη λέξη που ταιριάζει. Πάτα ξανά μια λέξη στο κενό για να τη βγάλεις.' },
      { el: 'answer.blank-check', title: 'Τελείωσες;', text: 'Διάβασε την πρόταση. Αν είναι σωστή, πάτα εδώ.', side: 'top' },
    ];
    case 'number-input': return [
      { el: 'answer.number', title: 'Η απάντησή σου', text: 'Εδώ φαίνεται ο αριθμός που γράφεις.', side: 'bottom' },
      { el: 'answer.numpad', title: 'Τα πλήκτρα', text: 'Γράψε τον αριθμό. Με το ⌫ σβήνεις, με το OK απαντάς.', side: 'left', demo: 'tap', say: 'Τα πλήκτρα. Γράψε τον αριθμό. Με το βελάκι σβήνεις, και με το Όκέι απαντάς.' },
    ];
    default: return [];
  }
};
