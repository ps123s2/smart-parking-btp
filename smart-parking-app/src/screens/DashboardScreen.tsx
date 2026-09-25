/**
 * Dashboard / Home screen - main view with map, slots, stats, and AI insights.
 * All data is streamed in real-time from Firebase via shared props (no duplicate listeners).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UseParkingResult } from '../hooks/useFirebaseParking';
import { ParkingMap } from '../components/map/ParkingMap';
import { StatsRow } from '../components/dashboard/StatsRow';
import { CO2Card } from '../components/dashboard/CO2Card';
import { AIInsightsCard } from '../components/dashboard/AIInsightsCard';
import { RecommendationBanner } from '../components/dashboard/RecommendationBanner';
import { SlotGrid } from '../components/slots/SlotGrid';
import { PulseIndicator } from '../components/ui/PulseIndicator';
import { SlotInfo } from '../types/parking';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';

interface DashboardScreenProps {
  userName?: string;
  parking: UseParkingResult;
  onBook?: (slot: SlotInfo) => void;
  onNavigateToMap?: () => void;
}

export function DashboardScreen({
  userName = 'User',
  parking,
  onBook,
  onNavigateToMap,
}: DashboardScreenProps) {
  const { data, slots, loading, error, stats, layout, userLocation, liveMetrics } = parking;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.blue} />
        <Text style={styles.loadingText}>Connecting to parking system...</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="cloud-offline" size={48} color={colors.text.muted} />
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorHint}>
          Make sure firebase_dashboard.py is running
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hello, {userName} 👋
          </Text>
          <View style={styles.liveRow}>
            <PulseIndicator color={colors.status.available} size={6} />
            <Text style={styles.subtitle}>Find your smart parking spot</Text>
          </View>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {userName.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* CO2 Banner — real-time calculation */}
      <View style={styles.section}>
        <CO2Card
          saved={liveMetrics.co2Saved}
          unit="g"
          distanceM={liveMetrics.distanceSaved}
        />
      </View>

      {/* Map preview */}
      <View style={styles.mapSection}>
        <ParkingMap
          slots={slots}
          parkingData={data}
          layout={layout}
          userLocation={userLocation}
          style={styles.mapPreview}
          compact={true}
        />
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <StatsRow
          available={stats.available}
          occupied={stats.occupied}
          total={stats.total}
        />
      </View>

      {/* Recommendation + Navigate */}
      {data?.recommendation?.best_slot && (
        <RecommendationBanner
          bestSlot={data.recommendation.best_slot}
          co2Saved={data.co2?.saved || 0}
          onNavigate={onNavigateToMap}
        />
      )}

      {/* Slot Grid */}
      <View style={styles.section}>
        <SlotGrid slots={slots} onBook={onBook} />
      </View>

      {/* AI Insights */}
      {data && (
        <View style={styles.section}>
          <View style={styles.sectionPadded}>
            <AIInsightsCard data={data} />
          </View>
        </View>
      )}

      {/* Bottom spacing */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  contentContainer: {
    paddingTop: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  loadingText: {
    color: colors.text.muted,
    fontSize: fontSize.md,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxxl,
  },
  errorTitle: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  errorText: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  errorHint: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  greeting: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accent.blue,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionPadded: {
    paddingHorizontal: spacing.lg,
  },
  mapSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    height: 250,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  mapPreview: {
    height: 250,
  },
});
