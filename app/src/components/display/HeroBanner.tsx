import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/state/themeStore';
import { useAdminDrawerStore } from '@/state/adminDrawerStore';
import { useUserStore } from '@/state/userStore';
import { isUserAdmin } from '@/utils/roles';
import { UserProfile } from '@/types/models';

export interface BannerItem {
  id: string;
  title: string;
  description: string;
  image: any; // local require(...) or { uri: string }
  link?: string;
}

interface HeroBannerProps {
  userProfile?: UserProfile | null;
  banners?: BannerItem[];
  autoPlayInterval?: number;
}

export const DEMO_BANNERS: BannerItem[] = [
  {
    id: 'b1',
    title: 'Saturnalia',
    description: 'Experience the magic under the grand lights',
    image: require('@/assets/story2/Copy_of_DSC09217_cesaci.jpg'),
    link: 'https://saturnalia.in',
  },
];

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const DOT_TRANSITION = LinearTransition.duration(250).easing(Easing.bezier(0.77, 0, 0.175, 1));

export default function HeroBanner({
  userProfile,
  banners = DEMO_BANNERS,
  autoPlayInterval = 4000,
}: HeroBannerProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, colors, toggleTheme } = useThemeStore();
  const { openDrawer } = useAdminDrawerStore();
  const { userData } = useUserStore();
  const canSeeAdmin = isUserAdmin(userProfile ?? userData);

  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Banner height: roughly 58% of screen height, clamped between 460 and 520
  const bannerHeight = Math.min(Math.max(Math.round(screenHeight * 0.58), 460), 520);

  const activeBanners = banners.length > 0 ? banners : DEMO_BANNERS;

  // Auto-play interval
  useEffect(() => {
    if (activeBanners.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % activeBanners.length;
        scrollViewRef.current?.scrollTo({
          x: next * screenWidth,
          animated: true,
        });
        return next;
      });
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [activeBanners.length, screenWidth, autoPlayInterval]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);
    if (index >= 0 && index < activeBanners.length && index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const handleDotPress = (index: number) => {
    setCurrentIndex(index);
    scrollViewRef.current?.scrollTo({
      x: index * screenWidth,
      animated: true,
    });
  };

  const handleLearnMore = async (link?: string) => {
    if (!link) return;
    try {
      const supported = await Linking.canOpenURL(link);
      if (supported) {
        await Linking.openURL(link);
      }
    } catch (err) {
      console.warn('Could not open link:', err);
    }
  };

  const handleProfilePress = () => {
    router.push('/profile');
  };

  // Determine user first name
  const rawName = userProfile?.displayName?.trim() || (userProfile as any)?.name?.trim() || 'User';
  const firstName = rawName.split(' ')[0];

  return (
    <View style={{ width: screenWidth, height: bannerHeight, position: 'relative' }}>
      {/* Horizontal Carousel */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ width: screenWidth, height: bannerHeight }}
      >
        {activeBanners.map((item) => {
          const imageSource = typeof item.image === 'number' ? item.image : { uri: item.image };
          return (
            <View
              key={item.id}
              style={{
                width: screenWidth,
                height: bannerHeight,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Image transition={200}
                source={imageSource}
                style={{
                  width: screenWidth,
                  height: bannerHeight,
                }}
                resizeMode="cover"
              />
            </View>
          );
        })}
      </ScrollView>

      {/* Top Gradient Overlay */}
      <LinearGradient
        colors={colors.topGradient}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(insets.top + 50, 130),
        }}
        pointerEvents="none"
      />

      {/* Top Bar Header Overlay */}
      <View
        style={{
          position: 'absolute',
          top: Math.max(insets.top + 8, 16),
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          zIndex: 20,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
          {/* Hamburger Menu on the left of Welcome, name - only for admin/staff */}
          {canSeeAdmin && (
            <TouchableOpacity
              onPress={openDrawer}
              activeOpacity={0.75}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="menu" size={22} color={colors.text} />
            </TouchableOpacity>
          )}

          {/* Welcome [Name] */}
          <Text
            style={{
              fontFamily: 'Talina',
              fontSize: 20,
              color: colors.text,
              letterSpacing: 0.5,
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            Welcome {firstName}
          </Text>
        </View>

        {/* Profile Avatar with Bright Cyan / Blue Ring */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={handleProfilePress}
            activeOpacity={0.8}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 2.5,
              borderColor: '#00B2FF',
              backgroundColor: isDark ? '#000000' : '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              shadowColor: '#00B2FF',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            {userProfile?.photoURL ? (
              <Image transition={200}
                source={{ uri: userProfile.photoURL }}
                style={{ width: '100%', height: '100%', borderRadius: 22 }}
                resizeMode="cover"
              />
            ) : (
              <Ionicons
                name="person"
                size={22}
                color={isDark ? '#D1D5DB' : '#374151'}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Gradient Overlay */}
      <LinearGradient
        colors={colors.bottomGradient}
        locations={[0, 0.25, 0.65, 0.88, 1]}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 150,
        }}
        pointerEvents="none"
      />

      {/* Bottom Content: Title, Description, Button, Dots */}
      <View
        style={{
          position: 'absolute',
          bottom: 12,
          left: 0,
          right: 0,
          alignItems: 'center',
          paddingHorizontal: 24,
          zIndex: 20,
        }}
      >
        {/* Title */}
        <Text
          style={{
            fontFamily: 'Talina',
            fontSize: 34,
            color: '#FFFFFF',
            textAlign: 'center',
            letterSpacing: 0.5,
            textShadowColor: 'rgba(0, 0, 0, 0.75)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 6,
          }}
          numberOfLines={1}
        >
          {activeBanners[currentIndex]?.title || 'Jamming Session'}
        </Text>

        {/* Description */}
        <Text
          style={{
            fontFamily: 'Poppins_500Medium',
            fontSize: 15,
            color: '#FFFFFF',
            textAlign: 'center',
            marginTop: 4,
            marginBottom: 12,
            textShadowColor: 'rgba(0, 0, 0, 0.65)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          }}
          numberOfLines={2}
        >
          {activeBanners[currentIndex]?.description || 'Lorem Ipsum Dolor Sit Amet'}
        </Text>

        {/* Learn More Button */}
        <TouchableOpacity
          onPress={() => handleLearnMore(activeBanners[currentIndex]?.link)}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#000000',
            paddingHorizontal: 20,
            paddingVertical: 9,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.35,
            shadowRadius: 5,
            elevation: 4,
          }}
        >
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 14,
              color: '#FFFFFF',
              marginRight: 4,
            }}
          >
            Learn more
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Pagination Dots Indicator */}
        {activeBanners.length > 1 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 14,
              marginBottom: 4,
              gap: 8,
            }}
          >
            {activeBanners.map((item, index) => {
              const isActive = index === currentIndex;
              return (
                <AnimatedTouchable
                  key={`dot-${item.id}-${index}`}
                  onPress={() => handleDotPress(index)}
                  activeOpacity={0.7}
                  // Active pill grows/shrinks instead of snapping between 6 and 22pt.
                  layout={DOT_TRANSITION}
                  style={{
                    height: 6,
                    width: isActive ? 22 : 6,
                    borderRadius: 3,
                    backgroundColor: isActive ? colors.dotActive : colors.dotInactive,
                  }}
                />
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}
