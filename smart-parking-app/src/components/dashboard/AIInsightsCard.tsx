/**
 * AI Insights card showing MARL recommendation and GRU predictions.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ParkingData, SLOT_LABELS } from '../../types/parking';
import { colors, borderRadius, spacing, fontSize, fontWeight } from '../../config/theme';
import { GlassCard } from '../ui/GlassCard';

interface AIInsightsCardProps {
  data: ParkingData;
}

export function AIInsightsCard({ data }: AIInsightsCardProps) {
  const bestSlotLabel = SLOT_LABELS[data.recommendation?.best_slot] || data.recommendation?.best_slot;
  const top3Labels = (data.recommendation?.top3 || []).map(
    (s) => SLOT_LABELS[s] || s
  );

  return (
    <GlassCard>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.aiIcon}>
          <Ionicons name="sparkles" size={16} color={colors.accent.blue} />
        </View>
        <Text style={styles.title}>AI Insights</Text>
      </View>

      {/* Best Slot Recommendation */}
      <View style={styles.recommendation}>
        <Ionicons name="star" size={14} color={colors.accent.blue} />
        <Text style={styles.recText}>
          Recommended: <Text style={styles.recSlot}>{bestSlotLabel}</Text>
        </Text>
      </View>

      {/* Top 3 slots */}
      <View style={styles.top3Container}>
        <Text style={styles.sectionLabel}>Top 3 Slots</Text>
        <View style={styles.chipRow}>
          {top3Labels.map((label, i) => (
            <View
              key={label}
              style={[styles.chip, i === 0 && styles.chipBest]}
            >
              <Text
                style={[styles.chipText, i === 0 && styles.chipTextBest]}
              >
                {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* GRU Predictions */}
      <View style={styles.predictionsContainer}>
        <Text style={styles.sectionLabel}>🔮 GRU Predictions</Text>
        {Object.entries(data.predictions || {}).map(([slot, prediction]) => {
          const isFree = prediction.includes('Free');
          return (
            <View key={slot} style={styles.predictionRow}>
              <Text style={styles.predSlot}>
                {SLOT_LABELS[slot] || slot}
              </Text>
              <View
                style={[
                  styles.predBadge,
                  {
                    backgroundColor: isFree
                      ? colors.status.availableGlow
                      : colors.status.occupiedGlow,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.predText,
                    {
                      color: isFree
                        ? colors.status.available
                        : colors.status.occupied,
                    },
                  ]}
                >
                  {isFree ? 'Free' : 'Busy'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Route info */}
      {data.navigation && (
        <View style={styles.routeInfo}>
          <View style={styles.routeStat}>
            <Text style={styles.routeIcon}>📏</Text>
            <Text style={styles.routeValue}>{data.navigation.distance}m</Text>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeStat}>
            <Text style={styles.routeIcon}>⏱</Text>
            <Text style={styles.routeValue}>{data.navigation.duration}s</Text>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeStat}>
            <Text style={styles.routeIcon}>🛣️</Text>
            <Text style={styles.routeValue}>
              {(data.route?.path || []).join(' → ')}
            </Text>
          </View>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  aiIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  recommendation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  recText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  recSlot: {
    color: colors.accent.blue,
    fontWeight: fontWeight.bold,
  },
  top3Container: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.pill,
  },
  chipBest: {
    backgroundColor: colors.accent.blueSoft,
    borderWidth: 1,
    borderColor: colors.accent.blueBorder,
  },
  chipText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  chipTextBest: {
    color: colors.accent.blue,
  },
  predictionsContainer: {
    marginBottom: spacing.md,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
  },
  predSlot: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  predBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  predText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  routeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  routeStat: {
    alignItems: 'center',
    gap: 2,
  },
  routeIcon: {
    fontSize: fontSize.md,
  },
  routeValue: {
    color: colors.text.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  routeDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border.subtle,
  },
});
