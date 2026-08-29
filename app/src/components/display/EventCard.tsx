// src/components/display/EventCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';

import { MapPin } from 'lucide-react-native';
import { FirebaseEvent } from '@/types/models';

interface EventCardProps {
  event: FirebaseEvent;
  onPress?: () => void; // Make optional since we'll handle navigation internally
  // variant?: 'default' | 'compact' | 'featured';
  className?: string;
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  onPress,
  // variant = 'default',
  className = ''
}) => {
  const router = useRouter();

  const handleEventPress = () => {
    if (onPress) {
      // Use custom onPress if provided (for backward compatibility)
      onPress();
    } else {
      router.push({ pathname: "/events/EventDetails", params: { eventData: JSON.stringify(event) } });
    }
  };

  // Helper functions to format FirebaseEvent data
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
    return event.coverImage ? { uri: event.coverImage } : require("@/assets/event.jpg");
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Technical': return 'primary';
      case 'Cultural': return 'info';
      case 'Sports': return 'success';
      case 'Workshop': return 'warning';
      default: return 'secondary';
    }
  };

  const { day, month } = getFormattedDate();
  const formattedTime = getFormattedTime();
  const eventImage = getEventImage();

  return (
    <TouchableOpacity
      className='flex flex-col bg-[#2D2D2D] overflow-hidden rounded-2xl shadow-md max-w-[270px] mr-4'
      onPress={handleEventPress}
      activeOpacity={0.9}
    >
      <View className='overflow-hidden'>
        <Image source={eventImage} className="w-full h-44" resizeMode="cover" />
      </View>
      <View className="flex flex-col absolute top-4 right-4 bg-[#FFFFFFD9] p-1 py-1 px-3 rounded-lg items-center">
        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-lg text-[#E84054]">
          {day}
        </Text>
        <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#E84054] mt-[-3px] text-sm">
          {month}
        </Text>
      </View>
      <View className="flex flex-col justify-between w-full px-3 py-3">
        {/* Event Name and Time - Keep in same row with proper truncation */}
        <View className='flex-row items-center w-full justify-between mb-1'>
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-2xl text-white flex-1 mr-2" numberOfLines={1} ellipsizeMode="tail">
            {event.title}
          </Text>
         
        </View>

        {/* Venue and Button */}
        <View className='flex-row items-center w-full justify-between'>
          <View className='flex flex-row items-center justify-center gap-[3px] flex-1 mr-2'>
            <MapPin size={16} fill="white" />
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#BCBCBC] mt-[-1px] text-md flex-1" numberOfLines={1} ellipsizeMode="tail">
              {event.venueName || 'TBA'}
            </Text>
          </View>
           <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className='text-[#BCBCBC] text-md flex-shrink-0'>
            {formattedTime}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default EventCard;