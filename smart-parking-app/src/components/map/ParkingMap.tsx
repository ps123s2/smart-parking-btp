/**
 * Professional parking map with:
 * - Dynamic coordinates near user's GPS
 * - Visible road network between slots
 * - Professional slot markers with parking icons
 * - In-app route animation after booking
 * - All 5 slots clearly visible
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import MapView, { Marker, Polyline, Polygon, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { SlotInfo, ParkingData, buildRouteToSlot } from '../../types/parking';
import { colors, borderRadius, spacing, fontSize, fontWeight } from '../../config/theme';
import { getMapOverlay } from '../../config/mapOverlay';

interface ParkingLayout {
  entry: { latitude: number; longitude: number };
  slots: Record<string, { latitude: number; longitude: number }>;
  roads: Array<Array<{ latitude: number; longitude: number }>>;
}

interface ParkingMapProps {
  slots: SlotInfo[];
  parkingData: ParkingData | null;
  layout: ParkingLayout | null;
  userLocation: { latitude: number; longitude: number } | null;
  onMarkerPress?: (slot: SlotInfo) => void;
  navigatingTo?: SlotInfo | null;
  style?: any;
  compact?: boolean;
}

export function ParkingMap({
  slots,
  parkingData,
  layout,
  userLocation,
  onMarkerPress,
  navigatingTo,
  style,
  compact = false,
}: ParkingMapProps) {
  const mapRef = useRef<MapView>(null);

  const entry = layout?.entry;

  // Get DXF map overlay centered on parking area
  const overlay = useMemo(() => {
    if (!entry) return null;
    return getMapOverlay(entry.latitude, entry.longitude);
  }, [entry?.latitude, entry?.longitude]);

  // Build navigation route
  const navRoute =
    navigatingTo && entry && userLocation
      ? [
        userLocation,
        entry,
        ...buildRouteToSlot(
          entry,
          navigatingTo.coordinate,
          entry.latitude + 0.0008,
          entry.longitude - 0.0003
        ).slice(1),
      ]
      : [];

  // Fit map to parking area
  useEffect(() => {
    if (mapRef.current && layout && slots.length > 0) {
      const coords = [
        layout.entry,
        ...slots.map((s) => s.coordinate),
        ...(userLocation ? [userLocation] : []),
      ];
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 140, right: 80, bottom: 200, left: 80 },
          animated: true,
        });
      }, 500);
    }
  }, [slots.length, layout, userLocation]);

  // Zoom to navigation route
  useEffect(() => {
    if (mapRef.current && navRoute.length > 2) {
      mapRef.current.fitToCoordinates(navRoute, {
        edgePadding: { top: 140, right: 60, bottom: 260, left: 60 },
        animated: true,
      });
    }
  }, [navigatingTo?.id]);

  if (!layout || !entry) return null;

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: entry.latitude,
          longitude: entry.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        customMapStyle={nightMapStyle}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        showsBuildings={true}
        mapType="standard"
      >
        {/* Giant dark background polygon to act as the map base since Google Tiles fail without billing */}
        <Polygon
          coordinates={[
            { latitude: entry.latitude + 0.1, longitude: entry.longitude - 0.1 },
            { latitude: entry.latitude + 0.1, longitude: entry.longitude + 0.1 },
            { latitude: entry.latitude - 0.1, longitude: entry.longitude + 0.1 },
            { latitude: entry.latitude - 0.1, longitude: entry.longitude - 0.1 },
          ]}
          fillColor="#0f172a"
          strokeWidth={0}
          zIndex={-10}
        />
        {/* ═══════ DXF MAP OVERLAY — Buildings ═══════ */}
        {overlay?.buildings.map((bldg, i) => (
          <Polygon
            key={`bldg-${i}`}
            coordinates={bldg}
            fillColor="rgba(30, 41, 59, 0.4)"
            strokeColor="rgba(51, 65, 85, 0.5)"
            strokeWidth={1}
          />
        ))}

        {/* ═══════ DXF MAP OVERLAY — Road Contours ═══════ */}
        {overlay?.roadContours.map((road, i) => (
          <Polyline
            key={`dxf-road-${i}`}
            coordinates={road}
            strokeColor="rgba(51, 65, 85, 0.5)"
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
          />
        ))}

        {/* ═══════ DXF MAP OVERLAY — Road Center Lines ═══════ */}
        {overlay?.roads.map((road, i) => (
          <Polyline
            key={`dxf-axis-${i}`}
            coordinates={road}
            strokeColor="rgba(148, 163, 184, 0.2)"
            strokeWidth={1}
            lineCap="round"
            lineDashPattern={[6, 4]}
          />
        ))}

        {/* ═══════ ROAD NETWORK ═══════ */}
        {layout.roads.map((road, i) => (
          <React.Fragment key={`road-${i}`}>
            <Polyline
              coordinates={road}
              strokeColor="rgba(30, 41, 59, 0.8)"
              strokeWidth={10}
              lineCap="round"
            />
            <Polyline
              coordinates={road}
              strokeColor="rgba(51, 65, 85, 0.6)"
              strokeWidth={8}
              lineCap="round"
            />
            <Polyline
              coordinates={road}
              strokeColor="rgba(148, 163, 184, 0.2)"
              strokeWidth={1}
              lineCap="round"
              lineDashPattern={[6, 6]}
            />
          </React.Fragment>
        ))}

        {/* ═══════ NAVIGATION ROUTE ═══════ */}
        {navRoute.length > 2 && (
          <>
            {/* Route glow */}
            <Polyline
              coordinates={navRoute}
              strokeColor="rgba(41, 121, 255, 0.15)"
              strokeWidth={12}
              lineCap="round"
              lineJoin="round"
              zIndex={1}
            />
            {/* Route line */}
            <Polyline
              coordinates={navRoute}
              strokeColor="#2979FF"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
              zIndex={2}
            />
            {/* Route dots (animated feel) */}
            <Polyline
              coordinates={navRoute}
              strokeColor="rgba(255, 255, 255, 0.4)"
              strokeWidth={2}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={[4, 8]}
              zIndex={3}
            />
          </>
        )}

        {/* ═══════ DEFAULT ROUTE (when not navigating) ═══════ */}
        {!navigatingTo && slots.find((s) => s.isBest) && (
          (() => {
            const best = slots.find((s) => s.isBest)!;
            const route = buildRouteToSlot(
              entry,
              best.coordinate,
              entry.latitude + 0.0008,
              entry.longitude - 0.0003
            );
            return (
              <>
                <Polyline
                  coordinates={route}
                  strokeColor="rgba(41, 121, 255, 0.12)"
                  strokeWidth={10}
                  lineCap="round"
                  lineJoin="round"
                  zIndex={1}
                />
                <Polyline
                  coordinates={route}
                  strokeColor="rgba(41, 121, 255, 0.6)"
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                  lineDashPattern={[8, 4]}
                  zIndex={2}
                />
              </>
            );
          })()
        )}

        {/* ═══════ ENTRY MARKER ═══════ */}
        <EntryMarker entry={entry} />

        {/* ═══════ PARKING SLOT MARKERS ═══════ */}
        {slots.map((slot) => {
          return (
            <SmartMarker
              key={slot.id}
              slot={slot}
              navigatingTo={navigatingTo}
              onMarkerPress={onMarkerPress}
            />
          );
        })}
      </MapView>

      {/* LIVE badge */}
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>

      {/* Navigation active badge */}
      {navigatingTo && (
        <View style={styles.navBadge}>
          <Ionicons name="navigate" size={12} color="#2979FF" />
          <Text style={styles.navBadgeText}>Navigating to {navigatingTo.label}</Text>
        </View>
      )}

      {/* Legend */}
      {!compact && (
        <View style={styles.legend}>
          <LegendDot color="#00C853" label="Free" />
          <LegendDot color="#FF5252" label="Taken" />
          <LegendDot color="#2979FF" label="Best" />
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: borderRadius.xl, overflow: 'hidden', backgroundColor: '#1a1f2e' },
  map: { width: '100%', height: '100%', minHeight: 300 },

  // Perfect SVG-based markers
  markerContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  absoluteCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  markerText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  starBadge: {
    position: 'absolute',
    top: -4, left: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#2979FF',
    borderWidth: 1.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  starText: { color: '#fff', fontSize: 8, fontWeight: '900', marginTop: -1 },

  // Badges
  liveBadge: { position: 'absolute', top: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10,13,20,0.9)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, gap: 4, borderWidth: 1, borderColor: 'rgba(244,67,54,0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F44336' },
  liveText: { color: '#F44336', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  navBadge: { position: 'absolute', top: spacing.md, left: spacing.md, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10,13,20,0.9)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, gap: 4, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)' },
  navBadgeText: { color: '#2979FF', fontSize: 10, fontWeight: '700' },

  // Legend
  legend: { position: 'absolute', bottom: spacing.md, left: spacing.md, flexDirection: 'row', backgroundColor: 'rgba(10,13,20,0.9)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: '#ccc', fontSize: 9, fontWeight: '600' },
});

