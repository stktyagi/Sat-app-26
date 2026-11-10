import { getOptimizedImageUrl } from '@/utils/image';
// src/components/display/EventCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { MapPin } from 'lucide-react-native';
import { FirebaseEvent } from '@/types/models';
import { useAuth } from '@/hooks/useAuth';

interface EventCardProps {
  event: FirebaseEvent;
  onPress?: () => void;
  className?: string;
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  onPress,
  className = ''
}) => {
  const router = useRouter();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.roles?.includes('admin');

  const handleEventPress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({ pathname: "/events/EventDetails", params: { eventData: JSON.stringify(event) } });
    }
  };

  const getFormattedDate = () => {
    const eventDate = new Date(event.dateTime || event.startDateTime);
    return {
      day: eventDate.getDate().toString(),
      month: eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    };
  };

  const getFormattedTime = () => {
    const eventDate = new Date(event.dateTime || event.startDateTime);
    return eventDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getEventImage = () => {
    const optimizedUrl = getOptimizedImageUrl(event.coverImage, 400);
    return optimizedUrl ? { uri: optimizedUrl } : require("@/assets/event.jpg");
  };

  const { day, month } = getFormattedDate();
  const formattedTime = getFormattedTime();
  const eventImage = getEventImage();

  return (
    <TouchableOpacity
      className={`flex flex-col bg-white overflow-hidden rounded-[24px] mr-4 w-[280px] ${className}`}
      style={{ boxShadow: '0px 8px 17px rgba(12, 53, 114, 0.12)' }}
      onPress={handleEventPress}
      activeOpacity={0.9}
    >
      <View className='overflow-hidden m-2 rounded-[18px]'>
        <Image
          source={eventImage}
          className="w-full h-40"
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
        
        {/* Date Badge */}
        <View className="absolute top-3 right-3 bg-white/95 px-3 py-1.5 rounded-xl items-center backdrop-blur-md" style={{ boxShadow: '0px 4px 12px rgba(0,0,0,0.1)' }}>
          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-lg text-[#0C3572] leading-5">
            {day}
          </Text>
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#EEB170] text-xs">
            {month}
          </Text>
        </View>

        {/* Admin Public/Private Tag */}
        {isAdmin && (
          <View className={`absolute top-3 left-3 px-3 py-1.5 rounded-xl items-center backdrop-blur-md ${event.isPublic ? 'bg-green-500/90' : 'bg-red-500/90'}`}>
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-white text-xs">
              {event.isPublic ? 'Public' : 'Private'}
            </Text>
          </View>
        )}
      </View>
      
      <View className="flex flex-col justify-between w-full px-4 pt-2 pb-5">
        <View className='flex-row items-center w-full justify-between mb-2'>
          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-xl text-[#0C3572] flex-1 mr-2" numberOfLines={1}>
            {event.title}
          </Text>
        </View>

        <View className='flex-row items-center w-full justify-between'>
          <View className='flex flex-row items-center flex-1 mr-2 px-2 py-1.5 rounded-lg'>
            <MapPin size={14} color="#0C3572" />
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572] ml-1.5 text-xs flex-1" numberOfLines={1}>
              {event.venueName || 'TBA'}
            </Text>
          </View>
          <View className='px-2 py-1.5 rounded-lg ml-2'>
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className='text-[#0C3572] text-xs'>
              {formattedTime}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default EventCard;