/**
 * Native DOM Mapbox GL JS 3D Implementation for Smart Parking Web Preview.
 * 
 * - Precisely matches reference image:
 *   * Parking lot rotated on the northwest side of access road from North Street roundabout
 *   * Dark asphalt pad with light curb border, white stall dividers, and perimeter greenery trees
 *   * "Parking Entrance" blue pill tag attached to entrance "P" marker
 *   * Glowing electric cyan/blue navigation route with arrows from user position through roundabout
 *   * Tilted 3D view with BH3 on bottom-left, roundabout at bottom, and IIITS Main Block on right
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlotInfo, ParkingData, IIIT_CAMPUS_ROAD_ROUTE, getDynamicCampusRoute } from '../../types/parking';
import { colors, borderRadius, spacing } from '../../config/theme';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

// Camera position framing BH3, the perimeter road loop, and the parking lot matching user screenshot
const CAMERA_LNG = 80.02685;
const CAMERA_LAT = 13.55490;
const CAMERA_PITCH = 52;
const CAMERA_BEARING = -42;
const CAMERA_ZOOM = 16.7;

interface ParkingLayout {
  entry: { latitude: number; longitude: number };
  slots: Record<string, { latitude: number; longitude: number }>;
  roads: Array<Array<{ latitude: number; longitude: number }>>;
}

interface ParkingMapProps {
  slots: SlotInfo[];
  parkingData: ParkingData | null;
  layout?: ParkingLayout | null;
  userLocation?: { latitude: number; longitude: number } | null;
  onMarkerPress?: (slot: SlotInfo) => void;
  navigatingTo?: SlotInfo | null;
  selectedSlot?: SlotInfo | null;
  style?: any;
  compact?: boolean;
  whiteWashBackground?: boolean;
  hideControls?: boolean;
  distanceMeters?: number;
  routeColor?: string;
}

/** Injects Mapbox GL JS and CSS directly into the page <head> once */
function loadMapboxGL(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject();
  if ((window as any).mapboxgl) return Promise.resolve((window as any).mapboxgl);

  return new Promise((resolve, reject) => {
    // 1. Mapbox CSS
    if (!document.getElementById('mapbox-gl-css')) {
      const link = document.createElement('link');
      link.id = 'mapbox-gl-css';
      link.rel = 'stylesheet';
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css';
      document.head.appendChild(link);
    }

    // 2. Custom Marker Styles
    if (!document.getElementById('smart-parking-map-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'smart-parking-map-styles';
      styleEl.innerHTML = `
        .mapboxgl-map,
        .mapboxgl-canvas-container,
        .mapboxgl-canvas {
          width: 100% !important;
          height: 100% !important;
        }
        .slot-marker {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 50%;
          border: 2.5px solid #ffffff; color: #ffffff;
          font-weight: 900; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          box-shadow: 0 8px 20px rgba(0,0,0,0.5);
          cursor: pointer; text-align: center; line-height: 28px;
          user-select: none;
        }
        .slot-marker.best {
          background-color: #2563EB;
          box-shadow: 0 8px 20px rgba(0,0,0,0.5);
        }
        .slot-star-icon {
          font-size: 10px;
          margin-right: 2px;
          display: inline-block;
          vertical-align: middle;
          line-height: 1;
        }
        .slot-marker.dimmed-slot {
          opacity: 0.38 !important;
          filter: saturate(60%);
        }
        .slot-marker.selected-target {
          opacity: 1 !important;
          border: 3.5px solid #ffffff !important;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.5) !important;
          z-index: 999 !important;
        }
        .slot-marker.selected-target.orange-target {
          box-shadow: 0 0 0 5px rgba(255, 91, 0, 0.5), 0 12px 28px rgba(0, 0, 0, 0.45) !important;
          animation: selectedOrangePulse 2s infinite ease-in-out;
        }
        @keyframes selectedPulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.5), 0 10px 24px rgba(0, 0, 0, 0.45);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.75), 0 14px 32px rgba(0, 0, 0, 0.55);
          }
        }
        @keyframes selectedOrangePulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(255, 91, 0, 0.5), 0 10px 24px rgba(0, 0, 0, 0.45);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(255, 91, 0, 0.75), 0 14px 32px rgba(0, 0, 0, 0.55);
          }
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
          font-weight: 700;
          font-size: 11px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          box-shadow: 0 4px 14px rgba(0,0,0,0.6);
          white-space: nowrap;
          border: 1px solid rgba(255,255,255,0.35);
          letter-spacing: 0.3px;
        }

        .user-marker-container {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
          user-select: none;
          pointer-events: auto;
          box-sizing: border-box;
        }
        .user-marker-container:active {
          cursor: grabbing;
        }

        .user-marker {
          width: 24px; height: 24px; border-radius: 50%;
          background: #0B0F19; border: 3.5px solid #ffffff;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
          position: relative;
          display: flex; align-items: center; justify-content: center;
          box-sizing: border-box;
          user-select: none;
          pointer-events: auto;
          opacity: 1 !important;
          z-index: 500 !important;
        }
        .user-marker:active {
          cursor: grabbing;
        }
        .user-marker::after {
          content: '';
          width: 6px; height: 6px; border-radius: 50%;
          background: #ffffff;
        }
        .user-marker::before {
          content: '';
          position: absolute;
          top: -10px; left: -10px; right: -10px; bottom: -10px;
          border-radius: 50%;
          background: rgba(11,15,25,0.25);
          animation: mapPulse 2s infinite ease-out;
        }
        @keyframes mapPulse {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(1.9); opacity: 0; }
        }

        .map-distance-capsule {
          display: flex;
          align-items: center;
          gap: 3px;
          background: #FFFFFF;
          padding: 6px 14px;
          border-radius: 9999px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
          border: 1.5px solid rgba(0, 0, 0, 0.08);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
          cursor: pointer;
          white-space: nowrap;
          pointer-events: auto;
        }
        .map-distance-val {
          color: #0B0F19;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: -0.3px;
        }
        .map-distance-unit {
          color: #64748B;
          font-size: 11px;
          font-weight: 600;
        }
        .map-distance-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #0B0F19;
          margin-right: 3px;
        }

        /* 3D Ground Destination Slot Target (Firmly locked to asphalt ground plane) */
        .slot-destination-ground-target {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          user-select: none;
          pointer-events: auto;
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
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          letter-spacing: -0.2px;
          text-align: center;
          position: relative;
          z-index: 2;
        }
        .slot-ground-ripple {
          position: absolute;
          top: -8px;
          left: -8px;
          right: -8px;
          bottom: -8px;
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

        /* Red Destination Pin Wrapper (Upright Billboard Needle Pin pointing to stall center) */
        .red-destination-pin-wrapper {
          cursor: pointer;
          user-select: none;
          pointer-events: auto;
          z-index: 1000 !important;
          width: 38px;
          height: 56px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          overflow: visible;
        }

        /* Inner Body with needle tip at bottom */
        .red-destination-pin-body {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          transform-origin: 50% 100%;
          animation: pinDropBounce 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes pinDropBounce {
          0% { transform: translateY(-16px) scale(0.8); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }

        /* Top Pill Badge positioned strictly ABOVE the pin */
        .red-destination-pin-badge {
          margin-bottom: 2px;
          background: #FFFFFF;
          color: #0F172A;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-weight: 900;
          font-size: 11px;
          padding: 2px 7px;
          border-radius: 9999px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          border: 1.5px solid rgba(0, 0, 0, 0.12);
          letter-spacing: -0.2px;
          white-space: nowrap;
          z-index: 2;
        }

        .red-destination-pin-svg-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 0;
          width: 32px;
          height: 38px;
        }
        .red-destination-pin-svg-wrap svg {
          display: block;
          filter: drop-shadow(0 4px 10px rgba(220, 38, 38, 0.5));
        }

        /* Google Maps 3D Navigation Vehicle Puck */
        .google-nav-puck {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #1A73E8;
          border: 3.5px solid #FFFFFF;
          box-shadow: 0 8px 24px rgba(26, 115, 232, 0.6), 0 2px 6px rgba(0,0,0,0.3);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 1 !important;
          z-index: 500 !important;
        }
        .google-nav-puck-chevron {
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 12px solid #FFFFFF;
          transform: translateY(-1px);
        }
        .google-nav-puck-aura {
          position: absolute;
          top: -14px; left: -14px; right: -14px; bottom: -14px;
          border-radius: 50%;
          background: rgba(26, 115, 232, 0.25);
          animation: navAuraPulse 2s infinite ease-out;
        }
        @keyframes navAuraPulse {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.8); opacity: 0; }
        }

        .mapboxgl-ctrl-bottom-right, .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-attrib {
          display: none !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    // 3. Mapbox JS Script
    if (!document.getElementById('mapbox-gl-js')) {
      const script = document.createElement('script');
      script.id = 'mapbox-gl-js';
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js';
      script.onload = () => {
        resolve((window as any).mapboxgl);
      };
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if ((window as any).mapboxgl) {
          clearInterval(interval);
          resolve((window as any).mapboxgl);
        }
      }, 50);
    }
  });
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
  routeColor,
}: ParkingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const entryMarkerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const distanceMarkerRef = useRef<any>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Google Maps recenter & camera state
  const [isCentered, setIsCentered] = useState(true);
  const [bearing, setBearing] = useState(CAMERA_BEARING);
  const [pitch, setPitch] = useState(CAMERA_PITCH);

  const entry = layout?.entry;

  // Complete Drive Route following real campus roads dynamically
  // Handles Academic Block, Hostels, North Street, or any user GPS location seamlessly
  const navRoute = useMemo(() => {
    if (!entry || !navigatingTo) return [];
    const userPt = userLocation || { latitude: 13.55395, longitude: 80.02550 };
    return getDynamicCampusRoute(userPt, navigatingTo.coordinate);
  }, [navigatingTo, entry, userLocation]);

  const defaultRoute = navRoute;

  // Recenter logic mimicking Google Maps behavior
  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const userPt = userLocation || { latitude: 13.55395, longitude: 80.02550 };

    if (!isCentered) {
      if (compact && navRoute && navRoute.length > 1 && (window as any).mapboxgl) {
        const mapboxgl = (window as any).mapboxgl;
        const bounds = new mapboxgl.LngLatBounds();
        navRoute.forEach((pt: any) => bounds.extend([pt.longitude, pt.latitude]));
        map.fitBounds(bounds, {
          padding: { top: 130, bottom: 380, left: 50, right: 50 },
          pitch: 48,
          bearing: -38,
          duration: 900,
          essential: true,
        });
      } else if (navigatingTo && navRoute && navRoute.length > 1 && (window as any).mapboxgl) {
        // Navigation mode: fit the full route into view
        const mapboxgl = (window as any).mapboxgl;
        const bounds = new mapboxgl.LngLatBounds();
        navRoute.forEach((pt: any) => bounds.extend([pt.longitude, pt.latitude]));
        map.fitBounds(bounds, {
          padding: { top: 160, bottom: 220, left: 60, right: 60 },
          pitch: 52,
          bearing: -38,
          duration: 900,
          essential: true,
        });
      } else {
        // Primary action: Smoothly fly and center camera on user location with driving perspective
        map.flyTo({
          center: [userPt.longitude, userPt.latitude],
          zoom: 17.2,
          pitch: 52,
          bearing: -42,
          essential: true,
          duration: 900,
        });
      }
      setIsCentered(true);
    } else {
      // 2. Secondary action when already centered (Google Maps route overview mode):
      if (navRoute && navRoute.length > 1 && (window as any).mapboxgl) {
        const mapboxgl = (window as any).mapboxgl;
        const bounds = new mapboxgl.LngLatBounds();
        navRoute.forEach((pt: any) => bounds.extend([pt.longitude, pt.latitude]));
        map.fitBounds(bounds, {
          padding: { top: 130, bottom: compact ? 380 : 310, left: 60, right: 60 },
          pitch: 48,
          bearing: -38,
          duration: 1000,
          essential: true,
        });
      } else {
        // Reset to full campus overview
        map.flyTo({
          center: [CAMERA_LNG, CAMERA_LAT],
          zoom: CAMERA_ZOOM,
          pitch: CAMERA_PITCH,
          bearing: CAMERA_BEARING,
          essential: true,
          duration: 900,
        });
      }
    }
  }, [isCentered, userLocation, navRoute, compact, navigatingTo]);

  const handleRotateLeft = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ bearing: map.getBearing() - 30, duration: 250 });
    setIsCentered(false);
  }, []);

  const handleRotateRight = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ bearing: map.getBearing() + 30, duration: 250 });
    setIsCentered(false);
  }, []);

  const handleResetNorth = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ bearing: 0, duration: 350 });
  }, []);

  const handleTogglePitch = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const curPitch = map.getPitch();
    map.easeTo({ pitch: curPitch > 25 ? 0 : 54, duration: 350 });
  }, []);

  const handleZoomIn = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomIn({ duration: 200 });
  }, []);

  const handleZoomOut = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomOut({ duration: 200 });
  }, []);

  // Listen for custom events dispatched by the UI
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onZoomIn = () => handleZoomIn();
    const onZoomOut = () => handleZoomOut();
    const onRecenter = () => handleRecenter();
    const onOverview = () => {
      const map = mapRef.current;
      const mapboxgl = (window as any).mapboxgl;
      if (!map || !mapboxgl || navRoute.length <= 1) return;
      const bounds = new mapboxgl.LngLatBounds();
      navRoute.forEach((pt: any) => bounds.extend([pt.longitude, pt.latitude]));
      map.fitBounds(bounds, {
        padding: { top: 140, bottom: 220, left: 60, right: 60 },
        pitch: 35,
        bearing: -38,
        duration: 900,
        essential: true,
      });
      setIsCentered(false);
    };

    window.addEventListener('smart-parking-zoom-in', onZoomIn);
    window.addEventListener('smart-parking-zoom-out', onZoomOut);
    window.addEventListener('smart-parking-recenter', onRecenter);
    window.addEventListener('smart-parking-overview', onOverview);

    return () => {
      window.removeEventListener('smart-parking-zoom-in', onZoomIn);
      window.removeEventListener('smart-parking-zoom-out', onZoomOut);
      window.removeEventListener('smart-parking-recenter', onRecenter);
      window.removeEventListener('smart-parking-overview', onOverview);
    };
  }, [handleZoomIn, handleZoomOut, handleRecenter, navRoute]);

  // Initialize Mapbox directly in the DOM
  useEffect(() => {
    let isCancelled = false;
    let containerEl: HTMLDivElement | null = null;
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    loadMapboxGL()
      .then((mapboxgl) => {
        if (isCancelled || !mapContainerRef.current) return;

        containerEl = mapContainerRef.current;
        // Prevent default browser context menu on right click to allow right-click drag rotation
        containerEl.addEventListener('contextmenu', handleContextMenu);

        mapboxgl.accessToken = MAPBOX_TOKEN;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/standard',
          center: [CAMERA_LNG, CAMERA_LAT],
          zoom: CAMERA_ZOOM,
          pitch: CAMERA_PITCH,
          bearing: CAMERA_BEARING,
          antialias: true,
          attributionControl: false,
          dragRotate: true,
          pitchWithRotate: true,
          touchPitch: true,
          touchZoomRotate: true,
        });

        mapRef.current = map;

        // Explicitly enable all interaction and rotation handlers
        map.dragRotate.enable();
        map.touchZoomRotate.enable();
        map.touchZoomRotate.enableRotation();
        map.touchPitch.enable();

        // Track user camera adjustments to dynamically update Google Maps recenter button state
        map.on('dragstart', () => setIsCentered(false));
        map.on('rotatestart', () => setIsCentered(false));
        map.on('pitchstart', () => setIsCentered(false));
        map.on('zoomstart', (e: any) => {
          if (e.originalEvent) setIsCentered(false);
        });

        map.on('rotate', () => {
          setBearing(Math.round(map.getBearing()));
        });
        map.on('pitch', () => {
          setPitch(Math.round(map.getPitch()));
        });

        map.on('moveend', () => {
          const center = map.getCenter();
          const userPt = userLocation || { latitude: 13.55395, longitude: 80.02550 };
          const dist = Math.hypot(center.lat - userPt.latitude, center.lng - userPt.longitude);
          if (dist < 0.0004) {
            setIsCentered(true);
          }
        });

        map.on('style.load', () => {
          try {
            map.setConfigProperty('basemap', 'lightPreset', 'day');
            map.setConfigProperty('basemap', 'showPlaceLabels', true);
            map.setConfigProperty('basemap', 'showPointOfInterestLabels', true);
            map.setConfigProperty('basemap', 'showTransitLabels', false);
          } catch (e) {
            console.warn('Mapbox config error:', e);
          }
        });

        map.on('load', () => {
          if (isCancelled) return;
          setMapLoaded(true);

          // 1. Parking Plaza Ground Pad (Dark Asphalt nested cleanly inside the grass loop, zero road overlap)
          map.addSource('parking-lot-pad', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [80.02705, 13.55627], // NW (comfortably inside Petal Road West curb)
                  [80.02747, 13.55627], // NE (comfortably inside Petal Road East curb)
                  [80.02747, 13.55590], // SE (comfortably inside North Street curb)
                  [80.02705, 13.55590], // SW (comfortably inside North Street curb)
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

          // 2. Parking Stall Divider Stripes (White grid lines matching user drawing)
          map.addSource('parking-stalls', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [
                // Horizontal dividing line between Row A and Row B
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[80.02705, 13.556085], [80.02747, 13.556085]] } },
                // Vertical column line 1 (separating A1/B1 from A2/B2)
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[80.02719, 13.55627], [80.02719, 13.55590]] } },
                // Vertical column line 2 (separating A2/B2 from A3/(P))
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[80.02733, 13.55627], [80.02733, 13.55590]] } },
                // Entrance arch curve at (P) corner matching user's drawing
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

          // 3. Perimeter Trees / Greenery (Matching round tree dots around perimeter lawn)
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
              'circle-radius': 5.5,
              'circle-stroke-color': '#15803d',
              'circle-stroke-width': 1.5,
              'circle-opacity': 0.95,
            },
          });

          // 3b. White-Wash Layer: slightly decrease map opacity to white color on home page
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
              'fill-opacity': (compact || whiteWashBackground) ? 0.58 : 0,
            },
          });

          // 4. Solid Black Real Road Navigation Route (Added AFTER white wash so it stays 100% solid & unwashed)
          map.addSource('nav-route', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          // Navigation Layer 1: Ambient Elevation Shadow
          map.addLayer({
            id: 'nav-route-shadow',
            type: 'line',
            source: 'nav-route',
            slot: 'top',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': 'rgba(0, 0, 0, 0.35)', 'line-width': 10, 'line-blur': 3 },
          });
          // Navigation Layer 2: Sharp Dark Casing Outline
          map.addLayer({
            id: 'nav-route-casing',
            type: 'line',
            source: 'nav-route',
            slot: 'top',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#0B0F19', 'line-width': 7 },
          });
          // Navigation Layer 3: Solid Black Real Road Route Line
          map.addLayer({
            id: 'nav-route-line',
            type: 'line',
            source: 'nav-route',
            slot: 'top',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#0B0F19', 'line-width': 5 },
          });

          setTimeout(() => {
            map.resize();
            if (compact && navRoute && navRoute.length > 1 && (window as any).mapboxgl) {
              const bounds = new (window as any).mapboxgl.LngLatBounds();
              navRoute.forEach((pt: any) => bounds.extend([pt.longitude, pt.latitude]));
              map.fitBounds(bounds, {
                padding: { top: 130, bottom: 380, left: 50, right: 50 },
                pitch: 48,
                bearing: -38,
                duration: 0,
              });
            }
          }, 150);
        });

        map.on('error', (err: any) => {
          console.warn('Mapbox map notice:', err);
        });
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to load Mapbox script:', err);
          setLoadError('Failed to load Mapbox GL JS');
        }
      });

    return () => {
      isCancelled = true;
      if (containerEl) {
        containerEl.removeEventListener('contextmenu', handleContextMenu);
      }
      if (distanceMarkerRef.current) {
        distanceMarkerRef.current.remove();
        distanceMarkerRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (entryMarkerRef.current) {
        entryMarkerRef.current.remove();
        entryMarkerRef.current = null;
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Route on map & physically anchor distance marker to the road
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = (window as any).mapboxgl;
    if (!map || !mapLoaded) return;

    const navSource = map.getSource('nav-route');
    if (navSource) {
      const navFeatures =
        navRoute.length > 1
          ? [
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: navRoute.map((p) => [p.longitude, p.latitude]),
                },
              },
            ]
          : [];
      navSource.setData({ type: 'FeatureCollection', features: navFeatures });
    }

    // Dynamic Real Distance Marker physically anchored to route waypoint on Mapbox
    if (mapboxgl && navRoute.length > 2) {
      const midIdx = Math.min(10, Math.floor(navRoute.length * 0.45));
      const wp = navRoute[midIdx] || navRoute[0];
      const distVal = distanceMeters || 715;

      if (!distanceMarkerRef.current) {
        const dEl = document.createElement('div');
        dEl.className = 'map-distance-capsule';
        dEl.innerHTML = `
          <div class="map-distance-dot"></div>
          <span class="map-distance-val">${distVal}</span>
          <span class="map-distance-unit">m</span>
        `;
        distanceMarkerRef.current = new mapboxgl.Marker({ element: dEl, anchor: 'center' })
          .setLngLat([wp.longitude, wp.latitude])
          .addTo(map);
      } else {
        const valEl = distanceMarkerRef.current.getElement()?.querySelector('.map-distance-val');
        if (valEl) {
          valEl.innerText = String(distVal);
        }
        distanceMarkerRef.current.setLngLat([wp.longitude, wp.latitude]);
      }
    } else if (distanceMarkerRef.current) {
      distanceMarkerRef.current.remove();
      distanceMarkerRef.current = null;
    }

    // In compact (home page) mode, automatically fit camera to show full route from user location to red destination pin above the bottom card
    if (compact && navRoute && navRoute.length > 1 && mapboxgl) {
      const bounds = new mapboxgl.LngLatBounds();
      navRoute.forEach((pt: any) => bounds.extend([pt.longitude, pt.latitude]));
      map.fitBounds(bounds, {
        padding: { top: 130, bottom: 380, left: 50, right: 50 },
        pitch: 48,
        bearing: -38,
        duration: 800,
        essential: true,
      });
    }

    // Google Maps Navigation Mode styling when navigating on MapScreen
    const isGoogleNav = !compact && !!navigatingTo;
    if (map.getLayer('nav-route-line')) {
      map.setPaintProperty('nav-route-line', 'line-color', isGoogleNav ? '#1A73E8' : '#0B0F19');
      map.setPaintProperty('nav-route-line', 'line-width', isGoogleNav ? 7 : 5);
      map.setPaintProperty('nav-route-casing', 'line-color', isGoogleNav ? '#1557B0' : '#0B0F19');
      map.setPaintProperty('nav-route-casing', 'line-width', isGoogleNav ? 10 : 7);
      map.setPaintProperty('nav-route-shadow', 'line-color', isGoogleNav ? 'rgba(26, 115, 232, 0.4)' : 'rgba(0, 0, 0, 0.35)');
    }

    // In full navigation mode on MapScreen, fit camera to show full route from user to destination
    if (isGoogleNav && mapboxgl && isCentered) {
      if (navRoute && navRoute.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        navRoute.forEach((pt: any) => bounds.extend([pt.longitude, pt.latitude]));
        map.fitBounds(bounds, {
          padding: { top: 160, bottom: 220, left: 60, right: 60 },
          pitch: 52,
          bearing: -38,
          duration: 900,
          essential: true,
        });
      } else {
        const userPt = userLocation || { latitude: 13.55395, longitude: 80.02550 };
        map.flyTo({
          center: [userPt.longitude, userPt.latitude],
          zoom: 16.8,
          pitch: 52,
          bearing: -38,
          duration: 900,
          essential: true,
        });
      }
    }
  }, [mapLoaded, navRoute, compact, navigatingTo, isCentered]);

  // Dynamically update white wash opacity when compact or whiteWashBackground changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    try {
      if (map.getLayer('map-white-wash-layer')) {
        const opacity = (compact || whiteWashBackground) ? 0.58 : 0;
        map.setPaintProperty('map-white-wash-layer', 'fill-opacity', opacity);
      }
    } catch (e) {
      // ignore
    }
  }, [mapLoaded, compact, whiteWashBackground]);

  // Update Slot Markers directly in DOM
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = (window as any).mapboxgl;
    if (!map || !mapLoaded || !mapboxgl) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const isWhiteWashed = compact || whiteWashBackground;
    const isGoogleNav = !compact && !!navigatingTo;

    // In homepage (compact || whiteWashBackground), ONLY the selected slot should be visible!
    const slotsToRender = isWhiteWashed
      ? (navigatingTo ? slots.filter((slot) => slot.id === navigatingTo.id) : slots.filter((slot) => slot.isBest).slice(0, 1))
      : slots;

    const activeTargetId = navigatingTo?.id || selectedSlot?.id || null;
    const currentZoom = map.getZoom();
    const isOverview = currentZoom < 17.5;

    // Add updated slot markers
    slotsToRender.forEach((slot) => {
      const isNav = !!navigatingTo && navigatingTo.id === slot.id;
      const isSel = (!!selectedSlot && selectedSlot.id === slot.id) || isNav;
      const isAI = slot.isBest;
      const isTarget = activeTargetId ? (slot.id === activeTargetId) : isAI;

      if (isNav) {
        // Active Navigation Destination Slot (100% firmly sticked and locked to asphalt ground plane)
        const groundEl = document.createElement('div');
        groundEl.className = 'slot-destination-ground-target';
        groundEl.setAttribute('data-slot-id', slot.id);
        if (isOverview && !isTarget) {
          groundEl.style.display = 'none';
        }
        groundEl.innerHTML = `
          <div class="slot-ground-ripple"></div>
          <div class="slot-ground-disc">
            <span class="slot-ground-label">${slot.label}</span>
          </div>
        `;
        groundEl.addEventListener('click', (e) => {
          e.stopPropagation();
          onMarkerPress?.(slot);
        });

        const groundMarker = new mapboxgl.Marker({
          element: groundEl,
          anchor: 'center',
          pitchAlignment: 'map',
          rotationAlignment: 'map',
        })
          .setLngLat([slot.coordinate.longitude, slot.coordinate.latitude])
          .addTo(map);

        markersRef.current.push(groundMarker);
      } else {
        const el = document.createElement('div');
        // Standard and AI recommended slots (all firmly sticked to asphalt ground plane)
        let bg = slot.occupied ? '#FF5252' : isAI ? '#2563EB' : '#10893E';
        if (isSel) {
          bg = isAI ? '#2563EB' : '#FF5B00';
        }

        const classes = ['slot-marker'];
        if (isAI) classes.push('best');
        if (isSel) classes.push('selected-target');
        if (navigatingTo && !isSel) {
          classes.push('dimmed-slot');
        }

        el.className = classes.join(' ');
        el.setAttribute('data-slot-id', slot.id);
        el.style.backgroundColor = bg;
        el.innerHTML = isAI ? '<span class="slot-star-icon">★</span>' + slot.label : slot.label;
        el.style.opacity = navigatingTo && !isSel ? '0.35' : '1';
        el.style.zIndex = '999';

        if (isOverview && !isTarget) {
          el.style.display = 'none';
        }

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onMarkerPress?.(slot);
        });

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
          pitchAlignment: 'map',
          rotationAlignment: 'map',
        })
          .setLngLat([slot.coordinate.longitude, slot.coordinate.latitude])
          .addTo(map);

        markersRef.current.push(marker);
      }
    });

    // Declutter markers dynamically on zoom out (WITHOUT touching el.style.transform)
    // When zoomed out (zoom < 17.5, campus view), ONLY the active destination/selected slot is shown
    // When zooming in close (zoom >= 17.5), all parking slots appear cleanly in their respective stalls
    const updateMarkerVisibility = () => {
      const z = map.getZoom();
      const isOverviewZoom = z < 17.5;
      const markerEls = document.querySelectorAll('.slot-marker, .slot-destination-ground-target');
      const curTargetId = navigatingTo?.id || selectedSlot?.id || null;

      markerEls.forEach((el: any) => {
        const slotId = el.getAttribute('data-slot-id');
        const isBest = el.classList.contains('best');
        const isTarget = curTargetId ? (slotId === curTargetId) : isBest;

        if (isOverviewZoom) {
          el.style.display = isTarget ? 'flex' : 'none';
        } else {
          el.style.display = 'flex';
        }
      });
    };

    map.on('zoom', updateMarkerVisibility);
    updateMarkerVisibility();

    // Entry Marker with "Parking Entrance" blue callout tag (only on full map screen, not on homepage)
    if (entry && !isWhiteWashed) {
      if (!entryMarkerRef.current) {
        const entryWrapper = document.createElement('div');
        entryWrapper.className = 'entry-marker-wrapper';
        entryWrapper.innerHTML = `
          <div class="entry-marker-pill">P</div>
          <div class="entry-label-tag">Parking Entrance</div>
        `;
        entryMarkerRef.current = new mapboxgl.Marker({ element: entryWrapper, anchor: 'left' })
          .setLngLat([entry.longitude, entry.latitude])
          .addTo(map);
      } else {
        entryMarkerRef.current.setLngLat([entry.longitude, entry.latitude]);
      }
    } else if (entryMarkerRef.current) {
      entryMarkerRef.current.remove();
      entryMarkerRef.current = null;
    }

    return () => {
      map.off('zoom', updateMarkerVisibility);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [mapLoaded, slots, entry, navigatingTo, selectedSlot, compact, whiteWashBackground, onMarkerPress]);

  // User Location Marker (3D Chevron Navigation Puck during Google Nav, or Solid Jet Black circle)
  // Firmly sticked to the 3D ground asphalt with pitchAlignment: 'map'
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = (window as any).mapboxgl;
    if (!map || !mapLoaded || !mapboxgl) return;

    const isGoogleNav = !compact && !!navigatingTo;
    const userPt = userLocation || { latitude: 13.55395, longitude: 80.02550 };

    if (!userMarkerRef.current) {
      const container = document.createElement('div');
      container.className = 'user-marker-container';

      const circle = document.createElement('div');
      circle.className = isGoogleNav ? 'google-nav-puck' : 'user-marker';
      circle.innerHTML = isGoogleNav
        ? '<div class="google-nav-puck-aura"></div><div class="google-nav-puck-chevron"></div>'
        : '';
      container.appendChild(circle);

      const marker = new mapboxgl.Marker({
        element: container,
        anchor: 'center',
        pitchAlignment: 'map',
        rotationAlignment: 'map',
        draggable: true,
      })
        .setLngLat([userPt.longitude, userPt.latitude])
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('smart-parking-set-user-location', {
              detail: { latitude: lngLat.lat, longitude: lngLat.lng },
            })
          );
        }
      });

      userMarkerRef.current = marker;
    } else {
      const container = userMarkerRef.current.getElement();
      if (container) {
        let circle = container.querySelector('.user-marker, .google-nav-puck');
        if (!circle) {
          circle = document.createElement('div');
          container.appendChild(circle);
        }
        circle.className = isGoogleNav ? 'google-nav-puck' : 'user-marker';
        circle.innerHTML = isGoogleNav
          ? '<div class="google-nav-puck-aura"></div><div class="google-nav-puck-chevron"></div>'
          : '';
      }
      userMarkerRef.current.setLngLat([userPt.longitude, userPt.latitude]);
    }
  }, [mapLoaded, userLocation, navigatingTo, compact]);

  // Handle Resize & Fullscreen Transitions
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };

    // 1. ResizeObserver directly observing mapContainerRef DOM element
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      ro = new ResizeObserver(() => {
        handleResize();
      });
      ro.observe(mapContainerRef.current);
    }

    // 2. Window and document event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    document.addEventListener('webkitfullscreenchange', handleResize);

    // 3. Staggered resizes after mount to catch flexbox layout completion
    const timers = [50, 150, 300, 600, 1000].map((t) => setTimeout(handleResize, t));

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
      document.removeEventListener('webkitfullscreenchange', handleResize);
      timers.forEach(clearTimeout);
    };
  }, [mapLoaded]);

  // Also trigger resize whenever navigation mode or layout mode toggles
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.resize();
      }, 60);
    }
  }, [navigatingTo, compact]);

  return (
    <View style={[styles.container, style]}>
      {/* Native Mapbox DOM Container */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#F8FAFC',
        }}
      />

      {/* Loading state indicator */}
      {!mapLoaded && !loadError && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#2979FF" />
          <Text style={styles.loadingText}>Loading 3D Campus Map...</Text>
        </View>
      )}

      {/* Error state */}
      {loadError && (
        <View style={styles.loadingOverlay}>
          <Text style={{ color: '#FF5252', fontSize: 12 }}>{loadError}</Text>
        </View>
      )}

      {/* LIVE 3D Badge (Only on full map screen, hidden on homepage) */}
      {!compact && !hideControls && (
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE 3D</Text>
        </View>
      )}

      {/* Navigation active badge (Only on full map screen, hidden on homepage) */}
      {!compact && !hideControls && navigatingTo && (
        <View style={styles.navBadge}>
          <Ionicons name="navigate" size={12} color="#00D2FF" />
          <Text style={styles.navBadgeText}>Navigating to {navigatingTo.label}</Text>
        </View>
      )}

      {/* Floating Map Controls & Google Maps Recenter Button */}
      {!hideControls && (
        <View
          pointerEvents="box-none"
          style={[
            styles.controlsContainer,
            { bottom: compact ? 12 : 285 },
          ]}
        >
          {/* Navigation & Rotation Glassmorphic Stack */}
          <View style={styles.controlStack}>
            {/* Compass / Reset North */}
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={handleResetNorth}
              activeOpacity={0.7}
              accessibilityLabel="Reset to North"
            >
              <View style={{ transform: [{ rotate: `${-bearing}deg` }] }}>
                <Ionicons name="compass" size={22} color="#EF4444" />
              </View>
            </TouchableOpacity>

            <View style={styles.controlDivider} />

            {/* Rotate Counter-Clockwise */}
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={handleRotateLeft}
              activeOpacity={0.7}
              accessibilityLabel="Rotate Left"
            >
              <Ionicons name="arrow-undo" size={17} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.controlDivider} />

            {/* Rotate Clockwise */}
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={handleRotateRight}
              activeOpacity={0.7}
              accessibilityLabel="Rotate Right"
            >
              <Ionicons name="arrow-redo" size={17} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.controlDivider} />

            {/* 3D / 2D Perspective Toggle */}
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={handleTogglePitch}
              activeOpacity={0.7}
              accessibilityLabel="Toggle 3D View"
            >
              <Text style={styles.pitchBadgeText}>{pitch > 25 ? '2D' : '3D'}</Text>
            </TouchableOpacity>

            <View style={styles.controlDivider} />

            {/* Zoom In */}
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={handleZoomIn}
              activeOpacity={0.7}
              accessibilityLabel="Zoom In"
            >
              <Ionicons name="add" size={19} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.controlDivider} />

            {/* Zoom Out */}
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={handleZoomOut}
              activeOpacity={0.7}
              accessibilityLabel="Zoom Out"
            >
              <Ionicons name="remove" size={19} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Google Maps Style Recenter Button */}
          <TouchableOpacity
            style={[
              styles.googleRecenterBtn,
              isCentered && styles.googleRecenterBtnActive,
            ]}
            onPress={handleRecenter}
            activeOpacity={0.82}
            accessibilityLabel="Recenter on my location"
          >
            <Ionicons
              name={isCentered ? 'locate' : 'locate-outline'}
              size={22}
              color={isCentered ? '#1A73E8' : '#5F6368'}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Legend */}
      {!compact && !navigatingTo && !hideControls && (
        <View style={styles.legend}>
          <LegendDot color="#10893E" label="Free" />
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
  container: {
    width: '100%',
    height: '100%',
    minHeight: 220,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 5,
  },
  loadingText: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  liveBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,13,20,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.35)',
    zIndex: 10,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F44336' },
  liveText: { color: '#F44336', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  navBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,13,20,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.4)',
    zIndex: 10,
  },
  navBadgeText: { color: '#00D2FF', fontSize: 10, fontWeight: '700' },
  controlsContainer: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
  },
  controlStack: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  controlBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDivider: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  pitchBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  googleRecenterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 3px 10px rgba(0, 0, 0, 0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  googleRecenterBtnActive: {
    borderColor: 'rgba(26, 115, 232, 0.4)',
    boxShadow: '0 3px 12px rgba(26, 115, 232, 0.35)',
  },
  legend: {
    position: 'absolute',
    bottom: 285,
    left: spacing.md,
    flexDirection: 'row',
    backgroundColor: 'rgba(10,13,20,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: '#ccc', fontSize: 9, fontWeight: '600' },
});
