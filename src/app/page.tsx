'use client';

import { useScanner } from '@/lib/useScanner';
import { ALL_SYMBOLS, CRYPTO_SYMBOLS, STOCK_SYMBOLS } from '@/lib/data/symbols';
import { Watchlist } from '@/components/Watchlist';
import { AlertsFeed } from '@/components/AlertsFeed';
import { LiveBadge } from '@/components/LiveBadge';

export default function DashboardPage() {
  const { results, loading } = useScanner(ALL_SYMBOLS);
  const names = Object.fromEntries(ALL_SYMBOLS.map((s) => [s.symbol, s.name]));

  const cryptoResults = CRYPTO_SYMBOLS.map((s) => results[s.symbol]).filter(Boolean);
  const stockResults = STOCK_SYMBOLS.map((s) => results[s.symbol]).filter(Boolean);
  const allResults = [...cryptoResults, ...stockResults];
  const allAlerts = allResults.flatMap((r) => r.alerts);
  const anyLive = allResults.some((r) => r.isLive);

  return (
    <>
      <div className="header">
        <div>
          <h1>Channel Scanner</h1>
          <div className="subtitle">support / resistance breakout monitor</div>
        </div>
        {allResults.length > 0 && <LiveBadge isLive={anyLive} />}
      </div>

      {loading && allResults.length === 0 ? (
        <div className="spinner-wrap">scanning…</div>
      ) : (
        <>
          <div className="section-title">Crypto</div>
          <Watchlist results={cryptoResults} names={names} />

          <div className="section-title">Stocks (top 15, by urgency)</div>
          <Watchlist results={stockResults} names={names} />

          <div className="section-title">Alerts</div>
          <AlertsFeed alerts={allAlerts} />
        </>
      )}
    </>
  );
}
