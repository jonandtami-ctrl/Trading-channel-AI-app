import type { ScanResult } from './types';
import { detectHorizontalRange, type HorizontalRangeResult, type RangeLookbackDays } from './horizontalRange';
import { detectAscendingChannel } from './ascendingChannel';
import { buildSupportTestRecords, type SupportTestRecord } from './supportTests';
import { computeBreakdownRisk, type RangeHealth, type BreakdownConfirmationConfig, DEFAULT_BREAKDOWN_CONFIG } from './breakdownRisk';
import { classifyEntry, entryOpportunityScore, type EntryStatus } from './entryConfirmation';
import { computeUpside } from './upside';
import { buildRiskRewardPlan, type RiskRewardPlan } from './profitManagement';
import { computeOverallScore } from './overallScore';
import { currencyForSymbol, type TradingCurrency } from './currency';
import { findSymbol } from './data/symbols';

/**
 * Ties items 4-12 together into one per-symbol result matching the exact
 * display shape item 13 asks for. This is the main entry point the new
 * Swing Scanner UI (and the cross-stock Support Reliability stats) are
 * built on.
 */

export type PatternType = 'horizontal_range' | 'ascending_channel';

export interface SwingSetup {
  symbol: string;
  name: string;
  exchange: string;
  currency: TradingCurrency;
  currentPrice: number;
  priceTimestamp: number;
  patternType: PatternType;
  lookbackDays: number;
  support: number;
  resistance: number;
  channelWidthPct: number;
  channelPositionPct: number;
  actualUpsidePct: number;
  riskRewardPlan: RiskRewardPlan;
  supportTouches: number;
  resistanceTouches: number;
  channelQualityScore: number;
  breakdownRiskScore: number;
  rangeHealth: RangeHealth;
  entryStatus: EntryStatus;
  overallSetupScore: number;
  eligibleForRanking: boolean;
  isLive: boolean;
  /** Empty for an ascending channel — a moving trendline doesn't have a fixed zone to count repeat tests against (a known limitation, not a bug). */
  testRecords: SupportTestRecord[];
}

const HORIZONTAL_LOOKBACK_CANDIDATES: RangeLookbackDays[] = [60, 30, 90];
const ASCENDING_LOOKBACK_DAYS = 90;

export function evaluateSwingSetup(result: ScanResult, breakdownConfig: BreakdownConfirmationConfig = DEFAULT_BREAKDOWN_CONFIG): SwingSetup | null {
  const candles = result.candles;
  if (candles.length === 0) return null;
  const last = candles[candles.length - 1];
  const currentPrice = last.close;

  let horizontal: HorizontalRangeResult | null = null;
  for (const days of HORIZONTAL_LOOKBACK_CANDIDATES) {
    const r = detectHorizontalRange(candles, days);
    if (r && (!horizontal || r.qualityScore > horizontal.qualityScore)) horizontal = r;
  }
  const ascending = detectAscendingChannel(candles, ASCENDING_LOOKBACK_DAYS);

  let patternType: PatternType;
  let support: number;
  let resistance: number;
  let supportZoneLow: number;
  let resistanceZoneHigh: number;
  let widthPct: number;
  let channelQualityScore: number;
  let supportTouches: number;
  let resistanceTouches: number;
  let lookbackDays: number;
  let testRecords: SupportTestRecord[] = [];

  if (horizontal && (!ascending || horizontal.qualityScore >= ascending.qualityScore)) {
    patternType = 'horizontal_range';
    support = horizontal.support;
    resistance = horizontal.resistance;
    supportZoneLow = horizontal.supportZoneLow;
    resistanceZoneHigh = horizontal.resistanceZoneHigh;
    widthPct = horizontal.widthPct;
    channelQualityScore = horizontal.qualityScore;
    supportTouches = horizontal.supportTouches;
    resistanceTouches = horizontal.resistanceTouches;
    lookbackDays = horizontal.lookbackDays;
    testRecords = buildSupportTestRecords(horizontal.slice, horizontal.channel.support);
  } else if (ascending) {
    patternType = 'ascending_channel';
    support = ascending.projectedSupport;
    resistance = ascending.projectedResistance;
    supportZoneLow = ascending.projectedSupport;
    resistanceZoneHigh = ascending.projectedResistance;
    widthPct = ascending.widthPct;
    channelQualityScore = ascending.qualityScore;
    supportTouches = ascending.higherLowCount;
    resistanceTouches = ascending.higherHighCount;
    lookbackDays = ascending.lookbackDays;
    // No fixed zone to build per-test records against — see testRecords docstring above.
  } else {
    return null;
  }

  const breakdown = computeBreakdownRisk(candles, supportZoneLow, support, testRecords, breakdownConfig);
  const entry = classifyEntry(candles, support, resistance, breakdown.health);
  const upside = computeUpside(support, resistance, currentPrice);
  const riskRewardPlan = buildRiskRewardPlan({ support, resistance: resistanceZoneHigh, currentPrice });

  const overall = computeOverallScore({
    channelQualityScore,
    businessQualityScore: null, // fundamentals data source not available — see audit notes, never fabricated
    entryOpportunityScore: entryOpportunityScore(entry),
    breakdownRiskScore: breakdown.score,
    rewardRiskRatio: riskRewardPlan.rewardToRisk1,
    isBroken: breakdown.health === 'broken',
  });

  const info = findSymbol(result.symbol);

  return {
    symbol: result.symbol,
    name: info?.name ?? result.symbol,
    exchange: info?.exchange ?? 'Unknown',
    currency: info ? currencyForSymbol(info) : 'USD',
    currentPrice,
    priceTimestamp: last.time,
    patternType,
    lookbackDays,
    support,
    resistance,
    channelWidthPct: widthPct,
    channelPositionPct: entry.channelPositionPct,
    actualUpsidePct: upside.actualUpsidePct,
    riskRewardPlan,
    supportTouches,
    resistanceTouches,
    channelQualityScore,
    breakdownRiskScore: breakdown.score,
    rangeHealth: breakdown.health,
    entryStatus: entry.status,
    overallSetupScore: overall.score,
    eligibleForRanking: overall.eligibleForRanking,
    isLive: result.isLive,
    testRecords,
  };
}

/**
 * Evaluates a whole scan universe and returns every qualifying setup,
 * sorted by Overall Setup Score descending (ties broken by width, your
 * stated preference for bigger potential moves). Demo-fallback results are
 * excluded — same discipline as every other signal in this app.
 */
export function evaluateAllSwingSetups(results: ScanResult[], breakdownConfig?: BreakdownConfirmationConfig): SwingSetup[] {
  const setups: SwingSetup[] = [];
  for (const result of results) {
    if (!result.isLive) continue;
    const setup = evaluateSwingSetup(result, breakdownConfig);
    if (setup) setups.push(setup);
  }
  return setups.sort((a, b) => b.overallSetupScore - a.overallSetupScore || b.channelWidthPct - a.channelWidthPct);
}
