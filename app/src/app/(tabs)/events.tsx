import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEvents } from '@/hooks/useEvents';
import { useThemeStore } from '@/state/themeStore';
import { useUserStore } from '@/state/userStore';
import { useAdminDrawerStore } from '@/state/adminDrawerStore';
import { FirebaseEvent } from '@/types/models';
import FeaturedEventCard from '@/components/display/FeaturedEventCard';
import { isUserAdmin } from '@/utils/roles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const EXPLORE_CATEGORIES = [
  { id: 'Cultural', label: 'Cultural', icon: 'musical-notes' },
  { id: 'Technical', label: 'Technical', icon: 'code-slash' },
  { id: 'Business', label: 'Business', icon: 'briefcase' },
  { id: 'Workshops', label: 'Workshops', icon: 'build' },
  { id: 'Informal', label: 'Informal', icon: 'game-controller' },
  { id: 'All', label: 'All', icon: 'sparkles' },
];

const BENTO_CONFIG = [
  { height: 110, bgColor: '#38BDF8' }, // Top-Left
  { height: 175, bgColor: '#C8E946' }, // Bottom-Left
  { height: 175, bgColor: '#E06A6A' }, // Top-Right
  { height: 110, bgColor: '#C04B6A' }, // Bottom-Right
];



function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

