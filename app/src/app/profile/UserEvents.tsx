// src/screens/App/Profile/UserEventsScreen.tsx
import React, { useState } from "react";
import { Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserStore } from "@/state/userStore";
import Header from '@/components/layout/Header'
import { useMyEvents } from '@/hooks/useMyEvents';

const UserEventsScreen: React.FC = () => {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('all');
  const { userData: userProfile } = useUserStore();
  const userId = userProfile?.userId || '';

  const { data: rows, loading } = useMyEvents();

  const events = rows.map((row: any) => ({
    eventId: row.event?.eventId || row.registration?.eventId,
    eventName: row.event?.title || row.registration?.eventName || 'Unknown Event',
    eventCategory: row.event?.category || row.registration?.eventCategory || 'Uncategorized',
    status: row.registration?.status || 'confirmed',
    ...row.registration,
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-500/20 text-green-400';
      case 'pending':
        return 'bg-[#EEB170]/20 text-[#EEB170]';
      case 'awaited':
        return 'bg-blue-500/20 text-blue-400';
      case 'payment_pending':
        return 'bg-orange-500/20 text-orange-400';
      case 'rejected':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-[#2175C0]';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'music':
        return 'musical-notes';
      case 'arts':
        return 'brush';
      case 'gaming':
        return 'game-controller';
      case 'sports':
        return 'fitness';
      case 'tech':
        return 'laptop';
      default:
        return 'calendar';
    }
  };

  const filteredEvents = events.filter(event => {
    if (activeFilter === 'all') return true;
    return event.status === activeFilter;
  });

  const FilterButton = ({ title, filterKey }: { title: string, filterKey: string }) => (
    <TouchableOpacity
      className={`px-8 py-2 border-2 rounded-2xl mr-3 ${activeFilter === filterKey ? 'border-[#F22F50]' : 'border-[#A0B3D0]'
        }`}
      onPress={() => setActiveFilter(filterKey)}
    >
      <Text style={{ fontFamily: 'Outfit_500Medium' }} className={`${activeFilter === filterKey ? 'text-[#F22F50]' : 'text-[#0C3572]'
        }`}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  /* Removed API call */

  if (loading) {
    return (
      <View className="flex-1 bg-transparent items-center justify-center">
        <ActivityIndicator size="large" color="#EEB170" />
        <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572] mt-4">Loading your events...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-transparent">
      {/* Header */}
      <Header />

      <View className="flex-row items-center justify-between mb-4 px-6 mt-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#0C3572" />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0C3572] text-2xl">My Events</Text>
          <View className="w-12" />
      </View>


      {/* Filters */}
      <View className="px-6 py-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterButton title="All" filterKey="all" />
          <FilterButton title="Confirmed" filterKey="confirmed" />
          <FilterButton title="Awaited" filterKey="awaited" />
          <FilterButton title="Pending" filterKey="pending" />
          <FilterButton title="Payment Due" filterKey="payment_pending" />
          <FilterButton title="Rejected" filterKey="rejected" />
        </ScrollView>
      </View>

      {/* Events List */}
      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {filteredEvents.length === 0 ? (
          <View className="flex-1 justify-center items-center py-16">
            <Ionicons name="calendar-outline" size={64} color="#6B7280" />
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-xl mt-4 mb-2">
              {activeFilter === 'all' ? 'No Events Registered' : `No ${activeFilter} Events`}
            </Text>
            <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[#2175C0] text-center mb-6 leading-6">
              {activeFilter === 'all'
                ? "You haven't registered for any events yet.\nExplore and register for exciting events!"
                : `No events with ${activeFilter} status found.`
              }
            </Text>

            {activeFilter === 'all' && (
              <TouchableOpacity 
              onPress={() => router.push("/events/SearchEvents")}
               className="bg-[#EEB170] rounded-xl px-6 py-3 flex-row items-center">
                <Ionicons name="add" size={20} color="#000" />
                <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-black font-semibold ml-2">Browse Events</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View>
            {filteredEvents.map((event) => (
              <TouchableOpacity
                key={event.eventId}
                onPress={() => router.push({ pathname: '/events/MyEventDetails', params: { eventId: event.eventId } })}
                className="bg-white rounded-2xl p-4 mb-3 border border-[#A0B3D0]"
              >
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-lg">
                  {event.eventName}
                </Text>
                <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] mt-1">
                  {event.eventCategory} · {event.status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default UserEventsScreen;
