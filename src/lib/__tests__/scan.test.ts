import { describe, expect, it } from 'vitest';
import {
  getSignal,
  closestLevelDistance,
  classifyStrength,
  assessRisk,
  getSignalDetail,
  channelReliabilityScore,
  mostReliableChannels,
  buffettStyleResults,
} from '../scan';
import type { TradePlan } from '../tradePlan';
import type { Alert, Candle, Channel, Level, Pivot, ScanResult } from '../types';

function makeResult(alerts: Alert[], lastClose = 100, channels: Channel[] = []): ScanResult {
  const candles: Candle[] = [{ time: 0, open: lastClose, high: lastClose, low: lastClose, close: lastClose }];
  return { symbol: 'TEST', candles, channels, levels: [], alerts, isLive: true };
}

function alert(type: Alert['type'], levelPrice: number, strengthPct?: number): Alert {
  return { symbol: 'TEST', type, price: 100, levelPrice, time: 0, message: '', strengthPct };
}

function makeTouches(count: number): Pivot[] {
  return Array.from({ length: count }, (_, i) => ({ index: i, time: i, price: 100, type: 'low' as const }));
}

function makeChannel(
  supportPrice: number,
  resistancePrice: number,
  opts: { status?: Channel['status']; supportTouches?: number; resistanceTouches?: number; containmentPct?: number } = {}
): Channel {
  const support: Level = { price: supportPrice, type: 'support', touches: makeTouches(opts.supportTouches ?? 0) };
  const resistance: Level = {
    price: resistancePrice,
    type: 'resistance',
    touches: makeTouches(opts.resistanceTouches ?? 0),
  };
  return {
    support,
    resistance,
    widthPct: ((resistancePrice - supportPrice) / supportPrice) * 100,
    containmentPct: opts.containmentPct ?? 90,
    status: opts.status ?? 'active',
    lastTouchIndex: 0,
  };
}

describe('getSignal', () => {
  it('calls a support bounce a BUY', () => {
    expect(getSignal(makeResult([alert('bounce_support', 90)]))).toBe('buy');
  });

  it('does NOT call a breakout a BUY — price is up near the old resistance line, not bouncing off support', () => {
    expect(getSignal(makeResult([alert('breakout', 110)]))).toBeNull();
  });

  it('calls breakdown and a resistance bounce a SELL', () => {
    expect(getSignal(makeResult([alert('breakdown', 90)]))).toBe('sell');
    expect(getSignal(makeResult([alert('bounce_resistance', 110)]))).toBe('sell');
  });

  it('calls merely approaching a level a WATCH, not a firm call', () => {
    expect(getSignal(makeResult([alert('approaching_support', 90)]))).toBe('watch_support');
    expect(getSignal(makeResult([alert('approaching_resistance', 110)]))).toBe('watch_resistance');
  });

  it('returns null when there are no relevant alerts', () => {
    expect(getSignal(makeResult([]))).toBeNull();
  });
});

describe('getSignal — with a trade plan attached, the plan wins over raw alerts', () => {
  function makePlan(overrides: Partial<TradePlan>): TradePlan {
    return {
      symbol: 'TEST',
      currentPrice: 100,
      trend: 'sideways',
      trendLabel: 'Sideways',
      channelDirection: 'horizontal',
      support: 95,
      resistance: 105,
      lastTouchDaysAgo: 0,
      channelState: 'mid_channel',
      channelStateLabel: 'Mid Channel',
      setupType: 'None',
      entryZoneLow: null,
      entryZoneHigh: null,
      confirmationNeeded: null,
      stopLoss: null,
      stopPct: null,
      target1: null,
      target2: null,
      potentialGainPct: null,
      riskRewardRatio: null,
      volumeLevel: 'normal',
      volumeRatio: 1,
      qualityScore: 50,
      entryQuality: null,
      warnings: [],
      finalStatus: 'no_trade',
      finalStatusLabel: '⚪ NO TRADE',
      reason: '',
      ...overrides,
    };
  }

  function resultWithPlan(plan: TradePlan): ScanResult {
    return {
      symbol: 'TEST',
      candles: [],
      channels: [],
      levels: [],
      alerts: [{ type: 'bounce_support', symbol: 'TEST', price: 100, levelPrice: 95, time: 0, message: '' }],
      isLive: true,
      tradePlan: plan,
    };
  }

  it('only calls BUY when the plan is a confirmed/high-quality bounce off support — a raw bounce_support alert alone is not enough', () => {
    const weakBounce = resultWithPlan(makePlan({ channelState: 'bouncing_from_support', finalStatus: 'poor_risk_reward' }));
    expect(getSignal(weakBounce)).toBeNull();

    const qualityBounce = resultWithPlan(makePlan({ channelState: 'bouncing_from_support', finalStatus: 'confirmed_setup' }));
    expect(getSignal(qualityBounce)).toBe('buy');
  });

  it('calls a channel breakdown a SELL regardless of alerts', () => {
    const result = resultWithPlan(makePlan({ channelState: 'channel_breakdown', finalStatus: 'channel_breakdown' }));
    expect(getSignal(result)).toBe('sell');
  });

  it('maps at_support and approaching/testing resistance to WATCH', () => {
    expect(getSignal(resultWithPlan(makePlan({ channelState: 'at_support' })))).toBe('watch_support');
    expect(getSignal(resultWithPlan(makePlan({ channelState: 'approaching_resistance' })))).toBe('watch_resistance');
    expect(getSignal(resultWithPlan(makePlan({ channelState: 'testing_resistance' })))).toBe('watch_resistance');
  });

  it('returns null for mid-channel and unconfirmed breakout states', () => {
    expect(getSignal(resultWithPlan(makePlan({ channelState: 'mid_channel' })))).toBeNull();
    expect(getSignal(resultWithPlan(makePlan({ channelState: 'breakout_attempt' })))).toBeNull();
    expect(getSignal(resultWithPlan(makePlan({ channelState: 'confirmed_breakout' })))).toBeNull();
  });
});

