/**
 * Animated counter that springs to new values.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, Animated, TextStyle } from 'react-native';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  style?: TextStyle;
  duration?: number;
}

export function AnimatedCounter({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  style,
  duration = 800,
}: AnimatedCounterProps) {
  const animRef = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    animRef.setValue(0);
    Animated.timing(animRef, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();

    const listener = animRef.addListener(({ value: v }) => {
      setDisplayValue(v.toFixed(decimals));
    });

    return () => animRef.removeListener(listener);
  }, [value, decimals, duration]);

  return (
    <Text style={style}>
      {prefix}
      {displayValue}
      {suffix}
    </Text>
  );
}
