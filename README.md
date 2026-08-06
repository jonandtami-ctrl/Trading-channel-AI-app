# Channel Scanner

A trading-support web app that scans crypto and stock charts for horizontal
support/resistance channels and flags when price is approaching, bouncing
off, or breaking one.

## How it works

- **Pivots** — swing highs/lows found with a symmetric local-extreme window (`src/lib/pivots.ts`)
- **Levels** — nearby pivots clustered into support/resistance prices (`src/lib/levels.ts`)
- **Channels** — a support + resistance pair becomes a channel only if both sides have 2+ touches, price stayed contained between them 80%+ of the time, the band is 1–15% wide, and at least one touch is recent; it flips to `broken` once price closes decisively past either level (`src/lib/channels.ts`)
- **Alerts** — approaching a level, bouncing off one, or breaking out/down (`src/lib/alerts.ts`)

Covered by unit tests in `src/lib/__tests__` (`npm test`).

## Data

- **Crypto** (BTC, ETH, SOL) — live from Binance's public klines API, fetched client-side.
- **Stocks** (15 symbols) — live from Yahoo Finance via a server-side proxy (`src/app/api/stocks/[symbol]/route.ts`), since Yahoo doesn't send CORS headers for direct browser requests. Falls back to bundled demo data if either source is unreachable. A `LIVE`/`DEMO` badge always shows which one you're looking at.

## Running locally

```bash
npm install
npm run dev
```

## Deploying

Deploys on Vercel: import this repo at vercel.com, framework preset
Next.js is auto-detected, no config needed. Every push to a branch gets
its own preview URL; pushes to `main` go to production.

`.github/workflows/ci.yml` runs the test suite and a production build on
every push, independent of deployment.

## Installing on iPhone

Open the deployed site in Safari → Share → **Add to Home Screen**. It runs
standalone (no browser chrome) with notch-safe padding.
