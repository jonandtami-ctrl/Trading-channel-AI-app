import { describe, expect, it } from 'vitest';
import {
  evaluateBounceSetup,
  evaluateAllBounceSetups,
  evaluateBounceSetupFromHistory,
  bounceSetupSections,
  MIN_CHANNEL_WIDTH_PCT,
  MAX_POSITION_PCT,
  type BounceSetupCandidate,
} from '../bounceSetup';
import { findSymbol } from '../data/symbols';
import type { Candle, Channel, Level, Pivot, ScanResult } from '../types';

const DAY = 86400;
const LIQUID_VOLUME = 1_000_000; // at ~$100/share, ~$100M/day — comfortably clears the $20M floor

function touch(index: number, time: number, price: number, type: Pivot['type']): Pivot {
  return { index, time, price, type };
}

/** A flat, unremarkable 40-day candle history — plenty of history for RSI/liquidity, with no real pivots of its own (findPivots needs a real swing to register one), so classifyTrend defaults to 'sideways' and never blocks a test on its own. Tests override the last one or two candles to control current price/position. */
function baseCandles(days = 40, price = 101, volume = LIQUID_VOLUME): Candle[] {
  return Array.from({ length: days }, (_, i) => ({
    time: i * DAY,
    open: price,
    high: price + 0.4,
    low: price - 0.4,
    close: price,
    volume,
  }));
}

/** Overrides the final candle's close (and optionally the prior candle's close, to control "turning up vs still falling"). */
function withLastClose(candles: Candle[], close: number, prevClose?: number): Candle[] {
  const next = candles.slice(0, -1);
  if (prevClose != null && next.length > 0) {
    next[next.length - 1] = { ...next[next.length - 1], close: prevClose };
  }
  const lastBase = candles[candles.length - 1];
  next.push({ ...lastBase, close, high: Math.max(close, lastBase.high), low: Math.min(close, lastBase.low) });
  return next;
}

/** A well-established, horizontal, well-touched channel — support/resistance touches 30+ days apart, two touches each side. */
function establishedChannel(supportPrice: number, resistancePrice: number): Channel {
  const support: Level = {
    price: supportPrice,
    type: 'support',
    touches: [touch(0, 0, supportPrice, 'low'), touch(20, 20 * DAY, supportPrice, 'low'), touch(38, 38 * DAY, supportPrice, 'low')],
  };
  const resistance: Level = {
    price: resistancePrice,
    type: 'resistance',
    touches: [touch(10, 10 * DAY, resistancePrice, 'high'), touch(30, 30 * DAY, resistancePrice, 'high')],
  };
  return { support, resistance, widthPct: ((resistancePrice - supportPrice) / supportPrice) * 100, containmentPct: 92, status: 'active', lastTouchIndex: 38 };
}

/** Same shape as establishedChannel, but each side's touches slope sharply downward over time — a descending channel, not a horizontal one. */
function descendingChannel(supportPrice: number, resistancePrice: number): Channel {
  const support: Level = {
    price: supportPrice,
    type: 'support',
    touches: [touch(0, 0, supportPrice * 1.1, 'low'), touch(20, 20 * DAY, supportPrice, 'low'), touch(38, 38 * DAY, supportPrice * 0.9, 'low')],
  };
  const resistance: Level = {
    price: resistancePrice,
    type: 'resistance',
    touches: [touch(10, 10 * DAY, resistancePrice * 1.1, 'high'), touch(30, 30 * DAY, resistancePrice * 0.9, 'high')],
  };
  return { support, resistance, widthPct: ((resistancePrice - supportPrice) / supportPrice) * 100, containmentPct: 92, status: 'active', lastTouchIndex: 38 };
}

