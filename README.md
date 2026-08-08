# Channel Scanner

A trading-support mobile app (Expo / React Native) that scans crypto,
stocks, and ETFs for horizontal support/resistance channels and calls
out BUY / SELL / WATCH picks as they form.

**Not financial advice.** This is a personal practice-trading tool —
every signal is informational only, not a recommendation to buy or
sell anything (`src/components/Disclaimer.tsx`, shown on the dashboard
and on any symbol with an active signal). Trading involves risk of loss.

## How it works

- **Pivots** — swing highs/lows found with a symmetric local-extreme window (`src/lib/pivots.ts`)
- **Levels** — nearby pivots clustered into support/resistance prices (`src/lib/levels.ts`)
- **Channels** — a support + resistance pair becomes a channel only if both sides have 2+ touches, price stayed contained between them 80%+ of the time, the band is 1–15% wide, and at least one touch is recent; it flips to `broken` once price closes decisively past either level (`src/lib/channels.ts`)
- **Alerts** — approaching a level, bouncing off one, or breaking out/down (`src/lib/alerts.ts`)
- **Signals** (`getSignal` in `src/lib/scan.ts`) — turns alerts into a trade call: a confirmed breakout or a bounce off support is a **BUY**; a confirmed breakdown or a rejection at resistance is a **SELL**; merely approaching a level (not yet a confirmed reversal) is a **WATCH**, not a firm call.
- **Strength & risk** (`classifyStrength`/`assessRisk`/`getSignalDetail` in `src/lib/scan.ts`) — how big the move off the level has been so far, tiered High (10%+) / Medium (5%+) / Low (1%+); risk is how much of the channel's total width that move has already used up (70%+ used = high risk of chasing a move that's about to run out of room, under 35% = low risk, room still ahead).

Covered by unit tests in `src/lib/__tests__` (`npm test`) — including
`notificationContent.test.ts`, which simulates repeated auto-refresh
cycles (same signal seen again → not re-notified; a genuinely new one
on a later rescan → flagged; date rollover → re-flagged) against the
pure dedup logic in `src/lib/notificationContent.ts`.

## Data

- **Crypto** (BTC, ETH, SOL) — live from Binance, refreshed every 60s.
- **Stocks & ETFs** (~950 tickers) — live from Yahoo Finance, refreshed every 20 min:
  - the full S&P 500 (`src/lib/data/sp500.ts`)
  - ~400 additional liquid NASDAQ/NYSE names, $1B+ market cap, not already in the S&P 500 (`src/lib/data/extra_symbols.ts`)
  - ~50 ETFs weighted toward leveraged/inverse products (SOXL/SOXS, TQQQ/SQQQ, SPXL/SPXS, etc.) since their amplified swings tend to form cleaner channels (`src/lib/data/etfs.ts`)
  - Picks are filtered to **under $120** at scan time to stay capital-friendly for practice trading — this uses the live price, not the static list.
- Either source falls back to bundled demo data if unreachable (with roughly realistic anchor prices for BTC/ETH/SOL, not the generic placeholder range). A `LIVE`/`DEMO` badge always shows which one you're looking at.
- ~950 symbols can't all be fetched at once without getting rate-limited, so the scanner (`src/hooks/useScanner.ts`) works through them in batches of 30 with a short pause between batches, updating the dashboard progressively as results come in (a full scan takes roughly a minute or two depending on network). Tap any symbol directly to check it even if it's not in the displayed picks — its detail screen scans it live on its own.

## Timeframes

Each symbol's detail screen has a 1M / 3M / 6M / 1Y / 2Y selector
(`src/components/TimeframeSelector.tsx`). Switching it refetches that
symbol at the new lookback window and reruns channel detection against
it (`src/lib/timeframes.ts`), so the channels shown always match what's
on screen — it's not just zooming the same dataset.

Within a timeframe, the chart itself is pinch-to-zoomable
(`src/components/ZoomableChart.tsx`, up to 5×, built on React Native's
built-in `PanResponder` — no extra native dependencies) with +/− buttons
and a reset control as well, then drag left/right to pan once zoomed in.

## Dashboard sections

Picks are split into four sections, each capped independently:

- **Buy Signals** (up to 15) — breakouts and support bounces
- **Sell Signals** (up to 15) — breakdowns and resistance rejections
- **Watching — Near Support** (up to 5) — approaching support, not confirmed yet
- **Watching — Near Resistance** (up to 5) — approaching resistance, not confirmed yet

## Pinning & the trade journal

