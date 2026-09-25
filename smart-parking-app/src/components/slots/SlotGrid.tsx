/**
 * Grid display of all parking slots in a 3-column layout.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SlotInfo } from '../../types/parking';
import { SlotCard } from './SlotCard';
import { colors, spacing, fontSize, fontWeight } from '../../config/theme';

interface SlotGridProps {
  slots: SlotInfo[];
  onBook?: (slot: SlotInfo) => void;
  onSlotPress?: (slot: SlotInfo) => void;
}

export function SlotGrid({ slots, onBook, onSlotPress }: SlotGridProps) {
  const available = slots.filter((s) => !s.occupied).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Parking Slots</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {available} / {slots.length} Free
          </Text>
        </View>
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {slots.map((slot, index) => (
          <View key={slot.id} style={styles.gridItem}>
            <SlotCard
              slot={slot}
              index={index}
              onBook={onBook}
              onPress={onSlotPress}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  countBadge: {
    backgroundColor: colors.status.availableGlow,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 100,
  },
  countText: {
    color: colors.status.available,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    width: '31%',
    flexGrow: 1,
    maxWidth: '33%',
  },
});
