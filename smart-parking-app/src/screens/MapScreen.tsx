/**
 * Full-screen map with in-app navigation.
 * After booking → route draws on the map with step indicators.
 * Receives shared parking data via props (no duplicate listeners).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import type { UseParkingResult } from '../hooks/useFirebaseParking';
import { ParkingMap } from '../components/map/ParkingMap';
import { SlotInfo, SLOT_LABELS } from '../types/parking';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../config/theme';

interface MapScreenProps {
  parking: UseParkingResult;
  onBook?: (slot: SlotInfo) => void;
}

export function MapScreen({ parking, onBook }: MapScreenProps) {
  const { user } = useAuth();
  const { data, slots, layout, userLocation, getSlotMetrics, bookings } = parking;
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);
  const [navigatingTo, setNavigatingTo] = useState<SlotInfo | null>(null);

  const bestSlot = data?.recommendation?.best_slot;

  // If the AI changes its recommendation, clear any manual selection
  // so the panel snaps back to the AI recommendation automatically.
  React.useEffect(() => {
    setSelectedSlot(null);
  }, [bestSlot]);
  const bestLabel = bestSlot ? SLOT_LABELS[bestSlot] || bestSlot : 'N/A';
  const activeSlot = selectedSlot || slots.find((s) => s.id === bestSlot) || null;
  const activeMetrics = getSlotMetrics(activeSlot);
  
  // Find if there is an active booking for this slot
  const activeBooking = activeSlot ? bookings.find((b) => b.slotId === activeSlot.id && b.status === 'active') : null;
  const isBooked = !!activeBooking;
  const isBookedByMe = isBooked && activeBooking?.userEmail === user?.email;

  const allOccupied = data?.all_occupied;
  const waitSuggestion = data?.recommendation?.wait_suggestion;

  function handleBook() {
    const sl = selectedSlot || slots.find((x) => x.id === bestSlot) || slots.find((x) => !x.occupied);
    if (!sl || sl.occupied) return;
    onBook?.(sl);

    // Start in-app navigation
    setNavigatingTo(sl);
    Alert.alert(
      '✅ Booking Confirmed!',
      `Slot ${sl.label} is booked.\nNavigation started on the map.`,
      [{ text: 'OK' }]
    );
  }

  function handleNavigate() {
    const sl = activeSlot;
    if (!sl) return;
    setNavigatingTo(sl);
  }

  function handleStopNav() {
    setNavigatingTo(null);
  }

  return (
    <View style={s.container}>
      <ParkingMap
        slots={slots}
        parkingData={data}
        layout={layout}
        userLocation={userLocation}
        onMarkerPress={setSelectedSlot}
        navigatingTo={navigatingTo}
        style={s.map}
      />

      {/* Top bar */}
      <View style={s.topBar}>
        <View style={s.pill}>
          <Ionicons name="navigate" size={14} color="#2979FF" />
          <Text style={s.pillT}>Smart Navigation</Text>
        </View>
        {navigatingTo && (
          <TouchableOpacity style={s.stopPill} onPress={handleStopNav}>
            <Ionicons name="close" size={14} color="#FF5252" />
            <Text style={s.stopT}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom panel */}
      <View style={s.panel}>
        <View style={s.handle} />

        {/* Navigation active indicator */}
        {navigatingTo && (
          <View style={s.navActive}>
            <View style={s.navPulse} />
            <Ionicons name="navigate" size={16} color="#2979FF" />
            <Text style={s.navActiveText}>
              Navigating to Slot {navigatingTo.label}
            </Text>
            <Text style={s.navEta}>
              ~{getSlotMetrics(navigatingTo).eta}s
            </Text>
          </View>
        )}

        {/* Destination / Context Info */}
        {allOccupied && !selectedSlot ? (
           <View style={s.destRow}>
             <View style={[s.destIc, { backgroundColor: 'rgba(255,82,82,0.1)' }]}>
               <Ionicons name="warning" size={24} color="#FF5252" />
             </View>
             <View style={{ flex: 1, marginLeft: 16 }}>
               <Text style={s.destLbl}>⚠️ All Slots Occupied</Text>
               <Text style={[s.destVal, { fontSize: 16 }]} numberOfLines={2}>
                 {waitSuggestion ? waitSuggestion.message : 'Waiting for a slot to free up...'}
               </Text>
             </View>
           </View>
        ) : (
          <View style={s.destRow}>
            {/* Left car icon */}
            <View style={s.destIc}>
              <Ionicons name="car-sport" size={26} color="#2979FF" />
            </View>
            
            {/* Middle text column */}
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={s.destLbl}>{selectedSlot ? 'Selected Slot' : '⭐ AI Recommended'}</Text>
              <Text style={s.destVal}>{activeSlot?.label.replace('Slot ', '') || (bestLabel ? bestLabel.replace('Slot ', '') : 'N/A')}</Text>
              <View style={s.floorRow}>
                <Ionicons name="layers" size={12} color={colors.text.muted} />
                <Text style={s.floorT}>Ground Floor</Text>
              </View>
            </View>

            {/* Right badges column */}
            <View style={s.rightCol}>
              <View style={s.badgeRow}>
                <View style={[s.chip, { backgroundColor: activeSlot?.occupied ? (isBookedByMe ? 'rgba(41,121,255,0.15)' : 'rgba(255,82,82,0.15)') : 'rgba(16,137,62,0.15)' }]}>
                  <Text style={[s.chipT, { color: activeSlot?.occupied ? (isBookedByMe ? '#2979FF' : '#FF5252') : '#10893E' }]}>
                    {activeSlot?.occupied ? (isBookedByMe ? 'Booked' : 'Occupied') : 'Free'}
                  </Text>
                </View>
                {selectedSlot && (
                  <TouchableOpacity onPress={() => setSelectedSlot(null)} style={s.closeBtn}>
                    <Ionicons name="close" size={16} color={colors.text.muted} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={s.openT}>Open 24/7</Text>
            </View>
          </View>
        )}

        {/* Stats row — real-time calculations for active slot */}
        <View style={s.statsRow}>
          <StatCard
            icon={<Ionicons name="map-outline" size={20} color={colors.text.muted} />}
            label="Distance"
            value={activeMetrics.distanceToSlot}
            unit={activeMetrics.distanceToSlot >= 1000 ? "km" : "m"}
            isKm={activeMetrics.distanceToSlot >= 1000}
          />
          <StatCard 
            icon={<Ionicons name="timer-outline" size={20} color={colors.text.muted} />} 
            label={activeSlot?.occupied ? (isBooked ? "Booked For" : "Duration") : "ETA"} 
            value={activeSlot?.occupied ? (isBooked ? Math.round(activeBooking.duration * 60) : activeSlot.timingLabel) : (activeMetrics.eta >= 60 ? Math.round(activeMetrics.eta / 60) : activeMetrics.eta)} 
            unit={activeSlot?.occupied ? (isBooked ? "min" : "") : (activeMetrics.eta >= 60 ? "min" : "s")} 
          />
          <StatCard 
            icon={<Ionicons name="leaf" size={20} color="#10893E" />} 
            label="CO₂ Saved" 
            value={activeMetrics.co2Saved} 
            unit="g" 
          />
        </View>

        {/* Action buttons */}
        <View style={s.btnRow}>
          {/* Navigate button */}
          <TouchableOpacity
            style={[s.dirBtn, navigatingTo && s.dirBtnActive, (!activeSlot && !navigatingTo) && s.btnDisabled]}
            onPress={navigatingTo ? handleStopNav : handleNavigate}
            activeOpacity={0.85}
            disabled={!activeSlot && !navigatingTo}
          >
            <Ionicons
              name={navigatingTo ? 'stop-circle' : 'navigate'}
              size={18}
              color={navigatingTo ? '#FF5252' : (!activeSlot ? colors.text.muted : '#2979FF')}
            />
            <Text style={[s.dirBtnT, navigatingTo && { color: '#FF5252' }, !activeSlot && !navigatingTo && { color: colors.text.muted }]}>
              {navigatingTo ? 'Stop Nav' : 'Navigate'}
            </Text>
          </TouchableOpacity>

          {/* Book + Navigate button */}
          <TouchableOpacity
            style={[s.bookBtn, (!activeSlot || activeSlot.occupied) && s.bookOff]}
            onPress={handleBook}
            activeOpacity={0.85}
            disabled={!activeSlot || activeSlot.occupied}
          >
            <Ionicons name={!activeSlot || activeSlot.occupied ? 'close-circle' : 'calendar-outline'} size={18} color={!activeSlot || activeSlot.occupied ? colors.text.muted : '#fff'} />
            <Text style={[s.bookT, (!activeSlot || activeSlot.occupied) && { color: colors.text.muted }]}>
              {!activeSlot ? 'No slot selected' : activeSlot.occupied ? 'Occupied' : 'Book & Navigate'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function StatCard({ icon, label, value, unit, isKm }: any) {
  const displayValue = isKm ? (value / 1000).toFixed(1) : value;
  return (
    <View style={s.statC}>
      {icon}
      <Text style={s.statL}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={s.statV}>{displayValue}</Text>
        {unit ? <Text style={s.statU}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  map: { flex: 1, borderRadius: 0 },
  topBar: { position: 'absolute', top: 55, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(10,13,20,0.92)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pillT: { color: '#fff', fontSize: 13, fontWeight: '700' },
  stopPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,82,82,0.15)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,82,82,0.3)' },
  stopT: { color: '#FF5252', fontSize: 13, fontWeight: '700' },
  panel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg.primary, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 50, paddingTop: 12, gap: 16, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'center', marginBottom: 4 },
  navActive: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(41,121,255,0.1)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(41,121,255,0.2)' },
  navPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2979FF' },
  navActiveText: { color: '#2979FF', fontSize: 13, fontWeight: '600', flex: 1 },
  navEta: { color: '#2979FF', fontSize: 13, fontWeight: '800' },
  destRow: { flexDirection: 'row', alignItems: 'center' },
  destIc: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(41,121,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  destLbl: { color: colors.text.muted, fontSize: 12, fontWeight: '500' },
  destVal: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
  floorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  floorT: { color: colors.text.muted, fontSize: 12, fontWeight: '500' },
  rightCol: { alignItems: 'flex-end', gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100 },
  chipT: { fontSize: 12, fontWeight: '800' },
  closeBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  openT: { color: colors.text.muted, fontSize: 11, fontWeight: '500', marginRight: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  statC: { flex: 1, alignItems: 'center', backgroundColor: '#1A1D27', borderRadius: 16, paddingVertical: 16, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  statL: { color: colors.text.muted, fontSize: 11, fontWeight: '500' },
  statV: { color: '#fff', fontSize: 16, fontWeight: '800' },
  statU: { color: colors.text.muted, fontSize: 13, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  dirBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'transparent', paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(41,121,255,0.4)' },
  dirBtnActive: { borderColor: 'rgba(255,82,82,0.3)', backgroundColor: 'rgba(255,82,82,0.08)' },
  dirBtnT: { color: '#2979FF', fontSize: 15, fontWeight: '700' },
  bookBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2979FF', paddingVertical: 16, borderRadius: 16, ...shadows.button },
  bookOff: { backgroundColor: 'rgba(255,255,255,0.06)', shadowOpacity: 0 },
  bookT: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5, borderColor: 'transparent' },
});
