// src/components/skeletons/HomeScreenSkeleton.tsx
import React from 'react';
import { View, ScrollView } from 'react-native';
import { Skeleton, SkeletonCircle } from '../ui/Skeleton';
import { BackgroundGradient } from '../layout/BackgroundGradient';

export const HomeScreenSkeleton = () => {
  return (
    // <BackgroundGradient>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Skeleton */}
        <View className="px-6 pt-14 pb-4">
          <View className="flex-row justify-between items-center">
            <Skeleton width={120} height={32} borderRadius={8} />
            <View className="flex-row gap-4">
              <SkeletonCircle size={40} />
              <SkeletonCircle size={40} />
            </View>
          </View>
        </View>

        {/* Carousel Skeleton */}
        <View className="px-6 my-6">
          <Skeleton width="100%" height={180} borderRadius={16} />
          <View className="flex-row justify-center mt-2 gap-2">
            <SkeletonCircle size={8} />
            <SkeletonCircle size={8} />
            <SkeletonCircle size={8} />
          </View>
        </View>

        <View className="px-6">
          {/* Search Bar Skeleton */}
          <Skeleton width="100%" height={56} borderRadius={16} className="mb-10" />

          {/* Stories Skeleton */}
          <View className="mb-8">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[1, 2, 3, 4, 5].map((item) => (
                <View key={item} className="items-center mr-4">
                  <SkeletonCircle size={80} />
                  <Skeleton width={60} height={16} borderRadius={8} className="mt-2" />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Upcoming Events Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Skeleton width={180} height={28} borderRadius={8} />
            <Skeleton width={60} height={20} borderRadius={8} />
          </View>

          {/* Category Filter Skeleton */}
          <View className="mb-8">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[1, 2, 3, 4].map((item) => (
                <Skeleton
                  key={item}
                  width={112}
                  height={40}
                  borderRadius={16}
                  style={{ marginRight: 12 }}
                />
              ))}
            </ScrollView>
          </View>

          {/* Event Cards Skeleton */}
          <View className="mb-8">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[1, 2, 3].map((item) => (
                <View key={item} className="mr-4">
                  <Skeleton width={280} height={320} borderRadius={20} />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Event Map Header */}
          <Skeleton width={140} height={28} borderRadius={8} className="mb-4" />

          {/* Mini Map Skeleton */}
          <Skeleton width="100%" height={200} borderRadius={16} className="mb-8" />
        </View>
      {/* Floating Chat Button Skeleton */}
      <View className="absolute bottom-32 right-10">
        <SkeletonCircle size={56} />
      </View>
      </ScrollView>

    // </BackgroundGradient>
  );
};
