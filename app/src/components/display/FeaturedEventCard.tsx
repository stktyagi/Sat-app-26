import React from 'react';
import { View, Text, Pressable, TouchableOpacity } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

  const getDateBadge = () => {
    const raw = event?.startDateTime || event?.dateTime;
    if (!raw) return { day: '21', month: 'Nov' };
    const d = new Date(raw);
    if (isNaN(d.getTime())) return { day: '21', month: 'Nov' };
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    return { day: `${day}`, month };
  };

  const dateBadge = getDateBadge();
  const coverSource = event?.coverImage ? { uri: event.coverImage } : require('@/assets/event.jpg');

  const formatPrize = () => {
    const raw = event?.shortPrizes || event?.prizes;
    if (!raw) return '1,50,000';
    const clean = raw.replace(/[*#_~]/g, '').trim();
    if (!clean) return '1,50,000';
    const match = clean.match(/(\d[\d,]*000|\d[\d,]*\s*(?:k|lakh)?)/i);
    if (match) return match[1].replace(/^₹\s*/, '').replace(/^Rs\.?\s*/i, '');
    if (clean.length <= 15) return clean.replace(/^₹\s*/, '').replace(/^Rs\.?\s*/i, '');
    return clean.slice(0, 15);
  };

  const prizeDisplay = formatPrize();
  const venueDisplay = event?.venueName || 'CSED';

  const categoryName = event?.category || 'Technical';
  const typeTag = event?.eventType === 'team' ? 'Team' : 'Challenge';
  const subTag = event?.eventType === 'team' ? 'Hackathon' : (categoryName === 'Technical' ? 'Coding' : 'Showcase');

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[pressStyle, {
        width: '100%',
        backgroundColor: '#151518',
        borderRadius: 26,
        padding: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: isDark ? '#2D2D35' : '#222226',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.45 : 0.16,
        shadowRadius: 14,
        elevation: 6,
        overflow: 'hidden',
      }]}
    >
      {/* Top Image Section with Inset Rounded Corners */}
      <View
        style={{
          width: '100%',
          height: 195,
          borderRadius: 20,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Image transition={200}
          source={coverSource}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />

        {/* Floating Top-Right Date Badge */}
        <View
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            backgroundColor: 'rgba(22, 22, 26, 0.92)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 6,
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 54,
          }}
        >
          <Text
            style={{
              fontFamily: 'Poppins_700Bold',
              color: '#FFFFFF',
              fontSize: 20,
              lineHeight: 24,
            }}
          >
            {dateBadge.day}
          </Text>
          <Text
            style={{
              fontFamily: 'Poppins_500Medium',
              color: '#E0E0E0',
              fontSize: 12,
              lineHeight: 14,
            }}
          >
            {dateBadge.month}
          </Text>
        </View>
      </View>

      {/* Tag Pills Row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 6,
          marginTop: 12,
          marginBottom: 6,
        }}
      >
        {/* Centered Tag Pills */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Gold Pill */}
          <View
            style={{
              backgroundColor: '#FACC15',
              borderRadius: 9999,
              paddingHorizontal: 9,
              paddingVertical: 2.5,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                color: '#000000',
                fontSize: 10,
              }}
            >
              {typeTag}
            </Text>
          </View>

          {/* Rose Pill */}
          <View
            style={{
              backgroundColor: '#FB7185',
              borderRadius: 9999,
              paddingHorizontal: 9,
              paddingVertical: 2.5,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                color: '#FFFFFF',
                fontSize: 10,
              }}
            >
              {categoryName}
            </Text>
          </View>

          {/* Mint Green Pill */}
          <View
            style={{
              backgroundColor: '#4ADE80',
              borderRadius: 9999,
              paddingHorizontal: 9,
              paddingVertical: 2.5,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                color: '#052E16',
                fontSize: 10,
              }}
            >
              {subTag}
            </Text>
          </View>
        </View>
      </View>

      {/* Centered Event Title */}
      <Text
        style={{
          fontFamily: 'Poppins_700Bold',
          color: '#FFFFFF',
          fontSize: 19,
          lineHeight: 25,
          textAlign: 'center',
          paddingHorizontal: 8,
          marginVertical: 8,
        }}
        numberOfLines={2}
      >
        {event?.title || 'Event Title'}
      </Text>

      {/* Trophy Prize & Venue Row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 4,
          marginBottom: 14,
          paddingHorizontal: 8,
          width: '100%',
          maxWidth: '100%',
        }}
      >
        {/* Trophy and Prize */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 }}>
          <Ionicons
            name="trophy-outline"
            size={18}
            color="#E0E0E0"
            style={{ marginRight: 6, flexShrink: 0 }}
          />
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              color: '#FFFFFF',
              fontSize: 15,
              flexShrink: 1,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {prizeDisplay}
          </Text>
        </View>

        {/* Crimson Vertical Divider */}
        <View
          style={{
            width: 1.5,
            height: 18,
            backgroundColor: '#E11D48',
            marginHorizontal: 12,
            flexShrink: 0,
          }}
        />

        {/* Location and Venue */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 }}>
          <Ionicons
            name="location-outline"
            size={18}
            color="#E0E0E0"
            style={{ marginRight: 5, flexShrink: 0 }}
          />
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              color: '#FFFFFF',
              fontSize: 15,
              flexShrink: 1,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {venueDisplay}
          </Text>
        </View>
      </View>

      {/* Register Now Pill Button */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handlePress}
        style={{
          backgroundColor: '#5BB5F9',
          borderRadius: 9999,
          paddingVertical: 10,
          paddingHorizontal: 40,
          alignSelf: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
          minWidth: 180,
        }}
      >
        <Text
          style={{
            fontFamily: 'Poppins_600SemiBold',
            color: '#0F172A',
            fontSize: 14,
          }}
        >
          Register Now
        </Text>
      </TouchableOpacity>
    </AnimatedPressable>
  );
};

export default FeaturedEventCard;
