/**
 * Item 9 — channel width and remaining upside are NOT the same number and
 * must never be conflated. Width is a property of the range itself;
 * actual upside depends on where price (or a proposed entry) currently
 * sits inside that range.
 */
export interface UpsideBreakdown {
  channelWidthPct: number;
  actualUpsidePct: number;
  /** Upside from a proposed confirmed entry price, when it differs from the current price. Null if no entry price was given. */
  upsideFromEntryPct: number | null;
}

export function computeUpside(support: number, resistance: number, currentPrice: number, entryPrice?: number | null): UpsideBreakdown {
  const channelWidthPct = support > 0 ? ((resistance - support) / support) * 100 : 0;
  const actualUpsidePct = currentPrice > 0 ? ((resistance - currentPrice) / currentPrice) * 100 : 0;
  const upsideFromEntryPct = entryPrice != null && entryPrice > 0 ? ((resistance - entryPrice) / entryPrice) * 100 : null;
  return { channelWidthPct, actualUpsidePct, upsideFromEntryPct };
}
