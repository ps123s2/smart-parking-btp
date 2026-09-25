/**
 * CO2 savings display card with animated counter and gradient background.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize, fontWeight } from '../../config/theme';
import { AnimatedCounter } from '../ui/AnimatedCounter';

interface CO2CardProps {
  saved: number;
  unit: string;
  distanceM?: number;
}

export function CO2Card({ saved, unit, distanceM }: CO2CardProps) {
  return (
    <LinearGradient
      colors={[colors.gradient.co2Start, colors.gradient.co2End]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="leaf" size={24} color={colors.accent.blueLight} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>CO₂ Saved</Text>
        <View style={styles.valueRow}>
          <Text style={styles.emoji}>🌱</Text>
          <AnimatedCounter
            value={saved}
            suffix={` ${unit}`}
            decimals={1}
            style={styles.value}
          />
        </View>
        {distanceM != null && distanceM > 0 && (
          <Text style={styles.subtitle}>
            {distanceM}m less driving distance
          </Text>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent.blueBorder,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  label: {
    color: 'rgba(100, 181, 246, 0.7)',
    fontSize: fontSize.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  emoji: {
    fontSize: fontSize.lg,
  },
  value: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    color: 'rgba(100, 181, 246, 0.5)',
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
