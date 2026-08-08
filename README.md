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
- **Stocks** — the full S&P 500 (503 tickers, `src/lib/data/sp500.ts`,
  snapshotted from a maintained public dataset), live from Yahoo Finance.
  Native apps aren't subject to browser CORS restrictions, so this calls
  Yahoo directly, no proxy needed.
- Either source falls back to bundled demo data if unreachable. A
  `LIVE`/`DEMO` badge always shows which one you're looking at.
- 503 symbols can't all be fetched at once without getting rate-limited,
  so the scanner (`src/hooks/useScanner.ts`) works through them in
  batches of 15 with a short pause between batches, updating the
  dashboard progressively as results come in (~30-60s for a full scan
  depending on network). Rescans every 20 minutes. The dashboard shows
  the top 25 stocks by urgency (breakouts first), not all 503 — tap
  any symbol you don't see listed to check it directly, it's still
  being scanned in the background.

## Running in Expo Go

```bash
npm install
npx expo start
```

Scan the QR code that appears with the **Expo Go** app (App Store /
Play Store) — no build, no hosting, no app store review.

## Weekly Sunday alert

On launch, the app requests notification permission and schedules a
recurring local notification for Sunday at 8pm listing which stocks are
currently sitting in an active channel (`src/lib/notifications.ts`).
It reschedules with fresh content every time the app is opened and
finishes a scan, so the Sunday notification reflects whatever was true
the last time you had the app open that week — local notifications
can't recompute their own content at fire time without the app running.

## Project structure

- `src/app/` — screens, file-based routing via `expo-router`
  (`index.tsx` = watchlist dashboard, `symbol/[symbol].tsx` = chart + channel detail)
- `src/components/` — `CandleChart` (SVG candlesticks + support/resistance lines), `Watchlist`, `AlertsFeed`, `LiveBadge`
- `src/lib/` — the detection engine and data layer, plain TypeScript with no React Native or browser dependencies
