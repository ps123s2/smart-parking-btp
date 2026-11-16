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
  booked_slots?: Record<string, any>;
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
  vehicleType?: string;
  addons?: string[];
  totalFare?: number;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  token: string;
  role: string;
  co2_saved: number;
}

export interface AIAllocationResponse {
  success: boolean;
  status: string;
  allocated_stall: string | null;
  allocated_label: string | null;
  allocation_source?: 'marl_gcn_neural_policy' | 'heuristic_fallback';
  model_confidence?: number | null;
  latency_ms?: number;
  top3_slots?: string[];
  ranked_slots?: Array<{ slot_id: string; label: string; score: number }>;
  is_fallback?: boolean;
  fallback_reason?: string | null;
  model_version?: string;
  message?: string;
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
export function generateParkingLayout(userLat?: number, userLng?: number) {
  // Official IIIT Sri City Campus Parking Facility (Safely inside the Petal Road grass island, zero road overlap)
  const entry = { latitude: 13.55593, longitude: 80.02740 }; // Parking Entrance (P)
  const slots: Record<string, { latitude: number; longitude: number }> = {
    slot1: { latitude: 13.55618, longitude: 80.02712 }, // A1 (Top row, west)
    slot2: { latitude: 13.55618, longitude: 80.02726 }, // A2 (Top row, center)
    slot3: { latitude: 13.55618, longitude: 80.02740 }, // A3 (Top row, east)
    slot4: { latitude: 13.55599, longitude: 80.02712 }, // B1 (Bottom row, west)
    slot5: { latitude: 13.55599, longitude: 80.02726 }, // B2 (Bottom row, center)
  };

  const roads = [
    // North Street approach to parking entrance
    [
      { latitude: 13.55581, longitude: 80.02670 },
      { latitude: 13.55581, longitude: 80.02700 },
      { latitude: 13.55582, longitude: 80.02740 },
    ],
    // Driveway entering parking lot at (P)
    [
      { latitude: 13.55582, longitude: 80.02740 },
      { latitude: 13.55593, longitude: 80.02740 },
    ],
    // Internal parking aisle between Row A and Row B
    [
      { latitude: 13.556085, longitude: 80.02740 },
      { latitude: 13.556085, longitude: 80.02708 },
    ],
  ];

  return { entry, slots, roads };
}

// Real campus road backbone matching OSM geometry around the campus field to Entrance (P)
export const IIIT_CAMPUS_ROAD_ROUTE = [
  // 1. Start on North Street near BH3
  { latitude: 13.55395, longitude: 80.02550 },
  { latitude: 13.55410, longitude: 80.02562 },
  { latitude: 13.55424, longitude: 80.02575 },
  // 2. Roundabout into southern North Street
  { latitude: 13.55432, longitude: 80.02585 },
  { latitude: 13.55424, longitude: 80.02598 },
  { latitude: 13.55412, longitude: 80.02612 },
  { latitude: 13.55398, longitude: 80.02626 },
  { latitude: 13.553863, longitude: 80.026357 },
  // 3. Straight east along south North Street
  { latitude: 13.553868, longitude: 80.027200 },
  { latitude: 13.553874, longitude: 80.028041 },
  // 4. Southeast corner curve
  { latitude: 13.553880, longitude: 80.028154 },
  { latitude: 13.553896, longitude: 80.028214 },
  { latitude: 13.553925, longitude: 80.028247 },
  { latitude: 13.553971, longitude: 80.028267 },
  { latitude: 13.554063, longitude: 80.028271 },
  // 5. East North Street heading North
  { latitude: 13.554500, longitude: 80.028265 },
  { latitude: 13.555000, longitude: 80.028260 },
  { latitude: 13.555585, longitude: 80.028254 },
  // 6. Northeast corner curve
  { latitude: 13.555686, longitude: 80.028246 },
  { latitude: 13.555735, longitude: 80.028224 },
  { latitude: 13.555799, longitude: 80.028147 },
  { latitude: 13.555819, longitude: 80.027988 },
  // 7. North Street heading west to parking lot
  { latitude: 13.555827, longitude: 80.027559 },
  { latitude: 13.555822, longitude: 80.027400 },
  // 8. Turn into Parking Entrance (P)
  { latitude: 13.555930, longitude: 80.027400 },
  // 9. Internal drive aisle
  { latitude: 13.556085, longitude: 80.027400 },
];

// Real campus road backbone from Academic Block & Petal Road West south to Entrance (P)
export const IIIT_ACADEMIC_ROAD_ROUTE = [
  { latitude: 13.55680, longitude: 80.02610 }, // Academic Block entrance
  { latitude: 13.55640, longitude: 80.02635 }, // Petal Road West
  { latitude: 13.55605, longitude: 80.02655 }, // Petal Road West approaching North Street
  { latitude: 13.55581, longitude: 80.02670 }, // Junction Petal Road West & North Street
  { latitude: 13.55581, longitude: 80.02700 }, // North Street
  { latitude: 13.555822, longitude: 80.027400 }, // North Street at Parking Entrance (P)
  { latitude: 13.555930, longitude: 80.027400 }, // Parking Entrance (P) arch
  { latitude: 13.556085, longitude: 80.027400 }, // Internal drive aisle
];

/**
 * Dynamically construct the exact road network route from user location to a parking stall.
 * Handles users at Academic Block, Hostels, North Street, or anywhere on campus.
 */
export function getDynamicCampusRoute(
  userPt: { latitude: number; longitude: number },
  slotCoord: { latitude: number; longitude: number }
): Array<{ latitude: number; longitude: number }> {
  const isIIIT = Math.abs(userPt.latitude - 13.555) < 0.15 && Math.abs(userPt.longitude - 80.026) < 0.15;

  if (isIIIT) {
    // Choose route branch based on user's position relative to North Street (13.5555)
    // Northern campus (Academic Block, Petal Rd West, North Street West) vs Southern campus (BH3, Hostels, South Rd)
    const baseRoute = userPt.latitude >= 13.5554 ? IIIT_ACADEMIC_ROAD_ROUTE : IIIT_CAMPUS_ROAD_ROUTE;

    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < baseRoute.length; i++) {
      const pt = baseRoute[i];
      const d = Math.hypot(pt.latitude - userPt.latitude, pt.longitude - userPt.longitude);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }

    return [
      userPt,
      ...baseRoute.slice(closestIdx),
      // Move down internal aisle to target slot's column
      { latitude: 13.556085, longitude: slotCoord.longitude },
      // Direct pull-in into stall
      slotCoord,
    ];
  }

