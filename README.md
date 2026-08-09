# Channel Scanner

A trading-support mobile app (Expo / React Native) that scans crypto,
stocks, and ETFs for horizontal support/resistance channels and calls
out BUY / SELL / WATCH picks as they form — following a disciplined
channel-trading methodology (buy confirmed bounces off support, not raw
price moves; require confirmation before calling a breakout; gate every
call on quality, volume, trend, and risk/reward before it's shown).

**Not financial advice.** This is a personal trading-analysis tool built
on live market data — every signal is informational only, not a
recommendation to buy or sell anything (`src/components/Disclaimer.tsx`,
shown on the dashboard and on any symbol with an active signal, plus the
full version on the Settings tab). Trading involves risk of loss.

## How it works

- **Pivots** — swing highs/lows found with a symmetric local-extreme window (`src/lib/pivots.ts`)
- **Levels** — nearby pivots clustered into support/resistance zones (`src/lib/levels.ts`)
- **Channels** — a support + resistance pair becomes a channel only if both sides have 2+ touches, price stayed contained between them 80%+ of the time, the band is 1–15% wide, and at least one touch fell within the last ~60 candles (roughly 3 months of daily data) — a fixed window regardless of which timeframe you're viewing, so a 1Y or 2Y chart never surfaces a channel that's actually gone stale just because it's still inside a longer lookback; it flips to `broken` once price closes decisively past either level (`src/lib/channels.ts`)
- **Alerts** — approaching a level, bouncing off one, or breaking out/down (`src/lib/alerts.ts`)
- **Trade plan** (`src/lib/tradePlan.ts`) — the core decision engine. Given a channel, works out exactly where price is in the structure (12 states: at support, bouncing from support, mid-channel, approaching/testing resistance, breakout attempt/confirmed/retest/false, channel breakdown, trending above/below channel), classifies trend (`src/lib/trend.ts`), channel slope (`src/lib/channelDirection.ts`), and volume (`src/lib/volumeAnalysis.ts`), then produces a full plan: setup type, entry zone, confirmation needed, stop-loss, two targets, risk/reward ratio, a 0–100 quality score, entry quality (excellent/good/acceptable/late/poor), how many days ago the channel's levels were actually last touched, warnings (descending channel, FOMO distance from support, weak breakout volume, poor risk/reward), and a final plain-language status (🟢/🟡/🔴/⚪) with the reasoning behind it. Shown in full on every symbol's detail screen (`src/components/TradePlanCard.tsx`).
- **Signals** (`getSignal` in `src/lib/scan.ts`) — the dashboard's BUY/SELL/WATCH read comes straight from the trade plan: **BUY** requires a genuinely confirmed, quality-gated bounce off support — not just any bounce alert; a breakout is deliberately *never* a BUY, since price sitting up near the old resistance line isn't "bouncing off support" the way this app's BUY call means. **SELL** is a confirmed channel breakdown. Merely approaching or testing a level without confirmation is a **WATCH**, not a firm call.
- **Strength & risk** (`classifyStrength`/`assessRisk`/`getSignalDetail` in `src/lib/scan.ts`) — how big the move off the level has been so far, tiered High (10%+) / Medium (5%+) / Low (1%+); risk is how much of the channel's total width that move has already used up.
- **Position sizing** — set your account size and risk-per-trade in Settings; every trade plan with a stop shows a suggested share count (`src/lib/positionSize.ts`): shares = (account size × risk%) ÷ (entry − stop), rounded down.
- **Stability** (`src/lib/stability.ts`) — a separate, deliberately non-trade-call read: is this symbol sitting in a tight (≤9% wide), well-touched (5+ touches, 2+ per side), horizontal channel with a sideways trend over 90+ candles? If so it's "stable" — a candidate for a quiet, long-term range rather than an active setup. Powers the **Stable Ranges** category.

Covered by unit tests in `src/lib/__tests__` (`npm test`) — 99 tests, including a full battery on `tradePlan.ts` covering every channel state (confirmed bounce, breakout attempt vs. confirmed vs. retest vs. false breakout, channel breakdown), entry-quality boundaries, quality-score range checks, and `stability.ts`'s width/touch/trend gating.

## Data

- **Crypto** — top 50 by market cap scanned live from Binance every 60s; the best 10 (closest to actually doing something) are shown on the dashboard.
- **Stocks & ETFs** (~550 tickers) — live from Yahoo Finance, refreshed every 20 min:
  - the full S&P 500 (`src/lib/data/sp500.ts`) — sticking to large-cap, recognizable names rather than a wider universe of smaller/less-familiar tickers
  - ~50 ETFs weighted toward leveraged/inverse products (SOXL/SOXS, TQQQ/SQQQ, SPXL/SPXS, etc.) since their amplified swings tend to form cleaner channels (`src/lib/data/etfs.ts`)
  - No price cap — every qualifying pick is shown regardless of share price.
- Either source falls back to bundled demo data if unreachable (with roughly realistic anchor prices for BTC/ETH/SOL, not the generic placeholder range). A `LIVE`/`DEMO` badge always shows which one you're looking at. Live fetches use a realistic browser User-Agent and retry once on a timeout or rate-limit response before falling back to demo (`src/lib/data/fetchWithTimeout.ts`).
- ~600 symbols can't all be fetched at once without getting rate-limited, so the scanner (`src/hooks/useScanner.ts`) works through them in batches of 30 with a short pause between batches, updating the dashboard progressively as results come in. Tap any symbol directly to check it even if it's not in the displayed picks — its detail screen scans it live on its own.

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

## Browse by market

The dashboard itself stays short: a stats strip (total buys/sells/watching/kept
across everything), four tappable category tiles, your pinned/open positions,
a compact "Today's Top Picks" list (best 6 buy/sell calls anywhere, ranked by
trade-plan quality score), and the alerts feed. Tapping a category tile opens
a dedicated screen (`src/app/category/[category].tsx`) with the full
breakdown for just that market:

- **Crypto** — all 50 scanned symbols, bucketed into Buy / Sell / Watching
- **Stocks** — the S&P 500 only (ETFs split out separately), same buckets
- **ETFs** — the leveraged/inverse ETF universe on its own, same buckets
- **Stable Ranges** — not a buy/sell call at all; every symbol currently
  sitting in a long, tight, sideways channel (`src/lib/stability.ts`), sorted
  narrowest-range first, each card showing the actual range, its width, and
  touch count

Every category screen reads from one shared scan (`src/hooks/ScanDataProvider.tsx`,
provided once at the app root) instead of re-scanning on each navigation, so
drilling into a category is instant. Within a category, Buy/Sell/Watch
buckets are capped at 25/25/15/15; the dashboard's own stats and "Today's Top
Picks" are computed across all categories combined.

## Pinning, positions, and the trade journal

- **Pinned tab** (bottom nav) — every symbol you've pinned or have an open trade in, scanned directly (fast, independent of the full ~600-symbol dashboard scan) so your active trades are always one tap away.
- **Pin** (button on any symbol's detail screen, `src/lib/pins.ts`) keeps that symbol in the Pinned tab and in a "Pinned & Open Positions" section on the dashboard, regardless of whether it still qualifies for a Buy/Sell/Watch section that day.
- **Log Trade** / **Close Trade** (symbol detail screen) records a real trade — price, quantity, and an editable date + time (defaults to now, but you can back-date a trade you're logging after the fact) — to a persistent journal (`src/lib/journal.ts` for the pure P&L/grouping logic, `src/lib/journalStorage.ts` for on-device storage via `@react-native-async-storage/async-storage`). Logging a trade also pins that symbol automatically.
- **Journal tab** lists every trade grouped by year — 2026, 2027, and onward accumulate as separate sections, each with its own realized-gain/loss total — and has an **Export / Share CSV** button (per year or all-time) that opens the native share sheet (or a plain browser download on web) so you can save it, email it, or print it for tax records.
- **Test mode replay** — each symbol's channel shows an animated "Test Mode — Replay" card (`src/lib/backtest.ts` for the simulation, `src/components/BacktestPlayer.tsx` for playback) that draws the channel's candles in over a few seconds with buy/sell markers popping up at each historical support/resistance touch, while Trades/Wins/Losses/Return tick up live as they happen. Play/Pause, restart, and a 1×/2× speed toggle are included. Clearly labeled as hypothetical — no fees or slippage modeled — it's there to gauge how clean the channel has actually traded, not as an auto-trader.

## Navigation

A bottom tab bar — **Dashboard / Pinned / Journal / Settings** — with
`@expo/vector-icons` glyphs. Tapping into a symbol from any tab pushes
the chart/detail screen on top via the stack navigator, with a back
gesture/button to return to whichever tab you came from.

## Settings

- **Position sizing** — account size and risk-per-trade %, persisted on-device (`src/lib/tradeSettingsStorage.ts`), used to suggest a share count on every trade plan.
- **Notifications** — live permission status, a link to your phone's notification settings if they're off, and a **Send test notification** button so you can confirm delivery without waiting for a real signal.
- **Scan universe** — a quick reference for what's being scanned and how often.
- **About** — the full not-financial-advice disclaimer and app version.

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
weekly recurring notifications are skipped entirely on web since
scheduled/recurring triggers aren't supported there. Instant
notifications (test button, new signals) go through the browser's own
`Notification` API on web (`src/lib/notifications.ts`) rather than
`expo-notifications`, which ships no working web implementation at all
(its "web" module is a stub with no `scheduleNotificationAsync`) — calls
into it on web would previously just silently do nothing.

## Notifications

On launch, the app requests notification permission and sets up local
alerts (`src/lib/notifications.ts`), all only while the app is open and
in the foreground — there's no backend, so nothing runs while it's
closed or backgrounded, and scheduled digests only stay current if the
app gets opened at least once before they next fire:

- **Instant buy/sell alerts** — fires right away whenever a scan finds a new BUY or SELL signal that hasn't already been flagged that day (deduped per symbol+signal+day so a 20-minute rescan doesn't repeat itself).
- **Sunday 8pm digest** — a recurring local notification listing which stocks are sitting in an active channel, to plan the week ahead.
- **Monday 8am digest** — the same content, delivered fresh as the week starts.

A **"Send test notification"** button on the Settings tab fires an
immediate local notification with no real signal behind it, so you can
confirm delivery is actually working on your device.

## Project structure

- `src/app/` — screens, file-based routing via `expo-router`
  (`(tabs)/index.tsx` = dashboard, `(tabs)/pinned.tsx` = pinned/open positions, `(tabs)/journal.tsx` = trade journal, `(tabs)/settings.tsx` = settings, `symbol/[symbol].tsx` = chart + trade plan detail, `category/[category].tsx` = per-market Buy/Sell/Watch or Stable Ranges drill-down, both pushed outside the tab bar)
- `src/hooks/ScanDataProvider.tsx` — runs the crypto and stock/ETF scans once at the app root and shares the results via context, so the dashboard and every category screen read the same data instead of re-scanning
- `src/components/` — `CandleChart`/`ZoomableChart` (SVG candlesticks + pinch-zoom), `TradePlanCard`, `Watchlist`, `StableList`, `CategoryTile`, `AlertsFeed`, `SectionHeader`, `LiveBadge`, `BacktestPlayer`
- `src/lib/` — the detection engine and data layer, plain TypeScript with no React Native or browser dependencies (`categorize.ts` splits scan results into the four dashboard categories)
