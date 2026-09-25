/**
 * Bookings screen — booking history and confirmation modal.
 * 
 * REAL-TIME SYNC: Bookings are written to Firebase so all connected
 * phones see updates instantly. No more local-only bookings.
 * 
 * GRANULAR TIME: Duration picker with 15-minute increments (15m → 4h).
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlotInfo, BookingInfo, SLOT_LABELS } from '../types/parking';
import { bookSlot } from '../services/api';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../config/theme';

// ═══════ DURATION OPTIONS (15-min increments, max 4 hours) ═══════
interface DurationOption {
  label: string;        // e.g. "1h 30m"
  hours: number;        // fractional hours (e.g. 1.5)
  totalMinutes: number; // 90
}

function generateDurationOptions(): DurationOption[] {
  const options: DurationOption[] = [];
  // 15 min to 4 hours in 15-min steps
  for (let mins = 15; mins <= 240; mins += 15) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    let label = '';
    if (h > 0 && m > 0) label = `${h}h ${m}m`;
    else if (h > 0) label = `${h}h`;
    else label = `${m}m`;
    options.push({ label, hours: mins / 60, totalMinutes: mins });
  }
  return options;
}

const DURATION_OPTIONS = generateDurationOptions();

/** Format fractional hours to readable string */
function formatDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ═══════ COMPONENT ═══════

interface BookingsScreenProps {
  userEmail?: string;
  slotToBook?: SlotInfo | null;
  onClearBookingSlot?: () => void;
  /** Real-time bookings from Firebase (synced across all devices) */
  bookings?: BookingInfo[];
  /** Write booking to Firebase for multi-device sync */
  onWriteBooking?: (booking: BookingInfo) => Promise<void>;
  /** Cancel booking in Firebase for multi-device sync */
  onCancelBooking?: (bookingId: string) => Promise<void>;
}

