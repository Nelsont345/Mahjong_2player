import type { GameState, PlayerState, PlayerIndex, Tile, Meld } from './types'
import { buildWall, isBonus, sortTiles, tileKey } from './tiles'
import {
  isWinningHand,
  claimOptions,
  concealedKongKeys,
  type ClaimOptions,
} from './win'

const HAND_SIZE = 13

function other(p: PlayerIndex): PlayerIndex {
  return p === 0 ? 1 : 0
}

function emptyPlayer(): PlayerState {
  return { hand: [], melds: [], flowers: [], discards: [] }
}

/**
 * Draw the next playing tile from the wall into `player`, setting aside any
 * flower/season tiles drawn along the way. Mutates the wall and the player.
 * Returns the drawn playing tile, or null if the wall ran out.
 */
function drawWithFlowers(wall: Tile[], player: PlayerState): Tile | null {
  while (wall.length > 0) {
    const tile = wall.shift()!
    if (isBonus(tile.kind)) {
      player.flowers.push(tile)
      continue
    }
    return tile
  }
  return null
}

export function newGame(): GameState {
  const wall = buildWall()
  const players: [PlayerState, PlayerState] = [emptyPlayer(), emptyPlayer()]

  for (const p of players) {
    while (p.hand.length < HAND_SIZE) {
      const tile = drawWithFlowers(wall, p)
      if (!tile) break
      p.hand.push(tile)
    }
    p.hand = sortTiles(p.hand)
  }

  return {
    wall,
    players,
    current: 0,
    phase: 'choosing',
    lastDiscard: null,
    drawnTileId: null,
    awaitingPass: true,
    winner: null,
    winType: null,
    drawnGame: false,
    turnCount: 0,
    message: "Player 1's turn — draw a tile or claim a discard.",
  }
}

export type Action =
  | { type: 'NEW_GAME' }
  | { type: 'REVEAL' }
  | { type: 'DRAW' }
  | { type: 'DISCARD'; tileId: string }
  | { type: 'CLAIM_PUNG' }
  | { type: 'CLAIM_KONG' }
  | { type: 'CLAIM_CHOW'; tileIds: [string, string] }
  | { type: 'CLAIM_RON' }
  | { type: 'SELF_DRAW_WIN' }
  | { type: 'CONCEALED_KONG'; key: string }
  | { type: 'ADDED_KONG'; key: string }

/** Pull `count` tiles matching `key` out of `hand`; returns them (mutates hand). */
function takeMatching(hand: Tile[], key: string, count: number): Tile[] {
  const taken: Tile[] = []
  for (let i = hand.length - 1; i >= 0 && taken.length < count; i--) {
    if (tileKey(hand[i].kind) === key) taken.push(...hand.splice(i, 1))
  }
  return taken
}

function takeById(hand: Tile[], id: string): Tile | null {
  const i = hand.findIndex((t) => t.id === id)
  if (i < 0) return null
  return hand.splice(i, 1)[0]
}

function removeLastDiscardTile(state: GameState): Tile | null {
  if (!state.lastDiscard) return null
  const opp = state.players[state.lastDiscard.by]
  const id = state.lastDiscard.tile.id
  const i = opp.discards.findIndex((t) => t.id === id)
  if (i < 0) return null
  return opp.discards.splice(i, 1)[0]
}

function endInDrawnGame(state: GameState): GameState {
  state.phase = 'over'
  state.drawnGame = true
  state.awaitingPass = false
  state.drawnTileId = null
  state.message = 'The wall is exhausted — the round is a draw.'
  return state
}

