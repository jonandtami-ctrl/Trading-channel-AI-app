import { getSignal } from './scan';
import type { ScanResult } from './types';

export interface NewSignalsResult {
  nextSeen: Set<string>;
  newBuys: string[];
  newSells: string[];
}

/**
 * Pure dedup pass: given the latest scan and everything already flagged
 * today, returns which buy/sell calls are actually new. Kept free of any
 * native imports so it's directly unit-testable — the same logic every
 * refresh cycle (crypto every 60s, stocks every 20min) runs through.
 */
export function computeNewSignals(stockResults: ScanResult[], seen: Set<string>, today: string): NewSignalsResult {
  const nextSeen = new Set(seen);
  const newBuys: string[] = [];
  const newSells: string[] = [];

  for (const result of stockResults) {
    const signal = getSignal(result);
    if (signal !== 'buy' && signal !== 'sell') continue;

    const key = `${result.symbol}-${signal}-${today}`;
    if (nextSeen.has(key)) continue;
    nextSeen.add(key);

    if (signal === 'buy') newBuys.push(result.symbol);
    else newSells.push(result.symbol);
  }

  return { nextSeen, newBuys, newSells };
}

export function buildSignalNotificationBody(newBuys: string[], newSells: string[]): string {
  const parts: string[] = [];
  if (newBuys.length > 0) {
    parts.push(`BUY: ${newBuys.slice(0, 10).join(', ')}${newBuys.length > 10 ? ` +${newBuys.length - 10} more` : ''}`);
  }
  if (newSells.length > 0) {
    parts.push(
      `SELL: ${newSells.slice(0, 10).join(', ')}${newSells.length > 10 ? ` +${newSells.length - 10} more` : ''}`
    );
  }
  return parts.join('   ·   ');
}

export function buildWeeklyDigestBody(stockResults: ScanResult[]): string {
  const inChannel = stockResults
    .filter((r) => r.channels.some((c) => c.status === 'active'))
    .map((r) => r.symbol);

  return inChannel.length > 0
    ? `${inChannel.slice(0, 8).join(', ')}${inChannel.length > 8 ? ` +${inChannel.length - 8} more` : ''} — bouncing in a channel right now.`
    : 'No stocks are currently sitting in a clean channel.';
}
