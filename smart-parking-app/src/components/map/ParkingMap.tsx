/**
 * Professional Smart Parking Map for Mobile using Mapbox GL.
 * 
 * - 60 FPS vector tile rendering with WebGL hardware acceleration
 * - Clean 3D parking lot asphalt pad with white stall lines and perimeter greenery
 * - Authentic Google Maps navigation route styling (electric cyan/blue with shadow)
 * - Automatic zoom clustering to prevent slot markers from overlapping when zoomed out
 * - Smooth camera transitions (recenter on user or parking entrance, fit route overview)
 */

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { SlotInfo, ParkingData, buildRouteToSlot, getDynamicCampusRoute } from '../../types/parking';
import { colors, borderRadius, spacing } from '../../config/theme';

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
  selectedSlot?: SlotInfo | null;
  style?: any;
  compact?: boolean;
  whiteWashBackground?: boolean;
  hideControls?: boolean;
  distanceMeters?: number;
  routeColor?: string;
  recenterTrigger?: number;
  overviewTrigger?: number;
  zoomInTrigger?: number;
  zoomOutTrigger?: number;
}

export function ParkingMap({
  slots,
  parkingData,
  layout,
  userLocation,
  onMarkerPress,
  navigatingTo,
  selectedSlot,
  style,
  compact = false,
  whiteWashBackground = false,
  hideControls = false,
  distanceMeters,
  recenterTrigger,
  overviewTrigger,
  zoomInTrigger,
  zoomOutTrigger,
}: ParkingMapProps) {
  const webRef = useRef<WebView>(null);
  const isMapReady = useRef(false);

  const entry = layout?.entry;

  // Build dynamic navigation route along real roads through Parking Entrance (P)
  const navRoute = useMemo(() => {
    if (!entry) return [];
    if (!navigatingTo) return [];
    const userPt = userLocation || { latitude: 13.55395, longitude: 80.02550 };
    return getDynamicCampusRoute(userPt, navigatingTo.coordinate);
  }, [navigatingTo, entry, userLocation]);

  // Serialized data payload for the map
  const getMapData = useCallback(() => {
    if (!entry) return null;
    const isWhiteWashed = compact || whiteWashBackground;
    const slotsToRender = isWhiteWashed
      ? (navigatingTo ? slots.filter((s) => s.id === navigatingTo.id) : slots.filter((s) => s.isBest).slice(0, 1))
      : slots;

    const calculatedDist = distanceMeters ?? (userLocation && entry ? Math.round(Math.hypot((userLocation.latitude - entry.latitude) * 111111, (userLocation.longitude - entry.longitude) * 111111)) : 0);

    return {
      type: 'update',
      slots: slotsToRender.map((s) => ({
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
      navRoute: navRoute.map((p) => [p.latitude, p.longitude]),
      userLocation: userLocation ? [userLocation.latitude, userLocation.longitude] : null,
      navigatingToId: navigatingTo?.id || null,
      selectedSlotId: selectedSlot?.id || null,
      distanceMeters: calculatedDist,
      isWhiteWashed: isWhiteWashed,
    };
  }, [slots, entry, navRoute, userLocation, navigatingTo?.id, selectedSlot?.id, distanceMeters, compact, whiteWashBackground]);

  // Push updates to WebView
  const lastPayloadRef = useRef('');
  const syncMap = useCallback(() => {
    if (!webRef.current || !entry) return;
    const data = getMapData();
    if (!data) return;
    const jsonStr = JSON.stringify(data);
    if (jsonStr === lastPayloadRef.current) return;
    lastPayloadRef.current = jsonStr;

    webRef.current.injectJavaScript(`
      if (window.updateMap) {
        window.updateMap(${jsonStr});
      }
      true;
    `);
  }, [entry, getMapData]);

  // Keep map synchronized with react state
  useEffect(() => {
    syncMap();
  }, [syncMap]);

  // Handle external Re-center triggers from MapScreen
  useEffect(() => {
    if (recenterTrigger && webRef.current) {
      webRef.current.injectJavaScript(`
        if (window.recenterMap) {
          window.recenterMap();
        }
        true;
      `);
    }
  }, [recenterTrigger]);

  // Handle external Overview triggers from MapScreen
  useEffect(() => {
    if (overviewTrigger && webRef.current) {
      webRef.current.injectJavaScript(`
        if (window.overviewMap) {
          window.overviewMap();
        }
        true;
      `);
    }
  }, [overviewTrigger]);

  // Handle external Zoom In triggers
  useEffect(() => {
    if (zoomInTrigger && webRef.current) {
      webRef.current.injectJavaScript(`
        if (window.map) {
          window.map.zoomIn();
        }
        true;
      `);
    }
  }, [zoomInTrigger]);

  // Handle external Zoom Out triggers
  useEffect(() => {
    if (zoomOutTrigger && webRef.current) {
      webRef.current.injectJavaScript(`
        if (window.map) {
          window.map.zoomOut();
        }
        true;
      `);
    }
  }, [zoomOutTrigger]);

  const mapHtml = useMemo(() => {
    if (!entry) return '';
    return generateMapHTML(entry);
  }, [entry?.latitude, entry?.longitude]);

  const webViewSource = useMemo(() => ({
    html: mapHtml,
    baseUrl: 'https://tiles.openfreemap.org',
  }), [mapHtml]);

  if (!layout || !entry) return null;

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        source={webViewSource}
        style={styles.map}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        androidLayerType="hardware"
        originWhitelist={['*']}
        onLoadEnd={() => {
          lastPayloadRef.current = '';
          syncMap();
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'mapReady') {
              isMapReady.current = true;
              lastPayloadRef.current = '';
              syncMap();
            } else if (data.type === 'markerPress' && onMarkerPress) {
              const slot = slots.find((s) => s.id === data.slotId);
              if (slot) onMarkerPress(slot);
            }
          } catch (e) {}
        }}
      />

      {/* LIVE badge (Only on full map screen, hidden on homepage) */}
      {!compact && !hideControls && (
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}

      {/* Navigation active badge (Only on full map screen, hidden on homepage) */}
      {!compact && !hideControls && navigatingTo && (
        <View style={styles.navBadge}>
          <Ionicons name="navigate" size={12} color="#1A73E8" />
          <Text style={styles.navBadgeText}>Navigating to {navigatingTo.label}</Text>
        </View>
      )}

      {/* Legend */}
      {!compact && (
        <View style={styles.legend}>
          <LegendDot color="#10893E" label="Free" />
          <LegendDot color="#FF5252" label="Taken" />
          <LegendDot color="#2563EB" label="Best" />
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

function generateMapHTML(
  entry: { latitude: number; longitude: number }
) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0f172a; overflow: hidden; }
    .mapboxgl-map, .mapboxgl-canvas-container, .mapboxgl-canvas {
      width: 100% !important;
      height: 100% !important;
    }
    
    .slot-marker {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 50%;
      border: 2.5px solid #ffffff; color: #ffffff;
      font-weight: 900; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 6px 16px rgba(0,0,0,0.65);
      cursor: pointer; text-align: center; line-height: 28px;
      user-select: none;
    }
    .slot-marker.best {
      background-color: #2563EB;
      box-shadow: 0 6px 16px rgba(0,0,0,0.65);
    }
    .slot-star-icon {
      font-size: 10px;
      margin-right: 2px;
      display: inline-block;
      vertical-align: middle;
      line-height: 1;
    }
    .slot-marker.selected-target {
      opacity: 1 !important;
      border: 3.5px solid #ffffff !important;
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.65) !important;
      z-index: 999 !important;
    }
    .slot-marker.dimmed-slot {
      opacity: 0.35 !important;
    }

    .entry-marker-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .entry-marker-pill {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #2563EB;
      border: 2.5px solid #ffffff;
      color: #ffffff;
      font-weight: 900;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      box-shadow: 0 4px 14px rgba(37,99,235,0.7);
      text-align: center;
    }
    .entry-label-tag {
      background: #2563EB;
      color: #ffffff;
      padding: 5px 12px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      box-shadow: 0 4px 14px rgba(37,99,235,0.6);
      white-space: nowrap;
    }

    .user-marker {
      width: 22px; height: 22px; border-radius: 50%;
      background: #1A73E8; border: 3.5px solid #ffffff;
      box-shadow: 0 4px 16px rgba(26,115,232,0.8);
      position: relative;
    }
    .user-marker::before {
      content: '';
      position: absolute;
      top: -10px; left: -10px; right: -10px; bottom: -10px;
      border-radius: 50%;
      background: rgba(26,115,232,0.25);
      animation: pulse 2s infinite ease-out;
    }
    @keyframes pulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.8); opacity: 0; }
    }

    /* User Marker for Home page (solid jet black disc with white center dot and subtle pulse) */
    .user-marker-home {
      width: 22px; height: 22px; border-radius: 50%;
      background: #0B0F19; border: 3.5px solid #ffffff;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      position: relative;
      display: flex; align-items: center; justify-content: center;
      box-sizing: border-box;
      user-select: none;
      z-index: 500 !important;
    }
    .user-marker-home::after {
      content: '';
      width: 6px; height: 6px; border-radius: 50%;
      background: #ffffff;
    }
    .user-marker-home::before {
      content: '';
      position: absolute;
      top: -10px; left: -10px; right: -10px; bottom: -10px;
      border-radius: 50%;
      background: rgba(11,15,25,0.25);
      animation: homePulse 2s infinite ease-out;
    }
    @keyframes homePulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.9); opacity: 0; }
    }

    /* Dynamic Route Distance Badge */
    .map-distance-capsule {
      display: flex;
      align-items: center;
      gap: 3px;
      background: #FFFFFF;
      padding: 5px 12px;
      border-radius: 9999px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
      border: 1.5px solid rgba(0, 0, 0, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      white-space: nowrap;
    }
    .map-distance-val {
      color: #0B0F19;
      font-size: 13px;
      font-weight: 900;
    }
    .map-distance-unit {
      color: #64748B;
      font-size: 10px;
      font-weight: 600;
    }
    .map-distance-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #0B0F19;
      margin-right: 2px;
    }

    /* 3D Ground Destination Slot Target */
    .slot-destination-ground-target {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      z-index: 998 !important;
    }
    .slot-ground-disc {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
      border: 2px solid #FFFFFF;
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.45), 0 8px 20px rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-weight: 900;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      letter-spacing: -0.2px;
      text-align: center;
      position: relative;
      z-index: 2;
    }
    .slot-ground-ripple {
      position: absolute;
      top: -8px; left: -8px; right: -8px; bottom: -8px;
      border-radius: 50%;
      border: 2px solid rgba(220, 38, 38, 0.85);
      background: rgba(220, 38, 38, 0.2);
      animation: groundTargetWave 2s infinite ease-out;
      pointer-events: none;
      z-index: 1;
    }
    @keyframes groundTargetWave {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.7); opacity: 0; }
    }

    .red-destination-pin-wrapper {
      cursor: pointer;
      user-select: none;
      z-index: 1000 !important;
      width: 38px;
      height: 56px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      overflow: visible;
    }
    .red-destination-pin-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      transform-origin: 50% 100%;
    }
    .red-destination-pin-badge {
      margin-bottom: 2px;
      background: #FFFFFF;
      color: #0F172A;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 900;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 9999px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border: 1.5px solid rgba(0, 0, 0, 0.12);
      white-space: nowrap;
      z-index: 2;
    }
    .red-destination-pin-svg-wrap {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      width: 34px;
      height: 42px;
    }
    .red-destination-pin-svg-wrap svg {
      display: block;
      filter: drop-shadow(0 4px 12px rgba(220, 38, 38, 0.55));
    }
    .red-destination-ground-pulse {
      position: absolute;
      bottom: -3px;
      left: 50%;
      width: 20px;
      height: 10px;
      margin-left: -10px;
      border-radius: 50%;
      background: rgba(220, 38, 38, 0.55);
      animation: groundPulse 2s infinite ease-out;
      pointer-events: none;
    }
    @keyframes groundPulse {
      0% { transform: scale(0.5); opacity: 0.9; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    .mapboxgl-ctrl-bottom-right, .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-attrib {
      display: none !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    function postMsg(data) {
      try {
        var str = JSON.stringify(data);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(str);
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage(str, '*');
        }
      } catch (err) {}
    }

    mapboxgl.accessToken = '${process.env.EXPO_PUBLIC_MAPBOX_TOKEN || ''}';

    var map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/standard',
      center: [80.02685, 13.55490],
      zoom: 16.7,
      pitch: 52,
      bearing: -42,
      antialias: true,
      attributionControl: false
    });
    window.map = map;

    map.on('style.load', function() {
      try {
        map.setConfigProperty('basemap', 'lightPreset', 'day');
        map.setConfigProperty('basemap', 'showPlaceLabels', true);
        map.setConfigProperty('basemap', 'showPointOfInterestLabels', true);
        map.setConfigProperty('basemap', 'showTransitLabels', false);
      } catch (e) {}
    });

    var currentMarkers = [];
    var entryMarker = null;
    var userMarker = null;
    var distanceMarker = null;
    var isMapLoaded = false;
    var pendingUpdate = null;
    var latestUserLocation = null;
    var latestNavRoute = null;
    var currentNavigatingToId = null;
    var currentSelectedSlotId = null;

    // Zoom responsiveness: dynamically declutter markers when zoomed out to prevent clumping
    // When zoomed out (zoom < 17.5, campus view), ONLY the active destination/selected slot is shown.
    // When zooming in close (zoom >= 17.5), all parking slots appear cleanly in their respective stalls.
    // NOTE: NEVER modify el.style.transform as that destroys Mapbox's 3D ground projection matrix!
    function updateMarkerVisibility() {
      var z = map.getZoom();
      var isOverview = z < 17.5;
      var markers = document.querySelectorAll('.slot-marker, .slot-destination-ground-target');
      var activeTargetId = currentNavigatingToId || currentSelectedSlotId || null;

      markers.forEach(function(el) {
        var slotId = el.getAttribute('data-slot-id');
        var isBest = el.classList.contains('best');
        var isTarget = activeTargetId ? (slotId === activeTargetId) : isBest;

        if (isOverview) {
          el.style.display = isTarget ? 'flex' : 'none';
        } else {
          el.style.display = 'flex';
        }
      });
    }

    map.on('zoom', updateMarkerVisibility);

    // Auto-resize handlers to guarantee WebGL canvas fills 100% of container on all screen resizes/rotations
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function() {
        if (map) map.resize();
      });
      ro.observe(document.getElementById('map'));
    }
    window.addEventListener('resize', function() {
      if (map) map.resize();
    });
    window.addEventListener('orientationchange', function() {
      if (map) map.resize();
    });
    [50, 150, 300, 600, 1000].forEach(function(d) {
      setTimeout(function() { if (map) map.resize(); }, d);
    });

    // Smooth camera control API callable from React Native
    window.recenterMap = function() {
      if (!map) return;
      if (latestUserLocation) {
        map.flyTo({
          center: [latestUserLocation[1], latestUserLocation[0]],
          zoom: 16.8,
          pitch: 52,
          bearing: -42,
          duration: 900,
          essential: true
        });
      } else {
        map.flyTo({
          center: [80.02685, 13.55490],
          zoom: 16.7,
          pitch: 52,
          bearing: -42,
          duration: 900,
          essential: true
        });
      }
    };

    window.overviewMap = function() {
      if (!map) return;
      if (latestNavRoute && latestNavRoute.length > 1) {
        var bounds = new mapboxgl.LngLatBounds();
        latestNavRoute.forEach(function(pt) { bounds.extend([pt[1], pt[0]]); });
        map.fitBounds(bounds, {
          padding: { top: 120, bottom: 200, left: 50, right: 50 },
          pitch: 42,
          bearing: -38,
          duration: 900,
          essential: true
        });
      } else if (latestUserLocation) {
        var bounds2 = new mapboxgl.LngLatBounds();
        bounds2.extend([latestUserLocation[1], latestUserLocation[0]]);
        bounds2.extend([80.02740, 13.55593]);
        map.fitBounds(bounds2, {
          padding: { top: 120, bottom: 200, left: 50, right: 50 },
          pitch: 42,
          bearing: -38,
          duration: 900,
          essential: true
        });
      }
    };

    map.on('load', function() {
      isMapLoaded = true;

      // 0. Translucent White Wash GeoJSON Canvas (covers whole globe, gives clean high-contrast look on Home page)
      map.addSource('map-white-wash', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-180, -85.05],
              [180, -85.05],
              [180, 85.05],
              [-180, 85.05],
              [-180, -85.05],
            ]],
          },
        },
      });
      map.addLayer({
        id: 'map-white-wash-layer',
        type: 'fill',
        source: 'map-white-wash',
        slot: 'top',
        paint: {
          'fill-color': '#FFFFFF',
          'fill-opacity': 0,
        },
      });

      // 1. Parking Plaza Ground Pad (Dark Asphalt nested cleanly inside the grass loop)
      map.addSource('parking-lot-pad', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [80.02705, 13.55627],
              [80.02747, 13.55627],
              [80.02747, 13.55590],
              [80.02705, 13.55590],
              [80.02705, 13.55627],
            ]],
          },
        },
      });
      map.addLayer({
        id: 'parking-lot-pad-fill',
        type: 'fill',
        source: 'parking-lot-pad',
        slot: 'top',
        paint: {
          'fill-color': '#232734',
          'fill-opacity': 0.95,
        },
      });
      map.addLayer({
        id: 'parking-lot-pad-border',
        type: 'line',
        source: 'parking-lot-pad',
        slot: 'top',
        paint: {
          'line-color': '#cbd5e1',
          'line-width': 3,
        },
      });

      // 2. Parking Stall Divider Stripes
      map.addSource('parking-stalls', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'LineString', coordinates: [[80.02705, 13.556085], [80.02747, 13.556085]] } },
            { type: 'Feature', geometry: { type: 'LineString', coordinates: [[80.02719, 13.55627], [80.02719, 13.55590]] } },
            { type: 'Feature', geometry: { type: 'LineString', coordinates: [[80.02733, 13.55627], [80.02733, 13.55590]] } },
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [80.02733, 13.55595],
                  [80.02737, 13.55602],
                  [80.02743, 13.55602],
                  [80.02747, 13.55595],
                ],
              },
            },
          ],
        },
      });
      map.addLayer({
        id: 'parking-stalls-lines',
        type: 'line',
        source: 'parking-stalls',
        slot: 'top',
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.75)',
          'line-width': 2.5,
        },
      });

      // 3. Perimeter Trees / Greenery
      map.addSource('parking-trees', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [80.02712, 13.55632] } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [80.02726, 13.55632] } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [80.02740, 13.55632] } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [80.02700, 13.55618] } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [80.02700, 13.55599] } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [80.02752, 13.55618] } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [80.02752, 13.55599] } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [80.02712, 13.55586] } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [80.02726, 13.55586] } },
          ],
        },
      });
      map.addLayer({
        id: 'parking-trees-circle',
        type: 'circle',
        source: 'parking-trees',
        slot: 'top',
        paint: {
          'circle-color': '#22c55e',
          'circle-radius': 4.5,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#166534',
        },
      });

      // 4. Real Road Navigation Route layers
      map.addSource('nav-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      // Layer 1: Ambient Drop Shadow
      map.addLayer({
        id: 'nav-route-shadow',
        type: 'line',
        source: 'nav-route',
        slot: 'top',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': 'rgba(0, 0, 0, 0.35)', 'line-width': 10, 'line-blur': 3 }
      });
      // Layer 2: Deep Casing Outline
      map.addLayer({
        id: 'nav-route-casing',
        type: 'line',
        source: 'nav-route',
        slot: 'top',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0B0F19', 'line-width': 7 }
      });
      // Layer 3: Route Core Line
      map.addLayer({
        id: 'nav-route-line',
        type: 'line',
        source: 'nav-route',
        slot: 'top',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0B0F19', 'line-width': 5 }
      });

      if (pendingUpdate) {
        window.updateMap(pendingUpdate);
      }

      postMsg({ type: 'mapReady' });
    });

    map.on('error', function(err) {
      console.warn('Mapbox notice:', err);
    });

    window.updateMap = function(data) {
      if (!data) return;
      if (!isMapLoaded) {
        pendingUpdate = data;
        return;
      }

      latestUserLocation = data.userLocation;
      latestNavRoute = data.navRoute;
      var isWhiteWashed = !!data.isWhiteWashed;

      // 0. Update White Wash Layer opacity
      var wwLayer = map.getLayer('map-white-wash-layer');
      if (wwLayer) {
        map.setPaintProperty('map-white-wash-layer', 'fill-opacity', isWhiteWashed ? 0.58 : 0);
      }

      // 1. Dynamic route styling: Solid black (#0B0F19) on Home page, Electric Blue (#1A73E8) on MapScreen
      if (map.getLayer('nav-route-line')) {
        map.setPaintProperty('nav-route-line', 'line-color', isWhiteWashed ? '#0B0F19' : '#1A73E8');
        map.setPaintProperty('nav-route-line', 'line-width', 5);
        map.setPaintProperty('nav-route-casing', 'line-color', isWhiteWashed ? '#0B0F19' : '#1557B0');
        map.setPaintProperty('nav-route-casing', 'line-width', isWhiteWashed ? 7 : 8);
        map.setPaintProperty('nav-route-shadow', 'line-color', isWhiteWashed ? 'rgba(0, 0, 0, 0.35)' : 'rgba(26, 115, 232, 0.4)');
      }

      // 2. Active Nav Route GeoJSON
      var navFeatures = [];
      if (data.navRoute && data.navRoute.length > 1) {
        navFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: data.navRoute.map(function(pt) { return [pt[1], pt[0]]; })
          }
        });
      }
      var navSource = map.getSource('nav-route');
      if (navSource) navSource.setData({ type: 'FeatureCollection', features: navFeatures });

      // Dynamic distance pill on navigation route
      if (data.navRoute && data.navRoute.length > 2 && data.distanceMeters) {
        var midIdx = Math.min(10, Math.floor(data.navRoute.length * 0.45));
        var wp = data.navRoute[midIdx] || data.navRoute[0];
        if (!distanceMarker) {
          var dEl = document.createElement('div');
          dEl.className = 'map-distance-capsule';
          dEl.innerHTML = '<div class="map-distance-dot"></div>' +
            '<span class="map-distance-val">' + data.distanceMeters + '</span>' +
            '<span class="map-distance-unit">m</span>';
          distanceMarker = new mapboxgl.Marker({ element: dEl, anchor: 'center' })
            .setLngLat([wp[1], wp[0]])
            .addTo(map);
        } else {
          var valEl = distanceMarker.getElement().querySelector('.map-distance-val');
          if (valEl) valEl.innerText = String(data.distanceMeters);
          distanceMarker.setLngLat([wp[1], wp[0]]);
        }
      } else if (distanceMarker) {
        distanceMarker.remove();
        distanceMarker = null;
      }

      // 3. Auto fit camera bounds in Home / compact mode
      if (isWhiteWashed && data.navRoute && data.navRoute.length > 1) {
        var rKey = (data.selectedSlotId || '') + '_' + (data.userLocation ? (data.userLocation[0].toFixed(3) + '_' + data.userLocation[1].toFixed(3)) : '');
        if (window._lastFramedRouteKey !== rKey) {
          window._lastFramedRouteKey = rKey;
          var bounds = new mapboxgl.LngLatBounds();
          data.navRoute.forEach(function(pt) { bounds.extend([pt[1], pt[0]]); });
          map.fitBounds(bounds, {
            padding: { top: 130, bottom: 330, left: 45, right: 45 },
            pitch: 48,
            bearing: -38,
            duration: 800,
            essential: true
          });
        }
      }

      // 4. Entry Marker (Only show on full MapScreen, HIDE on Home page)
      if (data.entry && !isWhiteWashed) {
        if (!entryMarker) {
          var entryWrapper = document.createElement('div');
          entryWrapper.className = 'entry-marker-wrapper';
          entryWrapper.innerHTML = '<div class="entry-marker-pill">P</div>' +
            '<div class="entry-label-tag">Parking Entrance</div>';
          entryMarker = new mapboxgl.Marker({ element: entryWrapper, anchor: 'left' })
            .setLngLat([data.entry.lng, data.entry.lat])
            .addTo(map);
        } else {
          entryMarker.setLngLat([data.entry.lng, data.entry.lat]);
        }
      } else if (entryMarker) {
        entryMarker.remove();
        entryMarker = null;
      }

      // 5. Slot Markers
      currentNavigatingToId = data.navigatingToId || null;
      currentSelectedSlotId = data.selectedSlotId || null;

      currentMarkers.forEach(function(m) { m.remove(); });
      currentMarkers = [];

      var currentZoom = map.getZoom();
      var isOverview = currentZoom < 17.5;
      var activeTargetId = currentNavigatingToId || currentSelectedSlotId || null;

      if (data.slots) {
        data.slots.forEach(function(slot) {
          var isNav = data.navigatingToId && slot.id === data.navigatingToId;
          var isSel = (data.selectedSlotId && slot.id === data.selectedSlotId) || isNav;
          var isTarget = activeTargetId ? (slot.id === activeTargetId) : slot.isBest;

          if (isWhiteWashed) {
            // Home page: Upright Billboard Red Destination Pin with slot label badge
            var pinEl = document.createElement('div');
            pinEl.className = 'red-destination-pin-wrapper';
            pinEl.setAttribute('data-slot-id', slot.id);
            pinEl.innerHTML = '<div class="red-destination-pin-body">' +
              '<div class="red-destination-pin-badge">' + slot.label + '</div>' +
              '<div class="red-destination-pin-svg-wrap">' +
                '<svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                  '<defs>' +
                    '<linearGradient id="redDestGrad_' + slot.id + '" x1="0" y1="0" x2="0" y2="1">' +
                      '<stop offset="0%" stop-color="#FF385C"/>' +
                      '<stop offset="100%" stop-color="#DC2626"/>' +
                    '</linearGradient>' +
                  '</defs>' +
                  '<path d="M17 0C7.61 0 0 7.61 0 17C0 26.5 15.2 40.8 15.9 41.5C16.5 42.1 17.5 42.1 18.1 41.5C18.8 40.8 34 26.5 34 17C34 7.61 26.39 0 17 0Z" fill="url(#redDestGrad_' + slot.id + ')"/>' +
                  '<path d="M17 1C25.84 1 33 8.16 33 17C33 25.8 18.4 39.5 17 40.8C15.6 39.5 1 25.8 1 17C1 8.16 8.16 1 17 1Z" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"/>' +
                  '<circle cx="17" cy="16" r="8" fill="#FFFFFF"/>' +
                  '<circle cx="17" cy="16" r="4.5" fill="#DC2626"/>' +
                '</svg>' +
                '<div class="red-destination-ground-pulse"></div>' +
              '</div>' +
            '</div>';

            pinEl.addEventListener('click', function(e) {
              e.stopPropagation();
              postMsg({ type: 'markerPress', slotId: slot.id });
            });

            var pinMarker = new mapboxgl.Marker({
              element: pinEl,
              anchor: 'bottom',
              pitchAlignment: 'viewport',
              rotationAlignment: 'auto',
            })
              .setLngLat([slot.lng, slot.lat])
              .addTo(map);

            currentMarkers.push(pinMarker);
          } else if (isNav) {
            // 3D Ground Slot Base (100% firmly sticked and locked to asphalt ground plane on MapScreen)
            var groundEl = document.createElement('div');
            groundEl.className = 'slot-destination-ground-target';
            groundEl.setAttribute('data-slot-id', slot.id);
            if (isOverview && !isTarget) {
              groundEl.style.display = 'none';
            }
            groundEl.innerHTML = '<div class="slot-ground-ripple"></div>' +
              '<div class="slot-ground-disc">' +
                '<span class="slot-ground-label">' + slot.label + '</span>' +
              '</div>';

            var groundMarker = new mapboxgl.Marker({
              element: groundEl,
              anchor: 'center',
              pitchAlignment: 'map',
              rotationAlignment: 'map',
            })
              .setLngLat([slot.lng, slot.lat])
              .addTo(map);
            currentMarkers.push(groundMarker);
          } else {
            var el = document.createElement('div');
            var bg = slot.occupied ? '#FF5252' : (slot.isBest ? '#2563EB' : '#10893E');
            if (isSel) {
              bg = slot.isBest ? '#2563EB' : '#FF5B00';
            }
            var cls = 'slot-marker';
            if (slot.isBest) cls += ' best';
            if (isSel) cls += ' selected-target';
            el.className = cls;
            el.setAttribute('data-slot-id', slot.id);
            el.style.backgroundColor = bg;
            el.innerHTML = slot.isBest
              ? '<span class="slot-star-icon">★</span>' + slot.label
              : slot.label;

            // In overview zoom (<17.5), only show target slot to prevent overlapping clumping
            if (isOverview && !isTarget) {
              el.style.display = 'none';
            }

            el.addEventListener('click', function(e) {
              e.stopPropagation();
              postMsg({ type: 'markerPress', slotId: slot.id });
            });

            var marker = new mapboxgl.Marker({
              element: el,
              anchor: 'center',
              pitchAlignment: 'map',
              rotationAlignment: 'map',
            })
              .setLngLat([slot.lng, slot.lat])
              .addTo(map);

            currentMarkers.push(marker);
          }
        });
      }

      // 6. User Location Marker
      if (data.userLocation) {
        var userCls = isWhiteWashed ? 'user-marker-home' : 'user-marker';
        if (!userMarker) {
          var uEl = document.createElement('div');
          uEl.className = userCls;
          userMarker = new mapboxgl.Marker({
            element: uEl,
            anchor: 'center',
            pitchAlignment: 'map',
            rotationAlignment: 'map',
          })
            .setLngLat([data.userLocation[1], data.userLocation[0]])
            .addTo(map);
        } else {
          var curUEl = userMarker.getElement();
          if (curUEl && curUEl.className !== userCls) {
            curUEl.className = userCls;
          }
          userMarker.setLngLat([data.userLocation[1], data.userLocation[0]]);
        }
      } else if (userMarker) {
        userMarker.remove();
        userMarker = null;
      }

      updateMarkerVisibility();
    };
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: { borderRadius: borderRadius.xl, overflow: 'hidden', backgroundColor: '#0f172a' },
  map: { width: '100%', height: '100%', minHeight: 300, backgroundColor: '#0f172a' },

  // Badges
  liveBadge: { position: 'absolute', top: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10,13,20,0.9)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, gap: 4, borderWidth: 1, borderColor: 'rgba(244,67,54,0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F44336' },
  liveText: { color: '#F44336', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  navBadge: { position: 'absolute', top: spacing.md, left: spacing.md, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10,13,20,0.9)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, gap: 4, borderWidth: 1, borderColor: 'rgba(26,115,232,0.4)' },
  navBadgeText: { color: '#1A73E8', fontSize: 10, fontWeight: '700' },

  // Legend
  legend: { position: 'absolute', bottom: spacing.md, left: spacing.md, flexDirection: 'row', backgroundColor: 'rgba(10,13,20,0.9)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: '#ccc', fontSize: 9, fontWeight: '600' },
});
