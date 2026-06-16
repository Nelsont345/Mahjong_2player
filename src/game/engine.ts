import type {
  GameState,
  GameMode,
  PlayerState,
  Tile,
  Wind,
  ClaimIntent,
  ClaimResponder,
} from './types'
import { buildWall, isBonus, sortTiles, tileKey } from './tiles'
import { isWinningHand, claimOptions, concealedKongKeys } from './win'

const HAND_SIZE = 13
const SEATS: Wind[] = ['E', 'S', 'W', 'N']
const SEAT_NAME: Record<Wind, string> = { E: 'East', S: 'South', W: 'West', N: 'North' }
/** Default names for the human players, in seat order. */
const HUMAN_NAMES = ['牛三', '笑言']

export function seatWindName(w: Wind): string {
  return SEAT_NAME[w]
}

function nextPlayer(p: number): number {
  return (p + 1) % 4
}

function distance(from: number, p: number): number {
  return (p - from + 4) % 4
}

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

function humanCount(mode: GameMode): number {
  return mode === '2p2ai' ? 2 : 1
}

export function newGame(mode: GameMode, names?: string[]): GameState {
  const wall = buildWall()
  const humans = humanCount(mode)

  const players: PlayerState[] = SEATS.map((seat, i) => {
    const kind = i < humans ? 'human' : 'ai'
    const name = kind === 'human' ? names?.[i] || HUMAN_NAMES[i] : `AI ${SEAT_NAME[seat]}`
    return { hand: [], melds: [], flowers: [], discards: [], seat, kind, name }
  })

  for (const p of players) {
    while (p.hand.length < HAND_SIZE) {
      const tile = drawWithFlowers(wall, p)
      if (!tile) break
      p.hand.push(tile)
    }
    p.hand = sortTiles(p.hand)
  }

  const state: GameState = {
    mode,
    wall,
    players,
    current: 0,
    phase: 'discard',
    claim: null,
    lastDiscard: null,
    drawnTileId: null,
    winner: null,
    winType: null,
    drawnGame: false,
    turnCount: 0,
    message: '',
  }

  startTurn(state, 0) // East draws the opening tile
  return state
}

export type Action =
  | { type: 'NEW_GAME'; mode: GameMode; names?: string[] }
  | { type: 'DISCARD'; tileId: string }
  | { type: 'SELF_DRAW_WIN' }
  | { type: 'CONCEALED_KONG'; key: string }
  | { type: 'ADDED_KONG'; key: string }
  | { type: 'CLAIM_RESPOND'; player: number; intent: ClaimIntent }

// ---- helpers ---------------------------------------------------------------

function endInDrawnGame(s: GameState): void {
  s.phase = 'over'
  s.drawnGame = true
  s.claim = null
  s.drawnTileId = null
  s.message = 'The wall is exhausted — the round is a draw.'
}

function startTurn(s: GameState, player: number): void {
  s.current = player
  s.claim = null
  s.lastDiscard = null
  const tile = drawWithFlowers(s.wall, s.players[player])
  if (!tile) {
    endInDrawnGame(s)
    return
  }
  s.players[player].hand.push(tile)
  s.players[player].hand = sortTiles(s.players[player].hand)
  s.drawnTileId = tile.id
  s.phase = 'discard'
  s.message = `${s.players[player].name} to discard.`
}

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

function removeLastDiscardTile(s: GameState): Tile | null {
  if (!s.lastDiscard) return null
  const pile = s.players[s.lastDiscard.by].discards
  const i = pile.findIndex((t) => t.id === s.lastDiscard!.tile.id)
  if (i < 0) return null
  return pile.splice(i, 1)[0]
}

function claimPriority(intent: ClaimIntent): number {
  switch (intent.kind) {
    case 'ron':
      return 3
    case 'pung':
    case 'kong':
      return 2
    case 'chow':
      return 1
    case 'pass':
      return 0
  }
}

/** Open the claim window for a freshly discarded tile. */
function openClaimWindow(s: GameState, discarder: number, tile: Tile): void {
  const next = nextPlayer(discarder)
  const responders: ClaimResponder[] = []
  for (let i = 1; i <= 3; i++) {
    const p = (discarder + i) % 4
    const player = s.players[p]
    const opt = claimOptions(player.hand, player.melds.length, tile.kind)
    const chows = p === next ? opt.chows : [] // chow only from the next seat
    const available = { pung: opt.pung, kong: opt.kong, ron: opt.ron, chows }
    const hasClaim = available.pung || available.kong || available.ron || chows.length > 0
    responders.push({
      player: p,
      available,
      decided: !hasClaim, // nothing to claim -> auto-pass, never blocks
      intent: hasClaim ? null : { kind: 'pass' },
    })
  }
  s.phase = 'claim'
  s.claim = { tile, discarder, responders }
  const waiting = responders.filter((r) => !r.decided)
  s.message =
    waiting.length > 0
      ? `${waiting.map((r) => s.players[r.player].name).join(', ')} may claim ${s.players[discarder].name}'s discard.`
      : `${s.players[discarder].name} discarded.`
  resolveClaimIfReady(s)
}

