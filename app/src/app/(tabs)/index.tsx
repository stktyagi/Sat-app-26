// src/screens/App/Home/HomeScreen.tsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Text, ScrollView, View, Linking, TouchableOpacity, TextInput, FlatList, ActivityIndicator, RefreshControl, BackHandler, ToastAndroid, Platform, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/state/userStore';
import { Carousel, StoryCubeViewer } from '../../components';
import { Banner as BannerType } from '@/data/Colleges';
import Banner from '@/components/display/Banner';
import FeaturedEventCard from '@/components/display/FeaturedEventCard';
import MiniMap from '@/components/display/MiniMap';
import { useEvents } from '@/hooks/useEvents';
import ChatBot from '@/components/interactive/ChatBot';
import { Bell, Bot, Menu, Plus, BookOpen, Briefcase, ChevronRight, Code2, LayoutGrid, Music, Sparkles, X } from 'lucide-react-native';
import { useStories } from '@/hooks/useStories';
import { useBanners } from '@/hooks/useBanners';
import StoryUploadButton from '@/components/story/StoryUploadButton';
import { Corousal } from '@/types/models';
import HeroBanner from '@/components/display/HeroBanner';
import { useThemeStore } from '@/state/themeStore';
import { HomeScreenSkeleton } from '@/components/skeletons/HomeScreenSkeleton';
import { useRouter, useFocusEffect } from 'expo-router';
import { API_BASE_URL } from '@/config/api';
import { UserStory } from '@/types/story';

const STORY_BORDER_COLORS = [
  '#41B8F0',
  '#F05041',
  '#7BF041',
  '#41B8F0',
  '#F05041',
  '#7BF041',
];

const FEATURED_FILTERS = [
  'Technical',
  'Cultural',
  'Business',
  'Workshops',
  'Centerstage',
  'All',
];

const getCategoryIcon = (cat: string) => {
  const iconColor = '#FFFFFF';
  const size = 13;
  switch (cat.toLowerCase()) {
    case 'technical':
      return <Code2 size={size} color={iconColor} />;
    case 'cultural':
      return <Music size={size} color={iconColor} />;
    case 'business':
      return <Briefcase size={size} color={iconColor} />;
    case 'workshops':
      return <BookOpen size={size} color={iconColor} />;
    case 'centerstage':
      return <Sparkles size={size} color={iconColor} />;
    default:
      return <LayoutGrid size={size} color={iconColor} />;
  }
};