/** Smart Entry Marker to prevent layout blinking */
function EntryMarker({ entry }: { entry: any }) {
  const [track, setTrack] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTrack(false), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Marker coordinate={entry} anchor={{ x: 0.5, y: 0.5 }} title="Parking Entry" zIndex={10} tracksViewChanges={track}>
      <View style={styles.markerContainer}>
        <Svg width="36" height="36" viewBox="0 0 36 36">
          <Circle cx="18" cy="18" r="16" fill="#2979FF" stroke="#ffffff" strokeWidth="2" />
        </Svg>
        <View style={styles.absoluteCenter}>
          <Text style={styles.markerText}>P</Text>
        </View>
      </View>
    </Marker>
  );
}

/** Smart Slot Marker handles tracksViewChanges automatically to prevent Android blinking */
function SmartMarker({ slot, navigatingTo, onMarkerPress }: { slot: SlotInfo; navigatingTo: SlotInfo | null | undefined; onMarkerPress?: (slot: SlotInfo) => void }) {
  const [track, setTrack] = useState(true);
  const isAvail = !slot.occupied;
  const isBest = slot.isBest;
  const isNav = navigatingTo?.id === slot.id;

  // Whenever the visual state changes, briefly turn on tracking to capture the new layout, then disable it
  useEffect(() => {
    setTrack(true);
    const timer = setTimeout(() => setTrack(false), 500);
    return () => clearTimeout(timer);
  }, [slot.occupied, isBest, isNav]);

  let fillColor = '#10893E'; // Free
  if (slot.occupied) fillColor = '#FF5252';
  if (isBest) fillColor = '#2979FF';

  return (
    <Marker
      coordinate={slot.coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={() => onMarkerPress?.(slot)}
      title={`Slot ${slot.label}`}
      description={isBest ? 'AI Recommended' : isAvail ? 'Available' : 'Occupied'}
      zIndex={isBest || isNav ? 15 : 10}
      tracksViewChanges={track}
    >
      <View style={styles.markerContainer}>
        <Svg width="36" height="36" viewBox="0 0 36 36">
          <Circle cx="18" cy="18" r="16" fill={fillColor} stroke="#ffffff" strokeWidth="2" />
        </Svg>

        <View style={styles.absoluteCenter}>
          <Text style={styles.markerText}>{slot.label}</Text>
        </View>

        {isBest && (
          <View style={styles.starBadge}>
            <Text style={styles.starText}>★</Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

/** Night style — deep slate blue to match mockup */
const nightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020617' }] },
];