const getEventTimeText = (evt: any) => {
  if (evt.timeText) return evt.timeText;
  const raw = evt.dateTime || evt.startDateTime;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return `Time: ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    return `Time: ${raw}`;
  }
  return 'Time: Overnight';
};

function parseEventDate(rawDate?: any): Date | null {
  if (!rawDate) return null;
  if (rawDate instanceof Date) return isNaN(rawDate.getTime()) ? null : rawDate;
  if (typeof rawDate === 'object' && rawDate.seconds) {
    return new Date(rawDate.seconds * 1000);
  }
  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function formatTimelineDateLabel(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  return `${getOrdinalSuffix(day)} ${month}`;
}

export default function EventsTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useThemeStore();
  const { userData: userProfile } = useUserStore();
  const { openDrawer } = useAdminDrawerStore();
  const { events, loading, refresh } = useEvents();

  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  // Featured events for Spotlight Bento Box
  const featuredEvents = useMemo(() => {
    const list = events.filter((e) => e.isFeatured === true);
    if (list.length > 0) return list;
    return events;
  }, [events]);

  // Group featured events into bento pages of 4 items each
  const bentoGroups = useMemo(() => {
    const groups: FirebaseEvent[][] = [];
    for (let i = 0; i < featuredEvents.length; i += 4) {
      const chunk = featuredEvents.slice(i, i + 4);
      if (chunk.length > 0) groups.push(chunk);
    }
    return groups;
  }, [featuredEvents]);

  // Top 10 Hyped Events sorted by registrations
  const hypedEvents = useMemo(() => {
    if (events.length === 0) return [];
    const sorted = [...events].sort((a, b) => (b.registeredCount || 0) - (a.registeredCount || 0));
    return sorted.slice(0, 10);
  }, [events]);

  // Timeline groups for each date — ONLY includes dates with actual scheduled events
  const timelineGroups = useMemo(() => {
    const dateMap: Record<string, { label: string; dateObj: Date; events: FirebaseEvent[] }> = {};

    events.forEach((evt) => {
      const raw = evt.dateTime || evt.startDateTime;
      const d = parseEventDate(raw);
      if (d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const key = `${year}-${month}-${day}`;
        const label = formatTimelineDateLabel(d);

        if (!dateMap[key]) {
          dateMap[key] = { label, dateObj: d, events: [] };
        }
        dateMap[key].events.push(evt);
      }
    });

    const sortedKeys = Object.keys(dateMap).sort((a, b) => {
      return dateMap[a].dateObj.getTime() - dateMap[b].dateObj.getTime();
    });

    return sortedKeys.map((key) => ({
      dateKey: key,
      dateLabel: dateMap[key].label,
      events: dateMap[key].events,
    }));
  }, [events]);

  // Search and Category Filter Results (shown when searching or category selected)
  const isFilteringActive = searchText.trim().length > 0 || (selectedCategory !== null && selectedCategory !== 'All');

  const filteredResults = useMemo(() => {
    if (!isFilteringActive) return [];
    return events.filter((evt) => {
      if (selectedCategory && selectedCategory !== 'All') {
        const cat = (evt.category || '').toLowerCase();
        if (cat !== selectedCategory.toLowerCase()) return false;
      }
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const title = (evt.title || '').toLowerCase();
        const desc = (evt.shortDescription || evt.description || '').toLowerCase();
        const venue = (evt.venueName || '').toLowerCase();
        const category = (evt.category || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || venue.includes(q) || category.includes(q);
      }
      return true;
    });
  }, [events, isFilteringActive, selectedCategory, searchText]);

  const handleEventPress = (event: FirebaseEvent) => {
    router.push({
      pathname: '/events/EventDetails',
      params: { eventData: JSON.stringify(event) },
    });
  };

  const getHypeCountText = (event: FirebaseEvent, index: number) => {
    const count = event.registeredCount ?? 0;
    if (count === 0) {
      return '0 Registered';
    }
    if (count === 1) {
      return '1 Registered';
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K+ Registered`;
    }
    return `${count} Registered`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#131316' : '#E0E0E0' }}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top + 8, 16),
          paddingBottom: 110,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#38BDF8']}
            tintColor="#38BDF8"
          />
        }
      >
        {/* Top Header Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            marginBottom: 18,
          }}
        >
          {/* Left: Hamburger menu for admins, or spacer */}
          {isUserAdmin(userProfile) ? (
            <TouchableOpacity
              onPress={openDrawer}
              activeOpacity={0.75}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="menu" size={22} color={isDark ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44, height: 44 }} />
          )}

          {/* Center: Heading */}
          <Text
            style={{
              fontFamily: 'Talina',
              fontSize: 32,
              letterSpacing: 0.5,
              color: isDark ? '#FFFFFF' : '#000000',
              textAlign: 'center',
            }}
          >
            Events
          </Text>

          {/* Right: Profile Avatar */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.85}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 2,
              borderColor: '#38BDF8',
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
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
                color={isDark ? '#38BDF8' : '#0C3572'}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
              borderWidth: 1.5,
              borderColor: isDark ? '#2D2D34' : '#E5E7EB',
              borderRadius: 25,
              paddingHorizontal: 16,
              paddingVertical: 11,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: isDark ? 0.3 : 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Ionicons
              name="search"
              size={18}
              color={isDark ? '#9CA3AF' : '#6B7280'}
              style={{ marginRight: 10 }}
            />
            <TextInput
              style={{
                flex: 1,
                fontFamily: 'Poppins_400Regular',
                fontSize: 15,
                color: isDark ? '#FFFFFF' : '#111827',
                padding: 0,
              }}
              placeholder="Search Event"
              placeholderTextColor={isDark ? '#71717A' : '#9CA3AF'}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Explore Section */}
        <View style={{ marginBottom: 26 }}>
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <Text
              style={{
                fontFamily: 'Talina',
                fontSize: 24,
                letterSpacing: 0.5,
                color: isDark ? '#FFFFFF' : '#000000',
              }}
            >
              Explore
            </Text>
          </View>

          {/* Horizontal Category Filter Pills with Leading Icons */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
          >
            {EXPLORE_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setSelectedCategory((prev) => (prev === cat.id ? null : cat.id));
                  }}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isSelected
                      ? 'rgba(56, 189, 248, 0.22)'
                      : isDark
                      ? '#18181D'
                      : '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: isSelected ? '#38BDF8' : isDark ? '#2E2E36' : '#D1D5DB',
                    borderRadius: 22,
                    paddingLeft: 6,
                    paddingRight: 16,
                    paddingVertical: 6,
                  }}
                >
                  {/* Leading Circular Icon Badge */}
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: isSelected ? '#38BDF8' : isDark ? '#282830' : '#E5E7EB',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                    }}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={15}
                      color={isSelected ? '#000000' : isDark ? '#FFFFFF' : '#374151'}
                    />
                  </View>

                  <Text
                    style={{
                      fontFamily: 'Poppins_600SemiBold',
                      fontSize: 14,
                      color: isDark ? '#FFFFFF' : '#111827',
                    }}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* If user is actively searching / filtering, display Filtered Results */}
        {isFilteringActive ? (
          <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text
                style={{
                  fontFamily: 'Talina',
                  fontSize: 22,
                  color: isDark ? '#FFFFFF' : '#111827',
                  letterSpacing: 0.5,
                }}
              >
                Filtered Results ({filteredResults.length})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchText('');
                  setSelectedCategory(null);
                }}
              >
                <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#38BDF8', fontSize: 13 }}>
                  Clear All
                </Text>
              </TouchableOpacity>
            </View>

            {filteredResults.length === 0 ? (
              <View
                style={{
                  paddingVertical: 36,
                  paddingHorizontal: 20,
                  alignItems: 'center',
                  backgroundColor: isDark ? '#18181D' : '#F3F4F6',
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isDark ? '#2E2E36' : '#E5E7EB',
                }}
              >
                <Ionicons name="search-outline" size={38} color={isDark ? '#6B7280' : '#9CA3AF'} style={{ marginBottom: 10 }} />
                <Text style={{ fontFamily: 'Talina', fontSize: 20, color: isDark ? '#FFFFFF' : '#111827', marginBottom: 4 }}>
                  No Matching Events
                </Text>
                <Text style={{ fontFamily: 'Poppins_400Regular', color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 13, textAlign: 'center' }}>
                  No events found for "{searchText || selectedCategory}"
                </Text>
              </View>
            ) : (
              <View style={{ width: '100%' }}>
                {filteredResults.map((evt, idx) => (
                  <FeaturedEventCard key={`filter-${evt.eventId || idx}-${idx}`} event={evt} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
            {/* "In the Spotlight" Bento Box Section */}
            {(loading || featuredEvents.length > 0) && (
            <View style={{ marginBottom: 30 }}>
              <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                <Text
                  style={{
                    fontFamily: 'Talina',
                    fontSize: 32,
                    lineHeight: 36,
                    letterSpacing: 0.5,
                    color: '#A855F7',
                  }}
                >
                  In the
                </Text>
                <Text
                  style={{
                    fontFamily: 'Talina',
                    fontSize: 34,
                    lineHeight: 38,
                    letterSpacing: 0.5,
                    color: '#38BDF8',
                    marginTop: -4,
                  }}
                >
                  Spotlight
                </Text>
              </View>

              {/* Bento Box Horizontal Slider */}
              {loading && featuredEvents.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
                >
                  {bentoGroups.map((group, groupIdx) => {
                    const c1 = group[0];
                    const c2 = group[1];
                    const c3 = group[2];
                    const c4 = group[3];

                    return (
                      <View
                        key={`bento-group-${groupIdx}`}
                        style={{
                          flexDirection: 'row',
                          gap: 12,
                          width: SCREEN_WIDTH - 40,
                        }}
                      >
                        {/* Left Column */}
                        <View style={{ flex: 1, gap: 12 }}>
                          {/* Card 1 (Top Left - Height 110) */}
                          {c1 ? (
                            <TouchableOpacity
                              onPress={() => handleEventPress(c1)}
                              activeOpacity={0.88}
                              style={{
                                height: BENTO_CONFIG[0].height,
                                backgroundColor: BENTO_CONFIG[0].bgColor,
                                borderRadius: 18,
                                padding: 14,
                                justifyContent: 'flex-end',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 6,
                                elevation: 4,
                              }}
                            >
                              <Text
                                style={{
                                  fontFamily: 'Poppins_700Bold',
                                  fontSize: 16,
                                  color: '#000000',
                                  lineHeight: 20,
                                }}
                                numberOfLines={2}
                              >
                                {c1.title || 'Event'}
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={{ height: BENTO_CONFIG[0].height, borderRadius: 18 }} />
                          )}

                          {/* Card 2 (Bottom Left - Height 175) */}
                          {c2 ? (
                            <TouchableOpacity
                              onPress={() => handleEventPress(c2)}
                              activeOpacity={0.88}
                              style={{
                                height: BENTO_CONFIG[1].height,
                                backgroundColor: BENTO_CONFIG[1].bgColor,
                                borderRadius: 18,
                                padding: 14,
                                justifyContent: 'flex-end',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 6,
                                elevation: 4,
                              }}
                            >
                              <Text
                                style={{
                                  fontFamily: 'Poppins_700Bold',
                                  fontSize: 16,
                                  color: '#000000',
                                  lineHeight: 20,
                                }}
                                numberOfLines={3}
                              >
                                {c2.title || 'Event'}
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={{ height: BENTO_CONFIG[1].height, borderRadius: 18 }} />
                          )}
                        </View>

                        {/* Right Column */}
                        <View style={{ flex: 1, gap: 12 }}>
                          {/* Card 3 (Top Right - Height 175) */}
                          {c3 ? (
                            <TouchableOpacity
                              onPress={() => handleEventPress(c3)}
                              activeOpacity={0.88}
                              style={{
                                height: BENTO_CONFIG[2].height,
                                backgroundColor: BENTO_CONFIG[2].bgColor,
                                borderRadius: 18,
                                padding: 14,
                                justifyContent: 'flex-end',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 6,
                                elevation: 4,
                              }}
                            >
                              <Text
                                style={{
                                  fontFamily: 'Poppins_700Bold',
                                  fontSize: 16,
                                  color: '#000000',
                                  lineHeight: 20,
                                }}
                                numberOfLines={3}
                              >
                                {c3.title || 'Event'}
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={{ height: BENTO_CONFIG[2].height, borderRadius: 18 }} />
                          )}

                          {/* Card 4 (Bottom Right - Height 110) */}
                          {c4 ? (
                            <TouchableOpacity
                              onPress={() => handleEventPress(c4)}
                              activeOpacity={0.88}
                              style={{
                                height: BENTO_CONFIG[3].height,
                                backgroundColor: BENTO_CONFIG[3].bgColor,
                                borderRadius: 18,
                                padding: 14,
                                justifyContent: 'flex-end',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 6,
                                elevation: 4,
                              }}
                            >
                              <Text
                                style={{
                                  fontFamily: 'Poppins_700Bold',
                                  fontSize: 16,
                                  color: '#000000',
                                  lineHeight: 20,
                                }}
                                numberOfLines={2}
                              >
                                {c4.title || 'Event'}
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={{ height: BENTO_CONFIG[3].height, borderRadius: 18 }} />
                          )}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
            )}

            {/* "Hyped Events" Section */}
            {hypedEvents.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                <Text
                  style={{
                    fontFamily: 'Talina',
                    fontSize: 32,
                    letterSpacing: 0.5,
                  }}
                >
                  <Text style={{ color: '#A855F7' }}>Hyped </Text>
                  <Text style={{ color: '#38BDF8' }}>Events</Text>
                </Text>
              </View>

              {/* Hyped Events Horizontal Slider (Top 5 registered) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
              >
                {hypedEvents.map((evt, idx) => {
                  const coverSource = evt.coverImage
                    ? { uri: evt.coverImage }
                    : idx % 3 === 0
                    ? require('@/assets/satwrap2.jpg')
                    : idx % 3 === 1
                    ? require('@/assets/satwrap3.jpg')
                    : require('@/assets/event.jpg');
                  const hypeBadge = getHypeCountText(evt, idx);

                  return (
                    <TouchableOpacity
                      key={`hyped-${evt.eventId || idx}-${idx}`}
                      onPress={() => handleEventPress(evt)}
                      activeOpacity={0.92}
                      style={{
                        width: 185,
                        height: 270,
                        borderRadius: 20,
                        overflow: 'hidden',
                        backgroundColor: '#1E1E22',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.35,
                        shadowRadius: 8,
                        elevation: 5,
                      }}
                    >
                      {/* Background Image */}
                      <Image transition={200}
                        source={coverSource}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />

                      {/* Dark Gradient Overlay for text readability */}
                      <LinearGradient
                        colors={['transparent', 'rgba(0, 0, 0, 0.45)', 'rgba(0, 0, 0, 0.95)']}
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: 140,
                        }}
                      />

                      {/* Card Content at Bottom */}
                      <View
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: 14,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'Poppins_700Bold',
                            color: '#FFFFFF',
                            fontSize: 16,
                            lineHeight: 21,
                            marginBottom: 2,
                          }}
                          numberOfLines={1}
                        >
                          {evt.title}
                        </Text>

                        <Text
                          style={{
                            fontFamily: 'Poppins_400Regular',
                            color: '#D1D5DB',
                            fontSize: 12,
                            marginBottom: 6,
                          }}
                          numberOfLines={1}
                        >
                          {evt.category || 'Featured Event'}
                        </Text>

                        <Text
                          style={{
                            fontFamily: 'Poppins_600SemiBold',
                            color: '#38BDF8',
                            fontSize: 12,
                          }}
                        >
                          {hypeBadge}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            )}

            {/* "Timeline" Section */}
            <View style={{ marginBottom: 30 }}>
              <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
                <Text
                  style={{
                    fontFamily: 'Talina',
                    fontSize: 34,
                    letterSpacing: 0.5,
                  }}
                >
                  <Text style={{ color: '#A855F7' }}>Time</Text>
                  <Text style={{ color: '#38BDF8' }}>line</Text>
                </Text>
              </View>

              {/* Timeline date groups */}
              {loading && events.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                </View>
              ) : timelineGroups.length === 0 ? (
                <View
                  style={{
                    paddingVertical: 28,
                    paddingHorizontal: 20,
                    marginHorizontal: 20,
                    alignItems: 'center',
                    backgroundColor: isDark ? '#18181D' : '#F3F4F6',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: isDark ? '#2E2E36' : '#E5E7EB',
                  }}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={32}
                    color={isDark ? '#6B7280' : '#9CA3AF'}
                    style={{ marginBottom: 8 }}
                  />
                  <Text
                    style={{
                      fontFamily: 'Poppins_600SemiBold',
                      fontSize: 15,
                      color: isDark ? '#E5E7EB' : '#111827',
                      marginBottom: 4,
                    }}
                  >
                    No Events Scheduled
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Poppins_400Regular',
                      color: isDark ? '#9CA3AF' : '#6B7280',
                      fontSize: 13,
                      textAlign: 'center',
                    }}
                  >
                    There are currently no events scheduled on the timeline.
                  </Text>
                </View>
              ) : (
                <View style={{ paddingLeft: 20 }}>
                  {timelineGroups.map((group, groupIdx) => {
                    const isLast = groupIdx === timelineGroups.length - 1;
                    const ROW_GAP = 24;
                    const CIRCLE_SIZE = 14;
                    const CIRCLE_TOP = 4;
                    const LINE_BOTTOM_OFFSET = -(ROW_GAP + CIRCLE_TOP + CIRCLE_SIZE / 2);

                    return (
                      <View
                        key={`tl-group-${group.dateKey || groupIdx}-${groupIdx}`}
                        style={{
                          flexDirection: 'row',
                          marginBottom: isLast ? 10 : ROW_GAP,
                        }}
                      >
                        {/* Left Column: Vertical Timeline Track with Node & Continuous Connecting Rail */}
                        <View style={{ width: 16, alignItems: 'center', marginRight: 14 }}>
                          {/* Continuous Vertical Rail connecting directly from this circle to the next circle */}
                          {!isLast && (
                            <View
                              style={{
                                position: 'absolute',
                                top: CIRCLE_TOP + CIRCLE_SIZE / 2,
                                bottom: LINE_BOTTOM_OFFSET,
                                width: 2.5,
                                backgroundColor: '#818CF8',
                                zIndex: 0,
                              }}
                            />
                          )}

                          {/* Dot / Circle: sits on top of the rail */}
                          <View
                            style={{
                              width: CIRCLE_SIZE,
                              height: CIRCLE_SIZE,
                              borderRadius: CIRCLE_SIZE / 2,
                              backgroundColor: '#60A5FA',
                              shadowColor: '#38BDF8',
                              shadowOffset: { width: 0, height: 0 },
                              shadowOpacity: 0.9,
                              shadowRadius: 5,
                              elevation: 4,
                              marginTop: CIRCLE_TOP,
                              zIndex: 2,
                            }}
                          />
                        </View>

                      {/* Right Column: Date Label + Horizontal Event Cards */}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: 'Poppins_700Bold',
                            fontSize: 18,
                            color: isDark ? '#FFFFFF' : '#111827',
                            marginBottom: 14,
                            lineHeight: 22,
                          }}
                        >
                          {group.dateLabel}
                        </Text>

                        {/* Horizontal ScrollView of Event Cards for this date */}
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: 14, paddingRight: 20, paddingBottom: 6 }}
                        >
                          {group.events.map((evt: any, cardIdx: number) => {
                            const coverSource = evt.coverImage
                              ? { uri: evt.coverImage }
                              : (groupIdx + cardIdx) % 3 === 0
                              ? require('@/assets/satwrap2.jpg')
                              : (groupIdx + cardIdx) % 3 === 1
                              ? require('@/assets/satwrap3.jpg')
                              : require('@/assets/event.jpg');

                            const timeText = getEventTimeText(evt);

                            return (
                              <TouchableOpacity
                                key={`tl-card-${groupIdx}-${evt.eventId || cardIdx}-${cardIdx}`}
                                onPress={() => handleEventPress(evt)}
                                activeOpacity={0.9}
                                style={{
                                  width: 155,
                                  height: 180,
                                  borderRadius: 18,
                                  overflow: 'hidden',
                                  backgroundColor: '#1E1E22',
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: 0.35,
                                  shadowRadius: 6,
                                  elevation: 4,
                                }}
                              >
                                {/* Event Image */}
                                <Image transition={200}
                                  source={coverSource}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="cover"
                                />

                                {/* Dark Gradient Overlay */}
                                <LinearGradient
                                  colors={['transparent', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.92)']}
                                  style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    height: 100,
                                  }}
                                />

                                {/* Content Overlaid at Bottom */}
                                <View
                                  style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    padding: 10,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontFamily: 'Poppins_700Bold',
                                      fontSize: 14,
                                      color: '#FFFFFF',
                                      lineHeight: 18,
                                      marginBottom: 2,
                                    }}
                                    numberOfLines={1}
                                  >
                                    {evt.title}
                                  </Text>

                                  <Text
                                    style={{
                                      fontFamily: 'Poppins_400Regular',
                                      fontSize: 11,
                                      color: '#D1D5DB',
                                    }}
                                    numberOfLines={1}
                                  >
                                    {timeText}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  </View>
);
}
