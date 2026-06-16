import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import { newGame, reducer, canClaim } from '../src/game/engine'
import { aiAction, aiClaimResponse } from '../src/game/ai'
import type { GameState, GameMode, Tile } from '../src/game/types'
import type { ClientMsg, ServerMsg, LobbySeat } from '../src/net/protocol'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 80
const DIST = join(__dirname, '..', 'dist')

const AI_DISCARD_DELAY = 750
const AI_CLAIM_DELAY = 550

// ---- rooms -----------------------------------------------------------------

interface Room {
  id: string
  mode: GameMode
  humans: number
  state: GameState | null
  /** Connected socket per seat (AI seats stay null). */
  sockets: (WebSocket | null)[]
  names: string[]
  ready: boolean[]
  timer: NodeJS.Timeout | null
}

const rooms = new Map<string, Room>()
let soloCounter = 0
const LAN_ROOM = 'lan'

function humanCount(mode: GameMode): number {
  return mode === '2p2ai' ? 2 : 1
}

function makeRoom(id: string, mode: GameMode): Room {
  return {
    id,
    mode,
    humans: humanCount(mode),
    state: null,
    sockets: [null, null, null, null],
    names: ['牛三', '笑言', '', ''],
    ready: [false, false, false, false],
    timer: null,
  }
}

/** Find a seat for a joining client, or null if the room is full. */
function assignSeat(room: Room): number | null {
  for (let s = 0; s < room.humans; s++) {
    if (room.sockets[s] === null) return s
  }
  return null
}

// ---- redaction -------------------------------------------------------------

const HIDDEN: Tile['kind'] = { type: 'wind', wind: 'E' }
function hiddenTiles(n: number, tag: string): Tile[] {
  return Array.from({ length: n }, (_, i) => ({ id: `hidden-${tag}-${i}`, kind: HIDDEN }))
}

/** A view of the state safe to send to `seat` (opponents' tiles hidden). */
function redactFor(state: GameState, seat: number): GameState {
  const s: GameState = structuredClone(state)
  const reveal = s.phase === 'over'
  s.wall = hiddenTiles(s.wall.length, 'wall')
  if (!reveal) {
    s.players.forEach((p, i) => {
      if (i !== seat) p.hand = hiddenTiles(p.hand.length, `h${i}`)
    })
    if (s.claim) {
      for (const r of s.claim.responders) {
        if (r.player !== seat) {
          r.available = { pung: false, kong: false, ron: false, chows: [] }
          r.intent = r.decided ? r.intent : null // hide undecided opponents' plans
        }
      }
    }
  }
  return s
}

// ---- messaging -------------------------------------------------------------

function send(ws: WebSocket, msg: ServerMsg): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function lobbyMsg(room: Room): ServerMsg {
  const seats: LobbySeat[] = [0, 1, 2, 3].map((s) => ({
    seat: s,
    name: s < room.humans ? room.names[s] || `Player ${s + 1}` : `AI`,
    kind: s < room.humans ? 'human' : 'ai',
    connected: s < room.humans ? room.sockets[s] !== null : true,
    ready: s < room.humans ? room.ready[s] : true,
  }))
  const canStart = room.ready.slice(0, room.humans).every(Boolean) &&
    room.sockets.slice(0, room.humans).every((x) => x !== null)
  return { t: 'lobby', mode: room.mode, seats, needed: room.humans, canStart }
}

function broadcastLobby(room: Room): void {
  const msg = lobbyMsg(room)
  room.sockets.forEach((ws) => ws && send(ws, msg))
}

function broadcastState(room: Room): void {
  if (!room.state) return
  room.sockets.forEach((ws, seat) => {
    if (ws) send(ws, { t: 'state', you: seat, state: redactFor(room.state!, seat) })
  })
}

// ---- game progression ------------------------------------------------------

function startGame(room: Room): void {
  room.state = newGame(room.mode, room.names)
  broadcastState(room)
  scheduleAI(room)
}

function apply(room: Room, action: Parameters<typeof reducer>[1]): void {
  if (!room.state) return
  room.state = reducer(room.state, action)
  broadcastState(room)
  scheduleAI(room)
}

