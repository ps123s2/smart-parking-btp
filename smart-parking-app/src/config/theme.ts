/**
 * Design system theme constants for the Smart Parking app.
 * Light neumorphic aesthetic with vibrant orange accents matching the mockup design.
 */

export const colors = {
  // Backgrounds (depth layers)
  bg: {
    deep: '#ECEEF2',
    primary: '#F5F6F9',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
    input: '#EDF0F4',
    pill: '#FFFFFF',
    orangeCard: '#FF5B00',
    orangeCardEnd: '#FF6D1A',
  },

  // Accent colors — Vibrant signature orange
  accent: {
    orange: '#FF5B00',
    orangeDark: '#E04F00',
    orangeLight: '#FF7A29',
    orangeGlow: 'rgba(255, 91, 0, 0.25)',
    orangeSoft: 'rgba(255, 91, 0, 0.12)',
    orangeBorder: 'rgba(255, 91, 0, 0.35)',
    // Map blue alias to orange for seamless harmony across all components
    blue: '#FF5B00',
    blueDark: '#E04F00',
    blueLight: '#FF7A29',
    blueGlow: 'rgba(255, 91, 0, 0.25)',
    blueSoft: 'rgba(255, 91, 0, 0.12)',
    blueBorder: 'rgba(255, 91, 0, 0.35)',
  },

  // Status colors
  status: {
    available: '#10B981',
    availableGlow: 'rgba(16, 185, 129, 0.12)',
    availableBorder: 'rgba(16, 185, 129, 0.25)',
    occupied: '#EF4444',
    occupiedGlow: 'rgba(239, 68, 68, 0.12)',
    occupiedBorder: 'rgba(239, 68, 68, 0.25)',
  },

  // Text
  text: {
    primary: '#111827',
    secondary: '#4B5563',
    muted: '#9CA3AF',
    accent: '#FF5B00',
    light: '#FFFFFF',
  },

  // Borders & surfaces
  border: {
    subtle: 'rgba(0, 0, 0, 0.06)',
    medium: 'rgba(0, 0, 0, 0.12)',
    active: 'rgba(255, 91, 0, 0.4)',
  },

  // Gradients
  gradient: {
    co2Start: '#F0FDF4',
    co2End: '#DCFCE7',
    accentStart: '#FF5B00',
    accentEnd: '#FF7A29',
  },

  // Chart colors
  chart: {
    blue: '#FF5B00',
    green: '#10B981',
    orange: '#FF9800',
    red: '#EF4444',
    purple: '#8B5CF6',
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
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  pill: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  }),
  button: {
    shadowColor: '#FF5B00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
};
