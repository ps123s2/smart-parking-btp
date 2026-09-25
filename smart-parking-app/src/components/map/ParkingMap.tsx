/**
 * Professional parking map using Leaflet.js via WebView.
 * This completely bypasses the Google Maps SDK requirement,
 * using free OpenStreetMap tiles rendered through a browser context.
 *
 * Features:
 * - Dark themed CartoDB tiles (free, no API key)
 * - Parking slot markers with color coding (green/red/blue)
 * - Road network overlay
 * - Navigation route animation
 * - DXF building overlays
 * - Entry marker
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { SlotInfo, ParkingData, buildRouteToSlot } from '../../types/parking';
import { colors, borderRadius, spacing } from '../../config/theme';
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
  const webRef = useRef<WebView>(null);

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

  // Build default route to best slot
  const defaultRoute = useMemo(() => {
    if (navigatingTo || !entry) return [];
    const best = slots.find((s) => s.isBest);
    if (!best) return [];
    return buildRouteToSlot(
      entry,
      best.coordinate,
      entry.latitude + 0.0008,
      entry.longitude - 0.0003
    );
  }, [slots, entry, navigatingTo]);

  // Update markers/routes when data changes
  useEffect(() => {
    if (!webRef.current || !entry) return;
    const updateData = {
      type: 'update',
      slots: slots.map(s => ({
        id: s.id,
        label: s.label,
        lat: s.coordinate.latitude,
        lng: s.coordinate.longitude,
        occupied: s.occupied,
        isBest: s.isBest,
        isTop3: s.isTop3,
        prediction: s.prediction,
      })),
      entry: { lat: entry.latitude, lng: entry.longitude },
      roads: layout?.roads.map(road => road.map(p => [p.latitude, p.longitude])) || [],
      navRoute: navRoute.map(p => [p.latitude, p.longitude]),
      defaultRoute: defaultRoute.map(p => [p.latitude, p.longitude]),
      overlay: overlay ? {
        buildings: overlay.buildings.map(b => b.map(p => [p.latitude, p.longitude])),
        roads: overlay.roads.map(r => r.map(p => [p.latitude, p.longitude])),
        roadContours: overlay.roadContours.map(r => r.map(p => [p.latitude, p.longitude])),
      } : null,
      userLocation: userLocation ? [userLocation.latitude, userLocation.longitude] : null,
      navigatingToId: navigatingTo?.id || null,
    };
    webRef.current.injectJavaScript(`
      if (window.updateMap) window.updateMap(${JSON.stringify(updateData)});
      true;
    `);
  }, [slots, entry, navRoute.length, defaultRoute.length, navigatingTo?.id, overlay]);

  if (!layout || !entry) return null;

  const leafletHtml = generateLeafletHTML(entry);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        source={{ html: leafletHtml }}
        style={styles.map}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'markerPress' && onMarkerPress) {
              const slot = slots.find(s => s.id === data.slotId);
              if (slot) onMarkerPress(slot);
            }
          } catch (e) {}
        }}
      />

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

function generateLeafletHTML(entry: { latitude: number; longitude: number }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: #0f172a; }
    .slot-marker {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 50%;
      border: 2px solid #fff; color: #fff;
      font-weight: 900; font-size: 12px; font-family: -apple-system, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      cursor: pointer; text-align: center; line-height: 28px;
    }
    .slot-marker.best { position: relative; }
    .slot-marker.best::after {
      content: '★'; position: absolute; top: -6px; left: -6px;
      width: 14px; height: 14px; border-radius: 50%;
      background: #2979FF; border: 1.5px solid #fff;
      font-size: 7px; line-height: 14px; text-align: center;
    }
    .entry-marker {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 50%;
      background: #2979FF; border: 2px solid #fff; color: #fff;
      font-weight: 900; font-size: 14px; font-family: -apple-system, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      text-align: center; line-height: 28px;
    }
    .user-marker {
      width: 16px; height: 16px; border-radius: 50%;
      background: #4285F4; border: 3px solid #fff;
      box-shadow: 0 0 12px rgba(66,133,244,0.6);
    }
    .leaflet-tile-pane { opacity: 1; }
    .leaflet-control-attribution { display: none !important; }
    .leaflet-control-zoom { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [${entry.latitude}, ${entry.longitude}],
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    // Layer groups for dynamic updates
    var slotMarkers = L.layerGroup().addTo(map);
    var roadLayers = L.layerGroup().addTo(map);
    var overlayLayers = L.layerGroup().addTo(map);
    var routeLayers = L.layerGroup().addTo(map);
    var entryMarker = null;
    var userMarker = null;

    window.updateMap = function(data) {
      // Clear dynamic layers
      slotMarkers.clearLayers();
      roadLayers.clearLayers();
      overlayLayers.clearLayers();
      routeLayers.clearLayers();

      // DXF Overlay - Buildings
      if (data.overlay) {
        data.overlay.buildings.forEach(function(bldg) {
          L.polygon(bldg, {
            fillColor: 'rgba(30, 41, 59, 0.4)',
            color: 'rgba(51, 65, 85, 0.5)',
            weight: 1,
            fillOpacity: 0.4,
          }).addTo(overlayLayers);
        });
        // DXF Roads
        data.overlay.roadContours.forEach(function(road) {
          L.polyline(road, { color: 'rgba(51, 65, 85, 0.5)', weight: 2 }).addTo(overlayLayers);
        });
        data.overlay.roads.forEach(function(road) {
          L.polyline(road, { color: 'rgba(148, 163, 184, 0.2)', weight: 1, dashArray: '6 4' }).addTo(overlayLayers);
        });
      }

      // Road network
      data.roads.forEach(function(road) {
        L.polyline(road, { color: 'rgba(30, 41, 59, 0.8)', weight: 10, lineCap: 'round' }).addTo(roadLayers);
        L.polyline(road, { color: 'rgba(51, 65, 85, 0.6)', weight: 8, lineCap: 'round' }).addTo(roadLayers);
        L.polyline(road, { color: 'rgba(148, 163, 184, 0.2)', weight: 1, dashArray: '6 6' }).addTo(roadLayers);
      });

      // Navigation route
      if (data.navRoute && data.navRoute.length > 2) {
        L.polyline(data.navRoute, { color: 'rgba(41, 121, 255, 0.15)', weight: 12, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayers);
        L.polyline(data.navRoute, { color: '#2979FF', weight: 5, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayers);
        L.polyline(data.navRoute, { color: 'rgba(255, 255, 255, 0.4)', weight: 2, dashArray: '4 8' }).addTo(routeLayers);
      }

      // Default route to best slot
      if (data.defaultRoute && data.defaultRoute.length > 1 && !data.navigatingToId) {
        L.polyline(data.defaultRoute, { color: 'rgba(41, 121, 255, 0.12)', weight: 10, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayers);
        L.polyline(data.defaultRoute, { color: 'rgba(41, 121, 255, 0.6)', weight: 4, dashArray: '8 4' }).addTo(routeLayers);
      }

      // Entry marker
      if (data.entry) {
        if (entryMarker) map.removeLayer(entryMarker);
        var entryIcon = L.divIcon({
          className: '',
          html: '<div class="entry-marker">P</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        entryMarker = L.marker([data.entry.lat, data.entry.lng], { icon: entryIcon, zIndexOffset: 1000 }).addTo(map);
      }

      // Slot markers
      data.slots.forEach(function(slot) {
        var fillColor = '#10893E';
        if (slot.occupied) fillColor = '#FF5252';
        if (slot.isBest) fillColor = '#2979FF';

        var bestClass = slot.isBest ? ' best' : '';
        var icon = L.divIcon({
          className: '',
          html: '<div class="slot-marker' + bestClass + '" style="background:' + fillColor + '">' + slot.label + '</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        var marker = L.marker([slot.lat, slot.lng], { icon: icon, zIndexOffset: slot.isBest ? 1500 : 500 }).addTo(slotMarkers);
        marker.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerPress', slotId: slot.id }));
        });

        var desc = slot.isBest ? 'AI Recommended' : (slot.occupied ? 'Occupied' : 'Available');
        marker.bindPopup('<b>Slot ' + slot.label + '</b><br/>' + desc);
      });

      // User location
      if (data.userLocation) {
        if (userMarker) map.removeLayer(userMarker);
        var userIcon = L.divIcon({
          className: '',
          html: '<div class="user-marker"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        userMarker = L.marker(data.userLocation, { icon: userIcon, zIndexOffset: 2000 }).addTo(map);
      }
    };
  </script>
</body>
</html>
`;
}

const styles = StyleSheet.create({
  container: { borderRadius: borderRadius.xl, overflow: 'hidden', backgroundColor: '#0f172a' },
  map: { width: '100%', height: '100%', minHeight: 300, backgroundColor: '#0f172a' },

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
