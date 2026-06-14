import type { Tile } from '../game/types'
import { TileView } from './TileView'

interface DiscardsViewProps {
  tiles: Tile[]
  /** Highlight the most recent discard (a pending claim). */
  highlightLastId?: string | null
}

/** A player's discard pile, oldest first. */
export function DiscardsView({ tiles, highlightLastId }: DiscardsViewProps) {
  return (
    <div className="discards">
      {tiles.length === 0 && <span className="discards__empty">No discards yet</span>}
      {tiles.map((tile) => (
        <TileView key={tile.id} tile={tile} highlighted={tile.id === highlightLastId} />
      ))}
    </div>
  )
}
