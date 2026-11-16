import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlotInfo } from '../../types/parking';
import { colors, spacing, fontSize, fontWeight } from '../../config/theme';
import { showToast } from '../../utils/toast';

export interface BookingDetails {
  slot: SlotInfo;
  durationHours: number;
  arrivalOffsetMinutes: number;
  startTime: Date;
  endTime: Date;
  vehicleType: string;
  addons: string[];
  totalFare: number;
}

interface BookingModalProps {
  visible: boolean;
  slot: SlotInfo | null;
  onClose: () => void;
  onConfirm: (details: BookingDetails) => Promise<void> | void;
  confirmButtonText?: string;
}

const DURATION_PRESETS = [
  { label: '30 mins', hours: 0.5, rate: 10 },
  { label: '1 Hour', hours: 1, rate: 20 },
  { label: '2 Hours', hours: 2, rate: 40, popular: true },
  { label: '3 Hours', hours: 3, rate: 60 },
  { label: '4 Hours', hours: 4, rate: 80 },
  { label: '8 Hours', hours: 8, rate: 150 },
];

const ARRIVAL_PRESETS = [
  { label: 'Now (Immediate)', minutes: 0, icon: 'flash' as const },
  { label: 'In 15 mins', minutes: 15, icon: 'time-outline' as const },
  { label: 'In 30 mins', minutes: 30, icon: 'time-outline' as const },
  { label: 'In 1 hour', minutes: 60, icon: 'time-outline' as const },
];

const VEHICLE_OPTIONS = [
  { id: 'car', label: 'Car / Sedan', icon: 'car-sport' as const },
  { id: 'suv', label: 'SUV / 4x4', icon: 'car' as const },
  { id: 'ev', label: 'Electric (EV)', icon: 'battery-charging' as const },
  { id: 'bike', label: 'Two-Wheeler', icon: 'bicycle' as const },
];

const ADDON_OPTIONS = [
  { id: 'ev_charge', label: 'Fast EV Charging Point', sub: 'Dedicated 22kW AC charger plug', price: 15, icon: 'flash-outline' as const },
  { id: 'covered', label: 'Covered Roof Shade', sub: 'UV protected weather bay', price: 0, icon: 'umbrella-outline' as const },
  { id: 'alert', label: 'SMS / Push Notification', sub: 'Remind me 15m before expiry', price: 0, icon: 'notifications-outline' as const },
];

