# Mahjong · 2 Player

A browser-based, two-player Mahjong game. Built with **React + TypeScript + Vite**,
served as static files through **nginx** in Docker.

Two people play on one device, hot-seat (pass-and-play): between turns a
"pass the device" screen hides the active hand so opponents can't peek.

## Rules implemented

Standard play on the full **144-tile** set (three suits 1–9, winds, dragons,
plus 8 flower/season bonus tiles). **No scoring** — a hand simply wins.

- **Goal:** form 4 melds + 1 pair.
  - **Chow** — run of three in a suit (e.g. 4–5–6 of circles)
  - **Pung** — three identical tiles
  - **Kong** — four identical tiles (claimed, concealed, or added to a pung); draws a replacement
- **Win** by self-draw or by claiming the opponent's discard.
- Also recognises **Seven Pairs** and **Thirteen Orphans** (concealed only).
- **Flowers/seasons** are set aside automatically and replaced with a fresh draw.
- If the wall runs out before anyone wins, the round is a **draw**.

## Run it

```bash
docker build -t mahjong-2player .
docker run -p 8080:80 mahjong-2player
```

Then open <http://localhost:8080>.

## Project layout

```
src/
  game/        pure game logic (no React)
    types.ts     domain types
    tiles.ts     tile set, wall, shuffle, glyphs/labels
    win.ts       winning-hand + claim detection
    engine.ts    reducer (deal, draw, discard, claim, kong, flowers, win)
  components/  presentational React components
  App.tsx      board, controls, pass screen, game-over
```

The game logic in `src/game/` is framework-agnostic and fully separated from the UI.
