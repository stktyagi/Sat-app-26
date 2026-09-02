import React from "react";
import { View,Image } from "react-native";
import Calendar from '@/components/interactive/Calendar';
import { useEvents } from '@/hooks/useEvents';
import Header from '@/components/layout/Header'
import { useRouter } from 'expo-router';

const EventsScreen = () => {
  const router = useRouter();
  const { events, loading, error } = useEvents();
  
  return (
    <View className="flex-1 bg-transparent">
      <Header />
      <Calendar events={events} loading={loading} error={error} navigation={router as any} />
    </View>
  );
};
 
export default EventsScreen;