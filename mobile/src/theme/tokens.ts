/**
 * UrbanPulse Mobile Design Tokens
 * React Native formatted design tokens matching web values for dark surfaces, cyan accents,
 * severity indicators, and 44x44pt minimum touch target sizing.
 */

export const tokens = {
  colors: {
    surfaces: {
      app: '#0a0f1d',
      card: '#0e1321',
      panel: '#161b2a',
      elevated: '#1a1f2e',
      border: '#27314a',
      borderSubtle: '#1e293b',
    },
    primary: {
      cyan: '#06b6d4',
      cyanHover: '#0891b2',
      cyanMuted: 'rgba(6, 182, 212, 0.15)',
      cyanBorder: 'rgba(6, 182, 212, 0.3)',
      contrastText: '#081726',
    },
    severity: {
      critical: {
        bg: '#450a0a',
        badgeBg: 'rgba(244, 63, 94, 0.18)',
        border: '#f43f5e',
        text: '#f43f5e',
        pillText: '#ffe4e6',
      },
      high: {
        bg: '#431407',
        badgeBg: 'rgba(249, 115, 22, 0.18)',
        border: '#f97316',
        text: '#f97316',
        pillText: '#ffedd5',
      },
      medium: {
        bg: '#422006',
        badgeBg: 'rgba(234, 179, 8, 0.18)',
        border: '#eab308',
        text: '#eab308',
        pillText: '#fef9c3',
      },
      low: {
        bg: '#082f49',
        badgeBg: 'rgba(6, 182, 212, 0.18)',
        border: '#06b6d4',
        text: '#06b6d4',
        pillText: '#cffafe',
      },
      resolved: {
        bg: '#022c22',
        badgeBg: 'rgba(16, 185, 129, 0.18)',
        border: '#10b981',
        text: '#10b981',
        pillText: '#d1fae5',
      },
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      muted: '#64748b',
      disabled: '#475569',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    touchTargetMin: 44,
  },
  radii: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  typography: {
    fontSize: {
      xs: 11,
      sm: 12,
      base: 14,
      lg: 16,
      xl: 20,
      xxl: 24,
      hero: 32,
    },
  },
} as const;

export type MobileThemeTokens = typeof tokens;
