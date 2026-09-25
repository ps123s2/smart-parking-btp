/**
 * Profile screen with user info, CO2 stats, and logout.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserInfo } from '../types/parking';
import { useFirebaseParking } from '../hooks/useFirebaseParking';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../config/theme';
import { GlassCard } from '../components/ui/GlassCard';

interface ProfileScreenProps {
  user: UserInfo | null;
  onLogout: () => void;
}

export function ProfileScreen({ user, onLogout }: ProfileScreenProps) {
  const { data, stats } = useFirebaseParking();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Profile</Text>

      {/* Avatar + name */}
      <View style={s.avatarSection}>
        <LinearGradient colors={[colors.gradient.accentStart, colors.gradient.accentEnd]} style={s.avatarGrad}>
          <Text style={s.avatarText}>{(user?.name || 'G').charAt(0).toUpperCase()}</Text>
        </LinearGradient>
        <Text style={s.userName}>{user?.name || 'Guest'}</Text>
        <Text style={s.userEmail}>{user?.email || 'guest@demo.com'}</Text>
        <View style={s.roleBadge}>
          <Text style={s.roleText}>{user?.role?.toUpperCase() || 'CUSTOMER'}</Text>
        </View>
      </View>

      {/* Quick stats */}
      <View style={s.statsRow}>
        <GlassCard style={s.statCard}>
          <Ionicons name="leaf" size={20} color={colors.status.available} />
          <Text style={s.statValue}>{data?.co2?.saved?.toFixed(1) || '0.0'}</Text>
          <Text style={s.statLabel}>CO₂ Saved (g)</Text>
        </GlassCard>
        <GlassCard style={s.statCard}>
          <Ionicons name="car" size={20} color={colors.accent.blue} />
          <Text style={s.statValue}>{stats.total}</Text>
          <Text style={s.statLabel}>Total Slots</Text>
        </GlassCard>
        <GlassCard style={s.statCard}>
          <Ionicons name="checkmark-circle" size={20} color={colors.status.available} />
          <Text style={s.statValue}>{stats.available}</Text>
          <Text style={s.statLabel}>Available</Text>
        </GlassCard>
      </View>

      {/* System info */}
      <GlassCard style={s.infoCard}>
        <Text style={s.infoTitle}>System Info</Text>
        {[
          ['🔥', 'Firebase', 'Connected (Real-time)'],
          ['🤖', 'AI Models', 'MARL + GNN + GRU'],
          ['📡', 'Update Rate', 'Every 2 seconds'],
          ['🗺️', 'Location', 'Singapore'],
        ].map(([icon, label, value]) => (
          <View key={label as string} style={s.infoRow}>
            <Text>{icon}</Text>
            <Text style={s.infoLabel}>{label}</Text>
            <Text style={s.infoValue}>{value}</Text>
          </View>
        ))}
      </GlassCard>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={onLogout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={18} color={colors.status.occupied} />
        <Text style={s.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, marginBottom: spacing.xxl },
  avatarSection: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxl },
  avatarGrad: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', ...shadows.glow(colors.accent.blue) },
  avatarText: { color: '#fff', fontSize: fontSize.xxxl, fontWeight: fontWeight.bold },
  userName: { color: colors.text.primary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  userEmail: { color: colors.text.muted, fontSize: fontSize.md },
  roleBadge: { backgroundColor: colors.accent.blueSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.pill },
  roleText: { color: colors.accent.blue, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  statCard: { flex: 1, alignItems: 'center', gap: spacing.xs, padding: spacing.md },
  statValue: { color: colors.text.primary, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  statLabel: { color: colors.text.muted, fontSize: fontSize.xs, textAlign: 'center' },
  infoCard: { marginBottom: spacing.xl },
  infoTitle: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  infoLabel: { color: colors.text.secondary, fontSize: fontSize.md, flex: 1 },
  infoValue: { color: colors.text.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.status.occupiedGlow, paddingVertical: spacing.lg, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.status.occupiedBorder },
  logoutText: { color: colors.status.occupied, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
