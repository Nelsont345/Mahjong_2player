import { useCallback, useEffect, useRef, useState } from 'react'
import type { Action } from '../game/engine'
import type { GameMode, GameState } from '../game/types'
import type { ClientMsg, ServerMsg, LobbySeat, NoticeCode } from './protocol'

export type ConnStatus = 'idle' | 'connecting' | 'lobby' | 'playing' | 'error'

/** Codes the client itself can raise, on top of server NoticeCodes. */
export type ClientNoticeCode = NoticeCode | 'connLost'

export interface Lobby {
  mode: GameMode
  seats: LobbySeat[]
  needed: number
  canStart: boolean
}

export interface Connection {
  status: ConnStatus
  mySeat: number | null
  mode: GameMode | null
  lobby: Lobby | null
  state: GameState | null
  warning: { code: NoticeCode; nonce: number } | null
  error: ClientNoticeCode | null
  join: (mode: GameMode, name?: string) => void
  setReady: (ready: boolean) => void
  sendAction: (action: Action) => void
  reset: () => void
  leave: () => void
}

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws`
}

export function useConnection(): Connection {
  const [status, setStatus] = useState<ConnStatus>('idle')
  const [mySeat, setMySeat] = useState<number | null>(null)
  const [mode, setMode] = useState<GameMode | null>(null)
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [warning, setWarning] = useState<{ code: NoticeCode; nonce: number } | null>(null)
  const [error, setError] = useState<ClientNoticeCode | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const nonceRef = useRef(0)

  const send = useCallback((msg: ClientMsg) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }, [])

  const join = useCallback(
    (m: GameMode, name?: string) => {
      // Close any existing socket before starting a fresh session.
      wsRef.current?.close()
      setStatus('connecting')
      setMode(m)
      setError(null)
      setState(null)
      setLobby(null)

      const ws = new WebSocket(wsUrl())
      wsRef.current = ws

      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', mode: m, name } satisfies ClientMsg))
      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null
          setStatus((cur) => (cur === 'idle' ? cur : 'error'))
        }
      }
      ws.onerror = () => setError('connLost')
      ws.onmessage = (ev) => {
        let msg: ServerMsg
        try {
          msg = JSON.parse(ev.data)
        } catch {
          return
        }
        switch (msg.t) {
          case 'joined':
            setMySeat(msg.seat)
            setMode(msg.mode)
            break
          case 'lobby':
            setLobby({ mode: msg.mode, seats: msg.seats, needed: msg.needed, canStart: msg.canStart })
            setStatus((cur) => (cur === 'playing' ? cur : 'lobby'))
            break
          case 'state':
            setMySeat(msg.you)
            setState(msg.state)
            setStatus('playing')
            break
          case 'warning':
            nonceRef.current += 1
            setWarning({ code: msg.code, nonce: nonceRef.current })
            break
          case 'error':
            setError(msg.code)
            break
        }
      }
    },
    [],
  )

  const setReady = useCallback((ready: boolean) => send({ t: 'ready', ready }), [send])
  const sendAction = useCallback((action: Action) => send({ t: 'action', action }), [send])
  const reset = useCallback(() => send({ t: 'reset' }), [send])

  const leave = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setStatus('idle')
    setMySeat(null)
    setMode(null)
    setLobby(null)
    setState(null)
    setError(null)
  }, [])

  // Close the socket if the component unmounts.
  useEffect(() => () => wsRef.current?.close(), [])

  return {
    status,
    mySeat,
    mode,
    lobby,
    state,
    warning,
    error,
    join,
    setReady,
    sendAction,
    reset,
    leave,
  }
}
