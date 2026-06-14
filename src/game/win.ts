import type { Tile, TileKind } from './types'
import { tileKey, isSuited, isTerminalOrHonor } from './tiles'

/** Count map keyed by canonical tileKey. */
type Counts = Map<string, number>

function toCounts(kinds: TileKind[]): Counts {
  const m: Counts = new Map()
  for (const k of kinds) {
    const key = tileKey(k)
    m.set(key, (m.get(key) ?? 0) + 1)
  }
  return m
}

function total(counts: Counts): number {
  let n = 0
  for (const v of counts.values()) n += v
  return n
}

/** Canonical order over keys so recursion is deterministic. */
function firstNonZeroKey(counts: Counts): string | null {
  let best: string | null = null
  for (const [key, v] of counts) {
    if (v > 0 && (best === null || key < best)) best = key
  }
  return best
}

/** For a suited key like "m3" return the keys of the next two ranks, else null. */
function chowContinuation(key: string): [string, string] | null {
  const letter = key[0]
  if (letter !== 'm' && letter !== 'p' && letter !== 's') return null
  const rank = Number(key.slice(1))
  if (rank > 7) return null
  return [`${letter}${rank + 1}`, `${letter}${rank + 2}`]
}

/** Can `counts` be partitioned into exactly `groups` melds (each a pung or chow)? */
function formsGroups(counts: Counts, groups: number): boolean {
  if (total(counts) === 0) return groups === 0
  if (groups === 0) return false

  const key = firstNonZeroKey(counts)!

  // Try a pung (triplet).
  if ((counts.get(key) ?? 0) >= 3) {
    counts.set(key, counts.get(key)! - 3)
    if (formsGroups(counts, groups - 1)) {
      counts.set(key, counts.get(key)! + 3)
      return true
    }
    counts.set(key, counts.get(key)! + 3)
  }

  // Try a chow (run of three within a suit).
  const cont = chowContinuation(key)
  if (cont) {
    const [k1, k2] = cont
    if ((counts.get(k1) ?? 0) >= 1 && (counts.get(k2) ?? 0) >= 1) {
      counts.set(key, counts.get(key)! - 1)
      counts.set(k1, counts.get(k1)! - 1)
      counts.set(k2, counts.get(k2)! - 1)
      const ok = formsGroups(counts, groups - 1)
      counts.set(key, counts.get(key)! + 1)
      counts.set(k1, counts.get(k1)! + 1)
      counts.set(k2, counts.get(k2)! + 1)
      if (ok) return true
    }
  }

  return false
}

/** Standard hand: `groups` melds + exactly one pair from the concealed tiles. */
function isStandardWin(kinds: TileKind[], groups: number): boolean {
  const counts = toCounts(kinds)
  if (total(counts) !== groups * 3 + 2) return false

  for (const [key, v] of counts) {
    if (v >= 2) {
      counts.set(key, v - 2) // remove the pair
      const ok = formsGroups(counts, groups)
      counts.set(key, v)
      if (ok) return true
    }
  }
  return false
}

/** Seven Pairs: 14 concealed tiles forming 7 distinct pairs (no melds). */
function isSevenPairs(kinds: TileKind[]): boolean {
  if (kinds.length !== 14) return false
  const counts = toCounts(kinds)
  if (counts.size !== 7) return false
  for (const v of counts.values()) if (v !== 2) return false
  return true
}

/** Thirteen Orphans: one of each terminal/honor (13 kinds) plus any one duplicated. */
function isThirteenOrphans(kinds: TileKind[]): boolean {
  if (kinds.length !== 14) return false
  if (!kinds.every((k) => isTerminalOrHonor(k))) return false
  const counts = toCounts(kinds)
  if (counts.size !== 13) return false // all 13 distinct present, one doubled
  let pairs = 0
  for (const v of counts.values()) {
    if (v === 2) pairs++
    else if (v !== 1) return false
  }
  return pairs === 1
}

/**
 * Is the concealed `hand` (already including the winning tile) a complete hand,
 * given `exposedMelds` already-formed melds? Seven Pairs and Thirteen Orphans
 * only count with a fully concealed hand (no exposed melds).
 */
export function isWinningHand(hand: Tile[], exposedMelds: number): boolean {
  const kinds = hand.map((t) => t.kind)
  const groups = 4 - exposedMelds
  if (groups < 0) return false

  if (isStandardWin(kinds, groups)) return true
  if (exposedMelds === 0 && (isSevenPairs(kinds) || isThirteenOrphans(kinds))) return true
  return false
}

// ---- Claim detection -------------------------------------------------------

export interface ChowOption {
  /** The two tiles from hand (by id) that complete the run with the discard. */
  tileIds: [string, string]
}

export interface ClaimOptions {
  pung: boolean
  kong: boolean
  ron: boolean
  chows: ChowOption[]
}

/** What can `player` do with `discard` (a tile just discarded by the opponent)? */
export function claimOptions(
  hand: Tile[],
  exposedMelds: number,
  discard: TileKind,
): ClaimOptions {
  const key = tileKey(discard)
  const same = hand.filter((t) => tileKey(t.kind) === key)

  const chows: ChowOption[] = []
  if (isSuited(discard)) {
    const suit = discard.suit
    const r = discard.rank
    const find = (rank: number) =>
      hand.find((t) => t.kind.type === 'suit' && t.kind.suit === suit && t.kind.rank === rank)
    // The discard can be the low, middle, or high tile of the run.
    const patterns: Array<[number, number]> = [
      [r - 2, r - 1],
      [r - 1, r + 1],
      [r + 1, r + 2],
    ]
    for (const [a, b] of patterns) {
      if (a < 1 || b > 9) continue
      const ta = find(a)
      const tb = find(b)
      if (ta && tb) chows.push({ tileIds: [ta.id, tb.id] })
    }
  }

  // Ron: would adding the discard complete the hand?
  const ron = isWinningHand([...hand, { id: '__ron__', kind: discard }], exposedMelds)

  return {
    pung: same.length >= 2,
    kong: same.length >= 3,
    ron,
    chows,
  }
}

/** Does the player hold a concealed four-of-a-kind they could declare as a kong? */
export function concealedKongKeys(hand: Tile[]): string[] {
  const counts = new Map<string, number>()
  for (const t of hand) counts.set(tileKey(t.kind), (counts.get(tileKey(t.kind)) ?? 0) + 1)
  return [...counts.entries()].filter(([, v]) => v === 4).map(([k]) => k)
}
