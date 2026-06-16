import { useEffect, useState } from 'react'
import './App.css'
import type { GameMode, GameState, PlayerState, Tile, ClaimIntent } from './game/types'
import { tileGlyph, sortTiles, tileKey } from './game/tiles'
import {
  canSelfDrawWin,
  availableConcealedKongs,
  availableAddedKongs,
  pendingResponder,
} from './game/engine'
import { useConnection, type Connection } from './net/useConnection'
import { useI18n, LANGUAGES, type Lang, type Strings } from './i18n'
import { TileView } from './components/TileView'
import { MeldsView } from './components/MeldsView'
import { DiscardsView } from './components/DiscardsView'

/** Localized display name for a player. */
function nameOf(p: PlayerState, s: Strings): string {
  return p.kind === 'ai' ? s.aiName(p.seat) : p.name
}

/** Localized status line derived from the game state. */
function statusLine(state: GameState, s: Strings, lang: Lang): string {
  if (state.phase === 'discard') return s.toDiscard(nameOf(state.players[state.current], s))
  if (state.phase === 'claim' && state.claim) {
    const pending = state.claim.responders.filter((r) => !r.decided)
    if (pending.length === 0) return ''
    const sep = lang === 'zh' ? '、' : ', '
    return s.mayClaim(pending.map((r) => nameOf(state.players[r.player], s)).join(sep))
  }
  return ''
}

export default function App() {
  const conn = useConnection()
  const { s } = useI18n()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; nonce: number } | null>(null)

  useEffect(() => {
    if (conn.warning) setToast({ message: s.notice(conn.warning.code), nonce: conn.warning.nonce })
  }, [conn.warning, s])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  const phase = conn.state?.phase
  const current = conn.state?.current
  useEffect(() => {
    setSelectedId(null)
  }, [phase, current])

  const warn = (message: string) => setToast({ message, nonce: Date.now() })

  if (conn.status === 'idle') return <StartScreen onPick={conn.join} />
  if (conn.status === 'connecting') return <Splash glyph={'\u{1F004}'} title={s.connecting} />
  if (conn.status === 'error') {
    return (
      <Splash
        glyph="⚠️"
        title={s.notice(conn.error ?? 'connLost')}
        action={{ label: s.back, onClick: conn.leave }}
      />
    )
  }
  if (conn.status === 'lobby' || !conn.state || conn.mySeat === null) {
    return <LobbyScreen conn={conn} />
  }

  const state = conn.state
  const mySeat = conn.mySeat

  if (state.phase === 'over') {
    return <GameOver state={state} mySeat={mySeat} onPlayAgain={conn.reset} onLeave={conn.leave} />
  }

  return (
    <Board
      conn={conn}
      state={state}
      mySeat={mySeat}
      selectedId={selectedId}
      setSelectedId={setSelectedId}
      warn={warn}
      toast={toast}
    />
  )
}

// ---- Language controls -----------------------------------------------------

