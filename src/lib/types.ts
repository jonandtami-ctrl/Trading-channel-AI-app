export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type PivotType = 'high' | 'low';

export interface Pivot {
  index: number;
  time: number;
  price: number;
  type: PivotType;
}

export type LevelType = 'support' | 'resistance';

export interface Level {
  price: number;
  type: LevelType;
  touches: Pivot[];
}

export type ChannelStatus = 'active' | 'broken';

export interface Channel {
  support: Level;
  resistance: Level;
  widthPct: number;
  containmentPct: number;
  status: ChannelStatus;
  brokenDirection?: 'up' | 'down';
  lastTouchIndex: number;
}

export type AlertType =
  | 'approaching_support'
  | 'approaching_resistance'
  | 'bounce_support'
  | 'bounce_resistance'
  | 'breakout'
  | 'breakdown';

export interface Alert {
  symbol: string;
  type: AlertType;
  price: number;
  levelPrice: number;
  time: number;
  message: string;
  /** How far price has already moved off the level, as a percent — only set for breakout/breakdown/bounce alerts. */
  strengthPct?: number;
}

export interface ScanResult {
  symbol: string;
  candles: Candle[];
  channels: Channel[];
  /** Every support/resistance level found, not just ones paired into a qualifying channel. */
  levels: Level[];
  alerts: Alert[];
  isLive: boolean;
  /** Best (highest-quality) trade plan across this symbol's channels, if any were found. */
  tradePlan?: import('./tradePlan').TradePlan | null;
  /** Set when this symbol is sitting in a tight, long-established, sideways horizontal range. */
  stability?: import('./stability').StabilityInfo | null;
  /**
   * Channels detected with a much longer allowable span than `channels` —
   * long enough for a slow-moving large-cap stock to actually complete a
   * round-trip, unlike the ~1-month swing-trade cap. Used by the "Top 15
   * to Trade" active-channel view instead of `channels`, since those
   * stocks don't move on a swing-trade timescale.
   */
  valueChannels?: Channel[];
}
