import { type Dispatch, useEffect, useReducer, useState } from 'react'
import './App.css'
import type { GameState, PlayerIndex, Tile } from './game/types'
import { tileGlyph, sortTiles, tileKey } from './game/tiles'
import {
  reducer,
  newGame,
  activeClaimOptions,
  canSelfDrawWin,
  availableConcealedKongs,
  availableAddedKongs,
  type Action,
} from './game/engine'
import { TileView } from './components/TileView'
import { MeldsView } from './components/MeldsView'
import { DiscardsView } from './components/DiscardsView'
import { PassScreen } from './components/PassScreen'

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, newGame)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Clear any pending discard selection whenever the turn or phase changes.
  useEffect(() => {
    setSelectedId(null)
  }, [state.current, state.phase, state.awaitingPass])

  const opponent: PlayerIndex = state.current === 0 ? 1 : 0

  if (state.phase === 'over') {
    return <GameOver state={state} onNewGame={() => dispatch({ type: 'NEW_GAME' })} />
  }

  if (state.awaitingPass) {
    return (
      <div className="app">
        <Header state={state} onNewGame={() => dispatch({ type: 'NEW_GAME' })} />
        <PassScreen player={state.current} onReveal={() => dispatch({ type: 'REVEAL' })} />
      </div>
    )
  }

  const me = state.players[state.current]
  const them = state.players[opponent]

  return (
    <div className="app">
      <Header state={state} onNewGame={() => dispatch({ type: 'NEW_GAME' })} />

      <section className="board">
        {/* Opponent (hidden hand) */}
        <PlayerStrip
          label={`Player ${opponent + 1}`}
          subtitle="opponent"
          tilesHidden={them.hand.length}
          melds={them.melds}
          flowers={them.flowers}
        />

        {/* Table center: discard piles */}
        <div className="table">
          <div className="table__col">
            <div className="table__caption">Player {opponent + 1} discards</div>
            <DiscardsView
              tiles={them.discards}
              highlightLastId={state.lastDiscard?.by === opponent ? state.lastDiscard.tile.id : null}
            />
          </div>
          <div className="table__col">
            <div className="table__caption">Player {state.current + 1} discards</div>
            <DiscardsView tiles={me.discards} />
          </div>
        </div>

        {/* Active player */}
        <div className="me">
          <div className="me__header">
            <span className="me__title">
              You are <strong>Player {state.current + 1}</strong>
            </span>
            <span className="me__count">{me.hand.length} tiles in hand</span>
          </div>

          <MeldsView melds={me.melds} />
          <FlowersRow flowers={me.flowers} />

          <div className="hand">
            {sortTiles(me.hand).map((tile) => (
              <TileView
                key={tile.id}
                tile={tile}
                highlighted={tile.id === state.drawnTileId}
                selected={tile.id === selectedId}
                onClick={
                  state.phase === 'discarding'
                    ? (t) => setSelectedId((cur) => (cur === t.id ? null : t.id))
                    : undefined
                }
                disabled={state.phase !== 'discarding'}
              />
            ))}
          </div>

          <Controls
            state={state}
            selectedId={selectedId}
            dispatch={dispatch}
          />
        </div>
      </section>
    </div>
  )
}

function Header({ state, onNewGame }: { state: GameState; onNewGame: () => void }) {
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__logo">{'\u{1F004}'}</span>
        <h1>Mahjong · 2 Player</h1>
      </div>
      <div className="header__status">
        <span className="pill">Wall: {state.wall.length}</span>
        <span className="pill pill--turn">{state.message}</span>
      </div>
      <button type="button" className="btn" onClick={onNewGame}>
        New game
      </button>
    </header>
  )
}

interface PlayerStripProps {
  label: string
  subtitle: string
  tilesHidden: number
  melds: GameState['players'][number]['melds']
  flowers: Tile[]
}

function PlayerStrip({ label, subtitle, tilesHidden, melds, flowers }: PlayerStripProps) {
  return (
    <div className="strip">
      <div className="strip__header">
        <span className="strip__title">{label}</span>
        <span className="strip__sub">{subtitle}</span>
        <span className="strip__count">{tilesHidden} tiles</span>
      </div>
      <div className="strip__row">
        <div className="hand hand--hidden">
          {Array.from({ length: tilesHidden }).map((_, i) => (
            <span className="tile tile--facedown" key={i}>
              <span className="tile__glyph">{'\u{1F02B}'}</span>
            </span>
          ))}
        </div>
        <MeldsView melds={melds} />
      </div>
      <FlowersRow flowers={flowers} />
    </div>
  )
}

function FlowersRow({ flowers }: { flowers: Tile[] }) {
  if (flowers.length === 0) return null
  return (
    <div className="flowers">
      <span className="flowers__label">Flowers</span>
      {flowers.map((tile) => (
        <TileView key={tile.id} tile={tile} />
      ))}
    </div>
  )
}

