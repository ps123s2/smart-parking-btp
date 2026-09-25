/**
 * Web fallback for ParkingMap — react-native-maps is native-only.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SlotInfo, ParkingData } from '../../types/parking';
import { colors, borderRadius, spacing, fontSize, fontWeight } from '../../config/theme';

interface ParkingMapProps {
  slots: SlotInfo[];
  parkingData: ParkingData | null;
  layout?: any;
  userLocation?: any;
  onMarkerPress?: (slot: SlotInfo) => void;
  navigatingTo?: SlotInfo | null;
  style?: any;
  compact?: boolean;
}

export function ParkingMap({ slots, style }: ParkingMapProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.emoji}>🗺️</Text>
      <Text style={styles.title}>Interactive Map</Text>
      <Text style={styles.sub}>Open on mobile with Expo Go</Text>
      <View style={styles.slotsRow}>
        {slots.map(slot => (
          <View key={slot.id} style={[styles.slotDot, { backgroundColor: slot.occupied ? '#FF5252' : slot.isBest ? '#2979FF' : '#00C853' }]}>
            <Text style={styles.slotDotText}>{slot.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: borderRadius.xl, overflow: 'hidden', backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, padding: spacing.xl },
  emoji: { fontSize: 48 },
  title: { color: '#fff', fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sub: { color: colors.text.muted, fontSize: fontSize.sm },
  slotsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  slotDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  slotDotText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold },
});
