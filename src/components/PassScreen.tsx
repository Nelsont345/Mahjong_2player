interface PassScreenProps {
  player: number // 0-based
  onReveal: () => void
}

/** Hot-seat hand-off: hides the board until the next player taps to reveal. */
export function PassScreen({ player, onReveal }: PassScreenProps) {
  return (
    <div className="pass">
      <div className="pass__card">
        <div className="pass__tile">{'\u{1F02B}'}</div>
        <h2>Player {player + 1}'s turn</h2>
        <p>Pass the device to Player {player + 1}, then reveal your hand when ready.</p>
        <button type="button" className="btn btn--primary" onClick={onReveal}>
          Reveal my tiles
        </button>
      </div>
    </div>
  )
}
