/**
 * Profile screen with user info, CO2 stats, and logout.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserInfo } from '../types/parking';
import { useFirebaseParking } from '../hooks/useFirebaseParking';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../config/theme';

interface ProfileScreenProps {
  user: UserInfo | null;
  onLogout: () => void;
}

export function ProfileScreen({ user, onLogout }: ProfileScreenProps) {
  const { data, stats } = useFirebaseParking();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>My Profile</Text>

      {/* Avatar + user details */}
      <View style={s.avatarSection}>
        <View style={s.avatarWrap}>
          <Text style={s.avatarText}>{(user?.name || 'G').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={s.userName}>{user?.name || 'Guest User'}</Text>
        <Text style={s.userEmail}>{user?.email || 'guest@demo.com'}</Text>
        <View style={s.roleBadge}>
          <Text style={s.roleText}>{user?.role?.toUpperCase() || 'REGISTERED DRIVER'}</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Ionicons name="leaf" size={22} color={colors.status.available} />
          <Text style={s.statValue}>{data?.co2?.saved?.toFixed(1) || '0.0'}</Text>
          <Text style={s.statLabel}>CO₂ Saved (g)</Text>
        </View>
        <View style={s.statCard}>
          <Ionicons name="car" size={22} color={colors.accent.orange} />
          <Text style={s.statValue}>{stats.total}</Text>
          <Text style={s.statLabel}>Total Slots</Text>
        </View>
        <View style={s.statCard}>
          <Ionicons name="checkmark-circle" size={22} color={colors.status.available} />
          <Text style={s.statValue}>{stats.available}</Text>
          <Text style={s.statLabel}>Available</Text>
        </View>
      </View>

      {/* System info Card */}
      <View style={s.infoCard}>
        <Text style={s.infoTitle}>System & AI Engines</Text>
        {[
          ['🔥', 'Firebase Realtime DB', 'Connected (Live)'],
          ['🤖', 'AI Model Suite', 'MARL + GNN + GRU'],
          ['📡', 'Telemetry Stream', '2000 ms Interval'],
          ['🗺️', 'GIS Engine', 'Mapbox GL JS (DXF Vector)'],
        ].map(([icon, label, value]) => (
          <View key={label as string} style={s.infoRow}>
            <Text style={s.infoIcon}>{icon}</Text>
            <Text style={s.infoLabel}>{label}</Text>
            <Text style={s.infoValue}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Logout button */}
      <TouchableOpacity style={s.logoutBtn} onPress={onLogout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={18} color="#EF4444" />
        <Text style={s.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: spacing.xl,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  avatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.accent.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.accent.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  userName: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  userEmail: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 91, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    marginTop: 10,
  },
  roleText: {
    color: colors.accent.orange,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: 18,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  statValue: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  infoTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  infoLabel: {
    color: '#4B5563',
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  infoValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#FEE2E2',
    paddingVertical: spacing.lg,
    borderRadius: 16,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
});
