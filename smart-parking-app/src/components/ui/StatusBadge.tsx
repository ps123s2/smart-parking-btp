/**
 * Status badge for Available / Occupied states.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius, fontSize, fontWeight, spacing } from '../../config/theme';

interface StatusBadgeProps {
  status: 'available' | 'occupied' | 'best';
  small?: boolean;
}

export function StatusBadge({ status, small }: StatusBadgeProps) {
  const config = {
    available: {
      label: 'Free',
      color: colors.status.available,
      bg: colors.status.availableGlow,
    },
    occupied: {
      label: 'Taken',
      color: colors.status.occupied,
      bg: colors.status.occupiedGlow,
    },
    best: {
      label: 'BEST',
      color: colors.accent.blue,
      bg: colors.accent.blueSoft,
    },
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, small && styles.small]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.label, { color: config.color }, small && styles.smallText]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.pill,
    gap: spacing.xs + 2,
  },
  small: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  smallText: {
    fontSize: fontSize.xs,
  },
});
