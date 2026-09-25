/**
 * Individual parking slot card with status indicator and booking button.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlotInfo } from '../../types/parking';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../../config/theme';
import { StatusBadge } from '../ui/StatusBadge';

interface SlotCardProps {
  slot: SlotInfo;
  index: number;
  onBook?: (slot: SlotInfo) => void;
  onPress?: (slot: SlotInfo) => void;
}

export function SlotCard({ slot, index, onBook, onPress }: SlotCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const accentColor = slot.isBest
    ? colors.accent.blue
    : slot.occupied
    ? colors.status.occupied
    : colors.status.available;

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onPress?.(slot)}
        style={[
          styles.card,
          slot.isBest && styles.bestCard,
          slot.isBest && shadows.glow(colors.accent.blue),
        ]}
      >
        {/* Slot icon */}
        <View style={[styles.iconCircle, { backgroundColor: accentColor + '18' }]}>
          <Ionicons
            name={slot.occupied ? 'car' : 'car-outline'}
            size={22}
            color={accentColor}
          />
        </View>

        {/* Slot label */}
        <Text style={styles.label}>{slot.label}</Text>

        {/* Status badge */}
        <StatusBadge
          status={slot.isBest ? 'best' : slot.occupied ? 'occupied' : 'available'}
          small
        />

        {/* Prediction / Timing text */}
        <Text style={[styles.prediction, slot.occupied && { color: colors.status.occupied }]} numberOfLines={1}>
          {slot.occupied 
            ? `⏳ ${slot.timingLabel}`
            : slot.prediction.includes('Free') ? '🔮 Likely Free' : '🔮 Likely Busy'}
        </Text>

        {/* Book button (only for available slots) */}
        {!slot.occupied && (
          <TouchableOpacity
            style={[
              styles.bookButton,
              slot.isBest && styles.bookButtonBest,
            ]}
            onPress={() => onBook?.(slot)}
            activeOpacity={0.8}
          >
            <Text style={styles.bookButtonText}>Book</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  bestCard: {
    borderColor: colors.accent.blue,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  prediction: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
  },
  bookButton: {
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  bookButtonBest: {
    backgroundColor: colors.accent.blue,
  },
  bookButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
});
