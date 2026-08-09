export const colors = {
  bg: '#f4f6fa',
  bgPanel: '#ffffff',
  bgCard: '#ffffff',
  bgElevated: '#ffffff',
  bgPanelHover: '#eef1f6',
  border: '#e1e6ee',
  text: '#1b2436',
  textDim: '#69738a',
  green: '#1a8f4c',
  red: '#dc2626',
  amber: '#b45309',
  blue: '#2563eb',
  purple: '#8b5cf6',
  accent: '#0ea5e9',
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

// A soft elevated-card shadow, tuned for the light theme — subtle enough
// not to look like a heavy smudge on white.
export const cardShadow = {
  shadowColor: '#1b2436',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 3,
} as const;

export const glowShadow = (color: string) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.28,
  shadowRadius: 8,
  elevation: 3,
});
