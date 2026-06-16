import type { Tile } from '../game/types'
import { TileView } from './TileView'

interface DiscardsViewProps {
  tiles: Tile[]
  /** Highlight the most recent discard (a pending claim). */
  highlightLastId?: string | null
  /** Render smaller tiles for the compact seat panels. */
  compact?: boolean
}

/** A player's discard pile, oldest first. */
export function DiscardsView({ tiles, highlightLastId, compact }: DiscardsViewProps) {
  return (
    <div className={`discards${compact ? ' discards--compact' : ''}`}>
      {tiles.length === 0 && <span className="discards__empty">—</span>}
      {tiles.map((tile) => (
        <TileView key={tile.id} tile={tile} highlighted={tile.id === highlightLastId} />
      ))}
    </div>
  )
}