describe('closestLevelDistance', () => {
  it('returns the smallest fractional distance to any alert level', () => {
    const result = makeResult([alert('approaching_resistance', 110), alert('approaching_support', 99)], 100);
    expect(closestLevelDistance(result)).toBeCloseTo(0.01, 5);
  });

  it('returns Infinity when there are no alerts', () => {
    expect(closestLevelDistance(makeResult([]))).toBe(Infinity);
  });
});

describe('classifyStrength', () => {
  it('tiers 10%+ as high, 5%+ as medium, 1%+ as low', () => {
    expect(classifyStrength(12)).toBe('high');
    expect(classifyStrength(10)).toBe('high');
    expect(classifyStrength(7)).toBe('medium');
    expect(classifyStrength(5)).toBe('medium');
    expect(classifyStrength(2)).toBe('low');
    expect(classifyStrength(1)).toBe('low');
  });

  it('returns null below 1% or when missing', () => {
    expect(classifyStrength(0.5)).toBeNull();
    expect(classifyStrength(undefined)).toBeNull();
    expect(classifyStrength(null)).toBeNull();
  });
});

describe('assessRisk', () => {
  it('calls it high risk once the move has used up most of the channel width', () => {
    expect(assessRisk(8, 10)).toBe('high'); // 80% of the channel already used
  });

  it('calls it low risk when the move has barely used any of the channel width', () => {
    expect(assessRisk(1, 10)).toBe('low'); // 10% used, plenty of room left
  });

  it('calls it medium risk in between', () => {
    expect(assessRisk(4, 10)).toBe('medium'); // 40% used
  });
});

describe('getSignalDetail', () => {
  it('pairs a BUY with its strength tier and risk relative to the channel width', () => {
    const channel = makeChannel(100, 110); // 10% wide
    const result = makeResult([alert('bounce_support', 100, 9)], 109, [channel]); // strength 9% of a 10%-wide channel = 90% consumed
    const detail = getSignalDetail(result);
    expect(detail.signal).toBe('buy');
    expect(detail.strengthPct).toBe(9);
    expect(detail.strengthTier).toBe('medium');
    expect(detail.risk).toBe('high');
  });

  it('returns nulls for strength/risk when there is no signal', () => {
    const detail = getSignalDetail(makeResult([]));
    expect(detail.signal).toBeNull();
    expect(detail.strengthPct).toBeNull();
    expect(detail.risk).toBeNull();
  });
});

describe('channelReliabilityScore', () => {
  it('sums support + resistance touches on the best (first) channel', () => {
    const channel = makeChannel(90, 110, { supportTouches: 3, resistanceTouches: 4 });
    expect(channelReliabilityScore(makeResult([], 100, [channel]))).toBe(7);
  });

  it('returns 0 when there is no channel at all', () => {
    expect(channelReliabilityScore(makeResult([]))).toBe(0);
  });
});

