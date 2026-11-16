import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const NAV_TRANSITION_EVENT = 'smart-parking-nav-transition';

export function triggerNavigationTransition(onMidpoint?: () => void, onComplete?: () => void) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(NAV_TRANSITION_EVENT, {
        detail: { onMidpoint, onComplete },
      })
    );
  } else if (onMidpoint) {
    onMidpoint();
    if (onComplete) onComplete();
  }
}

// Backwards-compatible alias for any legacy callers
export const triggerCloudSplitTransition = triggerNavigationTransition;

/**
 * NavigationTransition
 *
 * A clean, modern, Apple Maps / Uber-inspired screen transition.
 * Smoothly crossfades with a minimalist navigation HUD indicator,
 * switches the active screen at the peak, and reveals the new view seamlessly.
 */
export function NavigationTransition() {
  const [isActive, setIsActive] = useState(false);
  const midpointCallbackRef = useRef<(() => void) | null>(null);
  const completeCallbackRef = useRef<(() => void) | null>(null);

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const iconScaleAnim = useRef(new Animated.Value(0.8)).current;
  const ringScaleAnim = useRef(new Animated.Value(0.8)).current;
  const ringOpacityAnim = useRef(new Animated.Value(0.7)).current;

  const startAnimation = useCallback(
    (onMidpoint?: () => void, onComplete?: () => void) => {
      midpointCallbackRef.current = onMidpoint || null;
      completeCallbackRef.current = onComplete || null;

      setIsActive(true);
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.96);
      iconScaleAnim.setValue(0.8);
      ringScaleAnim.setValue(0.8);
      ringOpacityAnim.setValue(0.7);

      // Phase 1: Smooth, rapid fade in (160ms)
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(iconScaleAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
        Animated.timing(ringScaleAnim, {
          toValue: 1.45,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacityAnim, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Switch screen at the transition midpoint
        if (midpointCallbackRef.current) {
          midpointCallbackRef.current();
        }

        // Phase 2: Gentle dissolve into the new view (170ms)
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 170,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.03,
            duration: 170,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsActive(false);
          if (completeCallbackRef.current) {
            completeCallbackRef.current();
          }
        });
      });
    },
    [opacityAnim, scaleAnim, iconScaleAnim, ringScaleAnim, ringOpacityAnim]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    const handleEvent = (e: any) => {
      const { onMidpoint, onComplete } = e.detail || {};
      startAnimation(onMidpoint, onComplete);
    };

    window.addEventListener(NAV_TRANSITION_EVENT, handleEvent);
    window.addEventListener('smart-parking-cloud-split', handleEvent);
    return () => {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener(NAV_TRANSITION_EVENT, handleEvent);
        window.removeEventListener('smart-parking-cloud-split', handleEvent);
      }
    };
  }, [startAnimation]);

  if (!isActive) return null;

  return (
    <Animated.View
      style={[
        styles.backdrop,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.hudCard}>
        {/* Subtle pulsating radar wave */}
        <Animated.View
          style={[
            styles.radarRing,
            {
              transform: [{ scale: ringScaleAnim }],
              opacity: ringOpacityAnim,
            },
          ]}
        />

        {/* Central glowing navigation puck icon */}
        <Animated.View
          style={[
            styles.iconWrapper,
            {
              transform: [{ scale: iconScaleAnim }],
            },
          ]}
        >
          <Ionicons name="navigate" size={26} color="#FFFFFF" />
        </Animated.View>

        <Text style={styles.hudTitle}>Entering Navigation</Text>
        <Text style={styles.hudSubtitle}>Calibrating 3D Campus Route...</Text>
      </View>
    </Animated.View>
  );
}

// Backwards-compatible export
export const CloudSplittingTransition = NavigationTransition;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        } as any)
      : {}),
  },
  hudCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  radarRing: {
    position: 'absolute',
    top: 14,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  hudTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  hudSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
