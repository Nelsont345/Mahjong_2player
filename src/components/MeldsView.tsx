import type { Meld } from '../game/types'
import { TileView } from './TileView'

const MELD_LABEL: Record<Meld['type'], string> = {
  chow: 'Chow',
  pung: 'Pung',
  kong: 'Kong',
}

/** Exposed (and concealed-kong) melds for a player. */
export function MeldsView({ melds }: { melds: Meld[] }) {
  if (melds.length === 0) return null
  return (
    <div className="melds">
      {melds.map((meld, i) => (
        <div className="meld" key={i} title={`${meld.concealed ? 'Concealed ' : ''}${MELD_LABEL[meld.type]}`}>
          {meld.tiles.map((tile, j) => (
            <TileView key={tile.id} tile={tile} facedown={meld.concealed && (j === 0 || j === 3)} />
          ))}
        </div>
      ))}
    </div>
  )
}