/** Execute a single claim for `responder` against the current discard. */
function executeClaim(s: GameState, player: number, intent: ClaimIntent): void {
  const claimer = s.players[player]
  const key = tileKey(s.claim!.tile.kind)

  if (intent.kind === 'ron') {
    const discard = removeLastDiscardTile(s)!
    claimer.hand.push(discard)
    claimer.hand = sortTiles(claimer.hand)
    s.winner = player
    s.winType = 'discard'
    s.phase = 'over'
    s.claim = null
    s.message = `${claimer.name} wins by claiming the discard!`
    return
  }

  if (intent.kind === 'pung') {
    const fromHand = takeMatching(claimer.hand, key, 2)
    const discard = removeLastDiscardTile(s)!
    claimer.melds.push({ type: 'pung', tiles: sortTiles([...fromHand, discard]), concealed: false })
    s.drawnTileId = null
    toDiscardAfterClaim(s, player, `${claimer.name} called Pung — discard a tile.`)
    return
  }

  if (intent.kind === 'kong') {
    const fromHand = takeMatching(claimer.hand, key, 3)
    const discard = removeLastDiscardTile(s)!
    claimer.melds.push({ type: 'kong', tiles: sortTiles([...fromHand, discard]), concealed: false })
    const rep = drawWithFlowers(s.wall, claimer)
    if (!rep) {
      endInDrawnGame(s)
      return
    }
    claimer.hand.push(rep)
    claimer.hand = sortTiles(claimer.hand)
    s.drawnTileId = rep.id
    toDiscardAfterClaim(s, player, `${claimer.name} called Kong and drew a replacement.`)
    return
  }

  if (intent.kind === 'chow') {
    const a = takeById(claimer.hand, intent.tileIds[0])
    const b = takeById(claimer.hand, intent.tileIds[1])
    const discard = removeLastDiscardTile(s)!
    claimer.melds.push({ type: 'chow', tiles: sortTiles([a!, b!, discard]), concealed: false })
    s.drawnTileId = null
    toDiscardAfterClaim(s, player, `${claimer.name} called Chow — discard a tile.`)
  }
}

function toDiscardAfterClaim(s: GameState, player: number, message: string): void {
  s.current = player
  s.claim = null
  s.lastDiscard = null
  s.phase = 'discard'
  s.message = message
}

/** Resolve the claim window if every responder has decided. */
function resolveClaimIfReady(s: GameState): void {
  if (!s.claim) return
  if (s.claim.responders.some((r) => !r.decided)) return

  const discarder = s.claim.discarder
  let winner: ClaimResponder | null = null
  for (const r of s.claim.responders) {
    if (!r.intent || r.intent.kind === 'pass') continue
    if (
      winner === null ||
      claimPriority(r.intent) > claimPriority(winner.intent!) ||
      (claimPriority(r.intent) === claimPriority(winner.intent!) &&
        distance(discarder, r.player) < distance(discarder, winner.player))
    ) {
      winner = r
    }
  }

  if (winner) {
    executeClaim(s, winner.player, winner.intent!)
  } else {
    startTurn(s, nextPlayer(discarder))
  }
}

// ---- reducer ---------------------------------------------------------------

