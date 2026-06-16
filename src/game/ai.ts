import type { GameState, Tile, ClaimIntent } from './types'
import { tileKey, isSuited, isTerminalOrHonor } from './tiles'
import { type Action, canSelfDrawWin } from './engine'

function counts(hand: Tile[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of hand) m.set(tileKey(t.kind), (m.get(tileKey(t.kind)) ?? 0) + 1)
  return m
}

/**
 * Usefulness of keeping a tile: duplicates (toward pungs) and suit neighbours
 * (toward chows) score high; isolated honours/terminals score low.
 */
function usefulness(tile: Tile, c: Map<string, number>): number {
  const key = tileKey(tile.kind)
  let score = ((c.get(key) ?? 0) - 1) * 2
  if (isSuited(tile.kind)) {
    const s = tile.kind.suit[0]
    const r = tile.kind.rank
    const has = (rank: number) => (c.get(`${s}${rank}`) ?? 0) > 0
    if (r - 1 >= 1 && has(r - 1)) score += 1
    if (r + 1 <= 9 && has(r + 1)) score += 1
    if (r - 2 >= 1 && has(r - 2)) score += 0.5
    if (r + 2 <= 9 && has(r + 2)) score += 0.5
  }
  return score
}

function worstTileId(hand: Tile[]): string {
  const c = counts(hand)
  let best: Tile | null = null
  let bestScore = Infinity
  for (const tile of hand) {
    const score = usefulness(tile, c) + (isTerminalOrHonor(tile.kind) ? -0.1 : 0)
    if (score < bestScore) {
      bestScore = score
      best = tile
    }
  }
  return (best ?? hand[0]).id
}

/** Pung only when a backup pair remains, so the hand can still finish. */
function shouldPung(hand: Tile[], key: string): boolean {
  const c = counts(hand)
  for (const [k, v] of c) {
    if (k !== key && v >= 2) return true
  }
  return false
}

/** Action for the current AI player during their discard turn. */
export function aiAction(state: GameState): Action {
  if (canSelfDrawWin(state)) return { type: 'SELF_DRAW_WIN' }
  return { type: 'DISCARD', tileId: worstTileId(state.players[state.current].hand) }
}

/** Claim decision for an AI responder `player` during the claim window. */
export function aiClaimResponse(state: GameState, player: number): Action {
  const pass: ClaimIntent = { kind: 'pass' }
  const window = state.claim
  const responder = window?.responders.find((r) => r.player === player)
  if (!responder) return { type: 'CLAIM_RESPOND', player, intent: pass }

  const a = responder.available
  let intent: ClaimIntent = pass
  if (a.ron) intent = { kind: 'ron' }
  else if (a.kong) intent = { kind: 'kong' }
  else if (a.pung && shouldPung(state.players[player].hand, tileKey(window!.tile.kind))) {
    intent = { kind: 'pung' }
  }
  // AIs leave chows to drawing.
  return { type: 'CLAIM_RESPOND', player, intent }
}