export default function HomeScreen({ setShowBottomNav }: { setShowBottomNav?: (x: boolean) => void }) {
  const router = useRouter();
  const { isDark, colors, toggleTheme } = useThemeStore();
  const lastExitPress = useRef(0);
  const [selectedFeaturedCategory, setSelectedFeaturedCategory] = useState<string>('All');
  
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        const now = Date.now();
        if (now - lastExitPress.current < 2000) {
          BackHandler.exitApp();
        } else {
          lastExitPress.current = now;
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        }
        return true;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [])
  );
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [showChatBot, setShowChatBot] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { userData: userProfile, refreshUserProfile } = useUserStore();

  const { banners, loading: bannersLoading, refresh: refreshBanners } = useBanners();
  const { events: allEvents, loading, error, refresh: refreshEvents } = useEvents();
  const { stories, loading: storiesLoading, refresh: refreshStories } = useStories();

  // Featured events: strictly only events marked with isFeatured tag
  const featuredEvents = useMemo(() => {
    const onlyFeatured = allEvents.filter(e => e.isFeatured === true);
    if (selectedFeaturedCategory === 'All') return onlyFeatured;
    return onlyFeatured.filter(e => (e.category || '').toLowerCase() === selectedFeaturedCategory.toLowerCase());
  }, [allEvents, selectedFeaturedCategory]);

  // Guard: once data has loaded for the first time, never show the skeleton again
  // (prevents flash when navigating back to this screen)
  const hasLoadedOnce = useRef(false);
  if (!hasLoadedOnce.current && !bannersLoading && !storiesLoading && !loading) {
    hasLoadedOnce.current = true;
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshBanners(),
        refreshStories(),
        refreshEvents(),
        refreshUserProfile()
      ]);
    } catch (err) {
      console.error('Error on refreshing:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshBanners, refreshStories, refreshEvents, refreshUserProfile]);



  const handleSearchPress = () => {
    router.push('/events/SearchEvents');
  };

  const handleMapPress = () => {
    router.push('/map/Map');
  };

  const handleStoryPress = (index: number) => {
    setSelectedStoryIndex(index);
    if (setShowBottomNav) setShowBottomNav(false);
    setShowStoryViewer(true);
  };

  const handleCloseStoryViewer = () => {
    if (setShowBottomNav) setShowBottomNav(true);
    setShowStoryViewer(false);
  };

  const handleChatBotPress = () => {
    setShowChatBot(true);
  };

  const handleCloseChatBot = () => {
    setShowChatBot(false);
  };

  const handleStoryUploadComplete = () => {
    refreshStories();
  };

  const renderStoryItem = ({ item, index }: { item: UserStory; index: number }) => {
    const borderColor = STORY_BORDER_COLORS[index % STORY_BORDER_COLORS.length];
    const firstImage = item.photoURL || (item.stories && item.stories.length > 0 ? item.stories[0].storyLink : null);
    const imageSource = typeof firstImage === 'number' ? firstImage : (firstImage?.uri ? firstImage : { uri: firstImage });

    return (
      <TouchableOpacity
        key={item.userId || `story-${index}`}
        className="items-center mr-4"
        onPress={() => handleStoryPress(index)}
        activeOpacity={0.85}
      >
        <View
          style={{
            width: 82,
            height: 95,
            borderRadius: 24,
            borderWidth: 1.5,
            borderColor: borderColor,
            overflow: 'hidden',
            backgroundColor: isDark ? '#1C1C1E' : '#E5E7EB',
          }}
        >
          {firstImage ? (
            <Image transition={200}
              source={imageSource}
              style={[
                { width: '100%', height: '100%' },
                Platform.OS === 'web' && ({ filter: 'grayscale(25%)' } as any),
              ]}
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full bg-neutral-800 items-center justify-center">
              <Text style={{ fontFamily: 'Poppins_700Bold', color: '#FFFFFF', fontSize: 22 }}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Subtle grayscale / desaturation filter overlay */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(120, 120, 120, 0.3)' },
            ]}
            pointerEvents="none"
          />
        </View>

        <Text
          style={{
            fontFamily: 'Poppins_600SemiBold',
            color: isDark ? '#FFFFFF' : '#000000',
            fontSize: 14,
            marginTop: 8,
            textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  // Show skeleton while initial data is loading — but ONLY if it has never loaded before.
  // This prevents a flash skeleton re-render when navigating back to this screen.
  const isInitialLoading = !hasLoadedOnce.current && (
    (loading && allEvents.length === 0) ||
    (storiesLoading && stories.length === 0) ||
    (bannersLoading && banners.length === 0)
  );

  if (isInitialLoading) {
    return <HomeScreenSkeleton />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#E0E0E0' }}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        className="flex-1"
        style={{ backgroundColor: isDark ? '#000000' : '#E0E0E0' }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FFBA00']}
            tintColor={'#FFBA00'}
          />
        }
      >
        {/* Full-section Hero Banner with Top and Bottom Gradients */}
        <HeroBanner userProfile={userProfile} banners={banners} />

        {/* Event Stories Section - Located right under the banner */}
        <View style={{ marginTop: 22, marginBottom: 6 }}>
          <View style={{ paddingHorizontal: 24, marginBottom: 14 }}>
            <Text
              style={{
                fontFamily: 'Talina',
                color: isDark ? '#FFFFFF' : '#000000',
                fontSize: 28,
                letterSpacing: 0.5,
              }}
            >
              Event Stories
            </Text>
          </View>

          {storiesLoading && stories.length === 0 ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color="#FFBA00" />
            </View>
          ) : stories.length === 0 ? (
            <View style={{ paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text
                style={{
                  fontFamily: 'Poppins_400Regular',
                  color: isDark ? '#9CA3AF' : '#6B7280',
                  fontSize: 14,
                }}
              >
                More stories on the way
              </Text>
            </View>
          ) : (
            <FlatList
              data={stories}
              renderItem={renderStoryItem}
              keyExtractor={(item, index) => item.userId || `story-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24 }}
            />
          )}
        </View>

        {/* Venue Map Section - Under stories */}
        <View style={{ paddingHorizontal: 24, marginTop: 14, marginBottom: 20 }}>
          <Text
            style={{
              fontFamily: 'Talina',
              color: isDark ? '#FFFFFF' : '#000000',
              textAlign: 'center',
              fontSize: 28,
              letterSpacing: 0.5,
              marginBottom: 16,
            }}
          >
            Venue Map
          </Text>

          <TouchableOpacity
            onPress={handleMapPress}
            activeOpacity={0.88}
            style={{
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.35 : 0.08,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <Image transition={200}
              source={require('@/assets/map.png')}
              style={{
                width: '100%',
                height: 220,
              }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>

        {/* Featured Events Section - Directly under the Venue Map */}
        <View style={{ paddingHorizontal: 24, marginTop: 16, marginBottom: 26 }}>
          {/* Header Row: Left two-line title & Right See All pill button */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 16,
            }}
          >
            <View>
              <Text
                style={{
                  fontFamily: 'Talina',
                  fontSize: 32,
                  lineHeight: 36,
                  letterSpacing: 0.5,
                  color: '#A855F7',
                }}
              >
                Featured
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
                Events
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/events')}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? '#1C1C20' : '#E5E7EB',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 9999,
                marginTop: 6,
                borderWidth: isDark ? 1 : 0,
                borderColor: '#2D2D35',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Poppins_500Medium',
                  color: isDark ? '#E5E7EB' : '#374151',
                  fontSize: 12,
                  marginRight: 2,
                }}
              >
                See All
              </Text>
              <ChevronRight size={14} color={isDark ? '#E5E7EB' : '#374151'} />
            </TouchableOpacity>
          </View>

          {/* Category Filter Pills Matching the Screenshot */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
            style={{ marginBottom: 20 }}
          >
            {FEATURED_FILTERS.map((cat) => {
              const isSelected = selectedFeaturedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    if (isSelected && cat !== 'All') {
                      setSelectedFeaturedCategory('All');
                    } else {
                      setSelectedFeaturedCategory(cat);
                    }
                  }}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isSelected
                      ? '#41B8F0'
                      : (isDark ? '#18181C' : '#D9D9DE'),
                    borderRadius: 9999,
                    paddingLeft: 6,
                    paddingRight: isSelected ? 10 : 16,
                    paddingVertical: 6,
                    borderWidth: isDark && !isSelected ? 1 : 0,
                    borderColor: '#272730',
                  }}
                >
                  {/* Left Circular Icon Container */}
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: isSelected
                        ? '#111827'
                        : (isDark ? '#272732' : '#1E1E24'),
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                    }}
                  >
                    {getCategoryIcon(cat)}
                  </View>

                  {/* Category Name */}
                  <Text
                    style={{
                      fontFamily: 'Poppins_600SemiBold',
                      color: isSelected
                        ? '#0F172A'
                        : (isDark ? '#FFFFFF' : '#1E1E24'),
                      fontSize: 13,
                    }}
                  >
                    {cat}
                  </Text>

                  {/* Selected 'X' Icon */}
                  {isSelected && (
                    <View style={{ marginLeft: 6 }}>
                      <X size={14} color="#0F172A" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Vertical Featured Event Cards */}
          {loading && featuredEvents.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#41B8F0" />
            </View>
          ) : featuredEvents.length === 0 ? (
            <View
              style={{
                paddingVertical: 28,
                paddingHorizontal: 16,
                alignItems: 'center',
                backgroundColor: isDark ? '#141416' : '#F3F4F6',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isDark ? '#262628' : '#E5E7EB',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Poppins_500Medium',
                  color: isDark ? '#9CA3AF' : '#6B7280',
                  fontSize: 14,
                  textAlign: 'center',
                }}
              >
                No featured events found for {selectedFeaturedCategory}
              </Text>
            </View>
          ) : (
            <View style={{ width: '100%' }}>
              {featuredEvents.map((evt) => (
                <FeaturedEventCard key={evt.eventId} event={evt} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Chat Button */}
      <TouchableOpacity
        onPress={handleChatBotPress}
        className="absolute bottom-32 right-10 w-14 h-14 bg-[#FFBA00] rounded-full shadow-lg items-center justify-center z-50"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Bot size={28} color="#121212" />
      </TouchableOpacity>

      {/* Story Cube Viewer Modal */}
      {showStoryViewer && stories.length > 0 && (
        <StoryCubeViewer
          users={stories.map((userStory: UserStory) => ({
            id: userStory.userId,
            user: userStory.name,
            stories: userStory.stories.map((story: any) => ({
              id: story.storyId,
              uri: story.storyLink,
              mediaType: story.mediaType as "video" | "image" | undefined,
            })),
          }))}
          userProfile={userProfile}
          onClose={handleCloseStoryViewer}
          initialUserIndex={selectedStoryIndex}
          onDeleteStory={async (userId, storyId) => {
            refreshStories();
          }}
        />
      )}

      {/* ChatBot Modal */}
      <ChatBot
        visible={showChatBot}
        onClose={handleCloseChatBot}
        chatbotApiUrl={`${API_BASE_URL}/chatbot/ask`}
      />
    </View>
  );
}