- **Pin** (button on any symbol's detail screen, `src/lib/pins.ts`) keeps that symbol permanently visible in a "Pinned & Open Positions" section at the top of the dashboard, regardless of whether it still qualifies for a Buy/Sell/Watch section that day — the daily rescan keeps finding new channels across the whole universe, but anything you've pinned won't get pushed out of view.
- **Log Trade** / **Close Trade** (same screen) records a real trade — price, quantity, and an editable date + time (defaults to now, but you can back-date a trade you're logging after the fact) — to a persistent journal (`src/lib/journal.ts` for the pure P&L/grouping logic, `src/lib/journalStorage.ts` for the on-device storage via `@react-native-async-storage/async-storage`). Logging a trade also pins that symbol automatically, same reasoning as above.
- **Journal screen** (`src/app/journal.tsx`, reachable from the dashboard header) lists every trade grouped by year — 2026, 2027, and onward accumulate as separate sections, each with its own realized-gain/loss total — and has an **Export / Share CSV** button (per year or all-time) that opens the native share sheet so you can save it, email it, or print it for tax records.
- **Test mode replay** — each symbol's channel shows an animated "Test Mode — Replay" card (`src/lib/backtest.ts` for the simulation, `src/components/BacktestPlayer.tsx` for playback) that draws the channel's candles in over a few seconds with buy/sell markers popping up at each historical support/resistance touch, while Trades/Wins/Losses/Return tick up live as they happen. Play/Pause, restart, and a 1×/2× speed toggle are included. Clearly labeled as hypothetical — no fees or slippage modeled, not a promise about what happens next — it's there to gauge how clean the channel has actually traded, not as an auto-trader.

## Running in Expo Go

```bash
npm install
npx expo start
```

Scan the QR code that appears with the **Expo Go** app (App Store /
Play Store) — no build, no hosting, no app store review.

## Running as a website (PWA)

The same codebase also runs as a website via `react-native-web`, no
separate rewrite required:

```bash
npm run build:web
```

Outputs a static site to `dist/`. Deployed to GitHub Pages under this
repo's subpath, so `app.json`'s `experiments.baseUrl` is set to
`/Trading-channel-AI-app` — asset URLs would silently 404 without it,
since GitHub Pages project sites are served from a subpath, not the
domain root. `scripts/inject_pwa_head.js` patches the exported
`index.html` with the meta/link tags iOS Safari needs for "Add to Home
Screen" to launch full-screen instead of as a bookmarked tab
(`apple-mobile-web-app-capable`, `apple-touch-icon`, `manifest.json`) —
that's a post-export patch rather than a `+html.tsx` custom document
because Expo Router's static-render output mode (needed for `+html.tsx`
to take effect) tries to server-render every screen at build time and
breaks on this app's live-data-fetching screens.

A couple of native-only APIs degrade gracefully on web instead of
crashing: `shareTradesCsv` falls back to a plain browser download
(`journalStorage.ts`) since there's no native share sheet, and the
weekly recurring notification is skipped entirely on web since
scheduled/recurring triggers aren't supported there — instant
notifications (test button, new signals) still attempt to fire via the
browser's Notification API where permission allows it.

## Notifications

On launch, the app requests notification permission and sets up two kinds
of alerts (`src/lib/notifications.ts`), both only while the app is open
and in the foreground — there's no backend, so nothing runs while it's
closed or backgrounded:

- **Instant buy/sell alerts** — fires right away whenever a scan finds a new BUY or SELL signal that hasn't already been flagged that day (deduped per symbol+signal+day so a 20-minute rescan doesn't repeat itself).
- **Weekly Sunday 8pm digest** — a recurring local notification listing which stocks are sitting in an active channel. Rescheduled with fresh content every time the app is opened and finishes a scan — local notifications can't recompute their own content at fire time without the app running, so it reflects whatever was true the last time you had the app open that week.

A **"Send test"** button appears next to the alert status line on the
dashboard once permission is granted — fires an immediate local
notification with no real signal behind it, so you can confirm delivery
is actually working on your device without waiting for a real call.

## Navigation

A bottom tab bar (Dashboard / Journal, with `@expo/vector-icons` glyphs)
replaces the old single scrolling screen + header link, so it reads as an
actual app rather than one long page. Tapping into a symbol still pushes
the chart/detail screen on top via the stack navigator, with a back
gesture/button to return to whichever tab you came from.

## Project structure

- `src/app/` — screens, file-based routing via `expo-router`
  (`(tabs)/index.tsx` = sectioned dashboard, `(tabs)/journal.tsx` = trade journal, `symbol/[symbol].tsx` = chart + channel detail, pushed outside the tab bar)
- `src/components/` — `CandleChart` (SVG candlesticks + support/resistance lines), `Watchlist`, `AlertsFeed`, `SectionHeader`, `LiveBadge`
- `src/lib/` — the detection engine and data layer, plain TypeScript with no React Native or browser dependencies
