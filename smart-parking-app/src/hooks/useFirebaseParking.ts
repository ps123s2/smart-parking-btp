/**
 * Real-time Firebase listener + dynamic parking lot placement near user GPS.
 * Calculates real-time CO2 savings and distances based on actual GPS.
 * 
 * BOOKING SYNC: Bookings are stored at /data/booked_slots/ inside the SAME
 * Firebase node that both phones already listen to. When Phone 1 books a slot,
 * Phone 2 sees it instantly via the existing /data listener — no extra listeners
 * or auth needed.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import * as Location from 'expo-location';
import { database, ref, onValue, set, remove } from '../config/firebase';
import {
  ParkingData,
  SlotInfo,
  BookingInfo,
  SLOT_LABELS,
  generateParkingLayout,
} from '../types/parking';

interface ParkingLayout {
  entry: { latitude: number; longitude: number };
  slots: Record<string, { latitude: number; longitude: number }>;
  roads: Array<Array<{ latitude: number; longitude: number }>>;
}

export interface LiveMetrics {
  /** Distance from user to the best/recommended slot (meters) */
  distanceToSlot: number;
  /** Distance from user to parking entry (meters) */
  distanceToEntry: number;
  /** Estimated walking/driving time in seconds */
  eta: number;
  /** CO2 saved by using AI-optimized slot instead of random searching (grams) */
  co2Saved: number;
  /** CO2 emission rate used (g/m) */
  emissionRate: number;
  /** Distance saved vs. average random parking search (meters) */
  distanceSaved: number;
}

/** Raw booked_slots structure from Firebase /data/booked_slots */
interface BookedSlotData {
  userEmail: string;
  slotLabel: string;
  duration: number;
  bookedAt: string;
  expiresAt: string;
  status: string;
}

export interface UseParkingResult {
  data: ParkingData | null;
  slots: SlotInfo[];
  loading: boolean;
  error: string | null;
  stats: { total: number; available: number; occupied: number };
  layout: ParkingLayout | null;
  userLocation: { latitude: number; longitude: number } | null;
  liveMetrics: LiveMetrics;
  getSlotMetrics: (slot: SlotInfo | null) => LiveMetrics;
  /** Real-time bookings synced across all devices via Firebase /data/booked_slots */
  bookings: BookingInfo[];
  /** Write a new booking to Firebase (syncs to all phones instantly) */
  writeBooking: (booking: BookingInfo) => Promise<void>;
  /** Cancel a booking in Firebase (syncs to all phones instantly) */
  cancelBooking: (slotId: string) => Promise<void>;
  /** Check if a slot is currently booked by anyone */
  isSlotBooked: (slotId: string) => boolean;
}

// Fixed location for IIIT Sri City Academic Block (For BTP Presentation)
const DEFAULT_LOCATION = { latitude: 13.5595, longitude: 79.9882 };

// CO2 emission constants
const CO2_GRAMS_PER_METER = 0.12; // Average car: ~120g CO2/km
const AVG_SEARCH_DISTANCE_M = 2400; // Avg distance drivers waste searching for parking
const AVG_DRIVING_SPEED_MPS = 5; // ~18 km/h in parking area

// Firebase REST URL for direct writes (bypasses SDK auth issues)
const FB_REST_BASE = 'https://smartparking-87cee-default-rtdb.asia-southeast1.firebasedatabase.app';

