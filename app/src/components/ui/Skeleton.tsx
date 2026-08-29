// src/components/ui/Skeleton.tsx
import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
  className,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      className={className}
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#4f4f4fff',
          opacity,
        } as ViewStyle,
        style,
      ]}
    />
  );
};

export const SkeletonCircle: React.FC<{ size: number; style?: ViewStyle }> = ({
  size,
  style,
}) => {
  return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;
};
