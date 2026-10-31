// src/screens/App/Home/SearchEventsScreen.tsx
import React, { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { ArrowLeft, Search, X, Calendar, Clock } from 'lucide-react-native';
import { useEventsSearch, useEventsByCategory } from '@/hooks/useEvents';
import { FirebaseEvent } from '@/types/models';
import { getFormattedDate, getFormattedTime } from '@/utils/dateUtils';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/state/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SearchEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();

  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const categories = ['All', 'Technical', 'Cultural', 'Business', 'Informal'];

  const bgColor = isDark ? "#131316" : "#E0E0E0";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A30" : "#D5D5D5";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#A0A0A0" : "#6B7280";

  // Use both search and category hooks
  const { events: searchEvents, loading: searchLoading } = useEventsSearch(searchText);
  const { events: categoryEvents, loading: categoryLoading } = useEventsByCategory(selectedCategory);

  const filteredEvents = searchText.trim() ? searchEvents : categoryEvents;
  const loading = searchText.trim() ? searchLoading : categoryLoading;

  const handleSearch = (text: string) => {
    setSearchText(text);
  };

  const renderEventItem = ({ item }: { item: FirebaseEvent }) => {
    const date = getFormattedDate(item.dateTime, item.startDateTime);
    const time = getFormattedTime(item.dateTime);
    const eventImage = item.coverImage ? { uri: item.coverImage } : require('@/assets/event.jpg');

    return (
      <TouchableOpacity
        style={{
          backgroundColor: cardBg,
          borderRadius: 20,
          flexDirection: 'row',
          marginBottom: 14,
          marginHorizontal: 20,
          padding: 12,
          borderWidth: 1,
          borderColor: cardBorder,
        }}
        onPress={() => router.push({ pathname: '/events/EventDetails', params: { eventData: JSON.stringify(item) } })}
        activeOpacity={0.75}
      >
        {/* Event Image */}
        <View style={{ width: 100, height: 100, overflow: 'hidden', borderRadius: 14, marginRight: 12 }}>
          <Image transition={200} source={eventImage} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>

        {/* Event Details */}
        <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 2 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Calendar size={12} color="#41B8F0" />
              <Text
                style={{
                  fontFamily: 'Poppins_400Regular',
                  color: textSecondary,
                  fontSize: 11,
                  marginLeft: 4,
                }}
              >
                {date} {time ? `• ${time}` : ''}
              </Text>
            </View>

            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                color: textPrimary,
                fontSize: 15,
                marginBottom: 2,
              }}
              numberOfLines={1}
            >
              {item.title}
            </Text>

            <Text
              style={{
                fontFamily: 'Poppins_400Regular',
                color: textSecondary,
                fontSize: 12,
                lineHeight: 16,
              }}
              numberOfLines={2}
            >
              {item.shortDescription || item.description}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            <View
              style={{
                backgroundColor: isDark ? 'rgba(65, 184, 240, 0.15)' : '#E0F2FE',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Poppins_500Medium',
                  color: '#41B8F0',
                  fontSize: 10,
                }}
              >
                {item.category}
              </Text>
            </View>
            {item.eventType && (
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Poppins_500Medium',
                    color: textSecondary,
                    fontSize: 10,
                    textTransform: 'capitalize',
                  }}
                >
                  {item.eventType}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 16,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: bgColor,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'Talina',
              fontSize: 22,
              color: textPrimary,
              letterSpacing: 0.5,
            }}
          >
            Search Events
          </Text>
          <Text
            style={{
              fontFamily: 'Poppins_400Regular',
              fontSize: 12,
              color: '#41B8F0',
              marginTop: 1,
            }}
          >
            Discover competitions, cultural & technical events
          </Text>
        </View>
      </View>

      {/* Search Input Box */}
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          <Search size={18} color="#41B8F0" />
          <TextInput
            style={{
              fontFamily: 'Poppins_400Regular',
              fontSize: 14,
              color: textPrimary,
              flex: 1,
              marginLeft: 10,
            }}
            placeholder="Search by title, category, description..."
            placeholderTextColor={textSecondary}
            value={searchText}
            onChangeText={handleSearch}
            autoFocus={true}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')} activeOpacity={0.7}>
              <X size={18} color={textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills (shown when not searching) */}
      {!searchText.trim() && (
        <View style={{ marginBottom: 14 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            {categories.map((cat) => {
              const selected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={{
                    backgroundColor: selected ? '#41B8F0' : cardBg,
                    borderWidth: 1,
                    borderColor: selected ? '#41B8F0' : cardBorder,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginRight: 8,
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={{
                      fontFamily: 'Poppins_600SemiBold',
                      fontSize: 12,
                      color: selected ? '#FFFFFF' : textPrimary,
                    }}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Results */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#41B8F0" />
            <Text
              style={{
                fontFamily: 'Poppins_400Regular',
                color: textSecondary,
                fontSize: 13,
                marginTop: 12,
              }}
            >
              Loading events...
            </Text>
          </View>
        ) : filteredEvents.length > 0 ? (
          <>
            <Text
              style={{
                fontFamily: 'Poppins_500Medium',
                color: textSecondary,
                fontSize: 12,
                paddingHorizontal: 20,
                marginBottom: 10,
              }}
            >
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found
            </Text>
            <FlatList
              data={filteredEvents}
              renderItem={renderEventItem}
              keyExtractor={(item, index) => item.eventId ? `${item.eventId}-${index}` : `event-${index}`}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            />
          </>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <Search size={48} color={textSecondary} />
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                color: textPrimary,
                fontSize: 16,
                textAlign: 'center',
                marginTop: 14,
              }}
            >
              No events found matching "{searchText}"
            </Text>
            <Text
              style={{
                fontFamily: 'Poppins_400Regular',
                color: textSecondary,
                fontSize: 12,
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              Try searching with different keywords or browse by category
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}