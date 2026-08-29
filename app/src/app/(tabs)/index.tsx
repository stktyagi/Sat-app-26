// src/screens/App/Home/HomeScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Text, ScrollView, View, Image,Linking, TouchableOpacity, TextInput, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/state/userStore';
import { Carousel, StoryCubeViewer } from '../../components';
import { Banner as BannerType } from '@/data/Colleges';
import Banner from '@/components/display/Banner';
import EventCard from '@/components/display/EventCard';
import MiniMap from '@/components/display/MiniMap';
import { useEventsByCategory } from '@/hooks/useEvents';
import ChatBot from '@/components/interactive/ChatBot';
import { Bell, Bot, Menu, Plus } from 'lucide-react-native';
import { useStories } from '@/hooks/useStories';
import StoryUploadButton from '@/components/story/StoryUploadButton';
import { Corousal } from '@/types/models';
import Header from '@/components/layout/Header';
import { HomeScreenSkeleton } from '@/components/skeletons/HomeScreenSkeleton';
import { useRouter } from 'expo-router';

export default function HomeScreen({ setShowBottomNav }: { setShowBottomNav?: (x: boolean) => void }) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [showChatBot, setShowChatBot] = useState(false);
  const [corousalData, setCorousalData] = useState<Corousal[]>([]);
  const [corousalLoading, setCorousalLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { userData: userProfile,refreshUserProfile } = useUserStore();
  const categories = ['All', 'Technical', 'Cultural', 'Business', 'Informal'];

  const { events: filteredEvents, loading, error } = useEventsByCategory(selectedCategory);
  const { stories, loading: storiesLoading, refresh: refreshStories } = useStories();

  const dummyStories = [
    {
      userId: 'dummy1',
      name: 'Student 1',
      isDummyStory: true,
      stories: [
        { storyId: 's1-1', storyLink: require("@/assets/story1/Copy_of_DSC_2885_ehyu7g.jpg"), mediaType: 'image' },
        { storyId: 's1-2', storyLink: require("@/assets/story1/Copy_of_JPG06242_hugpaw.jpg"), mediaType: 'image' },
      ],
      photoURL: 'https://api.dicebear.com/10.x/open-peeps/png?seed=Felix&hair=full,pixie,fonze,turban'
    },
    {
      userId: 'dummy2',
      name: 'Student 2',
      isDummyStory: true,
      stories: [
        { storyId: 's2-1', storyLink: require("@/assets/story2/Copy_of_DSC09217_cesaci.jpg"), mediaType: 'image' },
        { storyId: 's2-2', storyLink: require("@/assets/story2/Copy_of_JPG06985_hrr7ta.jpg"), mediaType: 'image' },
        { storyId: 's2-3', storyLink: require("@/assets/story2/Copy_of_OWL02218_ofmovh.jpg"), mediaType: 'image' },
      ],
      photoURL: 'https://api.dicebear.com/10.x/open-peeps/png?seed=Aneka&hair=full,pixie,fonze,turban'
    },
    {
      userId: 'dummy3',
      name: 'Student 3',
      isDummyStory: true,
      stories: [
        { storyId: 's3-1', storyLink: require("@/assets/story3/Copy_of_KAREE_SAT_PBKS-87_pllsr4.jpg"), mediaType: 'image' },
        { storyId: 's3-2', storyLink: require("@/assets/story3/Copy_of_OWL02359_lyncrp.jpg"), mediaType: 'image' },
      ],
      photoURL: 'https://api.dicebear.com/10.x/open-peeps/png?seed=Jasper&hair=full,pixie,fonze,turban'
    }
  ];

  const displayStories = stories.length > 0 ? stories : dummyStories;

  // Guard: once data has loaded for the first time, never show the skeleton again
  // (prevents flash when navigating back to this screen)
  const hasLoadedOnce = useRef(false);
  if (!hasLoadedOnce.current && !corousalLoading && !storiesLoading && !loading) {
    hasLoadedOnce.current = true;
  }

  const fetchCorousalData = useCallback(async () => {
    setCorousalLoading(true);
    try {
      /* Removed API call */
      console.log('Corousal data:', data);
      setCorousalData(data);
    } catch (err) {
      console.error('Error fetching corousal data:', err);
    } finally {
      setCorousalLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCorousalData();
  }, [fetchCorousalData]);




  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchCorousalData(),
        refreshStories(),
        refreshUserProfile()
      ]);
    } catch (err) {
      console.error('Error on refreshing:', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchCorousalData, refreshStories, refreshUserProfile]);



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

  const renderStoryItem = ({ item, index }: { item: any, index: number }) => {
    const isDummy = item.isDummyStory;
    return (
      <TouchableOpacity
        style={{
          boxSizing: 'content-box',
        }}
        className={`items-center mr-4 ${isDummy ? 'opacity-70' : ''}`}
        onPress={() => handleStoryPress(index)}
        activeOpacity={0.8}
      >
        <View className={`p-[2.5px] ${isDummy ? 'bg-[#FFD430]' : 'bg-[#FFBA00]'} rounded-full`}>
          <View className={`w-20 h-20 rounded-full ${isDummy ? 'bg-[#FFD430]' : 'bg-white'} border-[2px] border-black items-center justify-center overflow-hidden`}>
            {item.photoURL ? (
              <Image
                source={typeof item.photoURL === 'number' ? item.photoURL : { uri: item.photoURL }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full bg-gray-300 items-center justify-center">
                <Text className="text-black text-2xl font-bold">
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text className="text-[#0C3572] text-md mt-2" style={{ fontFamily: 'Outfit_500Medium' }} numberOfLines={1}>
          {item.name.split(" ")[0]}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEventCard = ({ item }: { item: any }) => (
    <EventCard event={item} />
  );

  // Show skeleton while initial data is loading — but ONLY if it has never loaded before.
  // This prevents a flash skeleton re-render when navigating back to this screen.
  const isInitialLoading = !hasLoadedOnce.current && (
    (loading && filteredEvents.length === 0) ||
    (storiesLoading && stories.length === 0) ||
    corousalLoading
  );

  if (isInitialLoading) {
    return <HomeScreenSkeleton />;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Scrollable Content */}
      <Header userProfile={userProfile} setShowBottomNav={setShowBottomNav || (() => {})} />

      <ScrollView
        className="flex-1"
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

        <View pointerEvents="auto" className='w-full flex-row justify-between items-center my-6'>
          <Carousel
            data={[1, 2, 3, 4].map((id) => ({
              id: id.toString(),
              imageUrl: require("@/assets/banner.png"),
              isActive: true,
              link: '',
              priority: id,
              title: `Banner ${id}`,
            }))}
            renderItem={({ item }) => (
              <Banner
          banner={item as unknown as BannerType}
          onPress={async (url?: string) => {
            if (!url) return;
            try {
              // require Linking here so we don't need to modify top-level imports
              const canOpen = await Linking.canOpenURL(url);
              if (canOpen) {
                await Linking.openURL(url);
              } else {
                console.warn('Cannot open URL:', url);
              }
            } catch (err) {
              console.error('Error opening URL:', err);
            }
          }}
              />
            )}
            autoPlay={true}
            autoPlayInterval={4000}
            showDots={true}
          />
        </View>
        <View className="min-h-fit px-6">
          {/* SatWrap Banner */}
          <TouchableOpacity
            onPress={() => router.push('/SatWrap')}
            className="bg-[#0C3572] rounded-2xl py-6 px-6 mb-6 flex-row items-center justify-between"
            style={{
               boxShadow: '0px 4px 15px 0px rgba(12, 53, 114, 0.4)', 
            }}
          >
            <View>
              <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-[#EEB170] text-2xl">SatWrap '26</Text>
              <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#DBE2ED] mt-1 text-sm">Your Saturnalia journey awaits!</Text>
            </View>
            <View className="bg-[#EEB170] w-10 h-10 rounded-full items-center justify-center">
              <Ionicons name="play" size={20} color="#0C3572" style={{ marginLeft: 2 }} />
            </View>
          </TouchableOpacity>

          {/* Search Bar */}
          <TouchableOpacity
            onPress={handleSearchPress}
            className="bg-[#FFFFFF] rounded-2xl py-4 px-6 mb-6 flex-row items-center"
            style={{
               boxShadow: '0px 4px 10px 0px rgba(0, 0, 0, 0.2)', 
            }}
          >
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572]text-xl flex-1">Search Events</Text>
            <Ionicons name="search" size={22} color="#0C3572" />
          </TouchableOpacity>


          {/* Stories Section */}
          {storiesLoading && stories.length === 0 ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="small" color="#FFBA00" />
            </View>
          ) : (
            <View className="mb-1">
              <FlatList
                data={[
                  ...(userProfile?.roles?.includes('admin') || userProfile?.roles?.includes('media') 
                    ? [{ isUploadButton: true }] 
                    : [{ isDummyUploadButton: true }]
                  ),
                  ...displayStories
                ]}
                renderItem={({ item, index }) => {
                  if ('isUploadButton' in item && item.isUploadButton) {
                    return (
                      <View className="items-center mr-4">
                        <StoryUploadButton
                          userId={userProfile?.userId || ''}
                          userName={userProfile?.displayName || 'User'}
                          userPhotoURL={userProfile?.photoURL}
                          onUploadComplete={handleStoryUploadComplete}
                        />
                        <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572] text-md mt-2">Add Story</Text>
                      </View>
                    );
                  }

                  if ('isDummyUploadButton' in item && item.isDummyUploadButton) {
                    return (
                      <TouchableOpacity className="items-center mr-4" activeOpacity={0.8}>
                        <View className="p-[2.5px] bg-[#FFD430] rounded-full">
                          <View className="w-20 h-20 rounded-full bg-white border-[2px] border-black items-center justify-center overflow-hidden">
                            <Ionicons name="add" size={40} color="black" />
                          </View>
                        </View>
                        <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572] text-md mt-2">Add Story</Text>
                      </TouchableOpacity>
                    );
                  }

                  const storyIndex = (userProfile?.roles?.includes('admin') || userProfile?.roles?.includes('media'))
                  ? index - 1
                  : index - 1; // since we now always have a + button (either real or dummy)
                  return renderStoryItem({ item, index: storyIndex });
                }}
                keyExtractor={(item, index) =>
                  'isUploadButton' in item && item.isUploadButton
                    ? 'upload-button'
                    : 'isDummyUploadButton' in item && item.isDummyUploadButton 
                    ? 'dummy-upload'
                    : (item as any).userId
                }
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20, marginBottom: 10 }}
                ListEmptyComponent={null}
              />
            </View>
          )}

          {/* Upcoming Events */}
          <View className="mb-6">
            <View className='flex flex-1 flex-row justify-between w-full items-center mb-6'>
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-2xl">Upcoming Events</Text>
              <TouchableOpacity
                onPress={handleSearchPress}
              >
                <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572] text-lg mr-2">See all</Text>
              </TouchableOpacity>
            </View>

            {/* Category Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-8"
            >
              {categories.map(cat => {
                const selected = selectedCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    className={`${selected ? 'bg-[#EEB170]' : ''} border-[#0C3572] w-28 py-2 rounded-2xl border-2 mr-3 items-center justify-center`}
                  >
                    <Text style={{ fontFamily: 'Outfit_500Medium' }} className={`text-[#0C3572] font-medium`}>{cat}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Event Cards */}
            <FlatList
              data={filteredEvents}
              renderItem={renderEventCard}
              keyExtractor={(item) => item.eventId}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 24 }}
            />
          </View>
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-2xl my-2">Event Map</Text>
          {/* Mini Map Component */}
          <MiniMap onPress={handleMapPress} />

          {/* Action Hub: SatPlay & SatClick */}
          <View className="flex-row justify-between items-center mt-8 mb-4">
            {/* SatPlay Hub */}
            <TouchableOpacity
              onPress={() => router.push('/SatPlay')}
              className="bg-[#FFFFFF] rounded-[28px] flex-1 aspect-square items-center justify-center"
              style={{
               boxShadow: '0px 4px 10px 0px rgba(0, 0, 0, 0.2)', 
            }}
            >
              
                <Image 
                  source={require("@/assets/rubik.png")} 
                  style={{ width: 100, height: 100, resizeMode: 'contain' }} 
                />
              <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0C3572] text-xl">SatPlay</Text>
            </TouchableOpacity>

            {/* Vertical Divider */}
            <View className="w-[2px] h-16 bg-[#A0B3D0] mx-4 opacity-40 rounded-full" />

            {/* SatClick Hub */}
            <TouchableOpacity
              onPress={() => router.push('/SatClick')}
              className="bg-[#FFFFFF] rounded-[28px] flex-1 aspect-square items-center justify-center"
              style={{
               boxShadow: '0px 4px 10px 0px rgba(0, 0, 0, 0.2)', 
            }}
            >
                <Image 
                  source={require("@/assets/camera.png")} 
                  style={{ width: 100, height: 100, resizeMode: 'contain' }} 
                />
              <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0C3572] text-xl">SatClick</Text>
            </TouchableOpacity>
          </View>

          {/* SatPay Offline Hub */}
          <TouchableOpacity
            onPress={() => router.push('/SatPayOffline')}
            className="bg-[#FFFFFF] rounded-[28px] w-full py-5 mb-10 flex-row items-center px-6"
            style={{
              boxShadow: '0px 4px 10px 0px rgba(0, 0, 0, 0.2)', 
            }}
          >
            <View className="bg-[#0C3572] w-14 h-14 rounded-full items-center justify-center shadow-sm">
              <Ionicons name="wifi" size={24} color="#EEB170" />
            </View>
            <View className="ml-4 flex-1">
              <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0C3572] text-xl">SatPay Offline</Text>
              <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572] opacity-70 text-sm mt-1">Pay at stalls without internet</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#A0B3D0" />
          </TouchableOpacity>
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
      {showStoryViewer && displayStories.length > 0 && (
        <StoryCubeViewer
          users={displayStories.map((userStory) => ({
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
            // Call your actual delete API here
            /* Removed API call */
            // Refresh stories after deletion
            refreshStories();
          }}
        />
      )}

      {/* ChatBot Modal */}
      <ChatBot
        visible={showChatBot}
        onClose={handleCloseChatBot}
        chatbotApiUrl="https://sat-backend-9sey.onrender.com/api/chatbot/ask"
      />
    </View>
  );
}
