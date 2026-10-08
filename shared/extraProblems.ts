// Extra problems («Κι άλλο πρόβλημα», #67): one left with ✕ stays a card on her screens, resumed where
// she left it, and the button draws a new one. The server (startExtraProblem, db.ts) and her screens
// (UserExercises.tsx) read the same limit and say the same reasons.

/** At most this many extra problems left unfinished at once: with that many, she finishes one first. */
export const MAX_SET_ASIDE = 3;

/** The button's label while MAX_SET_ASIDE extras wait (the cards sit right above it). */
export const finishOneFirst = 'Τελείωσε πρώτα ένα από αυτά';

/** The server's refusals, shown under the button as they come. */
export const extraRefusals = {
  setAside: `Έχεις ήδη ${MAX_SET_ASIDE} έξτρα προβλήματα. Τελείωσε πρώτα ένα από αυτά.`,
  // Every problem of her grade is waiting for her today (a tiny pool): none is handed out twice
  noneLeft: 'Δεν έχει άλλο πρόβλημα για σήμερα. Τελείωσε πρώτα ένα από αυτά που έχεις.',
} as const;
