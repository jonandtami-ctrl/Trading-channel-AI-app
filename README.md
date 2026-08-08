# Channel Scanner

A trading-support mobile app (Expo / React Native) that scans crypto,
stocks, and ETFs for horizontal support/resistance channels and calls
out BUY / SELL / WATCH picks as they form.

## How it works

- **Pivots** — swing highs/lows found with a symmetric local-extreme window (`src/lib/pivots.ts`)
- **Levels** — nearby pivots clustered into support/resistance prices (`src/lib/levels.ts`)
- **Channels** — a support + resistance pair becomes a channel only if both sides have 2+ touches, price stayed contained between them 80%+ of the time, the band is 1–15% wide, and at least one touch is recent; it flips to `broken` once price closes decisively past either level (`src/lib/channels.ts`)
- **Alerts** — approaching a level, bouncing off one, or breaking out/down (`src/lib/alerts.ts`)
- **Signals** (`getSignal` in `src/lib/scan.ts`) — turns alerts into a trade call: a confirmed breakout or a bounce off support is a **BUY**; a confirmed breakdown or a rejection at resistance is a **SELL**; merely approaching a level (not yet a confirmed reversal) is a **WATCH**, not a firm call.

Covered by unit tests in `src/lib/__tests__` (`npm test`).

## Data

- **Crypto** (BTC, ETH, SOL) — live from Binance, refreshed every 60s.
- **Stocks & ETFs** (~950 tickers) — live from Yahoo Finance, refreshed every 20 min:
  - the full S&P 500 (`src/lib/data/sp500.ts`)
  - ~400 additional liquid NASDAQ/NYSE names, $1B+ market cap, not already in the S&P 500 (`src/lib/data/extra_symbols.ts`)
  - ~50 ETFs weighted toward leveraged/inverse products (SOXL/SOXS, TQQQ/SQQQ, SPXL/SPXS, etc.) since their amplified swings tend to form cleaner channels (`src/lib/data/etfs.ts`)
  - Picks are filtered to **under $120** at scan time to stay capital-friendly for practice trading — this uses the live price, not the static list.
- Either source falls back to bundled demo data if unreachable (with roughly realistic anchor prices for BTC/ETH/SOL, not the generic placeholder range). A `LIVE`/`DEMO` badge always shows which one you're looking at.
- ~950 symbols can't all be fetched at once without getting rate-limited, so the scanner (`src/hooks/useScanner.ts`) works through them in batches of 20 with a short pause between batches, updating the dashboard progressively as results come in (a full scan takes roughly 1-2 minutes depending on network). Tap any symbol directly to check it even if it's not in the displayed picks — its detail screen scans it live on its own.

## Dashboard sections

Picks are capped at 30 total, split into:

- **Buy Signals** (up to 10) — breakouts and support bounces
- **Sell Signals** (up to 10) — breakdowns and resistance rejections
- **Watching — Near Support** (up to 5) — approaching support, not confirmed yet
- **Watching — Near Resistance** (up to 5) — approaching resistance, not confirmed yet

## Running in Expo Go

```bash
npm install
npx expo start
```

Scan the QR code that appears with the **Expo Go** app (App Store /
Play Store) — no build, no hosting, no app store review.

## Notifications

On launch, the app requests notification permission and sets up two kinds
of alerts (`src/lib/notifications.ts`):

- **Instant buy/sell alerts** — fires right away whenever a scan finds a new BUY or SELL signal that hasn't already been flagged that day (deduped per symbol+signal+day so a 20-minute rescan doesn't repeat itself).
- **Weekly Sunday 8pm digest** — a recurring local notification listing which stocks are sitting in an active channel. Rescheduled with fresh content every time the app is opened and finishes a scan — local notifications can't recompute their own content at fire time without the app running, so it reflects whatever was true the last time you had the app open that week.

## Project structure

- `src/app/` — screens, file-based routing via `expo-router`
  (`index.tsx` = sectioned dashboard, `symbol/[symbol].tsx` = chart + channel detail)
- `src/components/` — `CandleChart` (SVG candlesticks + support/resistance lines), `Watchlist`, `AlertsFeed`, `SectionHeader`, `LiveBadge`
- `src/lib/` — the detection engine and data layer, plain TypeScript with no React Native or browser dependencies