describe('evaluateBounceSetup — channel width gate', () => {
  it('rejects a channel narrower than the 3% minimum (rule 1)', () => {
    const channel = establishedChannel(100, 101); // 1% wide
    const candles = withLastClose(baseCandles(40, 100.2), 100.2);
    expect(channel.widthPct).toBeLessThan(MIN_CHANNEL_WIDTH_PCT);
    expect(evaluateBounceSetup('TEST', candles, channel)).toBeNull();
  });

  it('accepts an established 4% range with price near support', () => {
    const channel = establishedChannel(100, 104); // 4% wide
    const candles = withLastClose(baseCandles(40, 100.5), 100.5);
    const candidate = evaluateBounceSetup('ZTS', candles, channel);
    expect(candidate).not.toBeNull();
    expect(candidate!.widthPct).toBeCloseTo(4, 5);
    expect(candidate!.positionInChannelPct).toBeLessThanOrEqual(MAX_POSITION_PCT);
  });

  it('reports Room to Resistance and Position in Channel matching the spec formulas', () => {
    const channel = establishedChannel(100, 104);
    // currentPrice 100.4 -> position (100.4-100)/(104-100) = 10%; room (104-100.4)/100.4 ~= 3.6%
    const candles = withLastClose(baseCandles(40, 100.4), 100.4);
    const candidate = evaluateBounceSetup('ZTS', candles, channel)!;
    expect(candidate.positionInChannelPct).toBeCloseTo(10, 1);
    expect(candidate.roomToResistancePct).toBeCloseTo(3.586, 2);
  });
});

describe('evaluateBounceSetup — reliability gate (rule 3)', () => {
  it('rejects a channel with fewer than 2 touches on either side', () => {
    const channel = establishedChannel(100, 104);
    channel.support.touches = [touch(0, 0, 100, 'low')]; // only 1 touch
    const candles = withLastClose(baseCandles(40, 100.5), 100.5);
    expect(evaluateBounceSetup('TEST', candles, channel)).toBeNull();
  });

  it('rejects a channel younger than 30 days', () => {
    const channel = establishedChannel(100, 104);
    channel.support.touches = [touch(0, 8 * DAY, 100, 'low'), touch(2, 9 * DAY, 100, 'low')];
    channel.resistance.touches = [touch(1, 8 * DAY, 104, 'high'), touch(3, 9 * DAY, 104, 'high')];
    const candles = withLastClose(baseCandles(10, 100.5), 100.5);
    expect(evaluateBounceSetup('TEST', candles, channel)).toBeNull();
  });
});

describe('evaluateBounceSetup — trend filter (rule 4)', () => {
  it('rejects a channel whose support/resistance lines are themselves sloping down, even near support', () => {
    const channel = descendingChannel(100, 104);
    const candles = withLastClose(baseCandles(40, 100.5), 100.5);
    expect(evaluateBounceSetup('FALLING', candles, channel)).toBeNull();
  });
});

describe('evaluateBounceSetup — liquidity gate (rule 7)', () => {
  it('rejects an otherwise-qualifying setup with too little dollar volume', () => {
    const channel = establishedChannel(100, 104);
    const candles = withLastClose(baseCandles(40, 100.5, 1000), 100.5); // ~$100k/day, far under $20M
    expect(evaluateBounceSetup('ILLIQUID', candles, channel)).toBeNull();
  });

  it('accepts once volume clears the floor', () => {
    const channel = establishedChannel(100, 104);
    const candles = withLastClose(baseCandles(40, 100.5, LIQUID_VOLUME), 100.5);
    expect(evaluateBounceSetup('LIQUID', candles, channel)).not.toBeNull();
  });
});

describe('evaluateBounceSetup — position gate and status (rules 2, 6)', () => {
  it('is still evaluated (not rejected) when price sits high in the channel, but reads as in_channel', () => {
    const channel = establishedChannel(100, 104);
    const candles = withLastClose(baseCandles(40, 103.5), 103.5); // 87.5% up the range
    const candidate = evaluateBounceSetup('HIGH', candles, channel)!;
    expect(candidate.status).toBe('in_channel');
  });

  it('reads EARLY BOUNCE when near support and the latest candle is turning up', () => {
    const channel = establishedChannel(100, 104);
    const candles = withLastClose(baseCandles(40, 100.6), 100.5, 100.2); // 100.2 -> 100.5, an up-close
    const candidate = evaluateBounceSetup('BOUNCING', candles, channel)!;
    expect(candidate.status).toBe('early_bounce');
  });

  it('reads NEAR SUPPORT (not yet EARLY BOUNCE) when near support but still falling', () => {
    const channel = establishedChannel(100, 104);
    const candles = withLastClose(baseCandles(40, 100.6), 100.2, 100.5); // 100.5 -> 100.2, still declining
    const candidate = evaluateBounceSetup('STALLED', candles, channel)!;
    expect(candidate.status).toBe('near_support');
  });

  it('reads CHANNEL BREAKING when the latest close is meaningfully under support, even before channels.ts flips the channel to broken', () => {
    const channel = establishedChannel(100, 104);
    const candles = withLastClose(baseCandles(40, 100.6), 98.5); // >1% under support
    const candidate = evaluateBounceSetup('CRACKING', candles, channel)!;
    expect(candidate.status).toBe('breaking');
  });
});

