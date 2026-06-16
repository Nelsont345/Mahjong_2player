import type { Tile } from '../game/types'
import { tileGlyph, tileLabel, tileColorClass } from '../game/tiles'

interface TileViewProps {
  tile: Tile
  selected?: boolean
  highlighted?: boolean
  facedown?: boolean
  disabled?: boolean
  onClick?: (tile: Tile) => void
}

/** A single rendered mahjong tile. */
export function TileView({
  tile,
  selected,
  highlighted,
  facedown,
  disabled,
  onClick,
}: TileViewProps) {
  const clickable = !!onClick && !disabled
  const classes = ['tile']
  if (selected) classes.push('tile--selected')
  if (highlighted) classes.push('tile--highlighted')
  if (facedown) classes.push('tile--facedown')
  if (clickable) classes.push('tile--clickable')
  if (!facedown) classes.push(tileColorClass(tile.kind))

  return (
    <button
      type="button"
      className={classes.join(' ')}
      title={facedown ? 'Hidden tile' : tileLabel(tile.kind)}
      aria-label={facedown ? 'Hidden tile' : tileLabel(tile.kind)}
      disabled={!clickable}
      onClick={clickable ? () => onClick!(tile) : undefined}
    >
      <span className="tile__glyph">{facedown ? '\u{1F02B}' : tileGlyph(tile.kind)}</span>
    </button>
  )
}
