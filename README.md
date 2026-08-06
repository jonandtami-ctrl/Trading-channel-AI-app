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
- **Stocks** (15 symbols) — attempts Yahoo Finance client-side; since Yahoo doesn't send CORS headers for browser requests, this will fall back to bundled demo data on a static host. A `LIVE`/`DEMO` badge always shows which one you're looking at.

## Running locally

```bash
npm install
npm run dev
```

## Deploying

Pushing to `main` or `claude/channel-scanner-trading-7fbeu5` builds a static
export and deploys it to GitHub Pages via `.github/workflows/deploy.yml`.
One-time setup: in the repo's **Settings → Pages**, set **Source** to
**GitHub Actions**.

## Installing on iPhone

Open the deployed site in Safari → Share → **Add to Home Screen**. It runs
standalone (no browser chrome) with notch-safe padding.
