/**
 * Full-screen map with authentic Google Maps styled turn-by-turn navigation.
 * Uses custom logic & Mapbox GL JS engine (Zero Google Maps SDK integration).
 * When booked or navigating -> renders top Google Green maneuver banner,
 * 3D HUD camera perspective, Google navigation puck, electric blue route,
 * Google white HUD bottom bar with bold green ETA, steps drawer, and red exit button.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import type { UseParkingResult } from '../hooks/useFirebaseParking';
import { ParkingMap } from '../components/map/ParkingMap';
import { SlotInfo, SLOT_LABELS, BookingInfo } from '../types/parking';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../config/theme';
import { showToast } from '../utils/toast';
import { BookingModal, BookingDetails } from '../components/booking/BookingModal';

interface MapScreenProps {
  userEmail?: string;
  parking: UseParkingResult;
  onBook?: (slot: SlotInfo) => void;
  initialSlotToBook?: SlotInfo | null;
  autoOpenBookingModal?: boolean;
  onClearBookingModal?: () => void;
}

export function MapScreen({
  userEmail = '',
  parking,
  onBook,
  initialSlotToBook,
  autoOpenBookingModal,
  onClearBookingModal,
}: MapScreenProps) {
  const { user } = useAuth();
  const { data, slots, layout, userLocation, getSlotMetrics, bookings, writeBooking, cancelBooking, aiAllocation } = parking;
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [lastBookedSlot, setLastBookedSlot] = useState<SlotInfo | null>(null);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [showStepsDrawer, setShowStepsDrawer] = useState(false);
  const [isOverviewMode, setIsOverviewMode] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [slotToOpenInModal, setSlotToOpenInModal] = useState<SlotInfo | null>(null);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [overviewTrigger, setOverviewTrigger] = useState(0);

  function toggleMinimize() {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {}
    setIsMinimized((prev) => !prev);
  }

  // Priority: 1. Active AI allocation recommendation (Stage 8 MARL-GCN)
  //           2. Slot designated as best in live slots array
  //           3. Legacy Firebase recommendation from data object
  const bestSlot =
    aiAllocation?.allocated_stall ||
    slots.find((s) => s.isBest)?.id ||
    data?.recommendation?.best_slot;
  const isMyBooking = (b: BookingInfo) => {
    if (!userEmail || !b.userEmail) return false;
    return b.userEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
  };
  const activeBookingForUser = bookings.find(b => b.status === 'active' && isMyBooking(b));
  const targetSlotId = activeBookingForUser ? activeBookingForUser.slotId : (bestSlot || 'slot1');

  // If the AI changes its recommendation, clear any manual selection
  // so the panel snaps back to the AI recommendation automatically.
  useEffect(() => {
    if (!autoOpenBookingModal) {
      setSelectedSlot(null);
    }
  }, [targetSlotId, autoOpenBookingModal]);

  // Auto-open booking options modal when navigated from Home page ↗ arrow
  useEffect(() => {
    if (autoOpenBookingModal && initialSlotToBook) {
      if (activeBookingForUser) {
        showToast(
          'You already booked a slot!',
          `You currently have an active reservation for Slot ${activeBookingForUser.slotLabel}. Cancel it first to change slots.`,
          'warning'
        );
        onClearBookingModal?.();
        return;
      }
      const target = slots.find((s) => s.id === initialSlotToBook.id) || initialSlotToBook;
      if (target.occupied) {
        showToast(
          `Slot ${target.label} Occupied`,
          `Slot ${target.label} is currently booked or occupied. Please pick an available slot.`,
          'info'
        );
        setSelectedSlot(target);
        onClearBookingModal?.();
        return;
      }
      setSelectedSlot(target);
      setSlotToOpenInModal(target);
      setShowBookingModal(true);
      onClearBookingModal?.();
    }
  }, [autoOpenBookingModal, initialSlotToBook, activeBookingForUser, slots]);
  
  const targetLabel = targetSlotId ? SLOT_LABELS[targetSlotId] || targetSlotId : 'N/A';
  const activeSlot = selectedSlot || slots.find((s) => s.id === targetSlotId) || null;
  const activeMetrics = getSlotMetrics(activeSlot);
  
  // Find if there is an active booking for this slot by anyone
  const activeBooking = activeSlot ? bookings.find((b) => b.slotId === activeSlot.id && b.status === 'active') : null;
  const isBooked = !!activeBooking;
  const isBookedByMe = isBooked && Boolean(userEmail && activeBooking?.userEmail && activeBooking.userEmail.trim().toLowerCase() === userEmail.trim().toLowerCase());

  const allOccupied = data?.all_occupied;
  const waitSuggestion = data?.recommendation?.wait_suggestion;

  // Resolve active navigation destination slot (strictly tied to an active reservation)
  const navigatingTo: SlotInfo | null = (isNavigating && activeBookingForUser)
    ? (slots.find((s) => s.id === activeBookingForUser.slotId) || activeSlot || null)
    : null;

  // Auto-sync navigation mode with active reservation:
  // Starts turn-by-turn guidance when a booking is created/active;
  // Immediately exits navigation mode, clears HUD and destination if cancelled or expired!
  useEffect(() => {
    if (activeBookingForUser) {
      setIsNavigating(true);
      setSelectedSlot(null);
      setLastBookedSlot(slots.find((s) => s.id === activeBookingForUser.slotId) || null);
    } else {
      setIsNavigating(false);
      setLastBookedSlot(null);
      setSelectedSlot(null);
      setIsOverviewMode(false);
      setShowStepsDrawer(false);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    }
  }, [activeBookingForUser?.slotId]);

  // Handle voice guidance cue when navigation starts
  useEffect(() => {
    if (isNavigating && navigatingTo && !isVoiceMuted && Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(
          `Navigating to Slot ${navigatingTo.label.replace('Slot ', '')}. In 50 meters, turn right at Parking Entrance.`
        );
        msg.rate = 1.0;
        msg.pitch = 1.0;
        window.speechSynthesis.speak(msg);
      } catch {}
    }
  }, [isNavigating, navigatingTo?.id, isVoiceMuted]);

  function handleBook() {
    if (activeBookingForUser) {
      showToast(
        'You already booked a slot!',
        `You currently have an active reservation for Slot ${activeBookingForUser.slotLabel}. Cancel it first to change slots.`,
        'warning'
      );
      return;
    }

    const sl = selectedSlot || slots.find((x) => x.id === targetSlotId) || slots.find((x) => !x.occupied);
    if (!sl) {
      showToast('No Slot Available', 'Please select an available parking bay.', 'info');
      return;
    }
    if (sl.occupied) {
      showToast('Slot Occupied', `Slot ${sl.label} is occupied. Please pick a green available slot.`, 'info');
      return;
    }

    setSlotToOpenInModal(sl);
    setShowBookingModal(true);
  }

  async function handleConfirmModalBooking(details: BookingDetails) {
    if (activeBookingForUser) {
      showToast(
        'Booking Limit Reached',
        `You already have an active reservation for Slot ${activeBookingForUser.slotLabel}. Cancel it first before booking another slot.`,
        'warning'
      );
      setShowBookingModal(false);
      setSlotToOpenInModal(null);
      return;
    }

    const sl = details.slot;
    const currentSlot = slots.find((s) => s.id === sl.id) || sl;
    if (currentSlot.occupied) {
      showToast(
        'Slot Occupied',
        `Slot ${currentSlot.label} was just occupied or booked by another user. Please select an available slot.`,
        'error'
      );
      setShowBookingModal(false);
      setSlotToOpenInModal(null);
      return;
    }

    const bookingId = `bk_${Date.now()}_${sl.id}`;

    const newBooking: BookingInfo = {
      id: bookingId,
      slotId: sl.id,
      slotLabel: sl.label,
      date: details.startTime.toISOString(),
      duration: details.durationHours,
      status: 'active',
      userEmail: userEmail || 'guest@demo.com',
      expiresAt: details.endTime.toISOString(),
      vehicleType: details.vehicleType,
      addons: details.addons,
      totalFare: details.totalFare,
    };

    try {
      if (writeBooking) {
        await writeBooking(newBooking);
      }
      setShowBookingModal(false);
      setSlotToOpenInModal(null);
    } catch (err) {
      setShowBookingModal(false);
      setSlotToOpenInModal(null);
      console.warn('Booking write notice:', err);
    }
    
    onBook?.(sl);
    setLastBookedSlot(sl);
    setIsNavigating(true);
    showToast(
      'Booking Confirmed',
      `Slot ${sl.label} reserved (${details.durationHours}h • ₹${details.totalFare}). Route navigation started.`,
      'success'
    );
  }

  async function handleCancelCurrentBooking() {
    if (!activeBookingForUser) return;
    try {
      if (cancelBooking) {
        await cancelBooking(activeBookingForUser.slotId);
      }
      setIsNavigating(false);
      setLastBookedSlot(null);
      showToast(
        'Booking Cancelled',
        `Slot ${activeBookingForUser.slotLabel} reservation cancelled. Slot is now free.`,
        'info'
      );
    } catch (err: any) {
      console.warn('Cancel failed:', err);
    }
  }

  function handleNavigate() {
    if (!activeBookingForUser) {
      showToast(
        'Booking Required',
        'Please book a slot first to start route guidance.',
        'info'
      );
      return;
    }
    setIsNavigating(true);
    setIsOverviewMode(false);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smart-parking-recenter'));
    }
  }

  function handleStopNav() {
    setIsNavigating(false);
    setLastBookedSlot(null);
    setShowStepsDrawer(false);
    setIsOverviewMode(false);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if ('speechSynthesis' in window && window.speechSynthesis) window.speechSynthesis.cancel();
      } catch {}
      if (typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent('smart-parking-recenter'));
      }
    }
    showToast('Navigation Ended', 'Route guidance has been stopped.', 'info');
  }

  function handleToggleVoice() {
    setIsVoiceMuted((prev) => {
      const next = !prev;
      showToast(
        next ? 'Voice Muted' : 'Voice Guidance On',
        next ? 'Turn-by-turn voice alerts are muted.' : 'Voice instructions enabled.',
        'info'
      );
      return next;
    });
  }

  function handleRecenter() {
    setIsOverviewMode(false);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smart-parking-recenter'));
    }
    setRecenterTrigger((p) => p + 1);
    if (parking.refreshLocation) {
      parking.refreshLocation().catch(() => {});
    }
  }

  function handleToggleOverview() {
    setIsOverviewMode((prev) => {
      const next = !prev;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent(next ? 'smart-parking-overview' : 'smart-parking-recenter'));
      }
      if (next) {
        setOverviewTrigger((p) => p + 1);
      } else {
        setRecenterTrigger((p) => p + 1);
      }
      return next;
    });
  }

  // Dynamic turn-by-turn navigation steps based on real user coordinates on campus
  const currentSlotLabel = navigatingTo ? navigatingTo.label.replace('Slot ', '') : 'B1';
  const isNorthernCampus = (userLocation?.latitude ?? 0) >= 13.5554;
  const campusSteps = isNorthernCampus
    ? [
        {
          id: 'step-1',
          instruction: 'Head south on Petal Road West toward North Street',
          distance: '180 m',
          icon: 'arrow-up' as const,
        },
        {
          id: 'step-2',
          instruction: 'Turn left onto North Street toward Parking Entrance (P)',
          distance: '120 m',
          icon: 'arrow-forward' as const,
        },
        {
          id: 'step-3',
          instruction: 'Turn left into IIIT Sri City Parking Area',
          distance: '45 m',
          icon: 'arrow-undo' as const,
        },
        {
          id: 'step-4',
          instruction: `Arrive at Slot ${currentSlotLabel} (Ground Floor, Row ${currentSlotLabel[0] || 'A'})`,
          distance: '15 m',
          icon: 'location' as const,
        },
      ]
    : [
        {
          id: 'step-1',
          instruction: 'Head northeast on South Campus Road toward North Street',
          distance: '140 m',
          icon: 'arrow-up' as const,
        },
        {
          id: 'step-2',
          instruction: 'Turn right onto East North Street',
          distance: '210 m',
          icon: 'arrow-forward' as const,
        },
        {
          id: 'step-3',
          instruction: 'Turn left onto North Street West toward IIIT Sri City Parking Area',
          distance: '110 m',
          icon: 'arrow-back' as const,
        },
        {
          id: 'step-4',
          instruction: 'Turn right at Parking Entrance (P)',
          distance: '40 m',
          icon: 'arrow-forward' as const,
        },
        {
          id: 'step-5',
          instruction: `Arrive at Slot ${currentSlotLabel} (Ground Floor, Row ${currentSlotLabel[0] || 'A'})`,
          distance: '15 m',
          icon: 'location' as const,
        },
      ];

  // Calculated arrival time string
  const totalEtaSec = activeMetrics?.eta || 120;
  const etaFormatted = totalEtaSec >= 60 ? `${Math.round(totalEtaSec / 60)} min` : `${totalEtaSec} s`;
  const arrivalDate = new Date(Date.now() + totalEtaSec * 1000);
  const arrivalTimeStr = arrivalDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={s.container}>
      <ParkingMap
        slots={slots}
        parkingData={data}
        layout={layout}
        userLocation={userLocation}
        onMarkerPress={setSelectedSlot}
        navigatingTo={navigatingTo}
        selectedSlot={activeSlot}
        hideControls={isNavigating}
        recenterTrigger={recenterTrigger}
        overviewTrigger={overviewTrigger}
        style={s.map}
      />

      {/* ========================================================
          GOOGLE MAPS TURN-BY-TURN NAVIGATION OVERLAY
         ======================================================== */}
      {isNavigating && navigatingTo ? (
        <>
          {/* Top Google Navigation Maneuver Banner */}
          <View style={s.googleTopCard}>
            <View style={s.googleTopMain}>
              {/* Large Maneuver Icon */}
              <View style={s.googleManeuverBox}>
                <Ionicons name="arrow-redo" size={32} color="#FFFFFF" />
              </View>

              {/* Maneuver Instruction Details */}
              <View style={s.googleManeuverTextCol}>
                <Text style={s.googleDistanceLarge}>In {campusSteps[0]?.distance || '50 m'}</Text>
                <Text style={s.googleStreetName} numberOfLines={1}>
                  {campusSteps[0]?.instruction || 'Proceed toward Parking Entrance (P)'}
                </Text>
              </View>

              {/* Header Action Buttons (Speaker & Steps) */}
              <View style={s.googleHeaderActions}>
                <TouchableOpacity
                  style={s.googleHeaderBtn}
                  onPress={handleToggleVoice}
                  activeOpacity={0.7}
                  accessibilityLabel={isVoiceMuted ? 'Unmute voice guidance' : 'Mute voice guidance'}
                >
                  <Ionicons
                    name={isVoiceMuted ? 'volume-mute' : 'volume-high'}
                    size={20}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.googleHeaderBtn}
                  onPress={() => setShowStepsDrawer(true)}
                  activeOpacity={0.7}
                  accessibilityLabel="View directions list"
                >
                  <Ionicons name="list" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sub-strip: Next Maneuver Preview */}
            <View style={s.googleSubStrip}>
              <Ionicons name="arrow-forward" size={13} color="rgba(255, 255, 255, 0.85)" />
              <Text style={s.googleSubText} numberOfLines={1}>
                Then: {campusSteps[1]?.instruction || `Pull into Slot ${currentSlotLabel} • Ground Floor`}
              </Text>
            </View>
          </View>

          {/* Floating Map Action Buttons (Re-center, Overview) */}
          <View style={s.googleFloatingControls}>
            <TouchableOpacity
              style={s.googleFloatingBtn}
              onPress={handleToggleOverview}
              activeOpacity={0.8}
              accessibilityLabel={isOverviewMode ? 'Back to driving view' : 'Overview of entire route'}
            >
              <Ionicons
                name={isOverviewMode ? 'navigate' : 'map-outline'}
                size={20}
                color={isOverviewMode ? '#1A73E8' : '#3C4043'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.googleRecenterBtn, !isOverviewMode && s.googleRecenterBtnActive]}
              onPress={handleRecenter}
              activeOpacity={0.8}
              accessibilityLabel="Re-center on vehicle"
            >
              <Ionicons
                name="locate"
                size={22}
                color={!isOverviewMode ? '#1A73E8' : '#5F6368'}
              />
              <Text style={[s.googleRecenterText, !isOverviewMode && s.googleRecenterTextActive]}>
                Re-center
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Google Navigation HUD Bar */}
          <View style={s.googleBottomHud}>
            <View style={s.googleHudHandle} />

            <View style={s.googleHudRow}>
              {/* Trip Time & ETA Stats */}
              <TouchableOpacity
                style={s.googleHudLeft}
                onPress={() => setShowStepsDrawer(true)}
                activeOpacity={0.7}
              >
                <View style={s.googleEtaLine}>
                  <Text style={s.googleEtaText}>{etaFormatted}</Text>
                  <View style={s.googleRouteDot} />
                  <Text style={s.googleDistText}>
                    {activeMetrics.distanceToSlot} m • {arrivalTimeStr}
                  </Text>
                </View>
                <View style={s.googleTrafficLine}>
                  <Ionicons name="shield-checkmark" size={13} color="#188038" />
                  <Text style={s.googleTrafficText}>
                    Fastest route • IIIT Sri City Parking
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Action Cluster (Steps Pill & Iconic Red Exit Button) */}
              <View style={s.googleHudActions}>
                <TouchableOpacity
                  style={s.googleStepsBtn}
                  onPress={() => setShowStepsDrawer(true)}
                  activeOpacity={0.7}
                  accessibilityLabel="Directions steps"
                >
                  <Ionicons name="git-branch-outline" size={16} color="#3C4043" />
                  <Text style={s.googleStepsBtnText}>Steps</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.googleExitBtn}
                  onPress={handleStopNav}
                  activeOpacity={0.8}
                  accessibilityLabel="Exit Google Maps navigation"
                >
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Turn-by-Turn Steps Sheet / Drawer Modal */}
          {showStepsDrawer && (
            <View style={s.stepsDrawerOverlay}>
              <View style={s.stepsDrawerCard}>
                {/* Header */}
                <View style={s.stepsDrawerHeader}>
                  <View>
                    <Text style={s.stepsDrawerTitle}>Route to Slot {currentSlotLabel}</Text>
                    <Text style={s.stepsDrawerSub}>
                      {activeMetrics.distanceToSlot} m • ~{etaFormatted} • Arrival {arrivalTimeStr}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.stepsDrawerCloseBtn}
                    onPress={() => setShowStepsDrawer(false)}
                    accessibilityLabel="Close directions"
                  >
                    <Ionicons name="close" size={22} color="#5F6368" />
                  </TouchableOpacity>
                </View>

                {/* Steps List */}
                <ScrollView style={s.stepsListScroll} showsVerticalScrollIndicator={false}>
                  {campusSteps.map((step, idx) => (
                    <View key={step.id} style={s.stepRow}>
                      <View style={s.stepIconCol}>
                        <View
                          style={[
                            s.stepIconCircle,
                            idx === 0 && { backgroundColor: '#E6F4EA' },
                            idx === campusSteps.length - 1 && { backgroundColor: '#FCE8E6' },
                          ]}
                        >
                          <Ionicons
                            name={step.icon}
                            size={18}
                            color={
                              idx === 0
                                ? '#137333'
                                : idx === campusSteps.length - 1
                                ? '#EA4335'
                                : '#1A73E8'
                            }
                          />
                        </View>
                        {idx < campusSteps.length - 1 && <View style={s.stepConnectorLine} />}
                      </View>
                      <View style={s.stepInfoCol}>
                        <Text style={s.stepInstructionText}>{step.instruction}</Text>
                        <Text style={s.stepDistanceText}>{step.distance}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                {/* Bottom Done Button */}
                <TouchableOpacity
                  style={s.stepsDoneBtn}
                  onPress={() => setShowStepsDrawer(false)}
                  activeOpacity={0.8}
                >
                  <Text style={s.stepsDoneBtnText}>Resume Navigation</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      ) : (
        /* ========================================================
            STANDARD EXPLORE / BOOKING MODE
           ======================================================== */
        <>
          {/* Top Bar */}
          <View style={s.topBar}>
            <View style={s.pill}>
              <Ionicons name="navigate" size={14} color={colors.accent.orange} />
              <Text style={s.pillT}>Smart Navigation</Text>
            </View>

            {/* Floating Distance Capsule matching mockup design */}
            {activeMetrics?.distanceToSlot != null && (
              <View style={s.distancePill}>
                <Ionicons name="location" size={13} color={colors.accent.orange} />
                <Text style={s.distancePillText}>{activeMetrics.distanceToSlot} m</Text>
              </View>
            )}
          </View>

          {/* Floating Locate / Recenter button in explore mode */}
          <TouchableOpacity
            style={[s.exploreRecenterBtn, isMinimized && s.exploreRecenterBtnMinimized]}
            onPress={handleRecenter}
            activeOpacity={0.8}
            accessibilityLabel="Re-center on my location"
          >
            <Ionicons name="locate" size={22} color="#1A73E8" />
          </TouchableOpacity>

          {/* Bottom Panel */}
          <View style={[s.panel, isMinimized && s.panelMinimized]}>
            {/* Panel Header with Centered Drag Handle & Minimize/Expand Button */}
            <View style={s.panelHeader}>
              <View style={s.panelHeaderSpacer} />

              <TouchableOpacity
                style={s.handleTouch}
                onPress={toggleMinimize}
                activeOpacity={0.6}
                accessibilityLabel={isMinimized ? 'Expand panel' : 'Minimize panel'}
              >
                <View style={s.handle} />
              </TouchableOpacity>

              <TouchableOpacity
                style={s.minimizeBtn}
                onPress={toggleMinimize}
                activeOpacity={0.7}
                accessibilityLabel={isMinimized ? 'Expand panel' : 'Minimize panel'}
              >
                <Ionicons
                  name={isMinimized ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.text.secondary}
                />
                <Text style={s.minimizeBtnText}>
                  {isMinimized ? 'Expand' : 'Minimize'}
                </Text>
              </TouchableOpacity>
            </View>

            {isMinimized ? (
              /* Minimized Compact Bar: leaves >85% of map visible */
              <View style={s.miniRow}>
                <TouchableOpacity
                  style={s.miniInfo}
                  onPress={toggleMinimize}
                  activeOpacity={0.7}
                >
                  <View style={s.miniIcon}>
                    <Ionicons name="car-sport" size={18} color="#2979FF" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.miniSlotName} numberOfLines={1}>
                        {activeSlot ? `Slot ${activeSlot.label.replace('Slot ', '')}` : (targetLabel ? `Slot ${targetLabel.replace('Slot ', '')}` : 'No slot')}
                      </Text>
                      <View style={[s.miniBadge, { backgroundColor: activeSlot?.occupied ? (isBookedByMe ? 'rgba(41,121,255,0.18)' : 'rgba(255,82,82,0.18)') : 'rgba(16,137,62,0.18)' }]}>
                        <Text style={[s.miniBadgeText, { color: activeSlot?.occupied ? (isBookedByMe ? '#2979FF' : '#FF5252') : '#10893E' }]}>
                          {activeSlot?.occupied ? (isBookedByMe ? 'Booked' : 'Occupied') : 'Free'}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.miniSubText} numberOfLines={1}>
                      {`${activeMetrics.distanceToSlot}m • ${activeMetrics.eta >= 60 ? Math.round(activeMetrics.eta / 60) + ' min ETA' : activeMetrics.eta + 's ETA'} • ${activeMetrics.co2Saved}g CO₂`}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={s.miniBtnGroup}>
                  {activeBookingForUser ? (
                    <TouchableOpacity
                      style={[s.miniActionBtn, s.miniNavBtn]}
                      onPress={handleNavigate}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="navigate" size={14} color="#fff" />
                      <Text style={s.miniActionText}>Navigate</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[s.miniActionBtn, (!activeSlot || activeSlot.occupied) && s.miniBtnDisabled]}
                      onPress={handleBook}
                      disabled={!activeSlot || activeSlot.occupied}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={14} color={!activeSlot || activeSlot.occupied ? colors.text.muted : '#fff'} />
                      <Text style={[s.miniActionText, (!activeSlot || activeSlot.occupied) && { color: colors.text.muted }]}>
                        Book
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <>
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
                      <Text style={s.destLbl}>{selectedSlot ? 'Selected Slot' : (activeBookingForUser ? '🚗 Your Booked Slot' : '⭐ AI Recommended')}</Text>
                      <Text style={s.destVal}>{activeSlot?.label.replace('Slot ', '') || (targetLabel ? targetLabel.replace('Slot ', '') : 'N/A')}</Text>
                      <View style={s.floorRow}>
                        <Ionicons name="layers" size={12} color={colors.text.muted} />
                        <Text style={s.floorT}>Ground Floor</Text>
                        <Text style={s.aiDotSep}>•</Text>
                        <Ionicons name="git-network-outline" size={12} color="#00D2FF" />
                        <Text style={s.gnnT}>GNN: {activeMetrics.gnnDistance}m path</Text>
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
                  {/* Navigate button — only active after booking */}
                  <TouchableOpacity
                    style={[s.dirBtn, (!activeBookingForUser) && s.btnDisabled]}
                    onPress={handleNavigate}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="navigate"
                      size={18}
                      color={!activeBookingForUser ? colors.text.muted : '#2979FF'}
                    />
                    <Text style={[s.dirBtnT, !activeBookingForUser && { color: colors.text.muted }]}>
                      {activeBookingForUser ? 'Navigate' : 'Book First'}
                    </Text>
                  </TouchableOpacity>

                  {/* Book or Cancel button */}
                  {activeBookingForUser ? (
                    <TouchableOpacity
                      style={[
                        s.bookBtn,
                        { backgroundColor: '#FEE2E2', borderWidth: 1.5, borderColor: '#EF4444' }
                      ]}
                      onPress={handleCancelCurrentBooking}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={18}
                        color="#DC2626"
                      />
                      <Text style={[s.bookT, { color: '#DC2626', fontWeight: '700' }]}>
                        Cancel ({activeBookingForUser.slotLabel})
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[
                        s.bookBtn,
                        (!activeSlot || activeSlot.occupied) && s.bookOff,
                      ]}
                      onPress={handleBook}
                      activeOpacity={0.85}
                      disabled={!activeSlot || activeSlot.occupied}
                    >
                      <Ionicons
                        name={!activeSlot || activeSlot.occupied ? 'ban' : 'calendar-outline'}
                        size={18}
                        color={!activeSlot || activeSlot.occupied ? colors.text.muted : '#fff'}
                      />
                      <Text
                        style={[
                          s.bookT,
                          (!activeSlot || activeSlot.occupied) && { color: colors.text.muted }
                        ]}
                      >
                        {!activeSlot ? 'No slot selected' : activeSlot.occupied ? 'Occupied' : 'Book & Navigate'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </>
      )}

      {/* Comprehensive Timing & Preferences Booking Modal */}
      <BookingModal
        visible={showBookingModal}
        slot={slotToOpenInModal}
        onClose={() => setShowBookingModal(false)}
        onConfirm={handleConfirmModalBooking}
        confirmButtonText="Confirm Booking & Start Navigation"
      />
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

  /* ---------------- STANDARD EXPLORE MODE ---------------- */
  topBar: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  pillT: { color: '#111827', fontSize: 13, fontWeight: '800' },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  distancePillText: { color: '#111827', fontSize: 13, fontWeight: '800' },

  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 10,
    gap: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 10,
  },
  panelMinimized: { paddingBottom: 12, paddingTop: 6, gap: 6 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelHeaderSpacer: { width: 76 },
  handleTouch: { paddingVertical: 6, paddingHorizontal: 20, alignItems: 'center' },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center' },
  minimizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  minimizeBtnText: { color: '#4B5563', fontSize: 11, fontWeight: '600' },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 12,
  },
  miniInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 91, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniSlotName: { color: '#111827', fontSize: 16, fontWeight: '800' },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  miniBadgeText: { fontSize: 11, fontWeight: '700' },
  miniSubText: { color: '#64748B', fontSize: 12, marginTop: 2 },
  miniBtnGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent.orange,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  miniNavBtn: { backgroundColor: '#2979FF' },
  miniBtnDisabled: { backgroundColor: '#E2E8F0' },
  miniActionText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  destRow: { flexDirection: 'row', alignItems: 'center' },
  destIc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 91, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destLbl: { color: '#64748B', fontSize: 12, fontWeight: '500' },
  destVal: { color: '#111827', fontSize: 24, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
  floorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  floorT: { color: '#64748B', fontSize: 12, fontWeight: '500' },
  aiDotSep: { color: '#CBD5E1', fontSize: 10 },
  gnnT: { color: colors.accent.orange, fontSize: 12, fontWeight: '700' },
  rightCol: { alignItems: 'flex-end', gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100 },
  chipT: { fontSize: 12, fontWeight: '800' },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openT: { color: '#64748B', fontSize: 11, fontWeight: '500', marginRight: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  statC: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  statL: { color: '#64748B', fontSize: 11, fontWeight: '500' },
  statV: { color: '#111827', fontSize: 16, fontWeight: '800' },
  statU: { color: '#64748B', fontSize: 13, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  dirBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  dirBtnT: { color: '#334155', fontSize: 15, fontWeight: '700' },
  bookBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent.orange,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: colors.accent.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  bookOff: { backgroundColor: '#E2E8F0', shadowOpacity: 0 },
  bookT: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.5, borderColor: 'transparent' },

  /* ---------------- GOOGLE MAPS TURN-BY-TURN HUD ---------------- */
  googleTopCard: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: '#0F9D58', // Authentic Google Maps Navigation Emerald Green
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 12,
    zIndex: 100,
  },
  googleTopMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  googleManeuverBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleManeuverTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  googleDistanceLarge: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  googleStreetName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1,
  },
  googleHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  googleHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleSubStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0B8043', // Darker green strip for next maneuver preview
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  googleSubText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  /* Floating Google Recenter & Overview controls */
  googleFloatingControls: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    alignItems: 'flex-end',
    gap: 10,
    zIndex: 90,
  },
  googleFloatingBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  googleRecenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  googleRecenterBtnActive: {
    borderWidth: 1.5,
    borderColor: '#1A73E8',
  },
  googleRecenterText: {
    color: '#5F6368',
    fontSize: 13,
    fontWeight: '700',
  },
  googleRecenterTextActive: {
    color: '#1A73E8',
  },

  /* Bottom Google Navigation HUD */
  googleBottomHud: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 14,
    zIndex: 100,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  googleHudHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 10,
  },
  googleHudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  googleHudLeft: {
    flex: 1,
  },
  googleEtaLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  googleEtaText: {
    color: '#188038', // Iconic Google Maps bold green ETA
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  googleRouteDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#5F6368',
    alignSelf: 'center',
  },
  googleDistText: {
    color: '#5F6368',
    fontSize: 14,
    fontWeight: '600',
  },
  googleTrafficLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  googleTrafficText: {
    color: '#188038',
    fontSize: 12.5,
    fontWeight: '700',
  },
  googleHudActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  googleStepsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F3F4',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 100,
  },
  googleStepsBtnText: {
    color: '#3C4043',
    fontSize: 13,
    fontWeight: '700',
  },
  googleExitBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EA4335', // Iconic Google Maps red circular exit button
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EA4335',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  /* Turn-by-Turn Steps Modal / Drawer */
  stepsDrawerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  stepsDrawerCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 40,
    maxHeight: '75%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  stepsDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  stepsDrawerTitle: {
    color: '#202124',
    fontSize: 18,
    fontWeight: '800',
  },
  stepsDrawerSub: {
    color: '#5F6368',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  stepsDrawerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F3F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsListScroll: {
    marginTop: 14,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    minHeight: 58,
  },
  stepIconCol: {
    width: 44,
    alignItems: 'center',
  },
  stepIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepConnectorLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  stepInfoCol: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
    justifyContent: 'center',
  },
  stepInstructionText: {
    color: '#202124',
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 20,
  },
  stepDistanceText: {
    color: '#5F6368',
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 3,
  },
  stepsDoneBtn: {
    backgroundColor: '#1A73E8',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  stepsDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  exploreRecenterBtn: {
    position: 'absolute',
    right: spacing.md,
    bottom: 290,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 90,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  exploreRecenterBtnMinimized: {
    bottom: 96,
  },
});
