/**
 * Best slot recommendation banner with call-to-action navigation button.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLOT_LABELS } from '../../types/parking';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../../config/theme';

interface RecommendationBannerProps {
  bestSlot: string;
  co2Saved: number;
  onNavigate?: () => void;
}

export function RecommendationBanner({
  bestSlot,
  co2Saved,
  onNavigate,
}: RecommendationBannerProps) {
  const label = SLOT_LABELS[bestSlot] || bestSlot;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Ionicons name="star" size={16} color={colors.accent.blue} />
        <Text style={styles.recText}>
          Recommended: {label} • CO₂ {co2Saved.toFixed(1)} g
        </Text>
      </View>

      <TouchableOpacity
        style={styles.navButton}
        onPress={onNavigate}
        activeOpacity={0.85}
      >
        <Ionicons name="navigate" size={18} color="#fff" />
        <Text style={styles.navText}>Navigate to Best Slot • {label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  recText: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent.blue,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    ...shadows.button,
  },
  navText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
});