export function BookingModal({
  visible,
  slot,
  onClose,
  onConfirm,
  confirmButtonText,
}: BookingModalProps) {
  const [selectedDuration, setSelectedDuration] = useState(DURATION_PRESETS[2]); // 2 hours
  const [arrivalOffset, setArrivalOffset] = useState(ARRIVAL_PRESETS[0]); // Now
  const [selectedVehicle, setSelectedVehicle] = useState(VEHICLE_OPTIONS[0]); // Car
  const [selectedAddons, setSelectedAddons] = useState<string[]>(['alert']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when a new slot is opened
  useEffect(() => {
    if (visible) {
      setSelectedDuration(DURATION_PRESETS[2]);
      setArrivalOffset(ARRIVAL_PRESETS[0]);
      setSelectedVehicle(VEHICLE_OPTIONS[0]);
      setSelectedAddons(['alert']);
      setIsSubmitting(false);
    }
  }, [visible, slot?.id]);

  // Dynamic start and end times
  const { startTime, endTime, startTimeFormatted, endTimeFormatted } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getTime() + arrivalOffset.minutes * 60 * 1000);
    const end = new Date(start.getTime() + selectedDuration.hours * 60 * 60 * 1000);

    const formatTime = (d: Date) => {
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 becomes 12
      const strMinutes = minutes < 10 ? `0${minutes}` : String(minutes);
      return `${hours}:${strMinutes} ${ampm}`;
    };

    return {
      startTime: start,
      endTime: end,
      startTimeFormatted: formatTime(start),
      endTimeFormatted: formatTime(end),
    };
  }, [arrivalOffset, selectedDuration]);

  // Total Fare calculation
  const totalFare = useMemo(() => {
    let fare = selectedDuration.rate;
    if (selectedAddons.includes('ev_charge')) {
      fare += 15;
    }
    return fare;
  }, [selectedDuration, selectedAddons]);

  const toggleAddon = (addonId: string) => {
    setSelectedAddons((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  const handleConfirmPress = async () => {
    if (!slot || isSubmitting) return;
    if (slot.occupied) {
      showToast('Slot Occupied', `Slot ${slot.label} is already occupied.`, 'error');
      onClose();
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm({
        slot,
        durationHours: selectedDuration.hours,
        arrivalOffsetMinutes: arrivalOffset.minutes,
        startTime,
        endTime,
        vehicleType: selectedVehicle.label,
        addons: selectedAddons,
        totalFare,
      });
      onClose();
    } catch (err) {
      console.warn('Booking confirmation failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!slot) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalBackdrop} />

        <View style={styles.sheetContainer}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.slotBadgeIcon}>
                <Ionicons name="car-sport" size={20} color="#FFFFFF" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.modalTitle}>Slot {slot.label}</Text>
                  {slot.isBest && (
                    <View style={styles.aiBadge}>
                      <Ionicons name="sparkles" size={11} color="#2563EB" />
                      <Text style={styles.aiBadgeText}>AI Best Pick</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modalSubtitle}>IIIT Sri City Campus • Ground Floor Bay</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* ═══════ 1. LIVE SCHEDULE CARD (Entry ➔ Exit) ═══════ */}
            <View style={styles.scheduleCard}>
              <View style={styles.scheduleCol}>
                <Text style={styles.scheduleColLabel}>ARRIVAL</Text>
                <Text style={styles.scheduleTimeText}>{startTimeFormatted}</Text>
                <Text style={styles.scheduleSubText}>
                  {arrivalOffset.minutes === 0 ? 'Today (Now)' : `In ${arrivalOffset.minutes}m`}
                </Text>
              </View>

              <View style={styles.scheduleDivider}>
                <Ionicons name="arrow-forward" size={16} color="#94A3B8" />
                <View style={styles.durationCapsule}>
                  <Text style={styles.durationCapsuleText}>{selectedDuration.label}</Text>
                </View>
              </View>

              <View style={[styles.scheduleCol, { alignItems: 'flex-end' }]}>
                <Text style={styles.scheduleColLabel}>VALID UNTIL</Text>
                <Text style={[styles.scheduleTimeText, { color: '#EA580C' }]}>{endTimeFormatted}</Text>
                <Text style={styles.scheduleSubText}>Auto-release</Text>
              </View>
            </View>

            {/* ═══════ 2. ARRIVAL TIME SELECTION ═══════ */}
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="alarm-outline" size={16} color="#EA580C" />
              <Text style={styles.sectionTitle}>When will you arrive?</Text>
            </View>
            <View style={styles.chipsRow}>
              {ARRIVAL_PRESETS.map((item) => {
                const isSelected = arrivalOffset.minutes === item.minutes;
                return (
                  <TouchableOpacity
                    key={item.minutes}
                    style={[styles.arrivalChip, isSelected && styles.chipSelected]}
                    onPress={() => setArrivalOffset(item)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={item.icon}
                      size={13}
                      color={isSelected ? '#FFFFFF' : '#475569'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ═══════ 3. DURATION SELECTOR ═══════ */}
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="time-outline" size={16} color="#EA580C" />
              <Text style={styles.sectionTitle}>Select Parking Duration</Text>
            </View>
            <View style={styles.gridDuration}>
              {DURATION_PRESETS.map((d) => {
                const isSelected = selectedDuration.hours === d.hours;
                return (
                  <TouchableOpacity
                    key={d.label}
                    style={[styles.durGridCard, isSelected && styles.durGridCardSelected]}
                    onPress={() => setSelectedDuration(d)}
                    activeOpacity={0.75}
                  >
                    {d.popular && (
                      <View style={styles.popularTag}>
                        <Text style={styles.popularTagText}>POPULAR</Text>
                      </View>
                    )}
                    <Text style={[styles.durGridTitle, isSelected && styles.durGridTitleSelected]}>
                      {d.label}
                    </Text>
                    <Text style={[styles.durGridPrice, isSelected && styles.durGridPriceSelected]}>
                      ₹{d.rate}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ═══════ 4. VEHICLE CATEGORY ═══════ */}
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="car-outline" size={16} color="#EA580C" />
              <Text style={styles.sectionTitle}>Select Vehicle Type</Text>
            </View>
            <View style={styles.vehicleRow}>
              {VEHICLE_OPTIONS.map((veh) => {
                const isSelected = selectedVehicle.id === veh.id;
                return (
                  <TouchableOpacity
                    key={veh.id}
                    style={[styles.vehicleBtn, isSelected && styles.vehicleBtnSelected]}
                    onPress={() => setSelectedVehicle(veh)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={veh.icon}
                      size={20}
                      color={isSelected ? '#FFFFFF' : '#64748B'}
                    />
                    <Text style={[styles.vehicleText, isSelected && styles.vehicleTextSelected]}>
                      {veh.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ═══════ 5. EXTRA AMENITIES / ADD-ONS ═══════ */}
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="options-outline" size={16} color="#EA580C" />
              <Text style={styles.sectionTitle}>Extra Amenities & Preferences</Text>
            </View>
            <View style={styles.addonsList}>
              {ADDON_OPTIONS.map((addon) => {
                const isChecked = selectedAddons.includes(addon.id);
                return (
                  <TouchableOpacity
                    key={addon.id}
                    style={[styles.addonRow, isChecked && styles.addonRowChecked]}
                    onPress={() => toggleAddon(addon.id)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.addonLeft}>
                      <View style={[styles.addonIconCircle, isChecked && styles.addonIconCircleChecked]}>
                        <Ionicons
                          name={addon.icon}
                          size={18}
                          color={isChecked ? '#EA580C' : '#64748B'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.addonLabel, isChecked && styles.addonLabelChecked]}>
                          {addon.label}
                        </Text>
                        <Text style={styles.addonSub}>{addon.sub}</Text>
                      </View>
                    </View>

                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ═══════ 6. FARE BREAKDOWN & ECO SAVINGS ═══════ */}
            <View style={styles.summaryBox}>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryMuted}>Parking Fare ({selectedDuration.label})</Text>
                <Text style={styles.summaryValue}>₹{selectedDuration.rate}</Text>
              </View>
              {selectedAddons.includes('ev_charge') && (
                <View style={styles.summaryLine}>
                  <Text style={styles.summaryMuted}>Fast EV Charging Access</Text>
                  <Text style={styles.summaryValue}>+₹15</Text>
                </View>
              )}
              <View style={styles.summaryLine}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="leaf" size={13} color="#10B981" />
                  <Text style={[styles.summaryMuted, { color: '#059669', fontWeight: '600' }]}>
                    Eco Benefit (GNN Dijkstra)
                  </Text>
                </View>
                <Text style={[styles.summaryValue, { color: '#059669', fontWeight: '700' }]}>
                  ~25g CO₂ Saved
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={[styles.summaryLine, { marginTop: 4 }]}>
                <Text style={styles.totalLabel}>Estimated Total</Text>
                <Text style={styles.totalAmount}>₹{totalFare}</Text>
              </View>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* ═══════ BOTTOM CONFIRMATION BUTTON ═══════ */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.confirmActionButton}
              onPress={handleConfirmPress}
              disabled={isSubmitting}
              activeOpacity={0.88}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.confirmBtnContent}>
                  <Text style={styles.confirmBtnText}>
                    {confirmButtonText || `Confirm & Reserve Slot ${slot.label} (₹${totalFare})`}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        } as any)
      : {}),
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slotBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  scheduleCol: {
    flex: 1,
  },
  scheduleColLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  scheduleTimeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  scheduleSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  scheduleDivider: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 4,
  },
  durationCapsule: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  durationCapsuleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  arrivalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSelected: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  gridDuration: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  durGridCard: {
    width: '31%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  durGridCardSelected: {
    backgroundColor: '#FFF7ED',
    borderColor: '#EA580C',
  },
  popularTag: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#D97706',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  durGridTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  durGridTitleSelected: {
    color: '#EA580C',
  },
  durGridPrice: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  durGridPriceSelected: {
    color: '#C2410C',
    fontWeight: '700',
  },
  vehicleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  vehicleBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  vehicleBtnSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  vehicleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  vehicleTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addonsList: {
    gap: 8,
    marginBottom: 18,
  },
  addonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  addonRowChecked: {
    borderColor: '#FDBA74',
    backgroundColor: '#FFFBF7',
  },
  addonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  addonIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addonIconCircleChecked: {
    backgroundColor: '#FFEDD5',
  },
  addonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  addonLabelChecked: {
    color: '#EA580C',
  },
  addonSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryMuted: {
    fontSize: 12,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#EA580C',
  },
  footerRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  confirmActionButton: {
    backgroundColor: '#EA580C',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
