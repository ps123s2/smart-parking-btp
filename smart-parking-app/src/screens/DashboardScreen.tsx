/**
 * Home / Dashboard screen matching the user's uploaded mockup design.
 * Full-screen Mapbox GL JS map with low opacity translucent white wash.
 *
 * Floating light neumorphic overlays:
 * - Top user avatar + Good Morning + Notification / Bookmark circular buttons
 * - "Let's Find Parking near You" high-contrast hero typography
 * - Floating compass / locate target button
 * - High-contrast black navigation route line sweeping from user pin to parking slot
 * - Attached '715m' distance capsule anchored directly to the route line
 * - Floating '+' and '-' circular zoom buttons
 * - Signature vibrant orange card with top-down car bays visualizer & diagonal arrow button
 * - "IIIT Sricity Parking Area" location branding
 * - Available window clearly exhibiting Free, Occupied (with 3D car), and ONLY the AI recommended slot as Selected
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { UseParkingResult } from '../hooks/useFirebaseParking';
import { ParkingMap } from '../components/map/ParkingMap';
import { OverheadSlotsViewer } from '../components/slots/OverheadSlotsViewer';
import { SlotInfo, BookingInfo, getRealRoadDistanceToSlot } from '../types/parking';
import { colors, spacing, fontSize, fontWeight } from '../config/theme';
import { showToast } from '../utils/toast';
import { BookingModal, BookingDetails } from '../components/booking/BookingModal';

/** Well-known IIIT Sri City campus landmark locations for instant positioning */
export const CAMPUS_LOCATIONS = [
  {
    id: 'academic',
    name: 'Academic Block',
    sub: 'Northern Campus • Petal Road West',
    latitude: 13.55680,
    longitude: 80.02610,
    icon: 'business' as const,
  },
  {
    id: 'bh3',
    name: 'BH3 Hostel',
    sub: 'Southern Campus • North Street',
    latitude: 13.55395,
    longitude: 80.02550,
    icon: 'bed' as const,
  },
  {
    id: 'bh1',
    name: 'BH1 & BH2 Hostels',
    sub: 'South-West Campus',
    latitude: 13.55440,
    longitude: 80.02480,
    icon: 'home' as const,
  },
  {
    id: 'dining',
    name: 'Dining Hall',
    sub: 'Central Campus',
    latitude: 13.55460,
    longitude: 80.02580,
    icon: 'restaurant' as const,
  },
  {
    id: 'gate',
    name: 'Campus Main Gate',
    sub: 'Main Entry Road',
    latitude: 13.55280,
    longitude: 80.02650,
    icon: 'exit' as const,
  },
];

/** Compute dynamic real driving distance along the campus road network to the specific slot */
function calculateSlotRoadDistance(
  slotCoord?: { latitude: number; longitude: number },
  userCoord?: { latitude: number; longitude: number } | null,
  slotId: string = 'slot1'
): number {
  const userPt = userCoord || { latitude: 13.55395, longitude: 80.02550 };
  const targetPt = slotCoord || { latitude: 13.55618, longitude: 80.02712 };
  const { totalRealDistance } = getRealRoadDistanceToSlot(
    userPt.latitude,
    userPt.longitude,
    slotId,
    targetPt
  );
  return totalRealDistance;
}

// Dynamic 2D SVG canvas perspective projection for each stall in the 3D parking layout
const SLOT_MAP_COORDS: Record<string, { endX: number; endY: number; ctrlX: number; ctrlY: number }> = {
  slot1: { endX: 138, endY: 532, ctrlX: 180, ctrlY: 500 }, // A1 (Top row, west)
  slot2: { endX: 158, endY: 542, ctrlX: 192, ctrlY: 512 }, // A2 (Top row, center)
  slot3: { endX: 178, endY: 552, ctrlX: 204, ctrlY: 522 }, // A3 (Top row, east)
  slot4: { endX: 152, endY: 564, ctrlX: 190, ctrlY: 532 }, // B1 (Bottom row, west)
  slot5: { endX: 172, endY: 574, ctrlX: 200, ctrlY: 542 }, // B2 (Bottom row, center)
};

