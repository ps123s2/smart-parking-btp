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
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { database, ref, onValue, set, remove } from '../config/firebase';
import {
  ParkingData,
  SlotInfo,
  BookingInfo,
  SLOT_LABELS,
  generateParkingLayout,
  getRealRoadDistanceToSlot,
  computeDynamicMARLScores,
  GNN_SLOT_PATHS,
  AIAllocationResponse,
} from '../types/parking';
import { allocateAISlot } from '../services/api';

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
  /** Internal parking graph distance computed by GNN Dijkstra (meters) */
  gnnDistance: number;
  /** MARL reinforcement learning composite score */
  marlScore: number;
  /** GNN shortest path node sequence */
  gnnPath: string[];
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
  /** Force an immediate high-accuracy GPS poll */
  refreshLocation: () => Promise<{ latitude: number; longitude: number } | null>;
  /** Stage 8 MARL-GCN neural allocation response (or heuristic fallback) */
  aiAllocation: AIAllocationResponse | null;
  /** Force an on-demand refresh of the AI neural allocation */
  refreshAIAllocation: () => Promise<AIAllocationResponse | null>;
}

// Fixed location on North Street near BH3 (matches user position in screenshot)
const DEFAULT_LOCATION = { latitude: 13.55395, longitude: 80.02550 };

// CO2 emission constants
const CO2_GRAMS_PER_METER = 0.12; // Average car: ~120g CO2/km
const AVG_SEARCH_DISTANCE_M = 2400; // Avg distance drivers waste searching for parking
const AVG_DRIVING_SPEED_MPS = 5; // ~18 km/h in parking area

// Firebase REST URL for direct writes (bypasses SDK auth issues)
const FB_REST_BASE = 'https://smartparking-87cee-default-rtdb.asia-southeast1.firebasedatabase.app';

