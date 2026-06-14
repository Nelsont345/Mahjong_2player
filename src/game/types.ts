// Core domain types for the 2-player Mahjong game.

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

export interface PlayerState {
  /** Concealed tiles still in hand. */
  hand: Tile[]
  /** Exposed (and concealed-kong) melds. */
  melds: Meld[]
  /** Bonus flower/season tiles set aside. */
  flowers: Tile[]
  /** Tiles this player has discarded, oldest first. */
  discards: Tile[]
}

export type PlayerIndex = 0 | 1

/**
 * Phase of the active player's access:
 * - 'choosing'   : start of turn — may claim opponent's last discard or draw.
 * - 'discarding' : holds a freshly drawn/claimed tile — must discard (or win/kong).
 * - 'over'       : round finished.
 */
export type Phase = 'choosing' | 'discarding' | 'over'

export type WinType = 'self-draw' | 'discard'

export interface LastDiscard {
  tile: Tile
  by: PlayerIndex
}

export interface GameState {
  wall: Tile[]
  players: [PlayerState, PlayerState]
  /** Whose access it currently is. */
  current: PlayerIndex
  phase: Phase
  lastDiscard: LastDiscard | null
  /** Id of the tile just drawn this access (for highlighting). */
  drawnTileId: string | null
  /**
   * Hot-seat hand-off: when true the board hides the active hand and shows a
   * "pass the device" screen until the active player taps to reveal.
   */
  awaitingPass: boolean
  winner: PlayerIndex | null
  winType: WinType | null
  /** True when the wall ran out before anyone won. */
  drawnGame: boolean
  turnCount: number
  message: string
}
