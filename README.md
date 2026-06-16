# Mahjong

A browser-based, four-player Mahjong game. The front-end is **React + TypeScript + Vite**;
gameplay is run by an **authoritative Node + WebSocket server** that also serves the
built front-end. Everything ships in one Docker image.

Two modes from the start screen:

- **1 Player vs 3 AI** — solo against three computer opponents.
- **2 Players vs 2 AI** — two people on **different devices** play together against two AI.
  Both players open the same address, land in a **waiting room**, and the game starts once
  **both confirm they're ready**.

## How play works

- The **server holds the real game state**, runs the AI opponents, validates every move,
  and sends each device a view with **only that player's own tiles** revealed.
- After **every discard**, each human who can claim the tile gets a **Claim / Pass** step
  on their own device. If you try to claim a tile you can't actually use, the server
  **rejects it with a warning**.
- Claims resolve by priority: **Win > Pung/Kong > Chow** (Chow only from the next seat).

## Rules implemented

Standard play on the full **144-tile** set (three suits 1–9, winds, dragons, plus 8
flower/season bonus tiles). **No scoring** — a hand simply wins.

- **Goal:** four melds (Chow / Pung / Kong) + one pair.
- **Win** by self-draw or by claiming a discard. Also recognises **Seven Pairs** and
  **Thirteen Orphans** (concealed only).
- Flowers/seasons are set aside automatically and replaced. If the wall runs out, the
  round is a **draw**.

## Run it

```bash
docker build -t mahjong-2player .
docker run -p 8080:80 mahjong-2player
```

Open <http://localhost:8080>. For two players on different devices, both open the host's
LAN address (e.g. `http://<your-ip>:8080`), choose **2 Players vs 2 AI**, and ready up.

## Project layout

```
src/
  game/        framework-agnostic game logic (runs on the server)
    types.ts     domain types
    tiles.ts     tile set, wall, shuffle, glyphs/colors/labels
    win.ts       winning-hand + claim detection
    engine.ts    reducer + claim window + canClaim validator
    ai.ts        AI discard + claim decisions
  net/
    protocol.ts    shared client/server message types
    useConnection  React hook: WebSocket client
  components/  presentational React components
  App.tsx      start screen, waiting room, board, claim step, game over
server/
  index.ts     express static + ws: rooms, lobby/ready, AI driver, state redaction
```