/** Calculate distance between two GPS points in meters (Haversine) */
function haversine(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useFirebaseParking(): UseParkingResult {
  const [data, setData] = useState<ParkingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [layout, setLayout] = useState<ParkingLayout | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Record<string, BookedSlotData>>({});

  // Get user location dynamically and watch for movement (Restored to original behavior)
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Location permission denied, using default');
          setUserLocation(DEFAULT_LOCATION);
          setLayout(generateParkingLayout(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude));
          return;
        }

        // 1. Get initial location strictly from live GPS
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        if (initial) {
          setUserLocation({
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
          });
          
          // Spawn the parking lot exactly where your phone is standing right now!
          setLayout(generateParkingLayout(initial.coords.latitude, initial.coords.longitude));
        } else {
          throw new Error("Could not get initial location");
        }

        // 2. Watch for real-time updates (to move the blue dot & nav line)
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 2000,
            distanceInterval: 1,
          },
          (loc) => {
            setUserLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        );
      } catch (err) {
        console.warn('Location error', err);
        setUserLocation(DEFAULT_LOCATION);
        setLayout(generateParkingLayout(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude));
      }
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Firebase parking data listener — ALSO picks up booked_slots
  useEffect(() => {
    const dataRef = ref(database, 'data');
    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        const val = snapshot.val();
        if (val) {
          setData(val as ParkingData);
          setError(null);
          // Extract booked_slots from the same /data node
          if (val.booked_slots && typeof val.booked_slots === 'object') {
            setBookedSlots(val.booked_slots as Record<string, BookedSlotData>);
          } else {
            setBookedSlots({});
          }
        } else {
          setError('No parking data available');
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // ═══════ BOOKING FUNCTIONS (write via REST API to /data/booked_slots) ═══════

  /**
   * Write a booking to Firebase /data/booked_slots/{slotId}.
   * Uses REST API (PUT) which is guaranteed to work — same method
   * the Python backend uses. All phones receive the update instantly
   * through their existing /data listener.
   */
  const writeBooking = useCallback(async (booking: BookingInfo) => {
    try {
      const url = `${FB_REST_BASE}/data/booked_slots/${booking.slotId}.json`;
      const payload: BookedSlotData = {
        userEmail: booking.userEmail || 'guest@demo.com',
        slotLabel: booking.slotLabel,
        duration: booking.duration,
        bookedAt: booking.date,
        expiresAt: booking.expiresAt || '',
        status: 'active',
      };
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.warn('[Firebase REST] Write failed:', res.status, await res.text());
      }
    } catch (err: any) {
      console.warn('[Firebase REST] Write booking failed:', err.message);
    }
  }, []);

  /**
   * Cancel a booking by marking its status as 'cancelled'.
   * Uses REST API (PATCH) because some networks block DELETE requests.
   */
  const cancelBooking = useCallback(async (slotId: string) => {
    try {
      const url = `${FB_REST_BASE}/data/booked_slots/${slotId}.json`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) {
        console.warn('[Firebase REST] Cancel failed:', res.status, await res.text());
      }
    } catch (err: any) {
      console.warn('[Firebase REST] Cancel booking failed:', err.message);
    }
  }, []);

  /** Check if a slot currently has an active booking by any user */
  const isSlotBooked = useCallback((slotId: string): boolean => {
    return slotId in bookedSlots && bookedSlots[slotId]?.status === 'active';
  }, [bookedSlots]);

  // Convert bookedSlots map into BookingInfo array for the UI
  const bookings: BookingInfo[] = useMemo(() => {
    return Object.entries(bookedSlots).map(([slotId, raw]) => ({
      id: `bk_${slotId}`,
      slotId,
      slotLabel: raw.slotLabel || SLOT_LABELS[slotId] || slotId,
      date: raw.bookedAt || '',
      duration: raw.duration || 0,
      status: (raw.status || 'active') as BookingInfo['status'],
      userEmail: raw.userEmail || '',
      expiresAt: raw.expiresAt || '',
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bookedSlots]);

  // Build SlotInfo array using dynamic layout coordinates
  const slots: SlotInfo[] = useMemo(() =>
    data && layout
      ? data.states.map((state, index) => {
        const slotId = `slot${index + 1}`;
        const timing = data.timings?.[slotId];
        // A slot is occupied if sensor says so OR if someone has an active booking
        const activeBooking = bookedSlots[slotId];
        const hasActiveBooking = activeBooking && activeBooking.status === 'active';

        let finalTimingLabel = timing ? timing.label : 'Unknown';
        if (hasActiveBooking) {
          const mins = Math.round(activeBooking.duration * 60);
          finalTimingLabel = `${mins} min (Booked)`;
        }

        return {
          id: slotId,
          label: SLOT_LABELS[slotId] || `S${index + 1}`,
          index,
          occupied: state === 1 || hasActiveBooking,
          isBest: !hasActiveBooking && data.recommendation?.best_slot === slotId,
          isTop3: !hasActiveBooking && (data.recommendation?.top3?.includes(slotId) || false),
          prediction: data.predictions?.[slotId] || 'Unknown',
          estMinutes: timing ? timing.est_minutes : 0,
          timingLabel: finalTimingLabel,
          coordinate: layout.slots[slotId] || {
            latitude: layout.entry.latitude + 0.0005 * (index + 1),
            longitude: layout.entry.longitude,
          },
        };
      })
      : [],
    [data, layout, bookedSlots]
  );

  const stats = useMemo(() => ({
    total: slots.length,
    available: slots.filter((s) => !s.occupied).length,
    occupied: slots.filter((s) => s.occupied).length,
  }), [slots]);

  // ═══════ REAL-TIME CO2 & DISTANCE CALCULATION ═══════
  const getSlotMetrics = useCallback((targetSlot: SlotInfo | null): LiveMetrics => {
    if (!userLocation || !layout || slots.length === 0 || !targetSlot) {
      return {
        distanceToSlot: 0,
        distanceToEntry: 0,
        eta: 0,
        co2Saved: 0,
        emissionRate: CO2_GRAMS_PER_METER,
        distanceSaved: 0,
      };
    }

    // Real GPS distance calculations
    const distToEntry = haversine(
      userLocation.latitude, userLocation.longitude,
      layout.entry.latitude, layout.entry.longitude
    );

    const distEntryToSlot = haversine(
      layout.entry.latitude, layout.entry.longitude,
      targetSlot.coordinate.latitude, targetSlot.coordinate.longitude
    );

    const totalDist = distToEntry + distEntryToSlot;

    // CO2 saved = (avg random search distance - AI optimized distance) × emission rate
    // Only if AI route is shorter than average search
    const distSaved = Math.max(0, AVG_SEARCH_DISTANCE_M - totalDist);
    // Even if occupied, show theoretical CO2 savings for presentation purposes
    const co2 = distSaved * CO2_GRAMS_PER_METER;

    const eta = Math.round(totalDist / AVG_DRIVING_SPEED_MPS);

    return {
      distanceToSlot: Math.round(totalDist),
      distanceToEntry: Math.round(distToEntry),
      eta,
      co2Saved: Math.round(co2 * 10) / 10, // 1 decimal place
      emissionRate: CO2_GRAMS_PER_METER,
      distanceSaved: Math.round(distSaved),
    };
  }, [userLocation, layout, slots]);

  const liveMetrics: LiveMetrics = useMemo(() => {
    const bestSlot = slots.find((s) => s.isBest) || slots.find((s) => !s.occupied);
    return getSlotMetrics(bestSlot || null);
  }, [getSlotMetrics, slots]);

  return { data, slots, loading, error, stats, layout, userLocation, liveMetrics, getSlotMetrics, bookings, writeBooking, cancelBooking, isSlotBooked };
}