  // Fallback if user is testing outside campus:
  return [
    userPt,
    { latitude: slotCoord.latitude - 0.0003, longitude: userPt.longitude },
    { latitude: slotCoord.latitude - 0.0003, longitude: slotCoord.longitude },
    slotCoord,
  ];
}

/** Build a real-road navigation route from entry to a specific slot */
export function buildRouteToSlot(
  entry: { latitude: number; longitude: number },
  slot: { latitude: number; longitude: number },
  baseLat?: number,
  baseLng?: number
) {
  // If navigating in IIIT Sri City parking facility:
  const isIIITSlot = Math.abs(slot.longitude - 80.027) < 0.02;

  if (isIIITSlot) {
    return [
      ...IIIT_CAMPUS_ROAD_ROUTE,
      // Move down internal aisle to slot's column
      { latitude: 13.556085, longitude: slot.longitude },
      // Direct pull-in into slot
      slot,
    ];
  }

  if (Math.abs(slot.longitude - entry.longitude) < 0.00001) {
    return [entry, slot];
  }

  const bLat = baseLat || entry.latitude;
  const midRoadLat = bLat + 0.0002;
  const topRoadLat = bLat + 0.0006;

  const isTopRow = slot.latitude > bLat + 0.0003;
  const targetRoadLat = isTopRow ? topRoadLat : midRoadLat;

  return [
    entry,
    { latitude: midRoadLat, longitude: entry.longitude },
    ...(isTopRow ? [{ latitude: topRoadLat, longitude: entry.longitude }] : []),
    { latitude: targetRoadLat, longitude: slot.longitude },
    slot,
  ];
}

/**
 * GNN shortest path distances in meters from parking entry (P) to each slot.
 * Matches Dijkstra values from smart_parking_ai/models/gnn.py:
 * - slot5 (B2): 35m  (closest, first stall off aisle)
 * - slot4 (B1): 55m  (second stall off aisle)
 * - slot2 (A2): 70m  (row A center)
 * - slot1 (A1): 85m  (row A west)
 * - slot3 (A3): 85m  (row A east)
 */
export const GNN_SLOT_DISTANCES: Record<string, number> = {
  slot1: 85,
  slot2: 70,
  slot3: 85,
  slot4: 55,
  slot5: 35,
};

/**
 * GNN graph shortest path node sequences from parking entry to each stall.
 * Directly corresponds to PARKING_GRAPH Dijkstra traversal from gnn.py.
 */
export const GNN_SLOT_PATHS: Record<string, string[]> = {
  slot1: ['entry', 'jct_main', 'jct_b2', 'jct_a', 'jct_a2', 'jct_a1', 'slot1'],
  slot2: ['entry', 'jct_main', 'jct_b2', 'jct_a', 'jct_a2', 'slot2'],
  slot3: ['entry', 'jct_main', 'jct_b2', 'jct_a', 'jct_a2', 'jct_a3', 'slot3'],
  slot4: ['entry', 'jct_main', 'jct_b2', 'jct_b1', 'slot4'],
  slot5: ['entry', 'jct_main', 'jct_b2', 'slot5'],
};

