/**
 * Converts DXF map offsets (in meters) to GPS coordinates
 * centered at the user's current location.
 */
import mapLayout from './mapLayout.json';

const M2DEG_LAT = 1.0 / 111111.0;

function m2degLng(lat: number) {
  return 1.0 / (111111.0 * Math.cos((lat * Math.PI) / 180));
}

export interface MapOverlay {
  roads: Array<Array<{ latitude: number; longitude: number }>>;
  roadContours: Array<Array<{ latitude: number; longitude: number }>>;
  buildings: Array<Array<{ latitude: number; longitude: number }>>;
}

/** Convert DXF meter offsets to GPS coordinates around a center point */
export function getMapOverlay(centerLat: number, centerLng: number): MapOverlay {
  const lngScale = m2degLng(centerLat);

  function toGps(pt: { dx: number; dy: number }) {
    return {
      latitude: centerLat + pt.dy * M2DEG_LAT,
      longitude: centerLng + pt.dx * lngScale,
    };
  }

  return {
    roads: (mapLayout.roads as any[]).map((road: any[]) => road.map(toGps)),
    roadContours: (mapLayout.roads_contours as any[]).map((road: any[]) => road.map(toGps)),
    buildings: (mapLayout.buildings as any[]).map((bldg: any[]) => bldg.map(toGps)),
  };
}
