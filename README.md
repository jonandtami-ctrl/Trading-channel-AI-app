# Channel Scanner

A trading-support mobile app (Expo / React Native) that scans crypto and
stock charts for horizontal support/resistance channels and flags when
price is approaching, bouncing off, or breaking one.

## How it works

- **Pivots** — swing highs/lows found with a symmetric local-extreme window (`src/lib/pivots.ts`)
- **Levels** — nearby pivots clustered into support/resistance prices (`src/lib/levels.ts`)
- **Channels** — a support + resistance pair becomes a channel only if both sides have 2+ touches, price stayed contained between them 80%+ of the time, the band is 1–15% wide, and at least one touch is recent; it flips to `broken` once price closes decisively past either level (`src/lib/channels.ts`)
- **Alerts** — approaching a level, bouncing off one, or breaking out/down (`src/lib/alerts.ts`)

Covered by unit tests in `src/lib/__tests__` (`npm test`).

## Data

- **Crypto** (BTC, ETH, SOL) — live from Binance's public klines API.
- **Stocks** (15 symbols) — live from Yahoo Finance. Native apps aren't
  subject to browser CORS restrictions, so this calls Yahoo directly, no
  proxy needed.
- Either source falls back to bundled demo data if unreachable. A
  `LIVE`/`DEMO` badge always shows which one you're looking at.

## Running in Expo Go

```bash
npm install
npx expo start
```

Scan the QR code that appears with the **Expo Go** app (App Store /
Play Store) — no build, no hosting, no app store review.

## Project structure

- `src/app/` — screens, file-based routing via `expo-router`
  (`index.tsx` = watchlist dashboard, `symbol/[symbol].tsx` = chart + channel detail)
- `src/components/` — `CandleChart` (SVG candlesticks + support/resistance lines), `Watchlist`, `AlertsFeed`, `LiveBadge`
- `src/lib/` — the detection engine and data layer, plain TypeScript with no React Native or browser dependencies
