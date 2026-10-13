import type { Candle } from './types';
import { findPivots } from './pivots';
import { calculateRSI } from './rsi';
import type { RangeHealth } from './breakdownRisk';

/**
 * Entry confirmation taxonomy (item 8) — the exact eight statuses
 * requested. Never calls BOUNCE CONFIRMED just for being near support;
 * that requires actual corroborating evidence (see detectEntrySignals).
 */

export type EntryStatus =
  | 'approaching_support'
  | 'bounce_confirming'
  | 'bounce_confirmed'
  | 'mid_range'
  | 'near_resistance'
  | 'extended'
  | 'breakdown_warning'
  | 'broken';

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  approaching_support: 'APPROACHING SUPPORT',
  bounce_confirming: 'BOUNCE CONFIRMING',
  bounce_confirmed: 'BOUNCE CONFIRMED',
  mid_range: 'MID-RANGE',
  near_resistance: 'NEAR RESISTANCE',
  extended: 'EXTENDED',
  breakdown_warning: 'BREAKDOWN WARNING',
  broken: 'BROKEN',
};

export interface EntryConfirmationResult {
  status: EntryStatus;
  channelPositionPct: number;
  signals: Record<string, boolean>;
  signalCount: number;
  /** Plain-English explanation of exactly why this status was produced — not just the label. */
  rules: string[];
}

// Near-support cutoff used for confirmation purposes specifically — distinct
// from the "bottom 35% preferred entry zone" ranking preference in
// swingSetup.ts, which is about where to look, not how to classify what's found.
const NEAR_SUPPORT_POSITION_PCT = 15;
const NEAR_RESISTANCE_POSITION_PCT = 65;
const EXTENDED_POSITION_PCT = 90;

export function classifyEntry(candles: Candle[], support: number, resistance: number, breakdownHealth: RangeHealth): EntryConfirmationResult {
  const last = candles[candles.length - 1];
  const channelHeight = resistance - support;
  const channelPositionPct = channelHeight > 0 ? ((last.close - support) / channelHeight) * 100 : 50;

  if (breakdownHealth === 'broken') {
    return {
      status: 'broken',
      channelPositionPct,
      signals: {},
      signalCount: 0,
      rules: ["Breakdown confirmed per the configured rule — this isn't a bounce setup anymore."],
    };
  }
  if (breakdownHealth === 'breakdown_warning') {
    return {
      status: 'breakdown_warning',
      channelPositionPct,
      signals: {},
      signalCount: 0,
      rules: ["Multiple weakening-range factors are present even though support hasn't formally broken yet."],
    };
  }

  if (channelPositionPct >= EXTENDED_POSITION_PCT) {
    return {
      status: 'extended',
      channelPositionPct,
      signals: {},
      signalCount: 0,
      rules: [`Price is ${channelPositionPct.toFixed(0)}% through the channel — little room left before resistance.`],
    };
  }
  if (channelPositionPct >= NEAR_RESISTANCE_POSITION_PCT) {
    return {
      status: 'near_resistance',
      channelPositionPct,
      signals: {},
      signalCount: 0,
      rules: [`Price is ${channelPositionPct.toFixed(0)}% through the channel, approaching resistance.`],
    };
  }
  if (channelPositionPct > NEAR_SUPPORT_POSITION_PCT) {
    return {
      status: 'mid_range',
      channelPositionPct,
      signals: {},
      signalCount: 0,
      rules: [`Price is sitting mid-channel (${channelPositionPct.toFixed(0)}% through) — not near either boundary.`],
    };
  }

  const signals = detectEntrySignals(candles, support);
  const signalCount = Object.values(signals).filter(Boolean).length;
  const total = Object.keys(signals).length;

  const status: EntryStatus = signalCount === 0 ? 'approaching_support' : signalCount <= 2 ? 'bounce_confirming' : 'bounce_confirmed';

  return {
    status,
    channelPositionPct,
    signals,
    signalCount,
    rules: [`Near support (${channelPositionPct.toFixed(0)}% through the channel) with ${signalCount} of ${total} bounce-confirmation signals present.`],
  };
}

/** 0-100 mapping used by overallScore.ts's "entry opportunity" component. */
export function entryOpportunityScore(result: EntryConfirmationResult): number {
  switch (result.status) {
    case 'bounce_confirmed':
      return 85 + Math.min(15, result.signalCount * 3);
    case 'bounce_confirming':
      return 55 + result.signalCount * 8;
    case 'approaching_support':
      return 40;
    case 'mid_range':
      return 25;
    case 'near_resistance':
      return 15;
    case 'extended':
      return 5;
    case 'breakdown_warning':
      return 5;
    case 'broken':
      return 0;
  }
}

function detectEntrySignals(candles: Candle[], support: number): Record<string, boolean> {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const bullishReversalCandle = last.close > last.open && (prev == null || last.close > prev.close);
  const higherLow = computeHigherLow(candles, support);
  const strongCloseAboveSupport = last.close > support * 1.01;
  const breakAboveSwingResistance = computeBreakAboveSwingResistance(candles);

  const recentVolumes = candles.slice(-21, -1).map((c) => c.volume ?? 0);
  const avgVolume = recentVolumes.length ? recentVolumes.reduce((s, v) => s + v, 0) / recentVolumes.length : 0;
  const improvingVolume = avgVolume > 0 && (last.volume ?? 0) > avgVolume * 1.1 && last.close > last.open;

  const rsiSeries = calculateRSI(candles, 14);
  const relativeStrengthImproving = isRsiImproving(rsiSeries);

  return { bullishReversalCandle, higherLow, strongCloseAboveSupport, breakAboveSwingResistance, improvingVolume, relativeStrengthImproving };
}

function computeHigherLow(candles: Candle[], support: number): boolean {
  const pivots = findPivots(candles.slice(-40), 3);
  const lows = pivots.filter((p) => p.type === 'low').slice(-2);
  if (lows.length < 2) return false;
  return lows[1].price > lows[0].price && lows[1].price <= support * 1.08;
}

function computeBreakAboveSwingResistance(candles: Candle[]): boolean {
  const pivots = findPivots(candles.slice(-40), 3);
  const highs = pivots.filter((p) => p.type === 'high');
  if (highs.length === 0) return false;
  const lastSwingHigh = highs[highs.length - 1];
  const last = candles[candles.length - 1];
  return last.close > lastSwingHigh.price;
}

function isRsiImproving(rsiSeries: number[]): boolean {
  const recent = rsiSeries.slice(-6).filter((v) => !Number.isNaN(v));
  if (recent.length < 3) return false;
  const current = recent[recent.length - 1];
  const priorMin = Math.min(...recent.slice(0, -1));
  return current > priorMin + 2;
}
