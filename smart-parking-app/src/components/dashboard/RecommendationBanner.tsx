/**
 * Best slot recommendation banner with call-to-action navigation button.
 * Matches the signature vibrant orange featured card from the mockup design.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlotInfo, SLOT_LABELS } from '../../types/parking';
import { OverheadSlotsViewer } from '../slots/OverheadSlotsViewer';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../../config/theme';

interface RecommendationBannerProps {
  bestSlot: string;
  co2Saved: number;
  isBooked?: boolean;
  onNavigate?: () => void;
  slots?: SlotInfo[];
  availableCount?: number;
}

export function RecommendationBanner({
  bestSlot,
  co2Saved,
  onNavigate,
  isBooked,
  slots = [],
  availableCount = 9,
}: RecommendationBannerProps) {
  const label = SLOT_LABELS[bestSlot] || bestSlot;

  return (
    <View style={styles.wrapper}>
      {/* Floating Pill Badge overlapping top-left (matches mockup Screen 1) */}
      <View style={styles.floatingAvailablePill}>
        <View style={styles.availableNumberCircle}>
          <Text style={styles.availableNumberText}>{availableCount}</Text>
        </View>
        <Text style={styles.availableLabelText}>Available</Text>
      </View>

      <TouchableOpacity
        style={styles.card}
        onPress={onNavigate}
        activeOpacity={0.92}
      >
        {/* Overhead Parking Preview Enclosure */}
        {slots.length > 0 && (
          <View style={styles.previewContainer}>
            <OverheadSlotsViewer
              slots={slots.slice(0, 8)}
              selectedSlotId={bestSlot}
              compact={true}
            />
          </View>
        )}

        {/* Card Info & Circular Arrow Action Button */}
        <View style={styles.bottomRow}>
          <View style={styles.textColumn}>
            <Text style={styles.locationTitle}>
              {isBooked ? `Reserved: Slot ${label}` : 'IIIT Sricity Parking Area'}
            </Text>
            <Text style={styles.locationSub}>
              {isBooked ? 'Tap to view live navigation' : 'Smart Parking • Campus Hub'}
            </Text>
          </View>

          {/* Circular Action Button with Diagonal Arrow ↗ */}
          <View style={styles.circleButtonOuter}>
            <View style={styles.circleButtonInner}>
              <Ionicons
                name="arrow-up"
                size={18}
                color="#FFFFFF"
                style={{ transform: [{ rotate: '45deg' }] }}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginHorizontal: spacing.lg,
    paddingTop: 16,
  },
  floatingAvailablePill: {
    position: 'absolute',
    top: 0,
    left: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  availableNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F3F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableNumberText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '800',
  },
  availableLabelText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '600',
    paddingRight: 4,
  },
  card: {
    backgroundColor: colors.bg.orangeCard,
    borderRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: colors.accent.orange,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 20,
    elevation: 8,
  },
  previewContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#D7DDE6',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  textColumn: {
    flex: 1,
    paddingRight: spacing.md,
  },
  locationTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  locationSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  circleButtonOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  circleButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

