import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ToastType = 'success' | 'warning' | 'info' | 'error';

export interface ToastData {
  id: number;
  title: string;
  message?: string;
  type: ToastType;
}

type ToastListener = (toast: ToastData | null) => void;
let listeners: ToastListener[] = [];
let toastCounter = 0;

/**
 * Dispatch a sleek in-app toast notification without blocking alert windows or "OK" buttons.
 */
export function showToast(
  title: string,
  message?: string,
  type: ToastType = 'info'
) {
  const toast: ToastData = {
    id: ++toastCounter,
    title,
    message,
    type,
  };
  listeners.forEach((fn) => fn(toast));
}

/**
 * Root In-App Toast Notification Banner.
 * Renders smoothly with auto-dismiss and zero blocking dialogs.
 */
export function AppToast() {
  const [currentToast, setCurrentToast] = useState<ToastData | null>(null);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(-24)).current;

  useEffect(() => {
    let hideTimer: any = null;

    const listener = (toast: ToastData | null) => {
      if (toast) {
        clearTimeout(hideTimer);
        setCurrentToast(toast);

        // Slide and fade in
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(translateYAnim, {
            toValue: 0,
            friction: 7,
            tension: 50,
            useNativeDriver: true,
          }),
        ]).start();

        // Auto-dismiss in 2.8 seconds
        hideTimer = setTimeout(() => {
          Animated.parallel([
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(translateYAnim, {
              toValue: -24,
              duration: 250,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setCurrentToast(null);
          });
        }, 2800);
      }
    };

    listeners.push(listener);
    return () => {
      clearTimeout(hideTimer);
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (!currentToast) return null;

  const iconName: any =
    currentToast.type === 'warning'
      ? 'alert-circle'
      : currentToast.type === 'success'
      ? 'checkmark-circle'
      : currentToast.type === 'error'
      ? 'close-circle'
      : 'information-circle';

  const iconColor =
    currentToast.type === 'warning'
      ? '#F59E0B'
      : currentToast.type === 'success'
      ? '#10B981'
      : currentToast.type === 'error'
      ? '#EF4444'
      : '#38BDF8';

  const borderColor =
    currentToast.type === 'warning'
      ? 'rgba(245, 158, 11, 0.45)'
      : currentToast.type === 'success'
      ? 'rgba(16, 185, 129, 0.45)'
      : currentToast.type === 'error'
      ? 'rgba(239, 68, 68, 0.45)'
      : 'rgba(56, 189, 248, 0.35)';

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        toastStyles.container,
        {
          opacity: opacityAnim,
          transform: [{ translateY: translateYAnim }],
          borderColor,
        },
      ]}
    >
      <View style={toastStyles.iconWrap}>
        <Ionicons name={iconName} size={22} color={iconColor} />
      </View>
      <View style={toastStyles.textWrap}>
        <Text style={toastStyles.title}>{currentToast.title}</Text>
        {currentToast.message ? (
          <Text style={toastStyles.message}>{currentToast.message}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 52,
    left: 20,
    right: 20,
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12)',
    gap: 12,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  message: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
});