export function reducer(state: GameState, action: Action): GameState {
  if (action.type === 'NEW_GAME') return newGame()
  if (state.phase === 'over') return state

  const next: GameState = structuredClone(state)
  const me = next.current
  const player = next.players[me]

  switch (action.type) {
    case 'REVEAL': {
      next.awaitingPass = false
      return next
    }

    case 'DRAW': {
      if (next.phase !== 'choosing') return state
      // Declining any claim — the opponent's discard stays on the table.
      next.lastDiscard = null
      const tile = drawWithFlowers(next.wall, player)
      if (!tile) return endInDrawnGame(next)
      player.hand.push(tile)
      player.hand = sortTiles(player.hand)
      next.drawnTileId = tile.id
      next.phase = 'discarding'
      next.message = `Player ${me + 1} drew a tile — discard, or declare a win/kong.`
      return next
    }

    case 'CLAIM_PUNG': {
      if (next.phase !== 'choosing' || !next.lastDiscard) return state
      const key = tileKey(next.lastDiscard.tile.kind)
      const fromHand = takeMatching(player.hand, key, 2)
      if (fromHand.length < 2) return state
      const discard = removeLastDiscardTile(next)!
      const meld: Meld = { type: 'pung', tiles: sortTiles([...fromHand, discard]), concealed: false }
      player.melds.push(meld)
      next.lastDiscard = null
      next.drawnTileId = null
      next.phase = 'discarding'
      next.message = `Player ${me + 1} called Pung — now discard a tile.`
      return next
    }

    case 'CLAIM_KONG': {
      if (next.phase !== 'choosing' || !next.lastDiscard) return state
      const key = tileKey(next.lastDiscard.tile.kind)
      const fromHand = takeMatching(player.hand, key, 3)
      if (fromHand.length < 3) return state
      const discard = removeLastDiscardTile(next)!
      const meld: Meld = { type: 'kong', tiles: sortTiles([...fromHand, discard]), concealed: false }
      player.melds.push(meld)
      next.lastDiscard = null
      const replacement = drawWithFlowers(next.wall, player)
      if (!replacement) return endInDrawnGame(next)
      player.hand.push(replacement)
      player.hand = sortTiles(player.hand)
      next.drawnTileId = replacement.id
      next.phase = 'discarding'
      next.message = `Player ${me + 1} called Kong and drew a replacement — now discard.`
      return next
    }

    case 'CLAIM_CHOW': {
      if (next.phase !== 'choosing' || !next.lastDiscard) return state
      const a = takeById(player.hand, action.tileIds[0])
      const b = takeById(player.hand, action.tileIds[1])
      if (!a || !b) return state
      const discard = removeLastDiscardTile(next)!
      const meld: Meld = { type: 'chow', tiles: sortTiles([a, b, discard]), concealed: false }
      player.melds.push(meld)
      next.lastDiscard = null
      next.drawnTileId = null
      next.phase = 'discarding'
      next.message = `Player ${me + 1} called Chow — now discard a tile.`
      return next
    }

    case 'CLAIM_RON': {
      if (next.phase !== 'choosing' || !next.lastDiscard) return state
      const discard = removeLastDiscardTile(next)!
      player.hand.push(discard)
      player.hand = sortTiles(player.hand)
      if (!isWinningHand(player.hand, player.melds.length)) return state
      next.winner = me
      next.winType = 'discard'
      next.phase = 'over'
      next.awaitingPass = false
      next.message = `Player ${me + 1} wins by claiming the discard!`
      return next
    }

    case 'DISCARD': {
      if (next.phase !== 'discarding') return state
      const tile = takeById(player.hand, action.tileId)
      if (!tile) return state
      player.discards.push(tile)
      next.lastDiscard = { tile, by: me }
      next.drawnTileId = null
      next.current = other(me)
      next.phase = 'choosing'
      next.awaitingPass = true
      next.turnCount += 1
      next.message = `Player ${other(me) + 1}'s turn.`
      return next
    }

    case 'SELF_DRAW_WIN': {
      if (next.phase !== 'discarding') return state
      if (!isWinningHand(player.hand, player.melds.length)) return state
      next.winner = me
      next.winType = 'self-draw'
      next.phase = 'over'
      next.awaitingPass = false
      next.message = `Player ${me + 1} wins by self-draw!`
      return next
    }

    case 'CONCEALED_KONG': {
      if (next.phase !== 'discarding') return state
      const fromHand = takeMatching(player.hand, action.key, 4)
      if (fromHand.length < 4) return state
      player.melds.push({ type: 'kong', tiles: sortTiles(fromHand), concealed: true })
      const replacement = drawWithFlowers(next.wall, player)
      if (!replacement) return endInDrawnGame(next)
      player.hand.push(replacement)
      player.hand = sortTiles(player.hand)
      next.drawnTileId = replacement.id
      next.message = `Player ${me + 1} declared a concealed Kong and drew a replacement.`
      return next
    }

    case 'ADDED_KONG': {
      if (next.phase !== 'discarding') return state
      const meld = player.melds.find((m) => m.type === 'pung' && tileKey(m.tiles[0].kind) === action.key)
      if (!meld) return state
      const fourth = takeMatching(player.hand, action.key, 1)
      if (fourth.length < 1) return state
      meld.type = 'kong'
      meld.tiles = sortTiles([...meld.tiles, ...fourth])
      const replacement = drawWithFlowers(next.wall, player)
      if (!replacement) return endInDrawnGame(next)
      player.hand.push(replacement)
      player.hand = sortTiles(player.hand)
      next.drawnTileId = replacement.id
      next.message = `Player ${me + 1} extended a Pung to a Kong and drew a replacement.`
      return next
    }

    default:
      return state
  }
}

// ---- UI selectors (pure helpers over current state) ------------------------

/** Claim options for the active player against the opponent's last discard. */
export function activeClaimOptions(state: GameState): ClaimOptions | null {
  if (state.phase !== 'choosing' || !state.lastDiscard) return null
  if (state.lastDiscard.by === state.current) return null
  const player = state.players[state.current]
  return claimOptions(player.hand, player.melds.length, state.lastDiscard.tile.kind)
}

export function canSelfDrawWin(state: GameState): boolean {
  if (state.phase !== 'discarding') return false
  const player = state.players[state.current]
  return isWinningHand(player.hand, player.melds.length)
}

/** Tile keys the active player can declare as a concealed kong. */
export function availableConcealedKongs(state: GameState): string[] {
  if (state.phase !== 'discarding') return []
  return concealedKongKeys(state.players[state.current].hand)
}

/** Tile keys the active player can add to an existing exposed pung. */
export function availableAddedKongs(state: GameState): string[] {
  if (state.phase !== 'discarding') return []
  const player = state.players[state.current]
  const keys: string[] = []
  for (const meld of player.melds) {
    if (meld.type !== 'pung') continue
    const key = tileKey(meld.tiles[0].kind)
    if (player.hand.some((t) => tileKey(t.kind) === key)) keys.push(key)
  }
  return keys
}
