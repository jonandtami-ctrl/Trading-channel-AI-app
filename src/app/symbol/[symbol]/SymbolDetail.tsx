'use client';

import Link from 'next/link';
import { useScanner } from '@/lib/useScanner';
import { findSymbol } from '@/lib/data/symbols';
import { LiveBadge } from '@/components/LiveBadge';
import { PriceChart } from '@/components/PriceChart';
import { AlertsFeed } from '@/components/AlertsFeed';
import { formatPrice } from '@/components/Watchlist';

export function SymbolDetail({ symbol }: { symbol: string }) {
  const info = findSymbol(symbol);
  const { results, loading } = useScanner(info ? [info] : []);
  const result = results[symbol];

  return (
    <div className="container">
      <Link href="/" className="back-link">
        ← Watchlist
      </Link>

      {loading && !result ? (
        <div className="spinner-wrap">loading {symbol}…</div>
      ) : result ? (
        <>
          <div className="detail-header">
            <div className="detail-meta">
              <span>
                {result.symbol} · {info?.name}
              </span>
              <LiveBadge isLive={result.isLive} />
            </div>
            <div className="detail-price">
              {result.candles.length > 0 ? formatPrice(result.candles[result.candles.length - 1].close) : '—'}
            </div>
          </div>

          <div className="chart-wrap">
            <PriceChart candles={result.candles} channels={result.channels} />
          </div>

          {result.channels.length > 0 ? (
            result.channels.map((channel, i) => (
              <div className="channel-card" key={i}>
                <div className="channel-card-row">
                  <span>Status</span>
                  <strong>
                    {channel.status === 'broken'
                      ? `Broken ${channel.brokenDirection === 'up' ? 'up' : 'down'}`
                      : 'Active channel'}
                  </strong>
                </div>
                <div className="channel-card-row">
                  <span>Resistance</span>
                  <strong>{formatPrice(channel.resistance.price)}</strong>
                </div>
                <div className="channel-card-row">
                  <span>Support</span>
                  <strong>{formatPrice(channel.support.price)}</strong>
                </div>
                <div className="channel-card-row">
                  <span>Width</span>
                  <strong>{channel.widthPct.toFixed(1)}%</strong>
                </div>
                <div className="channel-card-row">
                  <span>Containment</span>
                  <strong>{channel.containmentPct.toFixed(0)}%</strong>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">No active channel — price isn't currently consolidating.</div>
          )}

          <div className="section-title">Alerts</div>
          <AlertsFeed alerts={result.alerts} />
        </>
      ) : (
        <div className="empty-state">Symbol not found.</div>
      )}
    </div>
  );
}
