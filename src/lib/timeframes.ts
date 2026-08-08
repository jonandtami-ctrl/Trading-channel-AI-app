export interface Timeframe {
  label: string;
  yahooRange: string; // Yahoo Finance chart API "range" param, e.g. '1mo'
  days: number; // approximate lookback, used for Binance's candle limit and demo data
}

export const TIMEFRAMES: Timeframe[] = [
  { label: '1M', yahooRange: '1mo', days: 30 },
  { label: '3M', yahooRange: '3mo', days: 90 },
  { label: '6M', yahooRange: '6mo', days: 180 },
  { label: '1Y', yahooRange: '1y', days: 365 },
  { label: '2Y', yahooRange: '2y', days: 730 },
];

export const DEFAULT_TIMEFRAME = TIMEFRAMES[3]; // 1Y — matches prior default behavior