export function reducer(state: GameState, action: Action): GameState {
  if (action.type === 'NEW_GAME') return newGame(action.mode, action.names)
  if (state.phase === 'over') return state

  const s: GameState = structuredClone(state)

  switch (action.type) {
    case 'DISCARD': {
      if (s.phase !== 'discard') return state
      const me = s.current
      const tile = takeById(s.players[me].hand, action.tileId)
      if (!tile) return state
      s.players[me].discards.push(tile)
      s.lastDiscard = { tile, by: me }
      s.drawnTileId = null
      s.turnCount += 1
      openClaimWindow(s, me, tile)
      return s
    }

    case 'SELF_DRAW_WIN': {
      if (s.phase !== 'discard') return state
      const me = s.current
      if (!isWinningHand(s.players[me].hand, s.players[me].melds.length)) return state
      s.winner = me
      s.winType = 'self-draw'
      s.phase = 'over'
      s.message = `${s.players[me].name} wins by self-draw!`
      return s
    }

    case 'CONCEALED_KONG': {
      if (s.phase !== 'discard') return state
      const me = s.current
      const fromHand = takeMatching(s.players[me].hand, action.key, 4)
      if (fromHand.length < 4) return state
      s.players[me].melds.push({ type: 'kong', tiles: sortTiles(fromHand), concealed: true })
      const rep = drawWithFlowers(s.wall, s.players[me])
      if (!rep) return (endInDrawnGame(s), s)
      s.players[me].hand.push(rep)
      s.players[me].hand = sortTiles(s.players[me].hand)
      s.drawnTileId = rep.id
      s.message = `${s.players[me].name} declared a concealed Kong.`
      return s
    }

    case 'ADDED_KONG': {
      if (s.phase !== 'discard') return state
      const me = s.current
      const meld = s.players[me].melds.find(
        (m) => m.type === 'pung' && tileKey(m.tiles[0].kind) === action.key,
      )
      if (!meld) return state
      const fourth = takeMatching(s.players[me].hand, action.key, 1)
      if (fourth.length < 1) return state
      meld.type = 'kong'
      meld.tiles = sortTiles([...meld.tiles, ...fourth])
      const rep = drawWithFlowers(s.wall, s.players[me])
      if (!rep) return (endInDrawnGame(s), s)
      s.players[me].hand.push(rep)
      s.players[me].hand = sortTiles(s.players[me].hand)
      s.drawnTileId = rep.id
      s.message = `${s.players[me].name} extended a Pung to a Kong.`
      return s
    }

    case 'CLAIM_RESPOND': {
      if (s.phase !== 'claim' || !s.claim) return state
      const check = canClaim(state, action.player, action.intent)
      if (!check.ok) return state
      const responder = s.claim.responders.find((r) => r.player === action.player)!
      responder.decided = true
      responder.intent = action.intent
      resolveClaimIfReady(s)
      return s
    }

    default:
      return state
  }
}

// ---- validation + selectors ------------------------------------------------

/** Stable reason code for a denied claim (localized on the client). */
export type ClaimDenyCode =
  | 'noDiscard'
  | 'ownDiscard'
  | 'alreadyResponded'
  | 'cantPung'
  | 'cantKong'
  | 'cantRon'
  | 'cantChow'

/** Whether `player` may legally make claim `intent` right now (and why not). */
export function canClaim(
  state: GameState,
  player: number,
  intent: ClaimIntent,
): { ok: boolean; code?: ClaimDenyCode } {
  if (state.phase !== 'claim' || !state.claim) return { ok: false, code: 'noDiscard' }
  const responder = state.claim.responders.find((r) => r.player === player)
  if (!responder) return { ok: false, code: 'ownDiscard' }
  if (responder.decided) return { ok: false, code: 'alreadyResponded' }

  const a = responder.available
  switch (intent.kind) {
    case 'pass':
      return { ok: true }
    case 'pung':
      return a.pung ? { ok: true } : { ok: false, code: 'cantPung' }
    case 'kong':
      return a.kong ? { ok: true } : { ok: false, code: 'cantKong' }
    case 'ron':
      return a.ron ? { ok: true } : { ok: false, code: 'cantRon' }
    case 'chow': {
      const ok = a.chows.some(
        (c) =>
          (c.tileIds[0] === intent.tileIds[0] && c.tileIds[1] === intent.tileIds[1]) ||
          (c.tileIds[0] === intent.tileIds[1] && c.tileIds[1] === intent.tileIds[0]),
      )
      return ok ? { ok: true } : { ok: false, code: 'cantChow' }
    }
  }
}

/** The responder entry for `seat`, if they still need to decide a claim. */
export function pendingResponder(state: GameState, seat: number): ClaimResponder | null {
  if (state.phase !== 'claim' || !state.claim) return null
  const r = state.claim.responders.find((x) => x.player === seat)
  return r && !r.decided ? r : null
}

/** Seats (any kind) that still owe a claim decision. */
export function pendingSeats(state: GameState): number[] {
  if (state.phase !== 'claim' || !state.claim) return []
  return state.claim.responders.filter((r) => !r.decided).map((r) => r.player)
}

export function canSelfDrawWin(state: GameState): boolean {
  if (state.phase !== 'discard') return false
  const p = state.players[state.current]
  return isWinningHand(p.hand, p.melds.length)
}

export function availableConcealedKongs(state: GameState): string[] {
  if (state.phase !== 'discard') return []
  return concealedKongKeys(state.players[state.current].hand)
}

export function availableAddedKongs(state: GameState): string[] {
  if (state.phase !== 'discard') return []
  const player = state.players[state.current]
  const keys: string[] = []
  for (const meld of player.melds) {
    if (meld.type !== 'pung') continue
    const key = tileKey(meld.tiles[0].kind)
    if (player.hand.some((t) => tileKey(t.kind) === key)) keys.push(key)
  }
  return keys
}
