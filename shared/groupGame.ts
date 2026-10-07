// The group game's turns (#26). The server accepts an answer only from the player on turn, for the
// question on screen, and the screen shows the same player on turn: one rule, here.
//
// Type imports only, so the backend (CommonJS) and the frontend (Vite) can both load it.

import type { ExerciseSession } from './types';

/** The question on screen, counted across rounds (answers accumulate across rounds). */
export const currentQuestion = (s: ExerciseSession): number =>
  (s.currentRound - 1) * s.questionsPerRound + s.currentQuestionIndex;

/**
 * The player on turn: the first one, in the game's order, who hasn't answered the question on
 * screen. `players` leaves out the kids no longer in the config (their turn never comes).
 */
export const playerOnTurn = (s: ExerciseSession, players: string[] = s.playerIds): string | undefined =>
  players.find(pid => (s.answers[pid]?.length ?? 0) <= currentQuestion(s));
