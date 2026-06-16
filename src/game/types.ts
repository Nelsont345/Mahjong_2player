// Core domain types for the 4-player Mahjong game.

export type Suit = 'man' | 'pin' | 'sou' // characters, circles, bamboo
export type Wind = 'E' | 'S' | 'W' | 'N'
export type Dragon = 'red' | 'green' | 'white'

export type TileKind =
  | { type: 'suit'; suit: Suit; rank: number } // rank 1-9
  | { type: 'wind'; wind: Wind }
  | { type: 'dragon'; dragon: Dragon }
  | { type: 'flower'; index: number } // 1-4 (plum, orchid, bamboo, chrysanthemum)
  | { type: 'season'; index: number } // 1-4 (spring, summer, autumn, winter)

export interface Tile {
  /** Unique id for this physical tile (stable React key, identity tracking). */
  id: string
  kind: TileKind
}

export type MeldType = 'chow' | 'pung' | 'kong'

export interface Meld {
  type: MeldType
  tiles: Tile[]
  /** True for a concealed kong declared from hand (not claimed from a discard). */
  concealed: boolean
}

export type SeatKind = 'human' | 'ai'

/** '1p3ai' = one human vs three AIs; '2p2ai' = two humans vs two AIs. */
export type GameMode = '1p3ai' | '2p2ai'

export interface PlayerState {
  hand: Tile[]
  melds: Meld[]
  flowers: Tile[]
  discards: Tile[]
  seat: Wind
  kind: SeatKind
  name: string
}

/** A possible sequence claim: the two hand tiles that complete the run. */
export interface ChowOption {
  tileIds: [string, string]
}

/** What a player may do with the tile up for claim. */
export interface ClaimAvailability {
  pung: boolean
  kong: boolean
  ron: boolean
  chows: ChowOption[]
}

/** A player's decision on the tile up for claim. */
export type ClaimIntent =
  | { kind: 'pass' }
  | { kind: 'pung' }
  | { kind: 'kong' }
  | { kind: 'ron' }
  | { kind: 'chow'; tileIds: [string, string] }

export interface ClaimResponder {
  player: number
  available: ClaimAvailability
  decided: boolean
  intent: ClaimIntent | null
}

export interface ClaimWindow {
  tile: Tile
  discarder: number
  /** Every non-discarder; the window resolves once all have decided. */
  responders: ClaimResponder[]
}

/**
 * Phase of play:
 * - 'discard' : `current` player holds a drawn/claimed tile and must discard.
 * - 'claim'   : a tile was just discarded; responders decide claim or pass.
 * - 'over'    : round finished.
 */
export type Phase = 'discard' | 'claim' | 'over'

export type WinType = 'self-draw' | 'discard'

export interface LastDiscard {
  tile: Tile
  by: number
}

export interface GameState {
  mode: GameMode
  wall: Tile[]
  players: PlayerState[] // length 4
  current: number
  phase: Phase
  claim: ClaimWindow | null
  lastDiscard: LastDiscard | null
  drawnTileId: string | null
  winner: number | null
  winType: WinType | null
  drawnGame: boolean
  turnCount: number
  message: string
}
