/**
 * Statistics row showing available, occupied, and total slot counts.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize, fontWeight } from '../../config/theme';
import { AnimatedCounter } from '../ui/AnimatedCounter';

interface StatsRowProps {
  available: number;
  occupied: number;
  total: number;
}

export function StatsRow({ available, occupied, total }: StatsRowProps) {
  const stats = [
    {
      icon: 'checkmark-circle' as const,
      label: 'Available',
      value: available,
      color: colors.status.available,
      bg: colors.status.availableGlow,
    },
    {
      icon: 'close-circle' as const,
      label: 'Occupied',
      value: occupied,
      color: colors.status.occupied,
      bg: colors.status.occupiedGlow,
    },
    {
      icon: 'grid' as const,
      label: 'Total',
      value: total,
      color: colors.accent.blue,
      bg: colors.accent.blueSoft,
    },
  ];

  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <View key={stat.label} style={[styles.card, { backgroundColor: colors.bg.card }]}>
          <View style={[styles.iconCircle, { backgroundColor: stat.bg }]}>
            <Ionicons name={stat.icon} size={18} color={stat.color} />
          </View>
          <AnimatedCounter
            value={stat.value}
            style={{ ...styles.value, color: stat.color }}
          />
          <Text style={styles.label}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
  },
  label: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
  },
});