describe('evaluateBounceSetup — never fabricates a candidate for a symbol that never actually qualifies', () => {
  it('returns null outright when the channel is already broken', () => {
    const channel = establishedChannel(100, 104);
    channel.status = 'broken';
    channel.brokenDirection = 'down';
    const candles = withLastClose(baseCandles(40, 100.5), 100.5);
    expect(evaluateBounceSetup('BROKEN', candles, channel)).toBeNull();
  });
});

describe('evaluateBounceSetup — distance from support and extended-move penalty (rules 4, 5, 9)', () => {
  it('reports distanceFromSupportPct and scores a within-2%-of-support candidate higher than a far one', () => {
    const channel = establishedChannel(100, 110); // 10% wide, room for both cases below
    const near = evaluateBounceSetup('NEAR', withLastClose(baseCandles(40, 101), 101), channel)!;
    const far = evaluateBounceSetup('FAR', withLastClose(baseCandles(40, 107), 107), channel)!;
    expect(near.distanceFromSupportPct).toBeCloseTo(1, 1);
    expect(far.distanceFromSupportPct).toBeCloseTo(7, 1);
    expect(near.rankScore).toBeGreaterThan(far.rankScore);
    expect(far.penalties.some((p) => p.toLowerCase().includes('extended'))).toBe(true);
    expect(near.penalties.some((p) => p.toLowerCase().includes('extended'))).toBe(false);
  });

  it('penalizes high RSI once price has already moved away from support, even without a downtrend (rule 8)', () => {
    const channel = establishedChannel(100, 110);
    // Ramp the last several closes up from support toward 107 so RSI actually reads high, not just the raw price level.
    const ramping = baseCandles(40, 100);
    for (let i = 30; i < 40; i++) {
      ramping[i] = { ...ramping[i], close: 100 + (i - 29) * 0.8, open: 100 + (i - 29) * 0.8, high: 101 + (i - 29) * 0.8, low: 99 + (i - 29) * 0.8 };
    }
    const candidate = evaluateBounceSetup('OVERHEATED', ramping, channel)!;
    expect(candidate.rsi).not.toBeNull();
    expect(candidate.rsi!).toBeGreaterThan(70);
    expect(candidate.penalties.some((p) => p.toLowerCase().includes('rsi'))).toBe(true);
  });

  it('includes a plain-English reason string covering distance from support, touches, and upside room (rule 10)', () => {
    const channel = establishedChannel(100, 104);
    const candidate = evaluateBounceSetup('ZTS', withLastClose(baseCandles(40, 100.5), 100.5), channel)!;
    expect(candidate.reason.length).toBeGreaterThan(0);
    expect(candidate.reason).toMatch(/support/i);
    expect(candidate.reason).toMatch(/upside to resistance/i);
  });
});

/**
 * A genuine oscillating price series (not a hand-crafted Channel object) —
 * bounces between support and resistance every `cyclePeriod` days for
 * `days` total, so findPivots/clusterLevels/detectChannels (the same real
 * pipeline evaluateBounceSetupFromHistory runs) actually discovers the
 * range on its own, the way real market data would.
 */
function oscillatingCandles(days: number, support: number, resistance: number, cyclePeriod = 20, volume = LIQUID_VOLUME): Candle[] {
  const mid = (support + resistance) / 2;
  const amplitude = (resistance - support) / 2;
  return Array.from({ length: days }, (_, i) => {
    const phase = ((i % cyclePeriod) / cyclePeriod) * 2 * Math.PI;
    const price = mid - amplitude * Math.cos(phase);
    return { time: i * DAY, open: price, high: price + 0.05, low: price - 0.05, close: price, volume };
  });
}

