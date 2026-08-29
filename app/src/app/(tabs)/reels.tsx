import React, { useState, useRef, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Animated,
  StatusBar,
  Pressable,
  Platform,
  PanResponder,
  Vibration,
} from "react-native";
import Video, { OnLoadData } from "react-native-video";
import { Volume2, VolumeX, PauseIcon, ArrowLeft } from "lucide-react-native";
import { Reel } from '@/types/models';
import { showAlert } from "../../components";
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

interface ReelItemProps {
  reel: Reel;
  index: number;
  currentIndex: number;
  isMuted: boolean;
  isScreenFocused: boolean;
  onToggleMute: () => void;
  onNavigateToEvent: (eventId: string) => void;
  reelHeight: number;
  isLoadingEvent: boolean;
  bottomInset: number;
  topInset: number;
  tabBarHeight: number;
}

const ReelItem: React.FC<ReelItemProps> = React.memo(
  ({
    reel,
    index,
    currentIndex,
    isMuted,
    isScreenFocused,
    onToggleMute,
    onNavigateToEvent,
    reelHeight,
    isLoadingEvent,
    bottomInset,
    topInset,
    tabBarHeight,
  }) => {
    const isActive = index === currentIndex;
    const videoRef = useRef<React.ComponentRef<typeof Video> | null>(null);

    // State definitions
    const [isLoading, setIsLoading] = useState(true);
    const [paused, setPaused] = useState(false);
    const [showPauseIcon, setShowPauseIcon] = useState(false);
    const muteIconOpacity = useRef(new Animated.Value(0)).current;
    const muteIconScale = useRef(new Animated.Value(1.2)).current;
    const pauseIconOpacity = useRef(new Animated.Value(0)).current;
    const pauseIconScale = useRef(new Animated.Value(1.2)).current;

    // Swipe gesture state
    const [showSwipeHint, setShowSwipeHint] = useState(false);
    const [showInitialHint, setShowInitialHint] = useState(false);
    const swipeHintOpacity = useRef(new Animated.Value(0)).current;
    const swipeProgress = useRef(new Animated.Value(0)).current;
    const initialHintOpacity = useRef(new Animated.Value(0)).current;

    // Description expansion state
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [showDescriptionOverlay, setShowDescriptionOverlay] = useState(false);
    const descriptionOverlayOpacity = useRef(new Animated.Value(0)).current;

    // Define how many lines to show when collapsed
    const collapsedLineCount = 1;
    const isDescriptionLong = reel.description.length > 50;

    const toggleDescriptionExpansion = () => {
      if (!isDescriptionExpanded) {
        // Expanding - show overlay
        setShowDescriptionOverlay(true);
        setIsDescriptionExpanded(true);
        Animated.timing(descriptionOverlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        // Collapsing - hide overlay
        Animated.timing(descriptionOverlayOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowDescriptionOverlay(false);
          setIsDescriptionExpanded(false);
        });
      }
    };

    useEffect(() => {
      // If the screen is not focused or this reel is not the active one, pause it.
      const shouldBePaused = !isActive || !isScreenFocused;
      if (showPauseIcon !== shouldBePaused) {
        if (paused) {
          setShowPauseIcon(true);
        } else {
          setShowPauseIcon(shouldBePaused);
        }
      }

      // Reset video to beginning when it becomes inactive
      if (!isActive && videoRef.current) {
        // Only seek if we actually have a valid reference to avoid ExoPlayer IllegalStateException on Android
        // But since we can't use hooks here, let's just catch the error and do a null check
        try {
          videoRef.current.seek(0);
        } catch (e) {
          console.log("Seek error ignored");
        }
      }

      // Show initial hint only on the first reel (index 0)
      if (isActive && isScreenFocused && !showInitialHint && index === 0) {
        setShowInitialHint(true);
        Animated.sequence([
          Animated.delay(1500), // Wait 1.5 seconds
          Animated.timing(initialHintOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(2000), // Show for 2 seconds
          Animated.timing(initialHintOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [
      isActive,
      isScreenFocused,
      showPauseIcon,
      reel.id,
      showInitialHint,
      initialHintOpacity,
    ]);

    // Video event handlers
    

    const showMuteAnimation = useCallback(() => {
      muteIconOpacity.setValue(1);
      muteIconScale.setValue(1);
      Animated.parallel([
        Animated.timing(muteIconScale, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(muteIconOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, [muteIconOpacity, muteIconScale]);

    const handleToggleMute = useCallback(() => {
      onToggleMute();
      showMuteAnimation();
    }, [onToggleMute, showMuteAnimation]);

    const handleLongPress = useCallback(() => {
      setPaused(true);
      setShowPauseIcon(true);
      pauseIconOpacity.setValue(1);
      pauseIconScale.setValue(1);
      Animated.timing(pauseIconScale, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, [pauseIconOpacity, pauseIconScale]);

    const handlePressOut = useCallback(() => {
      setPaused(false);
      if (isActive && isScreenFocused) {
        setShowPauseIcon(false);
      }
      if (showPauseIcon) {
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(pauseIconOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => setShowPauseIcon(false));
      }
    }, [isActive, isScreenFocused, showPauseIcon, pauseIconOpacity]);

    // Video event handlers
    const onLoad = useCallback((_: OnLoadData) => {
      setIsLoading(false);
    }, []);

    const onLoadStart = useCallback(() => setIsLoading(true), []);

    const onEnd = useCallback(() => {
      videoRef.current?.seek(0);
    }, []);

    const onError = useCallback((error: any) => {
      console.error("Video error:", error);
      setIsLoading(false);
    }, []);

    // Swipe gesture handler
    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only respond to horizontal swipes (more horizontal than vertical)
          return (
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
            Math.abs(gestureState.dx) > 10
          );
        },
        onPanResponderGrant: () => {
          // Show swipe hint when user starts swiping
          setShowSwipeHint(true);
          Animated.timing(swipeHintOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderMove: (_, gestureState) => {
          // Update swipe progress (only for left swipes)
          if (gestureState.dx < 0) {
            const progress = Math.min(Math.abs(gestureState.dx) / 150, 1); // 150px for full swipe
            swipeProgress.setValue(progress);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const swipeThreshold = 100; // Minimum distance for successful swipe
          const velocityThreshold = 0.5; // Minimum velocity

          if (
            gestureState.dx < -swipeThreshold ||
            gestureState.vx < -velocityThreshold
          ) {
            // Successful swipe left - navigate to event
            Vibration.vibrate(50); // Haptic feedback
            if (reel.event.id !== "") {
              onNavigateToEvent(reel.event.id);
            }
          }

          // Reset animations
          Animated.parallel([
            Animated.timing(swipeHintOpacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(swipeProgress, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => setShowSwipeHint(false));
        },
      })
    ).current;

    return (
      <View
        className="bg-black"
        style={{ height: reelHeight, width: SCREEN_WIDTH }}
        {...panResponder.panHandlers}
      >
        <View className="w-full" style={{ height: reelHeight - tabBarHeight }}>
          <Pressable
            onPress={handleToggleMute}
            onLongPress={handleLongPress}
            onPressOut={handlePressOut}
            className="absolute inset-0 z-10"
          />

                              {Math.abs(index - currentIndex) <= 1 && (
            <Video
              ref={videoRef}
              source={typeof reel.videoUrl === 'number' ? reel.videoUrl : { uri: reel.videoUrl }}
              style={{
                height: "100%",
                width: "100%",
              }}
              resizeMode="contain"
              repeat={true}
              muted={isMuted}
              paused={showPauseIcon}
              onLoad={onLoad}
              onLoadStart={onLoadStart}
              onEnd={onEnd}
              onError={onError}
              progressUpdateInterval={250}
            />
          )}

          {/* --- Overlays --- */}
          <View className="absolute inset-0" pointerEvents="box-none">
            {isLoading && (
              <View
                className="absolute inset-0 justify-center items-center"
                pointerEvents="none"
              >
                <ActivityIndicator size="large" color="white" />
              </View>
            )}

            {showPauseIcon && (
              <View
                className="absolute inset-0 justify-center items-center"
                pointerEvents="none"
              >
                <PauseIcon size={48} color="white" />
              </View>
            )}
          </View>
        </View>

        {/* Content overlay */}
        <View
          className="absolute flex left-4 right-4"
          style={{
            bottom: Math.max((bottomInset || 0) + (tabBarHeight || 80), 100),
            zIndex: showDescriptionOverlay ? 30 : 20,
          }}
        >
          <View>
            {/* Title and Button Row */}
            <View className="flex-row items-center mb-3">
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  textShadowColor: "rgba(0, 0, 0, 0.8)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
                className="text-white text-xl"
                numberOfLines={2}
              >
                {reel.title}
              </Text>

              {/* Gap between title and button */}
              <View className="w-4" />

              {/* View Event Button */}
              {reel.event.id !== "" && (
                <Pressable
                  onPress={() => onNavigateToEvent(reel.event.id)}
                  disabled={isLoadingEvent}
                  className="bg-transparent border border-white/80 rounded-lg px-3 py-1"
                  style={{
                    opacity: isLoadingEvent ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-white text-xs"
                  >
                    {isLoadingEvent ? "Loading..." : "View Event"}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Description Text with conditional truncation */}
            <Text
              style={{
                fontFamily: "Outfit_500Medium",
                textShadowColor: isDescriptionExpanded
                  ? "rgba(0, 0, 0, 0.8)"
                  : "rgba(0, 0, 0, 0.6)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }}
              className={`text-white leading-6 ${isDescriptionExpanded ? "text-base" : "text-sm"
                }`}
              numberOfLines={isDescriptionExpanded ? 0 : collapsedLineCount}
            >
              {reel.description}
            </Text>

            {/* "View More" / "View Less" button, only shown for long descriptions */}
            {isDescriptionLong && (
              <Pressable onPress={toggleDescriptionExpansion} className="mt-3">
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    textShadowColor: "rgba(0, 0, 0, 0.6)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                  className={`text-xs ${isDescriptionExpanded ? "text-white" : "text-gray-200"
                    }`}
                >
                  {isDescriptionExpanded ? "View Less" : "View More"}
                </Text>
              </Pressable>
            )}

            {/* Swipe hint */}
            {reel.event.id !== "" && (
              <View className="mt-4 flex-row items-center">
                <Text
                  style={{
                    fontFamily: "Outfit_500Medium",
                    textShadowColor: "rgba(0, 0, 0, 0.6)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                  className="text-gray-200 text-sm mr-2"
                >
                  Swipe left to view event
                </Text>
                <ArrowLeft size={18} color="#e5e7eb" />
              </View>
            )}
          </View>
        </View>

        {/* Swipe progress indicator */}
        {showSwipeHint && reel.event.id !== "" && (
          <Animated.View
            className="absolute right-4 top-1/2 z-30"
            style={{
              opacity: swipeHintOpacity,
              transform: [
                {
                  translateX: Animated.multiply(swipeProgress, -50),
                },
                {
                  scale: Animated.add(1, Animated.multiply(swipeProgress, 0.2)),
                },
              ],
            }}
          >
            <View className="bg-black/60 rounded-full p-4 shadow-lg">
              <ArrowLeft size={28} color="white" />
            </View>
          </Animated.View>
        )}

        {/* Instagram-style overlay for expanded description */}
        {showDescriptionOverlay && (
          <Animated.View
            className="absolute inset-0 z-25"
            style={{
              opacity: descriptionOverlayOpacity,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
            }}
          >
            <Pressable
              className="flex-1"
              onPress={toggleDescriptionExpansion}
            />
          </Animated.View>
        )}

        {/* Initial hint animation */}
        {showInitialHint && (
          <Animated.View
            className="absolute top-1/2 left-1/2 z-30"
            style={{
              opacity: initialHintOpacity,
              transform: [
                { translateX: -85 }, // Center horizontally
                { translateY: -30 }, // Center vertically
              ],
            }}
          >
            <View className="bg-black/80 rounded-xl px-5 py-3 flex-row items-center shadow-lg">
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  textShadowColor: "rgba(0, 0, 0, 0.3)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 1,
                }}
                className="text-white text-base mr-3"
              >
                Swipe left for event
              </Text>
              <ArrowLeft size={18} color="white" />
            </View>
          </Animated.View>
        )}

        {/* --- Fixed UI Controls --- */}
        <Pressable
          onPress={handleToggleMute}
          className="absolute right-4 z-20 bg-black/40 rounded-full p-3"
          style={{ top: Platform.OS === "ios" ? 50 : 20 }}
        >
          {isMuted ? (
            <VolumeX size={24} color="white" />
          ) : (
            <Volume2 size={24} color="white" />
          )}
        </Pressable>
      </View>
    );
  }
);

import { useRouter, usePathname } from "expo-router";

const ReelsScreen: React.FC = () => {
  const router = useRouter();
  const [reels, setReels] = useState<Reel[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEvent, setIsLoadingEvent] = useState(false);

  // Use hooks for dynamic spacing
  const tabBarHeight = 80; // Hardcoded fallback for useBottomTabBarHeight
  const insets = useSafeAreaInsets();
  const USABLE_HEIGHT = SCREEN_HEIGHT - insets.top - insets.bottom;

  // Use pathname to determine if this tab is active
  const pathname = usePathname();
  const isScreenFocused = pathname === '/reels';

  const flatListRef = useRef<FlatList>(null);

  // Load reels from Firebase
  /* Removed API call */

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // The subscription will automatically update reels
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  }, []);

  const handleToggleMute = useCallback(() => setIsMuted((prev) => !prev), []);

  const handleNavigateToEvent = useCallback(
    async (eventId: string) => {
      if (!eventId) {
        showAlert("Error", "Event information not available");
        return;
      }

      setIsLoadingEvent(true);
      try {
        // Fetch the full event data
        /* Removed API call */

        if (eventData) {
          // Navigate with the full event object
          router.push({ pathname: "/events/EventDetails", params: { eventData: JSON.stringify(eventData) } });
        } else {
          showAlert("Error", "Event not found. Please try again later.");
        }
      } catch (error) {
        console.error("Error fetching event:", error);
        showAlert("Error", "Failed to load event details. Please try again.");
      } finally {
        setIsLoadingEvent(false);
      }
    },
    [router]
  );

  // Hide status bar when screen is focused
  useEffect(() => {
    if (isScreenFocused) {
      StatusBar.setHidden(true, "fade");
    } else {
      StatusBar.setHidden(false, "fade");
    }
    return () => {
      StatusBar.setHidden(false, "fade");
    };
  }, [isScreenFocused]);

  // onViewableItemsChanged logic
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Render Functions
  const renderItem = useCallback(
    ({ item, index }: { item: Reel; index: number }) => {
      return (
        <ReelItem
          reel={item}
          index={index}
          currentIndex={currentIndex}
          isMuted={isMuted}
          isScreenFocused={isScreenFocused}
          onToggleMute={handleToggleMute}
          onNavigateToEvent={handleNavigateToEvent}
          reelHeight={USABLE_HEIGHT}
          isLoadingEvent={isLoadingEvent}
          bottomInset={insets.bottom}
          topInset={insets.top}
          tabBarHeight={tabBarHeight}
        />
      );
    },
    [
      currentIndex,
      isMuted,
      isScreenFocused,
      handleToggleMute,
      handleNavigateToEvent,
      USABLE_HEIGHT,
      isLoadingEvent,
      insets.bottom,
      insets.top,
      tabBarHeight,
    ]
  );

  const keyExtractor = useCallback((item: Reel) => item.id, []);

  interface ItemLayout {
    length: number;
    offset: number;
    index: number;
  }

  const getItemLayout = useCallback(
    (_: ArrayLike<Reel> | null | undefined, index: number): ItemLayout => ({
      length: USABLE_HEIGHT,
      offset: USABLE_HEIGHT * index,
      index,
    }),
    [USABLE_HEIGHT]
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text
          style={{ fontFamily: "Outfit_500Medium" }}
          className="text-white mt-4"
        >
          Loading reels...
        </Text>
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View className="flex-1 bg-black justify-center items-center px-6">
        <Text
          style={{ fontFamily: "Outfit_600SemiBold" }}
          className="text-white text-xl text-center"
        >
          No reels available yet
        </Text>
        <Text
          style={{ fontFamily: "Outfit_400Regular" }}
          className="text-gray-400 text-center mt-2"
        >
          Check back soon for exciting content!
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        snapToInterval={USABLE_HEIGHT}
        snapToAlignment="start"
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        contentContainerStyle={{ flexGrow: 0 }}
      />
    </View>
  );
};

export default ReelsScreen;
