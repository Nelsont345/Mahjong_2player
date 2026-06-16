import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Wind } from './game/types'
import type { ClientNoticeCode } from './net/useConnection'

export type Lang = 'en' | 'zh'

export const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh', label: '简体中文' },
]

export interface Strings {
  appTitle: string
  tagline: string
  language: string
  // start
  mode1Title: string
  mode1Sub: string
  mode2Title: string
  mode2Sub: string
  startHint: string
  // lobby
  waitingRoom: string
  lobbyTagline: string
  imReady: string
  imNotReady: string
  lobbyHint: string
  you: string
  paren_you: string
  statusReady: string
  statusNotReady: string
  statusEmpty: string
  statusAiReady: string
  // splash
  connecting: string
  back: string
  // header / board
  leave: string
  mode1Pill: string
  mode2Pill: string
  wall: string
  tiles: string
  discardsLabel: string
  flowersLabel: string
  aiTag: string
  // controls
  selectToDiscard: string
  discardSelected: string
  winSelfDraw: string
  concealedKong: string
  addKong: string
  claimPrefix: (name: string) => string
  claimSuffix: string
  winRon: string
  pung: string
  kong: string
  chow: string
  pass: string
  claim: string
  // derived status
  toDiscard: (name: string) => string
  mayClaim: (names: string) => string
  // game over
  drawGame: string
  youWin: string
  someoneWins: (name: string) => string
  bySelfDraw: string
  byDiscard: string
  playAgain: string
  // helpers
  seat: (w: Wind) => string
  aiName: (w: Wind) => string
  notice: (code: ClientNoticeCode) => string
}

const SEAT_EN: Record<Wind, string> = { E: 'East', S: 'South', W: 'West', N: 'North' }
const SEAT_ZH: Record<Wind, string> = { E: '东', S: '南', W: '西', N: '北' }

const NOTICE_EN: Record<ClientNoticeCode, string> = {
  noDiscard: 'There is no discard to claim right now.',
  ownDiscard: "You can't claim your own discard.",
  alreadyResponded: 'You have already responded to this discard.',
  cantPung: "You can't Pung that tile.",
  cantKong: "You can't Kong that tile.",
  cantRon: 'That tile does not complete your hand.',
  cantChow: "You can't Chow that tile.",
  notYourTurn: 'It is not your turn.',
  roomFull: 'That game is full (2 players already joined).',
  serverError: 'Server error handling your request.',
  connLost: 'Lost connection to the game server.',
}

const NOTICE_ZH: Record<ClientNoticeCode, string> = {
  noDiscard: '现在没有可吃碰的弃牌。',
  ownDiscard: '不能吃碰自己打出的牌。',
  alreadyResponded: '你已经对这张弃牌做出选择了。',
  cantPung: '这张牌不能碰。',
  cantKong: '这张牌不能杠。',
  cantRon: '这张牌不能让你胡牌。',
  cantChow: '这张牌不能吃。',
  notYourTurn: '还没轮到你。',
  roomFull: '房间已满（已有 2 位玩家）。',
  serverError: '服务器处理请求出错。',
  connLost: '与游戏服务器的连接已断开。',
}

