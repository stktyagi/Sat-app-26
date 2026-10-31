import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FirebaseEvent } from '@/types/models';
import { useThemeStore } from '@/state/themeStore';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

interface FeaturedEventCardProps {
  event: FirebaseEvent;
  onPress?: () => void;
}

export const FeaturedEventCard: React.FC<FeaturedEventCardProps> = ({ event, onPress }) => {
  const router = useRouter();

  // Press feedback: settle to 0.97 quickly on touch, release a touch slower.
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  const pressIn = () => {
    pressScale.value = withTiming(0.97, { duration: 120, easing: EASE_OUT });
  };
  const pressOut = () => {
    pressScale.value = withTiming(1, { duration: 160, easing: EASE_OUT });
  };
  const { isDark } = useThemeStore();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({
        pathname: '/events/EventDetails',
        params: { eventData: JSON.stringify(event) },
      });
    }
  };

  const getFormattedDate = () => {
    const raw = event?.dateTime || event?.startDateTime;
    if (!raw) return 'TBA';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return 'TBA';
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    return `${day} ${month}`;
  };

  const dateBadge = getFormattedDate();
  const coverSource = event?.coverImage ? { uri: event.coverImage } : require('@/assets/event.jpg');

  const formatPrize = () => {
    const raw = event?.shortPrizes || event?.prizes;
    if (!raw) return 'TBA';
    const clean = raw.replace(/[*#_~]/g, '').trim();
    if (!clean) return 'TBA';
    const match = clean.match(/(\d[\d,]*000|\d[\d,]*\s*(?:k|lakh)?)/i);
    if (match) return match[1].replace(/^₹\s*/, '').replace(/^Rs\.?\s*/i, '');
    if (clean.length <= 15) return clean.replace(/^₹\s*/, '').replace(/^Rs\.?\s*/i, '');
    return clean.slice(0, 15);
  };

  const prizeDisplay = formatPrize();
  const venueDisplay = event?.venueName || 'Campus';

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[pressStyle, {
        width: '100%',
        backgroundColor: isDark ? '#141416' : '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isDark ? '#262628' : '#E5E7EB',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.35 : 0.08,
        shadowRadius: 12,
        elevation: 5,
      }]}
    >
      {/* Top Image Section */}
      <View style={{ width: '100%', height: 185, position: 'relative', overflow: 'hidden' }}>
        <Image transition={200}
          source={coverSource}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />

        {/* Top-Right Black Date Badge (e.g. 21 Nov) */}
        <View
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            backgroundColor: '#000000',
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 10,
          }}
        >
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              color: '#FFFFFF',
              fontSize: 13,
            }}
          >
            {dateBadge}
          </Text>
        </View>

        {/* Bottom subtle gradient fade */}
        <LinearGradient
          colors={['transparent', isDark ? 'rgba(20, 20, 22, 0.95)' : 'rgba(255, 255, 255, 0.85)']}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 50,
          }}
        />
      </View>

      {/* Card Body Content */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 }}>
        {/* Title in Cyan (as shown in screenshot) */}
        <View style={{ marginBottom: 10 }}>
          <Text
            style={{
              fontFamily: 'Talina',
              color: '#41B8F0',
              fontSize: 24,
              letterSpacing: 0.5,
            }}
            numberOfLines={1}
          >
            {event?.title || 'Event'}
          </Text>
        </View>

        {/* Tags Row with 41B8F0 border */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          {event.category ? (
            <View
              style={{
                borderWidth: 1.5,
                borderColor: '#41B8F0',
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 3,
                backgroundColor: 'transparent',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Poppins_600SemiBold',
                  color: isDark ? '#FFFFFF' : '#000000',
                  fontSize: 12,
                }}
              >
                {event.category}
              </Text>
            </View>
          ) : null}

          <View
            style={{
              borderWidth: 1.5,
              borderColor: '#41B8F0',
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 3,
              backgroundColor: 'transparent',
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                color: isDark ? '#FFFFFF' : '#000000',
                fontSize: 12,
              }}
            >
              {event.eventType === 'team' ? 'Team' : 'Challenge'}
            </Text>
          </View>
        </View>

        {/* Short Description */}
        <Text
          style={{
            fontFamily: 'Poppins_500Medium',
            color: isDark ? '#FFFFFF' : '#111827',
            fontSize: 14,
            lineHeight: 20,
            marginBottom: 14,
          }}
          numberOfLines={2}
        >
          {event?.shortDescription || event?.description || 'No description available'}
        </Text>

        {/* Metadata Row: Trophy Prize & Venue */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}>
            <Ionicons
              name="trophy-outline"
              size={16}
              color={isDark ? '#9CA3AF' : '#4B5563'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                color: isDark ? '#D1D5DB' : '#374151',
                fontSize: 14,
              }}
            >
              {prizeDisplay}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons
              name="location-outline"
              size={17}
              color={isDark ? '#9CA3AF' : '#4B5563'}
              style={{ marginRight: 5 }}
            />
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                color: isDark ? '#D1D5DB' : '#374151',
                fontSize: 14,
              }}
            >
              {venueDisplay}
            </Text>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
};

export default FeaturedEventCard;