export function BookingsScreen({
  userEmail = 'guest@demo.com',
  slotToBook,
  onClearBookingSlot,
  bookings = [],
  onWriteBooking,
  onCancelBooking,
}: BookingsScreenProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(
    DURATION_OPTIONS.find(d => d.totalMinutes === 120) || DURATION_OPTIONS[7] // Default 2h
  );
  const [booking, setBooking] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const durationListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (slotToBook) setShowModal(true);
  }, [slotToBook]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: showModal ? 1 : 0, duration: 300, useNativeDriver: true }).start();
    // Scroll to selected duration when modal opens
    if (showModal && durationListRef.current) {
      const idx = DURATION_OPTIONS.findIndex(d => d.totalMinutes === selectedDuration.totalMinutes);
      if (idx >= 0) {
        setTimeout(() => {
          durationListRef.current?.scrollToIndex({ index: Math.max(0, idx - 1), animated: true });
        }, 350);
      }
    }
  }, [showModal]);

  async function handleConfirmBooking() {
    if (!slotToBook) return;
    setBooking(true);

    const bookingId = `bk_${Date.now()}_${slotToBook.id}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + selectedDuration.totalMinutes * 60 * 1000);
    
    const newBooking: BookingInfo = {
      id: bookingId,
      slotId: slotToBook.id,
      slotLabel: slotToBook.label,
      date: now.toISOString(),
      duration: selectedDuration.hours,
      status: 'active',
      userEmail,
      expiresAt: expiresAt.toISOString(),
    };

    try {
      // 1. Write to Firebase first (syncs to all phones immediately)
      if (onWriteBooking) {
        await onWriteBooking(newBooking);
      }

      // 2. Also notify the Flask API (for logging/analytics)
      const res = await bookSlot(slotToBook.id, userEmail, selectedDuration.hours);

      setShowModal(false);
      onClearBookingSlot?.();
      Alert.alert(
        '✅ Booked!',
        `Slot ${slotToBook.label} booked for ${selectedDuration.label}\nAll devices will see this booking.`
      );
    } catch {
      // Even if API fails, Firebase write already synced the booking
      setShowModal(false);
      onClearBookingSlot?.();
    }
    setBooking(false);
  }

  function handleCancelBooking(b: BookingInfo) {
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel your booking for Slot ${b.slotLabel}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            if (onCancelBooking) {
              // Pass slotId — bookings are keyed by slotId in Firebase
              await onCancelBooking(b.slotId);
            }
          },
        },
      ]
    );
  }

  // Format date for display
  function formatDate(isoDate: string): string {
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return isoDate;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    } catch {
      return isoDate;
    }
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>My Bookings</Text>
        
        {bookings.filter(b => b.userEmail === userEmail).length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={colors.text.muted} />
            <Text style={s.emptyText}>No bookings yet</Text>
            <Text style={s.emptySubText}>Book a slot from the Map or Home tab</Text>
          </View>
        )}

        {bookings.filter(b => b.userEmail === userEmail).map(b => {
          const active = b.status === 'active';
          const cancelled = b.status === 'cancelled';
          return (
            <View key={b.id} style={[s.card, active && s.cardActive]}>
              <View style={[s.icon, { backgroundColor: active ? colors.accent.blueSoft : 'rgba(107,114,128,0.1)' }]}>
                <Ionicons name="car-sport" size={22} color={active ? colors.accent.blue : '#6b7280'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.slotName}>Slot {b.slotLabel}</Text>
                <Text style={s.dateText}>{formatDate(b.date)} • {formatDuration(b.duration)}</Text>
                {b.userEmail && !b.userEmail.startsWith('guest_') && (
                  <Text style={s.emailText}>{b.userEmail}</Text>
                )}
              </View>
              {active ? (
                <TouchableOpacity
                  style={s.cancelSlotBtn}
                  onPress={() => handleCancelBooking(b)}
                >
                  <Text style={s.cancelSlotText}>CANCEL</Text>
                </TouchableOpacity>
              ) : (
                <View style={[s.statusBadge, {
                  backgroundColor: cancelled ? 'rgba(239,68,68,0.1)' : 'rgba(107,114,128,0.1)'
                }]}>
                  <Text style={[s.statusText, {
                    color: cancelled ? '#ef4444' : '#6b7280'
                  }]}>
                    {b.status.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Booking Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => { setShowModal(false); onClearBookingSlot?.(); }}>
        <View style={s.modalOverlay}>
          <Animated.View style={[s.modalContent, { opacity: fadeAnim }]}>
            <Text style={s.modalLabel}>Confirm new booking</Text>
            <View style={s.modalIcon}><Ionicons name="car-sport" size={32} color={colors.accent.blue} /></View>
            <Text style={s.modalSlot}>{slotToBook?.label}</Text>
            <View style={s.modalStatusRow}>
              <View style={[s.modalDot, { backgroundColor: slotToBook?.occupied ? colors.status.occupied : colors.status.available }]} />
              <Text style={{ color: slotToBook?.occupied ? colors.status.occupied : colors.status.available, fontSize: fontSize.md, fontWeight: fontWeight.medium }}>{slotToBook?.occupied ? 'Occupied' : 'Available'}</Text>
            </View>

            {/* ═══════ GRANULAR DURATION PICKER ═══════ */}
            <Text style={s.durLabel}>Duration (max 4 hours)</Text>
            <View style={s.durPickerContainer}>
              <FlatList
                ref={durationListRef}
                data={DURATION_OPTIONS}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => String(item.totalMinutes)}
                contentContainerStyle={s.durListContent}
                getItemLayout={(_, index) => ({
                  length: 72,
                  offset: 72 * index,
                  index,
                })}
                renderItem={({ item }) => {
                  const isSelected = item.totalMinutes === selectedDuration.totalMinutes;
                  return (
                    <TouchableOpacity
                      style={[s.durChip, isSelected && s.durChipActive]}
                      onPress={() => setSelectedDuration(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.durChipText, isSelected && s.durChipTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
            <View style={s.durSummary}>
              <Ionicons name="time-outline" size={16} color={colors.accent.blue} />
              <Text style={s.durSummaryText}>
                {selectedDuration.label} ({selectedDuration.totalMinutes} minutes)
              </Text>
            </View>

            <TouchableOpacity style={s.confirmBtn} onPress={handleConfirmBooking} disabled={booking} activeOpacity={0.85}>
              <Text style={s.confirmText}>{booking ? 'Booking...' : `Book for ${selectedDuration.label}`}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowModal(false); onClearBookingSlot?.(); }}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, marginBottom: spacing.xl },
  
  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: colors.text.secondary, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  emptySubText: { color: colors.text.muted, fontSize: fontSize.sm },
  
  // Cards
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.bg.card, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1.5, borderColor: 'transparent' },
  cardActive: { borderColor: colors.accent.blueBorder },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  slotName: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  dateText: { color: colors.text.muted, fontSize: fontSize.sm, marginTop: 2 },
  emailText: { color: colors.text.muted, fontSize: 10, marginTop: 1, opacity: 0.6 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.pill },
  statusText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  cancelSlotBtn: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.pill, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  cancelSlotText: { color: colors.status.occupied, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: colors.bg.card, borderRadius: borderRadius.xxl, padding: spacing.xxl, alignItems: 'center', gap: spacing.md, width: '90%', borderWidth: 1.5, borderColor: colors.accent.blue },
  modalLabel: { color: colors.text.muted, fontSize: fontSize.sm },
  modalIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.accent.blueSoft, alignItems: 'center', justifyContent: 'center' },
  modalSlot: { color: colors.text.primary, fontSize: fontSize.hero, fontWeight: fontWeight.bold },
  modalStatusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modalDot: { width: 8, height: 8, borderRadius: 4 },
  
  // Duration picker
  durLabel: { color: colors.text.muted, fontSize: fontSize.xs, alignSelf: 'flex-start', marginTop: spacing.sm },
  durPickerContainer: { height: 48, alignSelf: 'stretch' },
  durListContent: { gap: 8, paddingHorizontal: 4 },
  durChip: {
    width: 64,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  durChipActive: {
    backgroundColor: colors.accent.blue,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  durChipText: { color: colors.text.secondary, fontSize: 13, fontWeight: fontWeight.bold },
  durChipTextActive: { color: '#fff' },
  durSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(41,121,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  durSummaryText: { color: colors.accent.blue, fontSize: 13, fontWeight: fontWeight.medium },
  
  // Buttons
  confirmBtn: { backgroundColor: colors.accent.blue, paddingVertical: spacing.lg, borderRadius: borderRadius.lg, alignSelf: 'stretch', alignItems: 'center', marginTop: spacing.sm },
  confirmText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  cancelText: { color: colors.text.muted, fontSize: fontSize.md, marginTop: spacing.sm },
});