// Instant initial fallback dataset matching the campus parking layout
const INITIAL_CAMPUS_PARKING_DATA: ParkingData = {
  states: [0, 1, 0, 1, 0],
  recommendation: {
    best_slot: 'slot1',
    top3: ['slot1', 'slot3', 'slot5'],
  },
  route: {
    path: ['Entrance', 'Lane_A', 'slot1'],
  },
  co2: {
    saved: 42.5,
    unit: 'g',
  },
  navigation: {
    polyline: '',
    distance: 715,
    duration: 120,
  },
  predictions: {
    slot1: 'Free (95% avail)',
    slot2: 'Occupied (est. 12m)',
    slot3: 'Free (88% avail)',
    slot4: 'Occupied (est. 25m)',
    slot5: 'Free (91% avail)',
  },
  timings: {
    slot1: { occupied: false, est_minutes: 0, label: 'Free' },
    slot2: { occupied: true, est_minutes: 12, label: '12 min' },
    slot3: { occupied: false, est_minutes: 0, label: 'Free' },
    slot4: { occupied: true, est_minutes: 25, label: '25 min' },
    slot5: { occupied: false, est_minutes: 0, label: 'Free' },
  },
};

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
  const [data, setData] = useState<ParkingData>(INITIAL_CAMPUS_PARKING_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem('smart-parking-user-location');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
            return parsed;
          }
        }
      } catch {}
    }
    return null;
  });
  const [layout, setLayout] = useState<ParkingLayout | null>(() => generateParkingLayout());
  const [bookedSlots, setBookedSlots] = useState<Record<string, BookedSlotData>>({});
  const [aiAllocation, setAiAllocation] = useState<AIAllocationResponse | null>(null);

  const refreshAIAllocation = useCallback(async () => {
    try {
      const res = await allocateAISlot();
      if (res && res.success) {
        setAiAllocation(res);
        return res;
      }
    } catch (err: any) {
      console.log('[AI Allocation] Fetch fallback active:', err?.message || err);
    }
    return null;
  }, []);

  // Helper to persist user location (throttled to avoid blocking localStorage I/O)
  const lastSavedLocRef = useState<{ lat: number; lng: number } | null>(null);
  const saveLocation = useCallback((lat: number, lng: number) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const last = (window as any).__lastSavedLoc;
        if (last && Math.abs(last.lat - lat) < 0.00005 && Math.abs(last.lng - lng) < 0.00005) {
          return;
        }
        (window as any).__lastSavedLoc = { lat, lng };
        window.localStorage.setItem(
          'smart-parking-user-location',
          JSON.stringify({ latitude: lat, longitude: lng })
        );
      } catch {}
    }
  }, []);

  // Force an immediate high-accuracy GPS poll
  const refreshLocation = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      return new Promise<{ latitude: number; longitude: number } | null>((resolve, reject) => {
        const handleSuccess = (pos: GeolocationPosition) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLocation((prev) => {
            if (prev && Math.abs(prev.latitude - lat) < 0.00002 && Math.abs(prev.longitude - lng) < 0.00002) {
              return prev;
            }
            return { latitude: lat, longitude: lng };
          });
          saveLocation(lat, lng);
          resolve({ latitude: lat, longitude: lng });
        };

        const handleError = (err: GeolocationPositionError) => {
          console.warn('[GPS] Geolocation error:', err.code, err.message);
          let reason = 'Could not access device GPS.';
          if (err.code === 1) {
            reason = 'Location permission denied. Please allow location access in your browser address bar.';
          } else if (err.code === 2) {
            reason = 'GPS location unavailable. Please check if device Location Services are turned on.';
          } else if (err.code === 3) {
            reason = 'GPS request timed out. Please try clicking again.';
          }
          reject(new Error(reason));
        };

        // Try high accuracy with a 10s timeout to allow user to click "Allow" in browser prompt
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          () => {
            // Fallback to coarse / Wi-Fi accuracy if high accuracy fails
            navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 10000,
            });
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    } else if (Platform.OS !== 'web') {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Location permission denied on device.');
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(coords);
        return coords;
      } catch (err: any) {
        throw new Error(err.message || 'Failed to detect GPS on device.');
      }
    }
    return null;
  }, [saveLocation]);

  // Get user location dynamically and continually watch for movement
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let webWatchId: number | null = null;
    let isCancelled = false;

    // Web platform: Native HTML5 navigator.geolocation with live tracking
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        let receivedRealGps = false;
        let bestAccuracy = Infinity;

        const handleSuccess = (pos: GeolocationPosition) => {
          if (isCancelled) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy || 9999;
          receivedRealGps = true;

          // Only accept if accuracy is better or reasonable
          if (accuracy <= bestAccuracy || bestAccuracy > 150) {
            bestAccuracy = accuracy;
            setUserLocation((prev) => {
              if (prev && Math.abs(prev.latitude - lat) < 0.00001 && Math.abs(prev.longitude - lng) < 0.00001) {
                return prev;
              }
              return { latitude: lat, longitude: lng };
            });
            saveLocation(lat, lng);
          }
        };

        const handleError = (err: GeolocationPositionError) => {
          console.warn('[GPS] Browser geolocation notice:', err.code, err.message);
          if (!receivedRealGps && !isCancelled) {
            setUserLocation((prev) => prev || DEFAULT_LOCATION);
          }
        };

        // 1. Initial direct HIGH-ACCURACY GPS check (maximumAge: 0 forces phone GPS chip hardware lock)
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          () => {
            // Fallback to coarse network/Wi-Fi only if high accuracy GPS times out (e.g., deep indoors)
            navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 10000,
            });
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );

        // 2. Real-time dynamic location watcher (continual high-accuracy GPS movement tracking)
        webWatchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });

        // 3. Fallback timer (4.5s) if user location hasn't been set yet
        const initFallbackTimer = setTimeout(() => {
          if (!receivedRealGps && !isCancelled) {
            setUserLocation((prev) => prev || DEFAULT_LOCATION);
          }
        }, 4500);

        // 4. Custom event listener for manual GPS refresh
        const onCustomRefresh = () => {
          refreshLocation();
        };
        window.addEventListener('smart-parking-refresh-location', onCustomRefresh);

        // 5. Custom event listener for manual location setting (drag circle or choose campus building)
        const onSetLocation = (e: any) => {
          const { latitude, longitude } = e.detail || {};
          if (typeof latitude === 'number' && typeof longitude === 'number') {
            receivedRealGps = true;
            setUserLocation((prev) => {
              if (prev && Math.abs(prev.latitude - latitude) < 0.00002 && Math.abs(prev.longitude - longitude) < 0.00002) {
                return prev;
              }
              return { latitude, longitude };
            });
            saveLocation(latitude, longitude);
          }
        };
        window.addEventListener('smart-parking-set-user-location', onSetLocation);

        return () => {
          isCancelled = true;
          clearTimeout(initFallbackTimer);
          window.removeEventListener('smart-parking-refresh-location', onCustomRefresh);
          window.removeEventListener('smart-parking-set-user-location', onSetLocation);
          if (webWatchId !== null) {
            navigator.geolocation.clearWatch(webWatchId);
          }
        };
      } else {
        setUserLocation((prev) => prev || DEFAULT_LOCATION);
      }
      return;
    }

    // Native platform (iOS / Android) — Real-time live GPS tracking
    (async () => {
      try {
        // 1. Verify location services are switched on in device settings
        try {
          const isEnabled = await Location.hasServicesEnabledAsync();
          if (!isEnabled) {
            console.warn('[GPS] Device location services are disabled.');
          }
        } catch {}

        // 2. Check / request foreground location permissions
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync();
          status = req.status;
        }

        if (status !== 'granted') {
          console.warn('[GPS] Native location permission denied, using default');
          if (!isCancelled) {
            setUserLocation((prev) => prev || DEFAULT_LOCATION);
            setLayout(generateParkingLayout(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude));
          }
          return;
        }

        // 3. INSTANT LOCK: Check cached position first for zero-delay startup
        try {
          const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 60000 });
          if (!isCancelled && lastKnown?.coords) {
            const lat = lastKnown.coords.latitude;
            const lng = lastKnown.coords.longitude;
            setUserLocation({ latitude: lat, longitude: lng });
            setLayout(generateParkingLayout(lat, lng));
          }
        } catch {}

        // 4. LIVE CONTINUOUS WATCH: Stream user movement every 1s / 1 meter!
        // Uses Accuracy.High (Google Fused Provider) for instant, battery-efficient GPS indoors & outdoors.
        if (!isCancelled) {
          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 1000,
              distanceInterval: 1,
            },
            (loc) => {
              if (!isCancelled && loc?.coords) {
                const lat = loc.coords.latitude;
                const lng = loc.coords.longitude;
                setUserLocation((prev) => {
                  if (prev && Math.abs(prev.latitude - lat) < 0.00001 && Math.abs(prev.longitude - lng) < 0.00001) {
                    return prev;
                  }
                  return { latitude: lat, longitude: lng };
                });
              }
            }
          );
        }

        // 5. In background: Poll current position to refine accuracy without blocking watchPosition
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
          .then((current) => {
            if (!isCancelled && current?.coords) {
              const lat = current.coords.latitude;
              const lng = current.coords.longitude;
              setUserLocation({ latitude: lat, longitude: lng });
            }
          })
          .catch((err) => {
            console.log('[GPS] Single poll notice:', err?.message || err);
          });
      } catch (err) {
        console.warn('[GPS] Native location error:', err);
        if (!isCancelled) {
          setUserLocation((prev) => prev || DEFAULT_LOCATION);
          setLayout(generateParkingLayout(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude));
        }
      }
    })();

    return () => {
      isCancelled = true;
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [refreshLocation]);

  // Firebase parking data listener with immediate REST fetch + polling fallback
  useEffect(() => {
    let isMounted = true;
    let lastPayloadStr = '';

    const handlePayload = (val: any) => {
      if (!val) {
        setError('No parking data available');
        setLoading(false);
        return;
      }
      try {
        const payloadKey = JSON.stringify({
          states: val.states,
          predictions: val.predictions,
          booked_slots: val.booked_slots,
          all_occupied: val.all_occupied,
          rec_best: val.recommendation?.best_slot,
        });
        if (payloadKey === lastPayloadStr) {
          setLoading(false);
          return; // Identical payload, avoid unnecessary full-app re-renders
        }
        lastPayloadStr = payloadKey;
      } catch {}

      setData(val as ParkingData);
      setError(null);
      // Extract booked_slots from the same /data node
      if (val.booked_slots && typeof val.booked_slots === 'object') {
        setBookedSlots(val.booked_slots as Record<string, BookedSlotData>);
      } else {
        setBookedSlots({});
      }
      setLoading(false);
    };

    // 1. Instant REST fetch — bypasses any WebSocket stalls or dummy API key delays
    const fetchDirect = async () => {
      try {
        const res = await fetch(`${FB_REST_BASE}/data.json`);
        if (res.ok && isMounted) {
          const val = await res.json();
          handlePayload(val);
        }
      } catch (err: any) {
        console.warn('[Firebase REST] Direct fetch warning:', err.message);
      }
    };

    fetchDirect();

    // 2. Poll every 5s as fallback (WebSocket listener below provides instant push)
    const pollInterval = setInterval(fetchDirect, 5000);

    // 3. Realtime WebSocket listener for instant push notifications
    let unsubscribe: (() => void) | null = null;
    try {
      const dataRef = ref(database, 'data');
      unsubscribe = onValue(
        dataRef,
        (snapshot) => {
          if (!isMounted) return;
          const val = snapshot.val();
          handlePayload(val);
        },
        (err) => {
          if (!isMounted) return;
          console.warn('[Firebase RTDB] Listener warning:', err.message);
          setData((current) => {
            if (!current) setError(err.message);
            return current;
          });
          setLoading(false);
        }
      );
    } catch (err: any) {
      console.warn('[Firebase RTDB] Listener init error:', err.message);
    }

    // 4. Safety timeout: never leave user stuck indefinitely
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      clearTimeout(safetyTimeout);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // ═══════ BOOKING FUNCTIONS (write via REST API to /data/booked_slots) ═══════

  /**
   * Write a booking to Firebase /data/booked_slots/{slotId}.
   * Uses REST API (PUT) which is guaranteed to work — same method
   * the Python backend uses. All phones receive the update instantly
   * through their existing /data listener.
   */
  const writeBooking = useCallback(async (booking: BookingInfo) => {
    const payload: BookedSlotData = {
      userEmail: booking.userEmail || 'guest@demo.com',
      slotLabel: booking.slotLabel,
      duration: booking.duration,
      bookedAt: booking.date,
      expiresAt: booking.expiresAt || '',
      status: 'active',
    };

    // 1. Optimistic local update so UI reflects the booking instantaneously
    setBookedSlots((prev) => ({
      ...prev,
      [booking.slotId]: payload,
    }));

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        booked_slots: {
          ...(prev.booked_slots || {}),
          [booking.slotId]: payload,
        },
      };
    });

    try {
      const url = `${FB_REST_BASE}/data/booked_slots/${booking.slotId}.json`;
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
    // 1. Optimistic local update so UI reflects cancellation instantaneously
    setBookedSlots((prev) => {
      const next = { ...prev };
      if (next[slotId]) {
        next[slotId] = {
          ...next[slotId],
          status: 'cancelled',
        };
      }
      return next;
    });

    setData((prev) => {
      if (!prev) return prev;
      const updatedBooked = { ...(prev.booked_slots || {}) };
      if (updatedBooked[slotId]) {
        updatedBooked[slotId] = {
          ...updatedBooked[slotId],
          status: 'cancelled',
        };
      }
      return {
        ...prev,
        booked_slots: updatedBooked,
      };
    });

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

  // Dynamic MARL + GNN + GRU recommendation calculation
  const dynamicMARL = useMemo(() => {
    if (!data?.states) return null;
    return computeDynamicMARLScores(data.states, bookedSlots, data.predictions);
  }, [data?.states, bookedSlots, data?.predictions]);

  // Build SlotInfo array using dynamic layout coordinates and dynamic MARL rankings
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

        // MARL dynamic selection: prefers AI neural allocation when available
        const preferredBestSlot = (!hasActiveBooking && aiAllocation?.allocated_stall)
          ? aiAllocation.allocated_stall
          : (dynamicMARL?.bestSlot || (!hasActiveBooking ? data.recommendation?.best_slot : null));

        const isBest = preferredBestSlot === slotId;

        const isTop3 = !hasActiveBooking && (
          aiAllocation?.top3_slots && aiAllocation.top3_slots.length > 0
            ? aiAllocation.top3_slots.includes(slotId)
            : (dynamicMARL?.top3 ? dynamicMARL.top3.includes(slotId) : (data.recommendation?.top3?.includes(slotId) || false))
        );

        return {
          id: slotId,
          label: SLOT_LABELS[slotId] || `S${index + 1}`,
          index,
          occupied: state === 1 || hasActiveBooking,
          isBest,
          isTop3,
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
    [data, layout, bookedSlots, dynamicMARL, aiAllocation]
  );

  const stats = useMemo(() => ({
    total: slots.length,
    available: slots.filter((s) => !s.occupied).length,
    occupied: slots.filter((s) => s.occupied).length,
  }), [slots]);

  // ═══════ REAL-TIME CO2 & REAL ROAD DISTANCE CALCULATION ═══════
  const getSlotMetrics = useCallback((targetSlot: SlotInfo | null): LiveMetrics => {
    if (!userLocation || !layout || slots.length === 0 || !targetSlot) {
      return {
        distanceToSlot: 0,
        distanceToEntry: 0,
        eta: 0,
        co2Saved: 0,
        emissionRate: CO2_GRAMS_PER_METER,
        distanceSaved: 0,
        gnnDistance: 0,
        marlScore: 0,
        gnnPath: [],
      };
    }

    // Dynamic real road network distance (user -> campus road route -> Entrance P -> GNN shortest path to stall)
    const { roadDistanceToEntry, gnnDistanceToSlot, totalRealDistance } = getRealRoadDistanceToSlot(
      userLocation.latitude,
      userLocation.longitude,
      targetSlot.id,
      layout.entry
    );

    const gnnPath = GNN_SLOT_PATHS[targetSlot.id] || ['entry', targetSlot.id];
    const marlScore = dynamicMARL?.scores[targetSlot.id] ?? 0;

    // CO2 saved = (avg random search distance - AI optimized real driving distance) × emission rate
    const distSaved = Math.max(0, AVG_SEARCH_DISTANCE_M - totalRealDistance);
    const co2 = distSaved * CO2_GRAMS_PER_METER;
    const eta = Math.round(totalRealDistance / AVG_DRIVING_SPEED_MPS);

    return {
      distanceToSlot: totalRealDistance,
      distanceToEntry: roadDistanceToEntry,
      eta,
      co2Saved: Math.round(co2 * 10) / 10, // 1 decimal place
      emissionRate: CO2_GRAMS_PER_METER,
      distanceSaved: Math.round(distSaved),
      gnnDistance: gnnDistanceToSlot,
      marlScore,
      gnnPath,
    };
  }, [userLocation, layout, slots, dynamicMARL]);

  const liveMetrics: LiveMetrics = useMemo(() => {
    const bestSlot = slots.find((s) => s.isBest) || slots.find((s) => !s.occupied);
    return getSlotMetrics(bestSlot || null);
  }, [getSlotMetrics, slots]);

  // Automatically trigger neural allocation fetch when sensor states update
  useEffect(() => {
    if (data?.states) {
      refreshAIAllocation();
    }
  }, [data?.states, refreshAIAllocation]);

  return {
    data,
    slots,
    loading,
    error,
    stats,
    layout,
    userLocation,
    liveMetrics,
    getSlotMetrics,
    bookings,
    writeBooking,
    cancelBooking,
    isSlotBooked,
    refreshLocation,
    aiAllocation,
    refreshAIAllocation,
  };
}
