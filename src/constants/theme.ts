export const colors = {
  bg: '#0a0e14',
  bgPanel: '#141b26',
  bgPanelHover: '#1b2330',
  bgCard: '#131a24',
  bgElevated: '#1a2230',
  border: '#232d3d',
  text: '#eef2f6',
  textDim: '#8891a0',
  green: '#3fb950',
  red: '#f85149',
  amber: '#d29922',
  blue: '#58a6ff',
  purple: '#a371f7',
  accent: '#2ea6ff',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

// A soft elevated-card shadow, tuned for the dark theme (subtle on iOS,
// falls back to Android's `elevation`).
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 10,
  elevation: 4,
} as const;

export const glowShadow = (color: string) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.45,
  shadowRadius: 8,
  elevation: 3,
});