function LanguageSelect() {
  const { lang, setLang, s } = useI18n()
  return (
    <div className="langSelect">
      <span className="langSelect__label">{s.language}</span>
      <div className="langSelect__opts">
        {LANGUAGES.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`langBtn${lang === l.id ? ' langBtn--active' : ''}`}
            onClick={() => setLang(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function LangToggle() {
  const { lang, setLang } = useI18n()
  return (
    <div className="langToggle">
      {LANGUAGES.map((l) => (
        <button
          key={l.id}
          type="button"
          className={`langBtn langBtn--sm${lang === l.id ? ' langBtn--active' : ''}`}
          onClick={() => setLang(l.id)}
        >
          {l.id === 'en' ? 'EN' : '中'}
        </button>
      ))}
    </div>
  )
}

// ---- Start + lobby ---------------------------------------------------------

function StartScreen({ onPick }: { onPick: (mode: GameMode) => void }) {
  const { s } = useI18n()
  return (
    <div className="app">
      <div className="start">
        <div className="start__card">
          <div className="start__logo">{'\u{1F004}'}</div>
          <h1>{s.appTitle}</h1>
          <p className="start__tag">{s.tagline}</p>
          <LanguageSelect />
          <div className="start__modes">
            <button type="button" className="modeBtn" onClick={() => onPick('1p3ai')}>
              <span className="modeBtn__title">{s.mode1Title}</span>
              <span className="modeBtn__sub">{s.mode1Sub}</span>
            </button>
            <button type="button" className="modeBtn" onClick={() => onPick('2p2ai')}>
              <span className="modeBtn__title">{s.mode2Title}</span>
              <span className="modeBtn__sub">{s.mode2Sub}</span>
            </button>
          </div>
          <p className="start__hint">{s.startHint}</p>
        </div>
      </div>
    </div>
  )
}

function LobbyScreen({ conn }: { conn: Connection }) {
  const { s } = useI18n()
  const lobby = conn.lobby
  const mySeat = conn.mySeat
  const myReady = lobby && mySeat !== null ? lobby.seats[mySeat]?.ready : false

  const statusText = (seat: NonNullable<Connection['lobby']>['seats'][number]) => {
    if (seat.kind === 'ai') return s.statusAiReady
    if (!seat.connected) return s.statusEmpty
    return seat.ready ? s.statusReady : s.statusNotReady
  }

  return (
    <div className="app">
      <div className="start">
        <div className="start__card">
          <div className="start__logo">{'\u{1F004}'}</div>
          <h1>{s.waitingRoom}</h1>
          <p className="start__tag">{s.lobbyTagline}</p>
          <LanguageSelect />

          <div className="lobby__seats">
            {(lobby?.seats ?? []).map((seat) => (
              <div key={seat.seat} className={`lobby__seat${seat.seat === mySeat ? ' lobby__seat--me' : ''}`}>
                <span className="lobby__seatName">
                  {seat.kind === 'ai' ? s.aiName((['E', 'S', 'W', 'N'] as const)[seat.seat]) : seat.name}
                  {seat.seat === mySeat ? s.paren_you : ''}
                </span>
                <span className="lobby__seatKind">{s.seat((['E', 'S', 'W', 'N'] as const)[seat.seat])}</span>
                <span
                  className={`lobby__status lobby__status--${
                    seat.kind === 'ai' ? 'ai' : !seat.connected ? 'empty' : seat.ready ? 'ready' : 'waiting'
                  }`}
                >
                  {statusText(seat)}
                </span>
              </div>
            ))}
          </div>

          <div className="over__actions">
            <button
              type="button"
              className={`btn ${myReady ? '' : 'btn--primary'}`}
              onClick={() => conn.setReady(!myReady)}
            >
              {myReady ? s.imNotReady : s.imReady}
            </button>
            <button type="button" className="btn" onClick={conn.leave}>
              {s.leave}
            </button>
          </div>
          <p className="start__hint">{s.lobbyHint}</p>
        </div>
      </div>
    </div>
  )
}

function Splash({
  glyph,
  title,
  action,
}: {
  glyph: string
  title: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="app">
      <div className="start">
        <div className="start__card">
          <div className="start__logo">{glyph}</div>
          <h2>{title}</h2>
          {action && (
            <div className="over__actions">
              <button type="button" className="btn btn--primary" onClick={action.onClick}>
                {action.label}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Board -----------------------------------------------------------------

interface BoardProps {
  conn: Connection
  state: GameState
  mySeat: number
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  warn: (message: string) => void
  toast: { message: string; nonce: number } | null
}

function Board({ conn, state, mySeat, selectedId, setSelectedId, warn, toast }: BoardProps) {
  const { s } = useI18n()
  const order = [0, 1, 2, 3].map((i) => (mySeat + i) % 4)
  const opponents = order.slice(1)
  const me = state.players[mySeat]
  const myTurn = state.phase === 'discard' && state.current === mySeat

  return (
    <div className="app">
      <Header state={state} onLeave={conn.leave} />
      {toast && <div className="toast">{toast.message}</div>}

      <section className="board">
        <div className="opponents">
          {opponents.map((seat) => (
            <OpponentCard
              key={seat}
              player={state.players[seat]}
              isActor={isActor(state, seat)}
              lastDiscardId={state.lastDiscard?.by === seat ? state.lastDiscard.tile.id : null}
            />
          ))}
        </div>

        <TableCenter state={state} />

        <div className={`me${myTurn ? ' me--active' : ''}`}>
          <div className="me__header">
            <span className="me__title">
              <strong>{me.name}</strong> · {s.seat(me.seat)} · {s.you}
            </span>
            <span className="me__count">
              {me.hand.length} {s.tiles}
            </span>
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
                onClick={myTurn ? (t) => setSelectedId(selectedId === t.id ? null : t.id) : undefined}
                disabled={!myTurn}
              />
            ))}
          </div>
          <div className="me__discards">
            <span className="me__discardsLabel">{s.discardsLabel}</span>
            <DiscardsView
              tiles={me.discards}
              highlightLastId={state.lastDiscard?.by === mySeat ? state.lastDiscard.tile.id : null}
              compact
            />
          </div>

          <Controls conn={conn} state={state} mySeat={mySeat} selectedId={selectedId} warn={warn} />
        </div>
      </section>
    </div>
  )
}

function isActor(state: GameState, seat: number): boolean {
  if (state.phase === 'discard') return state.current === seat
  if (state.phase === 'claim' && state.claim) {
    return state.claim.responders.some((r) => r.player === seat && !r.decided)
  }
  return false
}

function Header({ state, onLeave }: { state: GameState; onLeave: () => void }) {
  const { s, lang } = useI18n()
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__logo">{'\u{1F004}'}</span>
        <h1>{s.appTitle}</h1>
        <span className="pill">{state.mode === '1p3ai' ? s.mode1Pill : s.mode2Pill}</span>
      </div>
      <div className="header__status">
        <span className="pill">
          {s.wall}: {state.wall.length}
        </span>
        <span className="pill pill--turn">{statusLine(state, s, lang)}</span>
      </div>
      <LangToggle />
      <button type="button" className="btn" onClick={onLeave}>
        {s.leave}
      </button>
    </header>
  )
}

function OpponentCard({
  player,
  isActor,
  lastDiscardId,
}: {
  player: PlayerState
  isActor: boolean
  lastDiscardId: string | null
}) {
  const { s } = useI18n()
  return (
    <div className={`seat${isActor ? ' seat--active' : ''}`}>
      <div className="seat__head">
        <span className="seat__name">{nameOf(player, s)}</span>
        <span className="seat__tag">{s.seat(player.seat)}</span>
        <span className="seat__count">
          {player.hand.length}
          {'\u{1F02B}'}
        </span>
      </div>
      <div className="hand hand--hidden">
        {player.hand.map((t) => (
          <span className="tile tile--facedown tile--mini" key={t.id}>
            <span className="tile__glyph">{'\u{1F02B}'}</span>
          </span>
        ))}
      </div>
      <MeldsView melds={player.melds} />
      <FlowersRow flowers={player.flowers} />
      <DiscardsView tiles={player.discards} highlightLastId={lastDiscardId} compact />
    </div>
  )
}

function FlowersRow({ flowers }: { flowers: Tile[] }) {
  const { s } = useI18n()
  if (flowers.length === 0) return null
  return (
    <div className="flowers">
      <span className="flowers__label">{s.flowersLabel}</span>
      {flowers.map((tile) => (
        <TileView key={tile.id} tile={tile} />
      ))}
    </div>
  )
}

function TableCenter({ state }: { state: GameState }) {
  const { s } = useI18n()
  const claimTile = state.phase === 'claim' && state.claim ? state.claim.tile : null
  return (
    <div className="center">
      <div className="center__wall">
        <span className="center__num">{state.wall.length}</span>
        <span className="center__lbl">{s.wall}</span>
      </div>
      {claimTile && (
        <div className="center__claim">
          <span className="center__lbl">{s.claim}</span>
          <TileView tile={claimTile} highlighted />
        </div>
      )}
    </div>
  )
}

// ---- Controls --------------------------------------------------------------

interface ControlsProps {
  conn: Connection
  state: GameState
  mySeat: number
  selectedId: string | null
  warn: (message: string) => void
}

function Controls({ conn, state, mySeat, selectedId, warn }: ControlsProps) {
  const { s, lang } = useI18n()

  if (state.phase === 'discard' && state.current === mySeat) {
    const me = state.players[mySeat]
    const selfWin = canSelfDrawWin(state)
    const concealedKongs = availableConcealedKongs(state)
    const addedKongs = availableAddedKongs(state)
    return (
      <div className="controls">
        <button
          className="btn btn--primary"
          disabled={!selectedId}
          onClick={() => selectedId && conn.sendAction({ type: 'DISCARD', tileId: selectedId })}
        >
          {selectedId ? s.discardSelected : s.selectToDiscard}
        </button>
        {selfWin && (
          <button className="btn btn--win" onClick={() => conn.sendAction({ type: 'SELF_DRAW_WIN' })}>
            {s.winSelfDraw}
          </button>
        )}
        {concealedKongs.map((key) => (
          <button key={`ck-${key}`} className="btn btn--call" onClick={() => conn.sendAction({ type: 'CONCEALED_KONG', key })}>
            {s.concealedKong} {keyGlyph(me.hand, key)}
          </button>
        ))}
        {addedKongs.map((key) => (
          <button key={`ak-${key}`} className="btn btn--call" onClick={() => conn.sendAction({ type: 'ADDED_KONG', key })}>
            {s.addKong} {keyGlyph(me.hand, key)}
          </button>
        ))}
      </div>
    )
  }

  if (state.phase === 'claim' && state.claim && state.claim.discarder !== mySeat) {
    const resp = pendingResponder(state, mySeat)
    const tile = state.claim.tile
    const respond = (intent: ClaimIntent) => conn.sendAction({ type: 'CLAIM_RESPOND', player: mySeat, intent })

    if (resp) {
      const a = resp.available
      return (
        <div className="controls">
          <span className="controls__lead">
            {s.claimPrefix(nameOf(state.players[state.claim.discarder], s))} <TileView tile={tile} /> {s.claimSuffix}
          </span>
          {a.ron && (
            <button className="btn btn--win" onClick={() => respond({ kind: 'ron' })}>
              {s.winRon}
            </button>
          )}
          {a.pung && (
            <button className="btn btn--call" onClick={() => respond({ kind: 'pung' })}>
              {s.pung}
            </button>
          )}
          {a.kong && (
            <button className="btn btn--call" onClick={() => respond({ kind: 'kong' })}>
              {s.kong}
            </button>
          )}
          {a.chows.map((chow, i) => (
            <button key={i} className="btn btn--call" onClick={() => respond({ kind: 'chow', tileIds: chow.tileIds })}>
              {s.chow} {chowGlyphs(state, mySeat, chow.tileIds)}
            </button>
          ))}
          <button className="btn" onClick={() => respond({ kind: 'pass' })}>
            {s.pass}
          </button>
        </div>
      )
    }

    return (
      <div className="controls controls--idle">
        <span className="controls__hint">{statusLine(state, s, lang)}</span>
        <button className="btn" onClick={() => warn(s.notice('cantPung'))}>
          {s.claim}
        </button>
      </div>
    )
  }

  return (
    <div className="controls controls--idle">
      <span className="controls__hint">{statusLine(state, s, lang)}</span>
    </div>
  )
}

// ---- Game over -------------------------------------------------------------

function GameOver({
  state,
  mySeat,
  onPlayAgain,
  onLeave,
}: {
  state: GameState
  mySeat: number
  onPlayAgain: () => void
  onLeave: () => void
}) {
  const { s } = useI18n()
  const won = state.winner === mySeat
  return (
    <div className="app">
      <div className="over">
        <div className="over__card">
          <div className="over__glyph">{state.drawnGame ? '\u{1F02B}' : '\u{1F004}'}</div>
          <h2>
            {state.drawnGame ? s.drawGame : won ? s.youWin : s.someoneWins(nameOf(state.players[state.winner ?? 0], s))}
          </h2>
          {!state.drawnGame && <p className="over__sub">{state.winType === 'self-draw' ? s.bySelfDraw : s.byDiscard}</p>}

          <div className="over__hands">
            {state.players.map((p, i) => (
              <div className={`over__hand${state.winner === i ? ' over__hand--win' : ''}`} key={i}>
                <div className="over__handLabel">
                  {nameOf(p, s)} · {s.seat(p.seat)} {state.winner === i ? '🏆' : ''}
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

          <div className="over__actions">
            <button className="btn btn--primary" onClick={onPlayAgain}>
              {s.playAgain}
            </button>
            <button className="btn" onClick={onLeave}>
              {s.leave}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- display helpers -------------------------------------------------------

function chowGlyphs(state: GameState, mySeat: number, tileIds: [string, string]): string {
  if (!state.claim) return ''
  const hand = state.players[mySeat].hand
  const picked = tileIds.map((id) => hand.find((t) => t.id === id)).filter((t): t is Tile => !!t)
  const tiles = sortTiles([...picked, state.claim.tile])
  return tiles.map((t) => tileGlyph(t.kind)).join('')
}

function keyGlyph(hand: Tile[], key: string): string {
  const tile = hand.find((t) => tileKey(t.kind) === key)
  return tile ? tileGlyph(tile.kind) : ''
}
