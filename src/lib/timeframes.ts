export interface Timeframe {
  label: string;
  days: number; // how many of the most recent trading days the chart displays (ignored for '1D', which uses live intraday data instead)
}

// Exactly the windows that matter for a swing trade — no year/multi-year
// options. The scanner always analyzes a full history behind the scenes
// (see ANCHOR_DAYS in data/fetch.ts) so channel detection has enough depth
// to find real touches; these just control how much — or, for "1D", what
// kind — of data a chart shows.
export const TIMEFRAMES: Timeframe[] = [
  { label: '1D', days: 1 },
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
];

export const DEFAULT_TIMEFRAME = TIMEFRAMES[1]; // 1W
