/**
 * Bookings screen — booking history, real-time timer drawer, and overhead parking visualizer.
 * Matches the uploaded design (Screen 2: Overhead slots layout + Closing Time countdown arc).
 * 
 * ZERO ALERT WINDOWS: Cancel & booking run silently in the background with auto-dismissing toast.
 * SINGLE BOOKING RULE: One user can book only one slot at a time.
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
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlotInfo, BookingInfo } from '../types/parking';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../config/theme';
import { showToast } from '../utils/toast';
import { OverheadSlotsViewer } from '../components/slots/OverheadSlotsViewer';
import { BookingModal, BookingDetails } from '../components/booking/BookingModal';

// ═══════ DURATION OPTIONS (15-min increments, max 4 hours) ═══════
interface DurationOption {
  label: string;
  hours: number;
  totalMinutes: number;
}

function generateDurationOptions(): DurationOption[] {
  const options: DurationOption[] = [];
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

function formatDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

interface BookingsScreenProps {
  userEmail?: string;
  slotToBook?: SlotInfo | null;
  onClearBookingSlot?: () => void;
  bookings?: BookingInfo[];
  onWriteBooking?: (booking: BookingInfo) => Promise<void>;
  onCancelBooking?: (bookingId: string) => Promise<void>;
  slots?: SlotInfo[];
}

export function BookingsScreen({
  userEmail = 'guest@demo.com',
  slotToBook,
  onClearBookingSlot,
  bookings = [],
  onWriteBooking,
  onCancelBooking,
  slots = [],
}: BookingsScreenProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(
    DURATION_OPTIONS.find((d) => d.totalMinutes === 120) || DURATION_OPTIONS[7]
  );
  const [booking, setBooking] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'today' | 'tomorrow' | 'later'>('today');
  const [countdownStr, setCountdownStr] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const durationListRef = useRef<FlatList>(null);

  const [internalSlotToBook, setInternalSlotToBook] = useState<SlotInfo | null>(null);
  const currentSlotToBook = slotToBook || internalSlotToBook;

  // Check if this user already has an active booking (supporting guest mode & logged-in matching)
  const isMyBooking = (b: BookingInfo) => {
    if (!userEmail || !b.userEmail) return false;
    return b.userEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
  };

  const activeBookingForUser = bookings.find(
    (b) => b.status === 'active' && isMyBooking(b)
  );

  // Dynamic countdown timer calculation
  useEffect(() => {
    if (!activeBookingForUser) {
      setCountdownStr('');
      return;
    }

    function updateTimer() {
      if (!activeBookingForUser?.expiresAt) {
        setCountdownStr('02:00:00');
        return;
      }
      const diff = new Date(activeBookingForUser.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setCountdownStr('00:00:00');
        return;
      }
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdownStr(
        `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeBookingForUser?.expiresAt]);

  useEffect(() => {
    if (slotToBook) {
      if (activeBookingForUser) {
        onClearBookingSlot?.();
        showToast(
          'You already booked a slot!',
          `You currently have an active reservation for Slot ${activeBookingForUser.slotLabel}. Cancel it first to change slots.`,
          'warning'
        );
        return;
      }
      setShowModal(true);
    }
  }, [slotToBook, activeBookingForUser]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: showModal ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (showModal && durationListRef.current) {
      const idx = DURATION_OPTIONS.findIndex(
        (d) => d.totalMinutes === selectedDuration.totalMinutes
      );
      if (idx >= 0) {
        setTimeout(() => {
          durationListRef.current?.scrollToIndex({ index: Math.max(0, idx - 1), animated: true });
        }, 350);
      }
    }
  }, [showModal]);

  function handleParkButtonPress() {
    if (activeBookingForUser) {
      showToast(
        'You already booked a slot!',
        `You currently have an active reservation for Slot ${activeBookingForUser.slotLabel}. Cancel it first to change slots.`,
        'warning'
      );
      return;
    }
    const freeSlot = slots.find((s) => !s.occupied);
    if (!freeSlot) {
      showToast('No Available Slots', 'All parking bays are currently occupied.', 'info');
      return;
    }
    setInternalSlotToBook(freeSlot);
    setShowModal(true);
  }

  async function handleConfirmBookingDetails(details: BookingDetails) {
    if (activeBookingForUser) {
      showToast(
        'Booking Limit Reached',
        `You already have an active reservation for Slot ${activeBookingForUser.slotLabel}. Cancel it first before booking another slot.`,
        'warning'
      );
      setShowModal(false);
      onClearBookingSlot?.();
      setInternalSlotToBook(null);
      return;
    }

    const targetSlot = details.slot;
    const currentSlot = slots.find((s) => s.id === targetSlot.id) || targetSlot;
    if (currentSlot.occupied) {
      showToast(
        'Slot Occupied',
        `Slot ${currentSlot.label} was just occupied or booked by another user. Please choose an available slot.`,
        'error'
      );
      setShowModal(false);
      onClearBookingSlot?.();
      setInternalSlotToBook(null);
      return;
    }

    const bookingId = `bk_${Date.now()}_${targetSlot.id}`;

    const newBooking: BookingInfo = {
      id: bookingId,
      slotId: targetSlot.id,
      slotLabel: targetSlot.label,
      date: details.startTime.toISOString(),
      duration: details.durationHours,
      status: 'active',
      userEmail,
      expiresAt: details.endTime.toISOString(),
      vehicleType: details.vehicleType,
      addons: details.addons,
      totalFare: details.totalFare,
    };

    try {
      if (onWriteBooking) {
        await onWriteBooking(newBooking);
      }
      setShowModal(false);
      onClearBookingSlot?.();
      setInternalSlotToBook(null);
      showToast(
        'Booking Confirmed',
        `Slot ${targetSlot.label} reserved for ${details.durationHours}h (₹${details.totalFare}).`,
        'success'
      );
    } catch {
      setShowModal(false);
      onClearBookingSlot?.();
      setInternalSlotToBook(null);
    }
  }

  // Runs in background with zero alert windows or "OK" buttons
  async function handleCancelBooking(b: BookingInfo) {
    try {
      await onCancelBooking?.(b.slotId);
      showToast(
        'Booking Cancelled',
        `Slot ${b.slotLabel} reservation cancelled.`,
        'info'
      );
    } catch (err: any) {
      console.warn('Cancel failed:', err);
    }
  }

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
        {/* Top Action Bar (matches Mockup Screen 2: speaker pill on left, swap "Left Side" pill on right) */}
        <View style={s.topBarRow}>
          <TouchableOpacity style={s.circleSpeakerBtn} activeOpacity={0.7}>
            <Ionicons name="volume-medium-outline" size={20} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={s.swapFilterBtn} activeOpacity={0.7}>
            <Ionicons name="swap-horizontal" size={16} color="#111827" />
            <Text style={s.swapFilterText}>Left Side</Text>
          </TouchableOpacity>
        </View>

        {/* Screen Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>Reservations</Text>
            <Text style={s.subTitle}>Manage active slots & live duration</Text>
          </View>
          {activeBookingForUser && (
            <View style={s.activeBadgePill}>
              <View style={s.activeDot} />
              <Text style={s.activeBadgeText}>Slot {activeBookingForUser.slotLabel}</Text>
            </View>
          )}
        </View>

        {/* ═══════ OVERHEAD PARKING SLOTS VISUALIZER (Screen 2 from Mockup) ═══════ */}
        {slots.length > 0 && (
          <View style={s.overheadSection}>
            <View style={s.overheadHeader}>
              <Text style={s.overheadTitle}>Overhead Slot Map</Text>
              <View style={s.overheadFilterPill}>
                <Ionicons name="swap-horizontal" size={13} color="#4B5563" />
                <Text style={s.overheadFilterText}>All Bays</Text>
              </View>
            </View>
            <OverheadSlotsViewer
              slots={slots}
              selectedSlotId={currentSlotToBook?.id || activeBookingForUser?.slotId}
              aiRecommendedSlotId={slots.find((s) => s.isBest)?.id}
              onSelectSlot={(slot) => {
                if (activeBookingForUser) {
                  showToast(
                    'You already booked a slot!',
                    `You currently have an active reservation for Slot ${activeBookingForUser.slotLabel}. Cancel it first to change slots.`,
                    'warning'
                  );
                  return;
                }
                if (slot.occupied) {
                  showToast(`${slot.label} is occupied`, 'Please select a free green slot.', 'info');
                  return;
                }
                setInternalSlotToBook(slot);
                setShowModal(true);
              }}
            />
          </View>
        )}

        {/* ═══════ ACTIVE RESERVATION / CLOSING TIME DRAWER (Screen 2 from Mockup) ═══════ */}
        <View style={s.timerCard}>
          {/* Header: Clock + Closing Time Title + Action Button (Park or Cancel) */}
          <View style={s.timerCardHeader}>
            <View style={s.timerTitleGroup}>
              <Ionicons name="time-outline" size={20} color={colors.accent.orange} />
              <Text style={s.timerCardTitle}>Closing Time</Text>
            </View>

            {activeBookingForUser ? (
              <TouchableOpacity
                style={s.cancelSlotBtn}
                onPress={() => handleCancelBooking(activeBookingForUser)}
                activeOpacity={0.7}
              >
                <Text style={s.cancelSlotText}>CANCEL</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={s.parkBtn}
                onPress={handleParkButtonPress}
                activeOpacity={0.8}
              >
                <Text style={s.parkBtnText}>Park</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Tabs: Today / Tomorrow / Later */}
          <View style={s.tabsRow}>
            {(['today', 'tomorrow', 'later'] as const).map((tab) => {
              const isTabActive = selectedTab === tab;
              const tabLabel = tab.charAt(0).toUpperCase() + tab.slice(1);
              return (
                <TouchableOpacity
                  key={tab}
                  style={[s.tabPill, isTabActive && s.tabPillActive]}
                  onPress={() => setSelectedTab(tab)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.tabPillText, isTabActive && s.tabPillTextActive]}>
                    {tabLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Horseshoe Circular Timer Arc & Particle Dots */}
          <View style={s.gaugeContainer}>
            {/* Horseshoe Arc Track */}
            <View style={s.gaugeTrackOuter}>
              <View style={s.gaugeArcFilled} />
            </View>

            {/* Decorative Particle Dots */}
            <View style={s.particleGroup}>
              <View style={[s.particleDot, { top: 14, right: 42, width: 9, height: 9 }]} />
              <View style={[s.particleDot, { top: 32, right: 28, width: 11, height: 11 }]} />
              <View style={[s.particleDot, { top: 54, right: 38, width: 7, height: 7 }]} />
              <View style={[s.particleDot, { top: 72, right: 22, width: 9, height: 9 }]} />
              <View style={[s.particleDot, { top: 42, right: 52, width: 6, height: 6 }]} />
            </View>

            {/* Center Floating Circular Hourglass Button */}
            <View style={s.hourglassButton}>
              <Ionicons name="hourglass-outline" size={26} color="#111827" />
            </View>

            {/* Digital Countdown Timer */}
            <Text style={s.countdownTimerText}>
              {activeBookingForUser
                ? countdownStr || `${Math.round(activeBookingForUser.duration * 60)}:00`
                : '04:25:10'}
            </Text>
            <Text style={s.countdownSubtitle}>Alert me 15 mins before</Text>
          </View>
        </View>

        {/* ═══════ BOOKINGS HISTORY LIST ═══════ */}
        <View style={s.historySection}>
          <Text style={s.historyTitle}>Booking History</Text>

          {bookings.filter(isMyBooking).length === 0 && (
            <View style={s.emptyState}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="calendar-outline" size={32} color="#94A3B8" />
              </View>
              <Text style={s.emptyText}>No reservations yet</Text>
              <Text style={s.emptySubText}>Select a slot from Home or Map to book</Text>
            </View>
          )}

          {bookings
            .filter(isMyBooking)
            .map((b) => {
              const active = b.status === 'active';
              const cancelled = b.status === 'cancelled';
              return (
                <View key={b.id} style={[s.card, active && s.cardActive]}>
                  <View
                    style={[
                      s.icon,
                      { backgroundColor: active ? 'rgba(255, 91, 0, 0.12)' : '#F1F5F9' },
                    ]}
                  >
                    <Ionicons
                      name="car-sport"
                      size={22}
                      color={active ? colors.accent.orange : '#64748B'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.slotName}>Slot {b.slotLabel}</Text>
                    <Text style={s.dateText}>
                      {formatDate(b.date)} • {formatDuration(b.duration)}
                    </Text>
                  </View>
                  {active ? (
                    <TouchableOpacity
                      style={s.cancelSlotBtn}
                      onPress={() => handleCancelBooking(b)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.cancelSlotText}>CANCEL</Text>
                    </TouchableOpacity>
                  ) : (
                    <View
                      style={[
                        s.statusBadge,
                        { backgroundColor: cancelled ? 'rgba(239,68,68,0.1)' : '#F1F5F9' },
                      ]}
                    >
                      <Text
                        style={[
                          s.statusText,
                          { color: cancelled ? '#EF4444' : '#64748B' },
                        ]}
                      >
                        {b.status.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ═══════ COMPREHENSIVE TIMING & PREFERENCES BOOKING MODAL ═══════ */}
      <BookingModal
        visible={showModal}
        slot={currentSlotToBook}
        onClose={() => {
          setShowModal(false);
          onClearBookingSlot?.();
          setInternalSlotToBook(null);
        }}
        onConfirm={handleConfirmBookingDetails}
        confirmButtonText="Confirm & Reserve Slot"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  circleSpeakerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  swapFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  swapFilterText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  parkBtn: {
    backgroundColor: colors.accent.orange,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 100,
    shadowColor: colors.accent.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  parkBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subTitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  activeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 91, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 91, 0, 0.25)',
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent.orange,
  },
  activeBadgeText: {
    color: colors.accent.orange,
    fontSize: 12,
    fontWeight: '800',
  },

  // Overhead section
  overheadSection: {
    marginBottom: spacing.xl,
  },
  overheadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  overheadTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  overheadFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  overheadFilterText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '600',
  },

  // Active Timer Card (Screen 2 from Mockup)
  timerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  timerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerCardTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.lg,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: colors.accent.orange,
    shadowColor: colors.accent.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  tabPillText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
  },

  // Gauge & Particles Container
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    position: 'relative',
  },
  gaugeTrackOuter: {
    width: 200,
    height: 100,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    borderWidth: 18,
    borderColor: '#F1F5F9',
    borderBottomWidth: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  gaugeArcFilled: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 100,
    height: 100,
    borderTopRightRadius: 100,
    borderWidth: 18,
    borderColor: colors.accent.orange,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  particleGroup: {
    position: 'absolute',
    top: 24,
    right: '18%',
    width: 70,
    height: 90,
  },
  particleDot: {
    position: 'absolute',
    borderRadius: 10,
    backgroundColor: colors.accent.orange,
    opacity: 0.85,
  },
  hourglassButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  countdownTimerText: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '900',
    marginTop: spacing.md,
    letterSpacing: 1,
  },
  countdownSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },

  // History section
  historySection: {
    marginTop: spacing.sm,
  },
  historyTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyText: {
    color: '#111827',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  emptySubText: {
    color: '#64748B',
    fontSize: fontSize.sm,
  },

  // History Cards
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardActive: {
    borderColor: 'rgba(255, 91, 0, 0.4)',
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotName: {
    color: '#111827',
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  dateText: {
    color: '#64748B',
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.pill,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  cancelSlotBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  cancelSlotText: {
    color: '#EF4444',
    fontSize: fontSize.xs,
    fontWeight: '800',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    width: '90%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  modalLabel: {
    color: '#64748B',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 91, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSlot: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '900',
  },
  modalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  durLabel: {
    color: '#64748B',
    fontSize: fontSize.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  durPickerContainer: {
    height: 48,
    alignSelf: 'stretch',
  },
  durListContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  durChip: {
    width: 64,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  durChipActive: {
    backgroundColor: colors.accent.orange,
    shadowColor: colors.accent.orange,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  durChipText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '700',
  },
  durChipTextActive: {
    color: '#FFFFFF',
  },
  durSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 91, 0, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  durSummaryText: {
    color: colors.accent.orange,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    backgroundColor: colors.accent.orange,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowColor: colors.accent.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  cancelModalTouch: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: '#94A3B8',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