/** Calculate Haversine distance between two coordinates in meters */
export function calculateHaversineDistance(
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

/**
 * Calculate the real driving road distance from user to entry and into a slot.
 * Follows actual campus road waypoints (not Euclidean line) + GNN graph shortest path.
 */
export function getRealRoadDistanceToSlot(
  userLat: number,
  userLng: number,
  slotId: string,
  entryCoord?: { latitude: number; longitude: number }
): {
  roadDistanceToEntry: number;
  gnnDistanceToSlot: number;
  totalRealDistance: number;
} {
  const isIIIT = Math.abs(userLat - 13.555) < 0.15 && Math.abs(userLng - 80.026) < 0.15;
  const gnnDistanceToSlot = GNN_SLOT_DISTANCES[slotId] || 60;

  if (isIIIT) {
    const baseRoute = userLat >= 13.5554 ? IIIT_ACADEMIC_ROAD_ROUTE : IIIT_CAMPUS_ROAD_ROUTE;

    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < baseRoute.length; i++) {
      const pt = baseRoute[i];
      const d = calculateHaversineDistance(userLat, userLng, pt.latitude, pt.longitude);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }

    let roadDist = minDist;
    for (let i = closestIdx; i < baseRoute.length - 1; i++) {
      const p1 = baseRoute[i];
      const p2 = baseRoute[i + 1];
      roadDist += calculateHaversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    }

    const totalRealDistance = Math.round(roadDist + gnnDistanceToSlot);
    return {
      roadDistanceToEntry: Math.round(roadDist),
      gnnDistanceToSlot,
      totalRealDistance,
    };
  }

  // Fallback for custom user GPS locations
  const entry = entryCoord || { latitude: userLat + 0.0007, longitude: userLng + 0.0008 };
  const euclidean = calculateHaversineDistance(userLat, userLng, entry.latitude, entry.longitude);
  const roadDist = Math.round(euclidean * 1.32);
  const totalRealDistance = Math.round(roadDist + gnnDistanceToSlot);
  return {
    roadDistanceToEntry: roadDist,
    gnnDistanceToSlot,
    totalRealDistance,
  };
}

/**
 * Dynamic MARL + GNN + GRU composite scoring.
 * Mirrors exact logic from smart_parking_ai/models/marl.py:
 * score = marl_reward (+10 if free, -20 if occupied/booked)
 *       + gru_bonus (predicted_availability * confidence * 3.0)
 *       - gnn_distance_penalty (gnn_distance * 0.15)
 */
export function computeDynamicMARLScores(
  states: number[],
  bookedSlots: Record<string, any> = {},
  predictions?: Record<string, string>
): {
  bestSlot: string | null;
  top3: string[];
  scores: Record<string, number>;
  details: Record<string, { marlReward: number; gnnDist: number; gruBonus: number; finalScore: number }>;
} {
  const scores: Record<string, number> = {};
  const details: Record<string, any> = {};
  const distanceWeight = 0.15;
  const gruWeight = 3.0;

  for (let i = 0; i < states.length; i++) {
    const slotId = `slot${i + 1}`;
    const rawOccupied = states[i] === 1;
    const isBooked = bookedSlots[slotId]?.status === 'active';
    const isOccupied = rawOccupied || isBooked;

    // MARL reward
    const marlReward = isOccupied ? -20.0 : 10.0;

    // GNN distance
    const gnnDist = GNN_SLOT_DISTANCES[slotId] || 70;
    const distancePenalty = gnnDist * distanceWeight;

    // GRU availability bonus
    const predText = predictions?.[slotId] || '';
    let gruAvail = isOccupied ? 0.3 : 0.9;
    let gruConf = 0.85;
    if (predText.includes('Free')) {
      gruAvail = 0.95;
    } else if (predText.includes('Busy') || predText.includes('Occ')) {
      gruAvail = 0.2;
    }
    const gruBonus = gruAvail * gruConf * gruWeight;

    const finalScore = Math.round((marlReward + gruBonus - distancePenalty) * 100) / 100;
    scores[slotId] = finalScore;
    details[slotId] = {
      marlReward,
      gnnDist,
      gruBonus: Math.round(gruBonus * 100) / 100,
      finalScore,
    };
  }

  // Find candidate free slots sorted by highest score
  const freeCandidates = Object.entries(scores)
    .filter(([slotId]) => {
      const idx = parseInt(slotId.replace('slot', ''), 10) - 1;
      const isOccupied = states[idx] === 1 || bookedSlots[slotId]?.status === 'active';
      return !isOccupied;
    })
    .sort((a, b) => b[1] - a[1]);

  const bestSlot = freeCandidates.length > 0 ? freeCandidates[0][0] : null;
  const top3 = freeCandidates.slice(0, 3).map(([s]) => s);

  return {
    bestSlot,
    top3,
    scores,
    details,
  };
}