describe('SHOP.TO is eligible for the bounce-setup candidate universe', () => {
  it('resolves as a real, scannable symbol (not excluded by any hard-coded ticker list)', () => {
    expect(findSymbol('SHOP.TO')).toBeDefined();
    expect(findSymbol('SHOP.TO')?.kind).toBe('stock');
  });

  it('produces a candidate through the same evaluation path as any other symbol, discovering its own channel from raw price history', () => {
    const candles = oscillatingCandles(90, 100, 104);
    const result: ScanResult = { symbol: 'SHOP.TO', candles, channels: [], levels: [], alerts: [], isLive: true };
    const candidates = evaluateAllBounceSetups([result]);
    expect(candidates.map((c) => c.symbol)).toEqual(['SHOP.TO']);
    expect(candidates[0].support).toBeLessThan(candidates[0].resistance);
    expect(candidates[0].reason.length).toBeGreaterThan(0);
  });
});

describe('evaluateBounceSetupFromHistory — 3-month primary / 6-month secondary lookback (rules 1-2)', () => {
  it('finds a channel confirmed to be established within the 3-month primary window', () => {
    const candles = oscillatingCandles(90, 100, 104);
    const candidate = evaluateBounceSetupFromHistory('OSC3', candles);
    expect(candidate).not.toBeNull();
    expect(candidate!.widthPct).toBeGreaterThanOrEqual(MIN_CHANNEL_WIDTH_PCT);
  });

  it('does not throw and returns null for a symbol with no established range at all', () => {
    const flatCandles = baseCandles(70, 100);
    expect(evaluateBounceSetupFromHistory('FLAT', flatCandles)).toBeNull();
  });
});

describe('bounceSetupSections', () => {
  function candidate(overrides: Partial<BounceSetupCandidate>): BounceSetupCandidate {
    return {
      symbol: 'TEST',
      currentPrice: 100.5,
      support: 100,
      resistance: 104,
      widthPct: 4,
      roomToResistancePct: 3.5,
      distanceFromSupportPct: 0.5,
      positionInChannelPct: 12,
      channelAgeDays: 40,
      supportTouches: 3,
      resistanceTouches: 2,
      rsi: 38,
      status: 'near_support',
      liquidityUsd: 100_000_000,
      rankScore: 50,
      patternScore: 15,
      institutionalScore: 10,
      priceActionScore: 25,
      evidence: ['Holding support'],
      penalties: [],
      reason: 'Price is within 0.5% of support, 3 support touches, holding support, RSI 38, 3.5% upside to resistance.',
      ...overrides,
    };
  }

  it('excludes a breaking candidate from every section', () => {
    const breaking = candidate({ symbol: 'BREAK', status: 'breaking', positionInChannelPct: 5 });
    const { bestBounceSetups, wideChannels, nearChannelFloor } = bounceSetupSections([breaking]);
    expect(bestBounceSetups).toEqual([]);
    expect(wideChannels).toEqual([]);
    expect(nearChannelFloor).toEqual([]);
  });

  it('keeps a high-in-channel candidate out of Best Bounce Setups and Near Channel Floor, but in Wide Channels', () => {
    const high = candidate({ symbol: 'HIGH', status: 'in_channel', positionInChannelPct: 80 });
    const { bestBounceSetups, wideChannels, nearChannelFloor } = bounceSetupSections([high]);
    expect(bestBounceSetups).toEqual([]);
    expect(nearChannelFloor).toEqual([]);
    expect(wideChannels.map((c) => c.symbol)).toEqual(['HIGH']);
  });

  it('ranks Near Channel Floor purely by distance from support, unlike the weighted Best Bounce Setups sort', () => {
    // NEAR is closer to support but has weaker reliability/liquidity than FAR.
    const near = candidate({ symbol: 'NEAR', distanceFromSupportPct: 0.5, positionInChannelPct: 5, supportTouches: 2, resistanceTouches: 2, liquidityUsd: 21_000_000, rankScore: 30 });
    const far = candidate({ symbol: 'FAR', distanceFromSupportPct: 4, positionInChannelPct: 20, supportTouches: 6, resistanceTouches: 6, liquidityUsd: 500_000_000, rankScore: 90 });
    const { nearChannelFloor } = bounceSetupSections([far, near]);
    expect(nearChannelFloor.map((c) => c.symbol)).toEqual(['NEAR', 'FAR']);
  });

  it('respects the cap on Best Bounce Setups only', () => {
    const many = Array.from({ length: 5 }, (_, i) => candidate({ symbol: `S${i}`, positionInChannelPct: 10 }));
    const { bestBounceSetups, wideChannels } = bounceSetupSections(many, 2);
    expect(bestBounceSetups).toHaveLength(2);
    expect(wideChannels).toHaveLength(5);
  });
});
