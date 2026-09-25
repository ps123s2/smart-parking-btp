/**
 * Reusable glass-morphic card component with dark aesthetic.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing, shadows } from '../../config/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  glowColor?: string;
  bordered?: boolean;
}

export function GlassCard({ children, style, glowColor, bordered }: GlassCardProps) {
  return (
    <View
      style={[
        styles.card,
        bordered && styles.bordered,
        glowColor && { borderColor: glowColor, ...shadows.glow(glowColor) },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadows.card,
  },
  bordered: {
    borderWidth: 1.5,
    borderColor: colors.border.active,
  },
});
