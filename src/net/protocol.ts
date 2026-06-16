import type { GameMode, GameState } from '../game/types'
import type { Action, ClaimDenyCode } from '../game/engine'

export type { GameMode, GameState, Action }

/** Codes for server-side warnings/errors, localized on the client. */
export type NoticeCode = ClaimDenyCode | 'notYourTurn' | 'roomFull' | 'serverError'

export interface LobbySeat {
  seat: number
  name: string
  kind: 'human' | 'ai'
  connected: boolean
  ready: boolean
}

/** Messages sent from a client to the server. */
export type ClientMsg =
  | { t: 'join'; mode: GameMode; name?: string }
  | { t: 'ready'; ready: boolean }
  | { t: 'action'; action: Action }
  | { t: 'reset' }

/** Messages sent from the server to a client. */
export type ServerMsg =
  | { t: 'joined'; seat: number; mode: GameMode; roomId: string }
  | { t: 'lobby'; mode: GameMode; seats: LobbySeat[]; needed: number; canStart: boolean }
  | { t: 'state'; you: number; state: GameState }
  | { t: 'warning'; code: NoticeCode }
  | { t: 'error'; code: NoticeCode }
