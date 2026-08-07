'use client';

import Link from 'next/link';
import type { ScanResult } from '@/lib/types';
import { urgencyScore } from '@/lib/scan';

function statusFor(result: ScanResult): { label: string; className: string } {
  const breakout = result.alerts.find((a) => a.type === 'breakout');
  const breakdown = result.alerts.find((a) => a.type === 'breakdown');
  if (breakout) return { label: 'Breakout', className: 'status-breakout' };
  if (breakdown) return { label: 'Breakdown', className: 'status-breakdown' };

  const approaching = result.alerts.find(
    (a) => a.type === 'approaching_resistance' || a.type === 'approaching_support'
  );
  if (approaching) {
    return {
      label: approaching.type === 'approaching_resistance' ? 'Near resistance' : 'Near support',
      className: 'status-approaching',
    };
  }

  const bounce = result.alerts.find((a) => a.type === 'bounce_support' || a.type === 'bounce_resistance');
  if (bounce) return { label: 'Bounced', className: 'status-approaching' };

  const active = result.channels.find((c) => c.status === 'active');
  if (active) return { label: 'In channel', className: 'status-calm' };

  return { label: 'No channel', className: 'status-calm' };
}

export function Watchlist({ results, names }: { results: ScanResult[]; names: Record<string, string> }) {
  const sorted = [...results].sort((a, b) => urgencyScore(a) - urgencyScore(b));

  if (sorted.length === 0) {
    return <div className="empty-state">No data yet.</div>;
  }

  return (
    <div className="watchlist">
      {sorted.map((result) => {
        const last = result.candles[result.candles.length - 1];
        const status = statusFor(result);
        return (
          <Link key={result.symbol} href={`/symbol/${result.symbol}/`} className="watchlist-row">
            <div className="row-left">
              <span className="row-symbol">{result.symbol}</span>
              <span className="row-name">{names[result.symbol] ?? ''}</span>
            </div>
            <div className="row-right">
              <div className="row-price">
                <div>{last ? formatPrice(last.close) : '—'}</div>
              </div>
              <span className={`status-pill ${status.className}`}>{status.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function formatPrice(n: number): string {
  return n >= 100 ? `$${n.toFixed(2)}` : `$${n.toFixed(n >= 1 ? 3 : 5)}`;
}
