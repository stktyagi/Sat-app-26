// src/screens/App/Home/SearchEventsScreen.tsx
import React, { useState } from 'react';
import { Text, View, TextInput, FlatList, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEventsSearch, useEventsByCategory } from '@/hooks/useEvents';
import { FirebaseEvent } from '@/types/models';
import { getFormattedDate, getFormattedTime } from '@/utils/dateUtils';

import { useRouter } from 'expo-router';

export default function SearchEventsScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const categories = ['All', 'Technical', 'Cultural', 'Business', 'Informal'];

  // Use both search and category hooks
  const { events: searchEvents, loading: searchLoading } = useEventsSearch(searchText);
  const { events: categoryEvents, loading: categoryLoading } = useEventsByCategory(selectedCategory);

  // Combine filters: if searching, filter by search; otherwise by category
  const filteredEvents = searchText.trim() ? searchEvents : categoryEvents;
  const loading = searchText.trim() ? searchLoading : categoryLoading;

  const handleSearch = (text: string) => {
    setSearchText(text);
    // No manual filtering needed - the hook handles it automatically!
  };

  const renderEventItem = ({ item }: { item: FirebaseEvent }) => {
    // const day = getEventDay(item.dateTime, item.startDateTime);
    // const month = getEventMonth(item.dateTime, item.startDateTime)
    // const formattedDate = getEventTime(item.dateTime, item.startDateTime);
    const date = getFormattedDate(item.dateTime, item.startDateTime);
    // const time = getEventTime(item.dateTime, item.startDateTime);
    const eventImage = item.coverImage ? { uri: item.coverImage } : require('@/assets/event.jpg');

    return (
      <TouchableOpacity
        className="bg-[#0C3572] rounded-2xl flex-row mb-4 mx-4 p-3"
        onPress={() => router.push({ pathname: '/events/EventDetails', params: { eventData: JSON.stringify(item) } })}
      >


        {/* Event Image */}
        <View className="w-[40%] h-32 overflow-hidden rounded-xl mr-3">
          <Image source={eventImage} className="w-full h-full" resizeMode="cover"  />
        </View>

        {/* Event Details */}
        <View className="flex-1 justify-top gap-1">
          {/* starting date and time  */}
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-gray-400 text-sm">
            {date}  -  {getFormattedTime(item.dateTime)}
          </Text>
          <Text
            style={{ fontFamily: 'Outfit_700Bold' }}
            className="text-white text-xl mb-1"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.title}
          </Text>
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className='text-white text-sm mb-1' numberOfLines={3} ellipsizeMode="tail">
            {item.shortDescription}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-transparent">
      {/* Header */}
      <View className="bg-transparent px-4 pt-10 pb-4">
        <View className="flex-row  flex justify-between items-center mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-2"
          >
            <Ionicons name="arrow-back" size={24} color="#0C3572" />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0C3572] text-3xl">Events</Text>
          <View className='bg-white h-12 w-14 invisible'>
          </View>
        </View>

        {/* Search Input */}
        <View
          style={{
               boxShadow: '0px 4px 10px 0px rgba(0, 0, 0, 0.2)', 
            }}
        className="bg-white rounded-2xl px-5 py-2 flex-row items-center mb-4">
          <Ionicons name="search" size={20} className='mb-1' color="#9CA3AF" />
          <TextInput
            style={{ fontFamily: 'Outfit_500Medium' }}
            className="text-black flex-1 ml-2 text-lg"
            placeholder="Search events, categories, venues..."
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={handleSearch}
            autoFocus={true}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter - only show when not searching */}
        {!searchText.trim() && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-2"
          >
            {categories.map(cat => {
              const selected = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  className={`${selected ? 'border-[#EEB170]' : 'border-[#0C3572]'} px-4 py-2 border-2 rounded-2xl mr-3`}
                >
                  <Text style={{ fontFamily: 'Outfit_500Medium' }} className={`${selected ? 'text-[#EEB170]' : 'text-[#0C3572]'} font-medium`}>{cat}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Results */}
      <View className="flex-1">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] text-lg">
              Loading events...
            </Text>
          </View>
        ) : filteredEvents.length > 0 ? (
          <>
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] text-sm px-6 mb-4">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found
            </Text>
            <FlatList
              data={filteredEvents}
              renderItem={renderEventItem}
              keyExtractor={(item) => item.eventId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          </>
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="search" size={64} color="#0C3572" />
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572] text-lg text-center mt-4">
              No events found matching "{searchText}"
            </Text>
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] text-sm text-center mt-2">
              Try searching for different keywords
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}