interface ControlsProps {
  state: GameState
  selectedId: string | null
  dispatch: Dispatch<Action>
}

function Controls({ state, selectedId, dispatch }: ControlsProps) {
  const me = state.players[state.current]

  if (state.phase === 'choosing') {
    const claims = activeClaimOptions(state)
    return (
      <div className="controls">
        <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: 'DRAW' })}>
          Draw tile
        </button>
        {claims?.ron && (
          <button type="button" className="btn btn--win" onClick={() => dispatch({ type: 'CLAIM_RON' })}>
            Win (Ron)
          </button>
        )}
        {claims?.pung && (
          <button type="button" className="btn btn--call" onClick={() => dispatch({ type: 'CLAIM_PUNG' })}>
            Pung
          </button>
        )}
        {claims?.kong && (
          <button type="button" className="btn btn--call" onClick={() => dispatch({ type: 'CLAIM_KONG' })}>
            Kong
          </button>
        )}
        {claims?.chows.map((chow, i) => (
          <button
            key={i}
            type="button"
            className="btn btn--call"
            onClick={() => dispatch({ type: 'CLAIM_CHOW', tileIds: chow.tileIds })}
          >
            Chow {chowGlyphs(state, chow.tileIds)}
          </button>
        ))}
        {state.lastDiscard && state.lastDiscard.by !== state.current && (
          <span className="controls__hint">Drawing a tile declines the claim above.</span>
        )}
      </div>
    )
  }

  // discarding
  const selfWin = canSelfDrawWin(state)
  const concealedKongs = availableConcealedKongs(state)
  const addedKongs = availableAddedKongs(state)
  return (
    <div className="controls">
      <button
        type="button"
        className="btn btn--primary"
        disabled={!selectedId}
        onClick={() => selectedId && dispatch({ type: 'DISCARD', tileId: selectedId })}
      >
        {selectedId ? 'Discard selected tile' : 'Select a tile to discard'}
      </button>
      {selfWin && (
        <button type="button" className="btn btn--win" onClick={() => dispatch({ type: 'SELF_DRAW_WIN' })}>
          Win (self-draw)
        </button>
      )}
      {concealedKongs.map((key) => (
        <button
          key={`ck-${key}`}
          type="button"
          className="btn btn--call"
          onClick={() => dispatch({ type: 'CONCEALED_KONG', key })}
        >
          Concealed Kong {keyGlyph(me.hand, key)}
        </button>
      ))}
      {addedKongs.map((key) => (
        <button
          key={`ak-${key}`}
          type="button"
          className="btn btn--call"
          onClick={() => dispatch({ type: 'ADDED_KONG', key })}
        >
          Add Kong {keyGlyph(me.hand, key)}
        </button>
      ))}
    </div>
  )
}

function GameOver({ state, onNewGame }: { state: GameState; onNewGame: () => void }) {
  return (
    <div className="app">
      <div className="over">
        <div className="over__card">
          <div className="over__glyph">{state.drawnGame ? '\u{1F02B}' : '\u{1F004}'}</div>
          <h2>
            {state.drawnGame
              ? 'Draw — the wall ran out'
              : `Player ${(state.winner ?? 0) + 1} wins!`}
          </h2>
          {!state.drawnGame && (
            <p className="over__sub">
              {state.winType === 'self-draw' ? 'Won by self-draw.' : 'Won by claiming a discard.'}
            </p>
          )}

          <div className="over__hands">
            {state.players.map((p, i) => (
              <div className="over__hand" key={i}>
                <div className="over__handLabel">
                  Player {i + 1} {state.winner === i ? '· winner' : ''}
                </div>
                <MeldsView melds={p.melds} />
                <div className="hand">
                  {sortTiles(p.hand).map((tile) => (
                    <TileView key={tile.id} tile={tile} />
                  ))}
                </div>
                <FlowersRow flowers={p.flowers} />
              </div>
            ))}
          </div>

          <button type="button" className="btn btn--primary" onClick={onNewGame}>
            Play again
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- small display helpers -------------------------------------------------

function chowGlyphs(state: GameState, tileIds: [string, string]): string {
  if (!state.lastDiscard) return ''
  const hand = state.players[state.current].hand
  const picked = tileIds
    .map((id) => hand.find((t) => t.id === id))
    .filter((t): t is Tile => !!t)
  const tiles = sortTiles([...picked, state.lastDiscard.tile])
  return tiles.map((t) => tileGlyph(t.kind)).join('')
}

function keyGlyph(hand: Tile[], key: string): string {
  const tile = hand.find((t) => tileKey(t.kind) === key)
  return tile ? tileGlyph(tile.kind) : ''
}
