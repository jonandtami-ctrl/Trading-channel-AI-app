export interface Timeframe {
  label: string;
  days: number; // how many of the most recent trading days the chart displays
}

// Short, close-in windows first — the scanner always analyzes a full
// history behind the scenes (see ANCHOR_DAYS in data/fetch.ts) so channel
// detection has enough depth to find real touches; these just control how
// much of that history a chart shows.
export const TIMEFRAMES: Timeframe[] = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
];

export const DEFAULT_TIMEFRAME = TIMEFRAMES[1]; // 1M
