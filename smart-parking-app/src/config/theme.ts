/**
 * Design system theme constants for the Smart Parking app.
 * Dark glassmorphic aesthetic matching the mockup designs.
 */

export const colors = {
  // Backgrounds (depth layers)
  bg: {
    deep: '#060810',
    primary: '#0A0D14',
    card: '#131720',
    elevated: '#1A1F2E',
    input: '#0F1219',
  },

  // Accent colors
  accent: {
    blue: '#2979FF',
    blueDark: '#0D47A1',
    blueLight: '#64B5F6',
    blueGlow: 'rgba(41, 121, 255, 0.25)',
    blueSoft: 'rgba(41, 121, 255, 0.12)',
    blueBorder: 'rgba(41, 121, 255, 0.35)',
  },

  // Status colors
  status: {
    available: '#4CAF50',
    availableGlow: 'rgba(76, 175, 80, 0.15)',
    availableBorder: 'rgba(76, 175, 80, 0.3)',
    occupied: '#F44336',
    occupiedGlow: 'rgba(244, 67, 54, 0.15)',
    occupiedBorder: 'rgba(244, 67, 54, 0.3)',
  },

  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#94A3B8',
    muted: '#475569',
    accent: '#2979FF',
  },

  // Borders & surfaces
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    medium: 'rgba(255, 255, 255, 0.1)',
    active: 'rgba(41, 121, 255, 0.35)',
  },

  // Gradients
  gradient: {
    co2Start: '#0D2137',
    co2End: '#133052',
    accentStart: '#2979FF',
    accentEnd: '#0D47A1',
  },

  // Chart colors
  chart: {
    blue: '#2979FF',
    green: '#4CAF50',
    orange: '#FF9800',
    red: '#F44336',
    purple: '#9C27B0',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 100,
};

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  hero: 36,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  }),
  button: {
    shadowColor: '#2979FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
};
