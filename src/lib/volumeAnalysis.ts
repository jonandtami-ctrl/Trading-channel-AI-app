import type { Candle } from './types';

export type VolumeLevel = 'low' | 'normal' | 'elevated' | 'high';

export interface VolumeResult {
  level: VolumeLevel;
  /** candle volume ÷ trailing average — 1.0 means exactly average. */
  ratio: number;
}

const LOOKBACK = 20;

/**
 * Classifies a candle's volume relative to the trailing average (the
 * candle itself excluded): breakouts/bounces backed by above-average
 * volume are more trustworthy than quiet ones. Falls back to 'normal' when
 * volume data isn't available (e.g. some demo/fallback paths) rather than
 * penalizing a setup for missing data.
 */
export function classifyVolume(candles: Candle[], index: number): VolumeResult {
  const candle = candles[index];
  if (!candle || candle.volume == null) return { level: 'normal', ratio: 1 };

  const start = Math.max(0, index - LOOKBACK);
  const trailing = candles.slice(start, index).filter((c) => c.volume != null);
  if (trailing.length === 0) return { level: 'normal', ratio: 1 };

  const avg = trailing.reduce((sum, c) => sum + (c.volume ?? 0), 0) / trailing.length;
  if (avg <= 0) return { level: 'normal', ratio: 1 };

  const ratio = candle.volume / avg;
  let level: VolumeLevel;
  if (ratio >= 2) level = 'high';
  else if (ratio >= 1.4) level = 'elevated';
  else if (ratio >= 0.7) level = 'normal';
  else level = 'low';

  return { level, ratio };
}

/** 0-15 point contribution to the trade quality score. */
export function volumeScore(level: VolumeLevel): number {
  switch (level) {
    case 'high':
      return 15;
    case 'elevated':
      return 11;
    case 'normal':
      return 6;
    case 'low':
      return 2;
  }
}
