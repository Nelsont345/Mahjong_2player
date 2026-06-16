import type { Tile, TileKind, Suit, Wind, Dragon } from './types'

const WINDS: Wind[] = ['E', 'S', 'W', 'N']
const DRAGONS: Dragon[] = ['red', 'green', 'white']
const SUITS: Suit[] = ['man', 'pin', 'sou']

/**
 * Canonical key that ignores tile identity, used for melд/win matching and
 * sorting. Bonus tiles (flowers/seasons) never take part in melds.
 *   man 1-9 -> m1..m9, pin -> p1..p9, sou -> s1..s9
 *   winds   -> wE wS wW wN, dragons -> dr dg dw
 *   flowers -> f1..f4, seasons -> e1..e4
 */
export function tileKey(kind: TileKind): string {
  switch (kind.type) {
    case 'suit':
      return `${kind.suit[0]}${kind.rank}`
    case 'wind':
      return `w${kind.wind}`
    case 'dragon':
      return `d${kind.dragon[0]}`
    case 'flower':
      return `f${kind.index}`
    case 'season':
      return `e${kind.index}`
  }
}

export function isBonus(kind: TileKind): boolean {
  return kind.type === 'flower' || kind.type === 'season'
}

export function isSuited(kind: TileKind): kind is { type: 'suit'; suit: Suit; rank: number } {
  return kind.type === 'suit'
}

export function isHonor(kind: TileKind): boolean {
  return kind.type === 'wind' || kind.type === 'dragon'
}

/** 1 and 9 of a suit. */
export function isTerminal(kind: TileKind): boolean {
  return kind.type === 'suit' && (kind.rank === 1 || kind.rank === 9)
}

/** Terminal or honor — the tiles used by the Thirteen Orphans hand. */
export function isTerminalOrHonor(kind: TileKind): boolean {
  return isTerminal(kind) || isHonor(kind)
}

/** Stable sort order for displaying a hand. */
const SUIT_ORDER: Record<Suit, number> = { man: 0, pin: 1, sou: 2 }
const WIND_ORDER: Record<Wind, number> = { E: 0, S: 1, W: 2, N: 3 }
const DRAGON_ORDER: Record<Dragon, number> = { red: 0, green: 1, white: 2 }

function sortRank(kind: TileKind): number {
  switch (kind.type) {
    case 'suit':
      return SUIT_ORDER[kind.suit] * 100 + kind.rank
    case 'wind':
      return 1000 + WIND_ORDER[kind.wind]
    case 'dragon':
      return 1100 + DRAGON_ORDER[kind.dragon]
    case 'flower':
      return 2000 + kind.index
    case 'season':
      return 2100 + kind.index
  }
}

export function sortTiles<T extends Tile>(tiles: T[]): T[] {
  return [...tiles].sort((a, b) => sortRank(a.kind) - sortRank(b.kind))
}

/** Build a full, shuffled 144-tile wall (136 playing + 8 bonus). */
export function buildWall(): Tile[] {
  const kinds: TileKind[] = []

  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let i = 0; i < 4; i++) kinds.push({ type: 'suit', suit, rank })
    }
  }
  for (const wind of WINDS) {
    for (let i = 0; i < 4; i++) kinds.push({ type: 'wind', wind })
  }
  for (const dragon of DRAGONS) {
    for (let i = 0; i < 4; i++) kinds.push({ type: 'dragon', dragon })
  }
  for (let index = 1; index <= 4; index++) kinds.push({ type: 'flower', index })
  for (let index = 1; index <= 4; index++) kinds.push({ type: 'season', index })

  const tiles: Tile[] = kinds.map((kind, i) => ({ id: `t${i}`, kind }))
  return shuffle(tiles)
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---- Display ---------------------------------------------------------------

const MAN_BASE = 0x1f007 // 🀇 .. 🀏  (characters 1-9)
const SOU_BASE = 0x1f010 // 🀐 .. 🀘  (bamboo 1-9)
const PIN_BASE = 0x1f019 // 🀙 .. 🀡  (circles 1-9)
const WIND_GLYPH: Record<Wind, string> = {
  E: '\u{1F000}',
  S: '\u{1F001}',
  W: '\u{1F002}',
  N: '\u{1F003}',
}
const DRAGON_GLYPH: Record<Dragon, string> = {
  red: '\u{1F004}',
  green: '\u{1F005}',
  white: '\u{1F006}',
}
const FLOWER_GLYPHS = ['\u{1F022}', '\u{1F023}', '\u{1F024}', '\u{1F025}']
const SEASON_GLYPHS = ['\u{1F026}', '\u{1F027}', '\u{1F028}', '\u{1F029}']

/** Unicode mahjong glyph for a tile. */
export function tileGlyph(kind: TileKind): string {
  switch (kind.type) {
    case 'suit': {
      const base = kind.suit === 'man' ? MAN_BASE : kind.suit === 'sou' ? SOU_BASE : PIN_BASE
      return String.fromCodePoint(base + (kind.rank - 1))
    }
    case 'wind':
      return WIND_GLYPH[kind.wind]
    case 'dragon':
      return DRAGON_GLYPH[kind.dragon]
    case 'flower':
      return FLOWER_GLYPHS[kind.index - 1]
    case 'season':
      return SEASON_GLYPHS[kind.index - 1]
  }
}

/** CSS modifier class that colors the tile glyph by suit/honor. */
export function tileColorClass(kind: TileKind): string {
  switch (kind.type) {
    case 'suit':
      return `tile--${kind.suit}` // tile--man, tile--pin, tile--sou
    case 'wind':
      return 'tile--wind'
    case 'dragon':
      return `tile--dragon-${kind.dragon}`
    case 'flower':
      return 'tile--flower'
    case 'season':
      return 'tile--season'
  }
}

const SUIT_LABEL: Record<Suit, string> = { man: 'Characters', pin: 'Circles', sou: 'Bamboo' }
const WIND_LABEL: Record<Wind, string> = { E: 'East', S: 'South', W: 'West', N: 'North' }
const DRAGON_LABEL: Record<Dragon, string> = { red: 'Red Dragon', green: 'Green Dragon', white: 'White Dragon' }
const FLOWER_LABEL = ['Plum', 'Orchid', 'Bamboo', 'Chrysanthemum']
const SEASON_LABEL = ['Spring', 'Summer', 'Autumn', 'Winter']

/** Human-readable name (tooltip / accessibility). */
export function tileLabel(kind: TileKind): string {
  switch (kind.type) {
    case 'suit':
      return `${kind.rank} of ${SUIT_LABEL[kind.suit]}`
    case 'wind':
      return `${WIND_LABEL[kind.wind]} Wind`
    case 'dragon':
      return DRAGON_LABEL[kind.dragon]
    case 'flower':
      return `Flower: ${FLOWER_LABEL[kind.index - 1]}`
    case 'season':
      return `Season: ${SEASON_LABEL[kind.index - 1]}`
  }
}
