import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle, Easing } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

interface ScreenTransitionProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Smooth, subtle animated transition component that animates opacity and gentle slide
 * whenever any tab or screen becomes active.
 */
export function ScreenTransition({ children, style }: ScreenTransitionProps) {
  const isFocused = useIsFocused();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (isFocused) {
      fadeAnim.setValue(0);
      slideAnim.setValue(8);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isFocused]);

  return (
    <Animated.View
      pointerEvents={isFocused ? 'auto' : 'none'}
      style={[
        styles.container,
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          display: isFocused ? 'flex' : 'none',
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
