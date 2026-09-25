/**
 * TypeScript interfaces matching the Firebase Realtime DB structure.
 * Slot coordinates are generated DYNAMICALLY near the user's GPS location.
 */

export interface ParkingData {
  states: number[];
  all_occupied?: boolean;
  recommendation: {
    best_slot: string;
    top3: string[];
    wait_suggestion?: {
      slot: string;
      predicted_availability: number;
      confidence: number;
      message: string;
    };
  };
  route: {
    path: string[];
  };
  co2: {
    saved: number;
    unit: string;
    distance_m?: number;
  };
  navigation: {
    polyline: string;
    distance: number;
    duration: number;
  };
  predictions: Record<string, string>;
  timings?: Record<string, { occupied: boolean; est_minutes: number; label: string }>;
}

export interface SlotInfo {
  id: string;
  label: string;
  index: number;
  occupied: boolean;
  isBest: boolean;
  isTop3: boolean;
  prediction: string;
  estMinutes: number;
  timingLabel: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
}

export interface BookingInfo {
  id: string;
  slotId: string;
  slotLabel: string;
  date: string;
  /** Duration in fractional hours (e.g. 1.5 = 1h 30m). Max 4 hours. */
  duration: number;
  status: 'active' | 'completed' | 'cancelled';
  /** Email of the user who made this booking (for multi-device sync) */
  userEmail?: string;
  /** ISO timestamp when the booking expires */
  expiresAt?: string;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  token: string;
  role: string;
  co2_saved: number;
}

export const SLOT_LABELS: Record<string, string> = {
  slot1: 'A1',
  slot2: 'A2',
  slot3: 'A3',
  slot4: 'B1',
  slot5: 'B2',
};

/**
 * Generate parking lot layout near a given GPS coordinate.
 * Creates a realistic parking grid ~200m from the user.
 *
 *   Layout:
 *        Road
 *   [A1]  [A2]  [A3]     ← Row A
 *        Road
 *   [B1]  [B2]           ← Row B
 *        Road
 *   [Entry]
 */
export function generateParkingLayout(userLat: number, userLng: number) {
  // Offset: ~0.001 degree ≈ 111 meters
  const baseLat = userLat + 0.0015; // parking lot ~170m north of user
  const baseLng = userLng + 0.0005;

  const entry = { latitude: baseLat - 0.0008, longitude: baseLng + 0.0003 };

  const slots: Record<string, { latitude: number; longitude: number }> = {
    slot1: { latitude: baseLat + 0.0004, longitude: baseLng - 0.0004 },
    slot2: { latitude: baseLat + 0.0004, longitude: baseLng + 0.0003 },
    slot3: { latitude: baseLat + 0.0004, longitude: baseLng + 0.0013 },
    slot4: { latitude: baseLat, longitude: baseLng - 0.0004 },
    slot5: { latitude: baseLat, longitude: baseLng + 0.0003 },
  };

  // Road network connecting all slots
  const roads = [
    // Horizontal road Row A (top)
    [
      { latitude: baseLat + 0.0006, longitude: baseLng - 0.0007 },
      { latitude: baseLat + 0.0006, longitude: baseLng + 0.0016 },
    ],
    // Horizontal road between Row A and Row B
    [
      { latitude: baseLat + 0.0002, longitude: baseLng - 0.0007 },
      { latitude: baseLat + 0.0002, longitude: baseLng + 0.0016 },
    ],
    // Horizontal road below Row B
    [
      { latitude: baseLat - 0.0002, longitude: baseLng - 0.0007 },
      { latitude: baseLat - 0.0002, longitude: baseLng + 0.0016 },
    ],
    // Vertical road left
    [
      { latitude: baseLat + 0.0006, longitude: baseLng - 0.0004 },
      { latitude: baseLat - 0.0002, longitude: baseLng - 0.0004 },
    ],
    // Vertical road center
    [
      { latitude: baseLat + 0.0006, longitude: baseLng + 0.0003 },
      { latitude: baseLat - 0.0008, longitude: baseLng + 0.0003 },
    ],
    // Vertical road right
    [
      { latitude: baseLat + 0.0006, longitude: baseLng + 0.0013 },
      { latitude: baseLat - 0.0002, longitude: baseLng + 0.0013 },
    ],
  ];

  return { entry, slots, roads };
}

/** Build a road-following route from entry to a specific slot */
export function buildRouteToSlot(
  entry: { latitude: number; longitude: number },
  slot: { latitude: number; longitude: number },
  baseLat: number,
  baseLng: number
) {
  // If the slot is exactly on the main vertical road (like slot2 or slot5),
  // just draw a straight line to it. No need to go to an intersection and double back!
  if (Math.abs(slot.longitude - entry.longitude) < 0.00001) {
    return [entry, slot];
  }

  // Route goes: Entry → up main road → turn at correct row → to slot
  const midRoadLat = baseLat + 0.0002; // horizontal road between rows
  const topRoadLat = baseLat + 0.0006; // top horizontal road

  const isTopRow = slot.latitude > baseLat + 0.0003;
  const targetRoadLat = isTopRow ? topRoadLat : midRoadLat;

  return [
    entry,
    // Go up the main vertical road
    { latitude: midRoadLat, longitude: entry.longitude },
    // If top row, continue up
    ...(isTopRow ? [{ latitude: topRoadLat, longitude: entry.longitude }] : []),
    // Turn toward the slot
    { latitude: targetRoadLat, longitude: slot.longitude },
    // Go down to the slot
    slot,
  ];
}