const EN: Strings = {
  appTitle: 'Mahjong',
  tagline: 'Four-player · standard rules · no scoring',
  language: 'Language',
  mode1Title: '1 Player vs 3 AI',
  mode1Sub: 'Solo game against three computer opponents',
  mode2Title: '2 Players vs 2 AI',
  mode2Sub: 'Play with a friend on another device, plus two AI',
  startHint: 'Build four melds (Chow / Pung / Kong) and a pair. Win by self-draw or by claiming a discard.',
  waitingRoom: 'Waiting room',
  lobbyTagline: '2 Players vs 2 AI — both players must confirm to start.',
  imReady: "I'm ready to play",
  imNotReady: "I'm not ready",
  lobbyHint: "Share your computer's LAN address with the other player so they can open the same page and join this room.",
  you: 'you',
  paren_you: ' (you)',
  statusReady: 'ready ✓',
  statusNotReady: 'not ready',
  statusEmpty: 'empty',
  statusAiReady: 'ready',
  connecting: 'Connecting to the table…',
  back: 'Back',
  leave: 'Leave',
  mode1Pill: '1P vs 3 AI',
  mode2Pill: '2P vs 2 AI',
  wall: 'Wall',
  tiles: 'tiles',
  discardsLabel: 'Discards',
  flowersLabel: 'Flowers',
  aiTag: ' · AI',
  selectToDiscard: 'Select a tile to discard',
  discardSelected: 'Discard selected',
  winSelfDraw: 'Win (self-draw)',
  concealedKong: 'Concealed Kong',
  addKong: 'Add Kong',
  claimPrefix: (name) => `Claim ${name}'s`,
  claimSuffix: '?',
  winRon: 'Win (Ron)',
  pung: 'Pung',
  kong: 'Kong',
  chow: 'Chow',
  pass: 'Pass',
  claim: 'Claim',
  toDiscard: (name) => `${name} to discard.`,
  mayClaim: (names) => `${names} may claim the discard.`,
  drawGame: 'Draw — the wall ran out',
  youWin: 'You win! 🏆',
  someoneWins: (name) => `${name} wins`,
  bySelfDraw: 'Won by self-draw.',
  byDiscard: 'Won by claiming a discard.',
  playAgain: 'Play again',
  seat: (w) => SEAT_EN[w],
  aiName: (w) => `AI ${SEAT_EN[w]}`,
  notice: (code) => NOTICE_EN[code],
}

const ZH: Strings = {
  appTitle: '麻将',
  tagline: '四人 · 标准规则 · 无计分',
  language: '语言',
  mode1Title: '1 人对 3 电脑',
  mode1Sub: '单人对战三名电脑对手',
  mode2Title: '2 人对 2 电脑',
  mode2Sub: '与好友在另一台设备上对战，外加两名电脑',
  startHint: '组成四组面子（吃 / 碰 / 杠）和一对将。自摸或吃牌即可胡牌。',
  waitingRoom: '等待室',
  lobbyTagline: '2 人对 2 电脑 — 双方都确认后开始。',
  imReady: '我准备好了',
  imNotReady: '取消准备',
  lobbyHint: '把本机的局域网地址分享给另一位玩家，让其打开同一页面加入本房间。',
  you: '你',
  paren_you: '（你）',
  statusReady: '已准备 ✓',
  statusNotReady: '未准备',
  statusEmpty: '空缺',
  statusAiReady: '就绪',
  connecting: '正在连接牌桌…',
  back: '返回',
  leave: '离开',
  mode1Pill: '1 人 3 电脑',
  mode2Pill: '2 人 2 电脑',
  wall: '牌墙',
  tiles: '张',
  discardsLabel: '弃牌',
  flowersLabel: '花牌',
  aiTag: ' · 电脑',
  selectToDiscard: '选择一张牌打出',
  discardSelected: '打出所选牌',
  winSelfDraw: '自摸胡牌',
  concealedKong: '暗杠',
  addKong: '加杠',
  claimPrefix: (name) => `${name} 打出`,
  claimSuffix: '，要吗？',
  winRon: '荣和胡牌',
  pung: '碰',
  kong: '杠',
  chow: '吃',
  pass: '过',
  claim: '要牌',
  toDiscard: (name) => `轮到 ${name} 出牌。`,
  mayClaim: (names) => `${names} 可以吃碰这张弃牌。`,
  drawGame: '流局 — 牌墙已空',
  youWin: '你赢了！🏆',
  someoneWins: (name) => `${name} 胜出`,
  bySelfDraw: '自摸胡牌。',
  byDiscard: '吃牌胡牌。',
  playAgain: '再来一局',
  seat: (w) => SEAT_ZH[w],
  aiName: (w) => `电脑·${SEAT_ZH[w]}`,
  notice: (code) => NOTICE_ZH[code],
}

const DICTS: Record<Lang, Strings> = { en: EN, zh: ZH }

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  s: Strings
}

const I18nContext = createContext<I18nValue | null>(null)

const STORAGE_KEY = 'mahjong.lang'

function initialLang(): Lang {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  if (saved === 'en' || saved === 'zh') return saved
  return typeof navigator !== 'undefined' && navigator.language.startsWith('zh') ? 'zh' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
  }, [])
  const value = useMemo<I18nValue>(() => ({ lang, setLang, s: DICTS[lang] }), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