interface DashboardScreenProps {
  userName?: string;
  userEmail?: string;
  parking: UseParkingResult;
  onBook?: (slot: SlotInfo) => void;
  onNavigateToMap?: (slot?: SlotInfo) => void;
}

export function DashboardScreen({
  userName = 'John Abraham',
  userEmail = '',
  parking,
  onBook,
  onNavigateToMap,
}: DashboardScreenProps) {
  const { data, slots, loading, error, stats, layout, userLocation, liveMetrics, bookings, getSlotMetrics, cancelBooking, aiAllocation } = parking;

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isSmallWidth = windowWidth < 375;
  const isShortHeight = windowHeight < 740;

  // Dynamically responsive dimensions
  const heroFontSize = isSmallWidth ? 22 : (isShortHeight ? 24 : 28);
  const locationTitleSize = isSmallWidth ? 16 : (isShortHeight ? 18 : 20);
  const locationSubSize = isSmallWidth ? 11 : 12.5;
  const actionBtnSize = isSmallWidth ? 44 : 50;
  const actionBtnInnerSize = isSmallWidth ? 34 : 38;

  const isMyBooking = (b: BookingInfo) => {
    if (!userEmail || !b.userEmail) return false;
    return b.userEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
  };
  const activeBooking = bookings.find((b) => b.status === 'active' && isMyBooking(b));

  async function handleCancelDashboardBooking() {
    if (!activeBooking) return;
    try {
      if (cancelBooking) {
        await cancelBooking(activeBooking.slotId);
      }
      setUserSelectedSlotId(null);
      showToast('Booking Cancelled', `Slot ${activeBooking.slotLabel} reservation cancelled.`, 'info');
    } catch (err: any) {
      console.warn('Dashboard cancel failed:', err);
    }
  }

  // 1. Automatically select AI recommended slot when opening app
  // Priority: 1. Active User Booking
  //           2. Neural / Dynamic AI Allocation (allocated_stall)
  //           3. Slot designated as isBest in slots array (MARL dynamic policy)
  //           4. Legacy Firebase recommendation
  //           5. First available unoccupied slot / fallback 'slot1'
  const neuralAllocatedId = aiAllocation?.allocated_stall;
  const isNeuralAllocatedValid = neuralAllocatedId && (!slots.length || slots.some((s) => s.id === neuralAllocatedId && !s.occupied));

  const aiRecommendedSlotId = activeBooking
    ? activeBooking.slotId
    : (
        isNeuralAllocatedValid
          ? neuralAllocatedId
          : (slots.find((s) => s.isBest)?.id || data?.recommendation?.best_slot || slots.find((s) => !s.occupied)?.id || 'slot1')
      );

  // 2. User selection state on home page (defaults to null, meaning AI recommended is active)
  const [userSelectedSlotId, setUserSelectedSlotId] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [slotToOpenInModal, setSlotToOpenInModal] = useState<SlotInfo | null>(null);

  // Map camera & zoom triggers for mobile WebView and Web
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [zoomInTrigger, setZoomInTrigger] = useState(0);
  const [zoomOutTrigger, setZoomOutTrigger] = useState(0);

  async function handleConfirmDashboardBooking(details: BookingDetails) {
    if (activeBooking) {
      showToast(
        'Booking Limit Reached',
        `You already have an active reservation for Slot ${activeBooking.slotLabel}. Cancel it first before booking another slot.`,
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
        `Slot ${currentSlot.label} was just occupied or booked by another user. Please choose an available bay.`,
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
      if (parking.writeBooking) {
        await parking.writeBooking(newBooking);
      }
      setShowBookingModal(false);
      setSlotToOpenInModal(null);
      showToast(
        'Booking Confirmed',
        `Slot ${sl.label} reserved (${details.durationHours}h • ₹${details.totalFare}).`,
        'success'
      );
    } catch (err: any) {
      setShowBookingModal(false);
      setSlotToOpenInModal(null);
      console.warn('Dashboard booking write failed:', err);
    }
  }

  // Resolved readable location name
  const currentLocationName = useMemo(() => {
    if (!userLocation) return 'Detecting Location...';
    for (const loc of CAMPUS_LOCATIONS) {
      const d = Math.hypot(loc.latitude - userLocation.latitude, loc.longitude - userLocation.longitude);
      if (d < 0.00045) return loc.name;
    }
    if (userLocation.latitude >= 13.5554) {
      return 'Academic Block Area';
    }
    return 'My Current Location';
  }, [userLocation]);

  function handleSelectCampusLocation(loc: typeof CAMPUS_LOCATIONS[0]) {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('smart-parking-set-user-location', {
          detail: { latitude: loc.latitude, longitude: loc.longitude },
        })
      );
      window.dispatchEvent(new CustomEvent('smart-parking-recenter'));
    }
    setShowLocationModal(false);
    showToast('Location Set', `Your current location is now set to ${loc.name}.`, 'success');
  }

  async function handleDetectLiveGPS() {
    setShowLocationModal(false);
    showToast('Detecting GPS', 'Querying device high-accuracy GPS sensors...', 'info');
    try {
      const coords = await parking.refreshLocation();
      if (coords) {
        // Calculate distance from IIIT Sri City campus center (~13.555, 80.026)
        const dLat = (coords.latitude - 13.555) * 111000;
        const dLng = (coords.longitude - 80.026) * 108000;
        const campusDist = Math.hypot(dLat, dLng);

        if (campusDist > 8000) {
          // User is outside campus (remote testing)
          showToast(
            'Live GPS Found',
            `Detected location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}). Map updated!`,
            'info'
          );
        } else {
          showToast(
            'GPS Locked',
            `Device location detected (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}).`,
            'success'
          );
        }

        if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
          window.dispatchEvent(new CustomEvent('smart-parking-recenter'));
        }
      }
    } catch (err: any) {
      console.warn('[GPS Detection Error]', err);
      showToast(
        'Location Access Notice',
        err.message || 'Could not access GPS. Please allow browser location permissions or choose a campus building.',
        'error'
      );
    }
  }

  // Effective selected slot
  const targetSlotId = userSelectedSlotId || aiRecommendedSlotId;
  const targetSlot = slots.find((s) => s.id === targetSlotId) || slots[0];
  const isTargetAIRecommended = targetSlotId === aiRecommendedSlotId;

  // Real dynamic road distance to the selected slot using official GNN + Road Graph
  const dynamicDistance = useMemo(() => {
    if (!targetSlot) return 715;
    const metrics = getSlotMetrics(targetSlot);
    return metrics?.distanceToSlot || calculateSlotRoadDistance(targetSlot.coordinate, userLocation, targetSlot.id);
  }, [targetSlot, userLocation, getSlotMetrics]);

  // Handle slot tap in overhead viewer: updates selection without navigating away
  const handleSelectSlot = useCallback(
    (slot: SlotInfo) => {
      if (slot.occupied && slot.id !== activeBooking?.slotId) {
        showToast(`${slot.label} is occupied`, 'Please select a free slot or follow AI pick', 'info');
        return;
      }
      setUserSelectedSlotId(slot.id);
    },
    [activeBooking]
  );

  function handleZoomIn() {
    setZoomInTrigger((v) => v + 1);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smart-parking-zoom-in'));
    }
  }

  function handleZoomOut() {
    setZoomOutTrigger((v) => v + 1);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smart-parking-zoom-out'));
    }
  }

  function handleRecenter() {
    setRecenterTrigger((v) => v + 1);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smart-parking-recenter'));
    }
  }

  if (loading && (!slots || slots.length === 0)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.orange} />
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
        <Text style={styles.errorHint}>Make sure firebase_dashboard.py is running</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Fullscreen Native 3D Campus Map with Real In-Map Road Navigation Line & Anchored Distance Badge */}
      <View style={StyleSheet.absoluteFill}>
        <ParkingMap
          slots={slots}
          parkingData={data}
          layout={layout}
          userLocation={userLocation}
          navigatingTo={targetSlot}
          selectedSlot={targetSlot}
          distanceMeters={dynamicDistance}
          compact={true}
          whiteWashBackground={true}
          hideControls={true}
          recenterTrigger={recenterTrigger}
          zoomInTrigger={zoomInTrigger}
          zoomOutTrigger={zoomOutTrigger}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* 5. Floating Top Header & Hero Text */}
      <View
        style={[
          styles.topOverlay,
          {
            top: Math.max(4, insets.top * 0.2),
            paddingHorizontal: isSmallWidth ? 14 : 20,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* User bar */}
        <View style={[styles.topUserRow, isShortHeight && { marginBottom: 6 }]}>
          <View style={styles.userInfoLeft}>
            <View
              style={[
                styles.avatarCircle,
                isSmallWidth && { width: 38, height: 38, borderRadius: 19 },
              ]}
            >
              <Ionicons name="person" size={isSmallWidth ? 17 : 20} color={colors.accent.orange} />
            </View>
            <View>
              <Text style={styles.greetingSub}>Good Morning</Text>
              <Text style={[styles.userName, isSmallWidth && { fontSize: 14 }]}>{userName}</Text>
            </View>
          </View>

          {/* Right circular action buttons */}
          <View style={styles.topActionsRight}>
            <TouchableOpacity
              style={[
                styles.circleActionBtn,
                isSmallWidth && { width: 38, height: 38, borderRadius: 19 },
              ]}
              activeOpacity={0.75}
            >
              <Ionicons name="notifications-outline" size={isSmallWidth ? 17 : 19} color="#111827" />
              <View style={styles.unreadDot} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.circleActionBtn,
                isSmallWidth && { width: 38, height: 38, borderRadius: 19 },
              ]}
              activeOpacity={0.75}
            >
              <Ionicons name="bookmark-outline" size={isSmallWidth ? 17 : 19} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Title: "Let's Find Parking near You" with responsive typography */}
        <View
          style={[
            styles.heroContainer,
            isShortHeight && { marginTop: 4, paddingVertical: 6 },
            isSmallWidth && { paddingHorizontal: 12, borderRadius: 18, maxWidth: '85%' },
          ]}
        >
          <Text style={[styles.heroLightText, { fontSize: heroFontSize }]}>
            Let's Find <Text style={styles.heroBoldText}>Parking</Text>
          </Text>
          <Text style={[styles.heroSubtitle, { fontSize: heroFontSize }]}>near You</Text>

          {/* Dynamic Location Pill: Tap to fix/change location or trigger live GPS */}
          <TouchableOpacity
            style={[
              styles.locationPillBtn,
              isSmallWidth && { maxWidth: 200, paddingHorizontal: 10 },
              isShortHeight && { paddingVertical: 5 },
            ]}
            onPress={() => setShowLocationModal(true)}
            activeOpacity={0.8}
            accessibilityLabel="Change or fix current location"
          >
            <View style={styles.locationPulseDot} />
            <Ionicons name="location" size={13} color="#0B0F19" style={{ marginRight: 4 }} />
            <Text
              style={[styles.locationPillText, isSmallWidth && { fontSize: 11 }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {currentLocationName}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#64748B" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 6. Floating Compass / Recenter Target Button on Upper Right */}
      <TouchableOpacity
        style={[
          styles.floatingTargetBtn,
          {
            top: insets.top + (isShortHeight ? 56 : 72),
            right: isSmallWidth ? 14 : 20,
          },
          isSmallWidth && { width: 38, height: 38, borderRadius: 19 },
        ]}
        onPress={handleRecenter}
        activeOpacity={0.75}
        accessibilityLabel="Recenter map"
      >
        <View
          style={[
            styles.targetInnerRing,
            isSmallWidth && { width: 18, height: 18, borderRadius: 9 },
          ]}
        >
          <View style={[styles.targetCenterDot, isSmallWidth && { width: 6, height: 6, borderRadius: 3 }]} />
        </View>
      </TouchableOpacity>

      {/* 7. Floating Zoom Controls (+ and - buttons) anchored safely on the upper-right */}
      <View
        style={[
          styles.zoomControlsContainer,
          {
            top: insets.top + (isShortHeight ? 102 : 124),
            right: isSmallWidth ? 14 : 20,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.zoomBtn,
            isSmallWidth && { width: 38, height: 38, borderRadius: 19 },
          ]}
          onPress={handleZoomIn}
          activeOpacity={0.75}
          accessibilityLabel="Zoom In"
        >
          <Ionicons name="add" size={isSmallWidth ? 19 : 22} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.zoomBtn,
            isSmallWidth && { width: 38, height: 38, borderRadius: 19 },
          ]}
          onPress={handleZoomOut}
          activeOpacity={0.75}
          accessibilityLabel="Zoom Out"
        >
          <Ionicons name="remove" size={isSmallWidth ? 19 : 22} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* 8. Signature Vibrant Orange Card at Bottom with IIIT Sricity Parking Area */}
      <View
        style={[
          styles.bottomCardWrapper,
          {
            bottom: isShortHeight ? 6 : 12,
            left: isSmallWidth ? 10 : 16,
            right: isSmallWidth ? 10 : 16,
          },
        ]}
      >
        {/* Floating "Available" pill overlapping the top-left */}
        <View
          style={[
            styles.floatingAvailablePill,
            isShortHeight && { top: -13, paddingVertical: 4 },
            isSmallWidth && { left: 14, paddingHorizontal: 10 },
          ]}
        >
          <View
            style={[
              styles.availableNumberCircle,
              isSmallWidth && { width: 20, height: 20, borderRadius: 10 },
            ]}
          >
            <Text style={[styles.availableNumberText, isSmallWidth && { fontSize: 11.5 }]}>
              {stats.available}
            </Text>
          </View>
          <Text style={[styles.availableLabelText, isSmallWidth && { fontSize: 11.5 }]}>
            Available
          </Text>
        </View>

        {/* Outer Card is NOT a button — clicking inside does NOT navigate to map */}
        <View
          style={[
            styles.orangeCard,
            isShortHeight && { padding: 12, gap: 8 },
            isSmallWidth && { borderRadius: 22 },
          ]}
        >
          {/* Overhead Parking Bay Preview Window (shows Free, Occupied with 3D car, and Selected) */}
          <View style={styles.previewContainer}>
            <OverheadSlotsViewer
              slots={slots}
              selectedSlotId={targetSlotId}
              aiRecommendedSlotId={aiRecommendedSlotId}
              onSelectSlot={handleSelectSlot}
              compact={true}
            />
          </View>

          {/* Card Info & Circular Arrow Action Button */}
          <View style={[styles.bottomRow, isShortHeight && { paddingTop: 2 }]}>
            <View style={styles.textColumn}>
              <Text
                style={[styles.locationTitle, { fontSize: locationTitleSize }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {activeBooking ? `Slot ${activeBooking.slotLabel}` : 'IIIT Sricity Parking Area'}
              </Text>
              <Text
                style={[styles.locationSub, { fontSize: locationSubSize }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {activeBooking
                  ? 'Reserved • Ready to Navigate'
                  : isTargetAIRecommended
                  ? (aiAllocation?.allocation_source === 'marl_gcn_neural_policy'
                      ? `Neural MARL-GCN (${Math.round((aiAllocation.model_confidence || 0.5) * 100)}%) • Slot ${targetSlot?.label || 'A1'}`
                      : `AI Rec • Slot ${targetSlot?.label || 'A1'} Selected`)
                  : `User Selected • Slot ${targetSlot?.label || 'A1'}`}
              </Text>
            </View>

            {/* Action Buttons Row: Book / Cancel Pill + Circular ↗ Arrow */}
            <View style={styles.cardActionsRow}>
              {activeBooking ? (
                <TouchableOpacity
                  style={[styles.cancelBookingPillBtn, isShortHeight && { paddingVertical: 7, paddingHorizontal: 11 }]}
                  onPress={handleCancelDashboardBooking}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle" size={14} color="#DC2626" />
                  <Text style={[styles.cancelBookingPillText, isSmallWidth && { fontSize: 11 }]}>Cancel</Text>
                </TouchableOpacity>
              ) : targetSlot?.occupied ? (
                <TouchableOpacity
                  style={[
                    styles.bookSlotPillBtn,
                    { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
                    isShortHeight && { paddingVertical: 7, paddingHorizontal: 11 },
                  ]}
                  onPress={() => {
                    showToast(
                      `Slot ${targetSlot.label} Occupied`,
                      `Slot ${targetSlot.label} is already occupied or booked by another user. Please choose an available bay.`,
                      'warning'
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="ban" size={13} color="#9CA3AF" />
                  <Text style={[styles.bookSlotPillText, { color: '#9CA3AF' }, isSmallWidth && { fontSize: 11 }]}>Occupied</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.bookSlotPillBtn, isShortHeight && { paddingVertical: 7, paddingHorizontal: 11 }]}
                  onPress={() => {
                    if (targetSlot) {
                      if (targetSlot.occupied) {
                        showToast(
                          `Slot ${targetSlot.label} Occupied`,
                          `Slot ${targetSlot.label} is occupied. Please pick an available slot.`,
                          'info'
                        );
                        return;
                      }
                      setSlotToOpenInModal(targetSlot);
                      setShowBookingModal(true);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={13} color="#111827" />
                  <Text style={[styles.bookSlotPillText, isSmallWidth && { fontSize: 11 }]}>Book</Text>
                </TouchableOpacity>
              )}

              {/* Circular Action Button with ↗ Arrow - Clicking opens booking options in Map page */}
              <TouchableOpacity
                style={[
                  styles.circleButtonOuter,
                  { width: actionBtnSize, height: actionBtnSize, borderRadius: actionBtnSize / 2 },
                ]}
                onPress={() => onNavigateToMap?.(targetSlot)}
                activeOpacity={0.8}
                accessibilityLabel="Open Booking Options on Map Page"
              >
                <View
                  style={[
                    styles.circleButtonInner,
                    { width: actionBtnInnerSize, height: actionBtnInnerSize, borderRadius: actionBtnInnerSize / 2 },
                  ]}
                >
                  <Ionicons
                    name="arrow-up"
                    size={isSmallWidth ? 16 : 19}
                    color="#FFFFFF"
                    style={{ transform: [{ rotate: '45deg' }] }}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* 9. Interactive Campus Location Selector Modal */}
      <Modal
        visible={showLocationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowLocationModal(false)}
        >
          <View
            style={styles.locationModalContent}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="navigate-circle" size={24} color={colors.accent.orange} />
                <Text style={styles.modalTitle}>Set My Location</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowLocationModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select where you are on campus, or query live device GPS:
            </Text>

            {/* Detect Live GPS Button */}
            <TouchableOpacity
              style={styles.liveGpsOptionBtn}
              onPress={handleDetectLiveGPS}
              activeOpacity={0.8}
            >
              <View style={styles.liveGpsIconCircle}>
                <Ionicons name="radio" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.liveGpsTitle}>Detect Live Device GPS</Text>
                <Text style={styles.liveGpsSub}>Query live hardware sensors in real-time</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#2563EB" />
            </TouchableOpacity>

            <View style={styles.modalDivider} />
            <Text style={styles.presetSectionTitle}>Campus Locations</Text>

            {CAMPUS_LOCATIONS.map((loc) => {
              const isSelected =
                userLocation &&
                Math.hypot(loc.latitude - userLocation.latitude, loc.longitude - userLocation.longitude) < 0.00045;

              return (
                <TouchableOpacity
                  key={loc.id}
                  style={[styles.campusLocationItem, isSelected && styles.campusLocationItemSelected]}
                  onPress={() => handleSelectCampusLocation(loc)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.campusItemIconBox, isSelected && styles.campusItemIconBoxSelected]}>
                    <Ionicons
                      name={loc.icon}
                      size={18}
                      color={isSelected ? '#FFFFFF' : '#475569'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.campusItemName, isSelected && styles.campusItemNameSelected]}>
                      {loc.name}
                    </Text>
                    <Text style={styles.campusItemSub}>{loc.sub}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.accent.orange} />}
                </TouchableOpacity>
              );
            })}

            <View style={styles.mapTipBox}>
              <Ionicons name="information-circle-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
              <Text style={styles.mapTipText}>
                Tip: You can also drag the circle icon directly on the map to fine-tune your location.
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Comprehensive Timing & Preferences Booking Modal */}
      <BookingModal
        visible={showBookingModal}
        slot={slotToOpenInModal}
        onClose={() => setShowBookingModal(false)}
        onConfirm={handleConfirmDashboardBooking}
        confirmButtonText="Confirm & Reserve Slot"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F8',
    position: 'relative',
    overflow: 'hidden',
  },
  translucentMap: {
    opacity: 0.38,
  },
  whiteWashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(246, 248, 252, 0.62)',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F3F4F8',
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
    backgroundColor: '#F3F4F8',
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

  // Origin User Pin on the route
  originUserPin: {
    position: 'absolute',
    top: '41.5%',
    left: '23%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    zIndex: 8,
  },
  originPinInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
  },
  originPinDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },

  // Floating Distance Capsule ('715 m') attached directly to the navigation line
  floatingDistanceCapsule: {
    position: 'absolute',
    top: '48.5%',
    left: '42%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 100,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 7,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    zIndex: 9,
  },
  distanceValueText: {
    color: '#0B0F19',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  distanceUnitText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },

  // Floating Top Overlay
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 16,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
  },
  topUserRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  greetingSub: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  userName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 1,
  },
  topActionsRight: {
    flexDirection: 'row',
    gap: 10,
  },
  circleActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#111827',
  },

  // Hero Title: Frosted Glass Panel with Glass Shadow & Specular Bevel
  heroContainer: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow:
            '0 12px 32px 0 rgba(30, 41, 59, 0.10), 0 2px 8px 0 rgba(0, 0, 0, 0.04), inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.95)',
        } as any)
      : {}),
  },
  heroLightText: {
    color: '#64748B',
    fontSize: 30,
    fontWeight: '400',
    letterSpacing: -0.6,
    textShadowColor: 'rgba(255, 255, 255, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroBoldText: {
    color: '#0B0F19',
    fontWeight: '900',
    textShadowColor: 'rgba(255, 255, 255, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroSubtitle: {
    color: '#64748B',
    fontSize: 30,
    fontWeight: '400',
    letterSpacing: -0.6,
    marginTop: -2,
    textShadowColor: 'rgba(255, 255, 255, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Floating Compass / Recenter Target Button
  floatingTargetBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 148 : 120,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    zIndex: 10,
  },
  targetInnerRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetCenterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#64748B',
  },

  // Floating Zoom Stack on Right
  zoomControlsContainer: {
    position: 'absolute',
    bottom: 275,
    right: 20,
    gap: 10,
    zIndex: 10,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },

  // Bottom Signature Orange Card
  bottomCardWrapper: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  floatingAvailablePill: {
    position: 'absolute',
    top: -16,
    left: 20,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  availableNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F3F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableNumberText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
  },
  availableLabelText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '600',
    paddingRight: 4,
  },
  orangeCard: {
    backgroundColor: colors.accent.orange,
    borderRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: colors.accent.orange,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 20,
    elevation: 8,
  },
  previewContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#D7DDE6',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  textColumn: {
    flex: 1,
    paddingRight: spacing.md,
  },
  locationTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  locationSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBookingPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelBookingPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  bookSlotPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  bookSlotPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  circleButtonOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  circleButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Location Pill Button under Hero Header
  locationPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  locationPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  locationPillText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 160,
  },

  // Modal Backdrop & Content
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        } as any)
      : {}),
  },
  locationModalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },

  // Detect Live GPS Button
  liveGpsOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    gap: 12,
  },
  liveGpsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveGpsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
  },
  liveGpsSub: {
    fontSize: 11,
    color: '#60A5FA',
    marginTop: 1,
  },

  modalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  presetSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  // Campus Location Items
  campusLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  campusLocationItemSelected: {
    backgroundColor: '#FFF7ED',
    borderColor: colors.accent.orange,
  },
  campusItemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  campusItemIconBoxSelected: {
    backgroundColor: colors.accent.orange,
  },
  campusItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  campusItemNameSelected: {
    color: colors.accent.orange,
  },
  campusItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  // Map Tip Box
  mapTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  mapTipText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
});

