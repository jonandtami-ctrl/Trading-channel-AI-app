import type { Channel } from './types';

export interface BacktestTrade {
  entryIndex: number;
  entryPrice: number;
  entryTime: number;
  exitIndex: number;
  exitPrice: number;
  exitTime: number;
  pnlPct: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  totalReturnPct: number;
  winCount: number;
  lossCount: number;
}

/**
 * Hypothetical, not real: simulates buying every time price touched
 * support and selling every time it next touched resistance, using the
 * channel's own already-detected touch history. No fees, slippage, or
 * partial fills modeled — purely illustrative of how the channel has
 * behaved, not a guarantee of anything going forward.
 */
export function backtestChannel(channel: Channel): BacktestResult {
  const touches = [
    ...channel.support.touches.map((p) => ({ ...p, side: 'buy' as const })),
    ...channel.resistance.touches.map((p) => ({ ...p, side: 'sell' as const })),
  ].sort((a, b) => a.index - b.index);

  const trades: BacktestTrade[] = [];
  let open: (typeof touches)[number] | null = null;

  for (const touch of touches) {
    if (!open && touch.side === 'buy') {
      open = touch;
    } else if (open && touch.side === 'sell' && touch.index > open.index) {
      trades.push({
        entryIndex: open.index,
        entryPrice: open.price,
        entryTime: open.time,
        exitIndex: touch.index,
        exitPrice: touch.price,
        exitTime: touch.time,
        pnlPct: ((touch.price - open.price) / open.price) * 100,
      });
      open = null;
    }
  }

  return {
    trades,
    totalReturnPct: trades.reduce((sum, t) => sum + t.pnlPct, 0),
    winCount: trades.filter((t) => t.pnlPct > 0).length,
    lossCount: trades.filter((t) => t.pnlPct <= 0).length,
  };
}
