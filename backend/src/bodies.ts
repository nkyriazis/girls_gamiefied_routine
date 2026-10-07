// The shape of every request body a route reads (#32). Fastify checks it before the handler runs, with
// strict types (no coercion: "5" is not 5), and answers a bad body with a 400 { error } (server.ts's error
// handler) that changes nothing. Unknown fields are ignored: the handlers read only the fields named here.
// What a value means (a balance, a game's size) is db.ts's to check; GAME_LIMITS is shared, not repeated.
// A new route that reads a body gets its schema here and a case in test/bodies.test.ts.
import { GAME_LIMITS } from './db';

const id = { type: 'string', minLength: 1 } as const;
const object = <P extends Record<string, object>, R extends readonly (keyof P & string)[]>(properties: P, required: R) =>
  ({ type: 'object', properties, required }) as const;

/** A parent adds or takes away stars: a whole number, not 0 (the route says so in words). */
export const starsBody = object({ amount: { type: 'integer' } }, ['amount']);
export type StarsBody = { amount: number };

export const spendingBody = object({ userId: id, rewardId: id }, ['userId', 'rewardId']);
export type SpendingBody = { userId: string; rewardId: string };

export const spendingStatusBody = object({ status: { enum: ['done', 'revoked'] } }, ['status']);
export type SpendingStatusBody = { status: 'done' | 'revoked' };

export const transferBody = object({ fromUserId: id, toUserId: id, amount: { type: 'integer', minimum: 1 } }, ['fromUserId', 'toUserId', 'amount']);
export type TransferBody = { fromUserId: string; toUserId: string; amount: number };

export const transferActionBody = object({ action: { enum: ['approve', 'reject', 'cancel'] } }, ['action']);
export type TransferActionBody = { action: 'approve' | 'reject' | 'cancel' };

export const claimBody = object({ userId: id }, ['userId']);
export type ClaimBody = { userId: string };

/** No stars: the chore's own defaultStars. 0 pays nothing (as the state schema allows). */
export const confirmBody = object({ stars: { type: 'integer', minimum: 0 } }, []);
export type ConfirmBody = { stars?: number };

export const gameBody = object({
  playerIds: { type: 'array', items: id, minItems: 1, maxItems: GAME_LIMITS.players, uniqueItems: true },
  categories: { type: 'array', items: { type: 'string' } },
  totalRounds: { type: 'integer', minimum: 1, maximum: GAME_LIMITS.rounds },
  questionsPerRound: { type: 'integer', minimum: 1, maximum: GAME_LIMITS.questionsPerRound },
}, ['playerIds', 'categories', 'totalRounds', 'questionsPerRound']);
export type GameBody = { playerIds: string[]; categories: string[]; totalRounds: number; questionsPerRound: number };

/** An answer is any JSON value (an index, a boolean, pairs, a problem step), checked per exercise type, but it is there. */
export const gameAnswerBody = object({ userId: id, exerciseId: id, answer: {} }, ['userId', 'exerciseId', 'answer']);
export type GameAnswerBody = { userId: string; exerciseId: string; answer: unknown };

export const answerBody = object({ answer: {} }, ['answer']);
export type AnswerBody = { answer: unknown };

export const userBody = object({ userId: id }, ['userId']);
export type UserBody = { userId: string };

/** markHelpSeen checks each id's pattern. */
export const helpSeenBody = object({ tourIds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 } }, ['tourIds']);
export type HelpSeenBody = { tourIds: string[] };

/** Who closed a running routine: the kids' screens (no body, or no `by`) or a parent's «Τέλος» (#63). */
export const closeBody = object({ by: { enum: ['kid', 'parent'] } }, []);
export type CloseBody = { by?: 'kid' | 'parent' };

/** No userId (or no body at all): every tour. */
export const helpResetBody = object({ userId: { type: 'string' } }, []);
export type HelpResetBody = { userId?: string };

export const pushBody = object({ id }, ['id']);
export type PushBody = { id: string };

/** An ISO time or HH:mm (the route reads which). */
export const timeBody = object({ time: id }, ['time']);
export type TimeBody = { time: string };
