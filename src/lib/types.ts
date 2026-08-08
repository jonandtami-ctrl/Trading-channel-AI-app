export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
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
  alerts: Alert[];
  isLive: boolean;
}
