'use client';

import type { Alert } from '@/lib/types';

export function AlertsFeed({ alerts }: { alerts: Alert[] }) {
  const sorted = [...alerts].sort((a, b) => b.time - a.time).slice(0, 30);

  if (sorted.length === 0) {
    return <div className="empty-state">No alerts right now — everything's calm.</div>;
  }

  return (
    <div className="alerts-feed">
      {sorted.map((alert, i) => (
        <div key={`${alert.symbol}-${alert.type}-${alert.time}-${i}`} className="alert-item">
          <span className="alert-message">
            <span className="alert-symbol">{alert.symbol}</span> {alert.message}
          </span>
          <span className="alert-time">{formatTime(alert.time)}</span>
        </div>
      ))}
    </div>
  );
}

function formatTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