describe('mostReliableChannels', () => {
  it('keeps only active channels with more than the bare-minimum touch count, sorted most-touched first', () => {
    const wellTouched = makeResult([], 100, [makeChannel(90, 110, { supportTouches: 4, resistanceTouches: 4 })]);
    wellTouched.symbol = 'WELL';
    const barelyQualified = makeResult([], 100, [makeChannel(90, 110, { supportTouches: 2, resistanceTouches: 2 })]);
    barelyQualified.symbol = 'BARE';
    const mostTouched = makeResult([], 100, [makeChannel(90, 110, { supportTouches: 6, resistanceTouches: 5 })]);
    mostTouched.symbol = 'MOST';

    const ranked = mostReliableChannels([wellTouched, barelyQualified, mostTouched]);
    expect(ranked.map((r) => r.symbol)).toEqual(['MOST', 'WELL']);
  });

  it('excludes broken channels even if well-touched', () => {
    const broken = makeResult([], 100, [
      makeChannel(90, 110, { supportTouches: 5, resistanceTouches: 5, status: 'broken' }),
    ]);
    expect(mostReliableChannels([broken])).toEqual([]);
  });

  it('breaks ties by containment percentage', () => {
    const tighter = makeResult([], 100, [makeChannel(90, 110, { supportTouches: 3, resistanceTouches: 3, containmentPct: 95 })]);
    tighter.symbol = 'TIGHT';
    const looser = makeResult([], 100, [makeChannel(90, 110, { supportTouches: 3, resistanceTouches: 3, containmentPct: 85 })]);
    looser.symbol = 'LOOSE';

    const ranked = mostReliableChannels([looser, tighter]);
    expect(ranked.map((r) => r.symbol)).toEqual(['TIGHT', 'LOOSE']);
  });

  it('respects the cap', () => {
    const results = ['A', 'B', 'C'].map((sym) => {
      const r = makeResult([], 100, [makeChannel(90, 110, { supportTouches: 4, resistanceTouches: 4 })]);
      r.symbol = sym;
      return r;
    });
    expect(mostReliableChannels(results, 2)).toHaveLength(2);
  });
});

describe('buffettStyleResults', () => {
  const whitelist = ['KO', 'AAPL', 'BAC'];

  it('filters out anything not on the whitelist', () => {
    const ko = makeResult([], 100, []);
    ko.symbol = 'KO';
    const nvda = makeResult([], 100, []);
    nvda.symbol = 'NVDA';

    const filtered = buffettStyleResults([ko, nvda], whitelist);
    expect(filtered.map((r) => r.symbol)).toEqual(['KO']);
  });

  it('surfaces an active channel before an inactive/no-channel whitelisted symbol', () => {
    const noChannel = makeResult([], 100, []);
    noChannel.symbol = 'BAC';
    const broken = makeResult([], 100, [makeChannel(90, 110, { status: 'broken', supportTouches: 5, resistanceTouches: 5 })]);
    broken.symbol = 'AAPL';
    const active = makeResult([], 100, [makeChannel(90, 110, { status: 'active', supportTouches: 2, resistanceTouches: 2 })]);
    active.symbol = 'KO';

    const ranked = buffettStyleResults([noChannel, broken, active], whitelist);
    expect(ranked[0].symbol).toBe('KO');
  });

  it('among active channels, breaks ties by reliability score', () => {
    const lessTouched = makeResult([], 100, [makeChannel(90, 110, { status: 'active', supportTouches: 2, resistanceTouches: 2 })]);
    lessTouched.symbol = 'BAC';
    const moreTouched = makeResult([], 100, [makeChannel(90, 110, { status: 'active', supportTouches: 5, resistanceTouches: 5 })]);
    moreTouched.symbol = 'AAPL';

    const ranked = buffettStyleResults([lessTouched, moreTouched], whitelist);
    expect(ranked.map((r) => r.symbol)).toEqual(['AAPL', 'BAC']);
  });

  it('still includes whitelisted symbols with no channel at all, just ranked last', () => {
    const noChannel = makeResult([], 100, []);
    noChannel.symbol = 'BAC';
    const ranked = buffettStyleResults([noChannel], whitelist);
    expect(ranked.map((r) => r.symbol)).toEqual(['BAC']);
  });

  it('uses valueChannels (the wider-span detection) instead of the swing channels, when present', () => {
    const swingChannel = makeChannel(90, 110, { status: 'broken', supportTouches: 5, resistanceTouches: 5 });
    const valueChannel = makeChannel(80, 120, { status: 'active', supportTouches: 3, resistanceTouches: 3 });
    const result = makeResult([], 100, [swingChannel]);
    result.symbol = 'KO';
    result.valueChannels = [valueChannel];

    const [ranked] = buffettStyleResults([result], whitelist);
    // The returned result's `channels` should reflect valueChannels (active), not the swing channels (broken).
    expect(ranked.channels[0]).toBe(valueChannel);
  });

  it('falls back to the swing channels when valueChannels is absent', () => {
    const swingChannel = makeChannel(90, 110, { status: 'active', supportTouches: 3, resistanceTouches: 3 });
    const result = makeResult([], 100, [swingChannel]);
    result.symbol = 'KO';

    const [ranked] = buffettStyleResults([result], whitelist);
    expect(ranked.channels[0]).toBe(swingChannel);
  });
});
