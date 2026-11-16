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
    borderRadius: 18,
    gap: spacing.xs,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  label: {
    color: '#64748B',
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