/** Schedule the next AI move, if it's an AI's turn or an AI owes a claim. */
function scheduleAI(room: Room): void {
  if (room.timer) {
    clearTimeout(room.timer)
    room.timer = null
  }
  const s = room.state
  if (!s || s.phase === 'over') return

  if (s.phase === 'discard') {
    if (s.players[s.current].kind === 'ai') {
      room.timer = setTimeout(() => apply(room, aiAction(s)), AI_DISCARD_DELAY)
    }
    return
  }

  if (s.phase === 'claim' && s.claim) {
    const aiResp = s.claim.responders.find((r) => !r.decided && s.players[r.player].kind === 'ai')
    if (aiResp) {
      room.timer = setTimeout(() => apply(room, aiClaimResponse(s, aiResp.player)), AI_CLAIM_DELAY)
    }
  }
}

// ---- client handling -------------------------------------------------------

interface Conn {
  room: Room | null
  seat: number
}

function handleMessage(conn: Conn, ws: WebSocket, msg: ClientMsg): void {
  switch (msg.t) {
    case 'join': {
      if (conn.room) return
      const mode = msg.mode
      let room: Room
      if (mode === '2p2ai') {
        room = rooms.get(LAN_ROOM) ?? makeRoom(LAN_ROOM, mode)
        rooms.set(LAN_ROOM, room)
      } else {
        const id = `solo-${++soloCounter}`
        room = makeRoom(id, mode)
        rooms.set(id, room)
      }
      const seat = assignSeat(room)
      if (seat === null) {
        send(ws, { t: 'error', code: 'roomFull' })
        return
      }
      conn.room = room
      conn.seat = seat
      room.sockets[seat] = ws
      if (msg.name) room.names[seat] = msg.name
      send(ws, { t: 'joined', seat, mode, roomId: room.id })

      if (mode === '1p3ai') {
        room.ready[seat] = true
        if (!room.state) startGame(room)
        else broadcastState(room)
      } else {
        // 2p: reconnecting mid-game gets the live state; otherwise the lobby.
        if (room.state) broadcastState(room)
        broadcastLobby(room)
      }
      return
    }

    case 'ready': {
      const room = conn.room
      if (!room || conn.seat >= room.humans) return
      room.ready[conn.seat] = msg.ready
      broadcastLobby(room)
      const allReady = room.ready.slice(0, room.humans).every(Boolean)
      const allHere = room.sockets.slice(0, room.humans).every((x) => x !== null)
      if (allReady && allHere && !room.state) startGame(room)
      return
    }

    case 'action': {
      const room = conn.room
      if (!room || !room.state) return
      const s = room.state
      const action = msg.action
      if (action.type === 'CLAIM_RESPOND') {
        if (action.player !== conn.seat) return
        const check = canClaim(s, conn.seat, action.intent)
        if (!check.ok) {
          send(ws, { t: 'warning', code: check.code ?? 'cantPung' })
          return
        }
        apply(room, action)
      } else if (action.type === 'NEW_GAME') {
        // handled via 'reset'
        return
      } else {
        // discard / self-draw / kong: must be the acting player
        if (s.phase !== 'discard' || s.current !== conn.seat) {
          send(ws, { t: 'warning', code: 'notYourTurn' })
          return
        }
        apply(room, action)
      }
      return
    }

    case 'reset': {
      const room = conn.room
      if (!room) return
      if (room.timer) {
        clearTimeout(room.timer)
        room.timer = null
      }
      startGame(room)
      return
    }
  }
}

function handleClose(conn: Conn): void {
  const room = conn.room
  if (!room) return
  if (conn.seat >= 0 && conn.seat < room.humans && room.sockets[conn.seat]) {
    room.sockets[conn.seat] = null
    room.ready[conn.seat] = false
  }
  const anyone = room.sockets.slice(0, room.humans).some((x) => x !== null)
  if (!anyone) {
    if (room.timer) clearTimeout(room.timer)
    rooms.delete(room.id)
  } else {
    broadcastLobby(room)
  }
}

// ---- http + ws -------------------------------------------------------------

const app = express()
// Single-page app: express.static serves index.html at "/" and all assets.
app.use(express.static(DIST))

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  const conn: Conn = { room: null, seat: -1 }
  ws.on('message', (data) => {
    let msg: ClientMsg
    try {
      msg = JSON.parse(data.toString())
    } catch {
      return
    }
    try {
      handleMessage(conn, ws, msg)
    } catch (err) {
      console.error('message error', err)
      send(ws, { t: 'error', code: 'serverError' })
    }
  })
  ws.on('close', () => handleClose(conn))
  ws.on('error', () => handleClose(conn))
})

server.listen(PORT, () => {
  console.log(`Mahjong server listening on :${PORT}`)
})
