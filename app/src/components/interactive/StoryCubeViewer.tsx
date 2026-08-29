// src/components/interactive/StoryCubeViewer.tsx
//@ts-nocheck
import React, { useState, useCallback } from "react";
import {
  View,
  Image,
  Dimensions,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  TapGesture,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDecay,
  runOnJS,
  interpolate,
  useAnimatedReaction,
} from "react-native-reanimated";
import { VideoView, useVideoPlayer } from "expo-video";
import { DeleteIcon, Trash, X } from "lucide-react-native";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// --- INTERFACES ---
interface Story {
  id: number | string;
  uri?: string;
  mediaType?: "image" | "video";
  storyLink?: string;
}

interface User {
  id: number | string;
  user: string;
  stories: Story[];
}

interface StoryCubeViewerProps {
  users: User[];
  onClose: () => void;
  userProfile?: any;
  initialUserIndex?: number;
  onDeleteStory?: (userId: string, storyId: string) => void;
}

// --- STORY CONTENT COMPONENT ---
// This component now takes an activeUserIndex to determine if it should play video
const StoryContent = React.memo(
  ({
    user,
    storyIndex,
    isActive,
    onVideoEnd,
    onDeleteStory,
    onClose,
    userProfile,
  }: {
    user: User;
    storyIndex: number;
    isActive: boolean;
    onVideoEnd: () => void;
    onDeleteStory?: (storyId: string) => void;
    onClose: () => void;
    userProfile: any;
  }) => {
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const currentStory = user.stories?.[storyIndex];
    const mediaUrl = currentStory?.storyLink || currentStory?.uri || "";
    const isVideo = currentStory?.mediaType === "video";

    // FIX: Create player only for videos to prevent crashes
    // Use null for non-videos to avoid unnecessary player instances
    const player = useVideoPlayer(isVideo ? mediaUrl : null, (player) => {
      if (player && isVideo) {
        player.loop = false;
        player.showsTimecodes = false;
        player.preservesPitch = true;
        player.staysActiveInBackground = true;
        player.volume = 1.0;
      }
    });

    const deleteTap = Gesture.Tap()
      .maxDuration(500)
      .onEnd(() => {
        "worklet";
        if (onDeleteStory && currentStory) {
          console.log("Delete tap triggered for story:", currentStory.id);
          // We must use runOnJS to call back to the React thread from the UI thread
          runOnJS(onDeleteStory)(currentStory.id);
        } else {
          console.log(
            "Delete tap triggered but missing onDeleteStory or currentStory"
          );
        }
      });

    // FIX 2: Separate effect for video playback control
    // This ensures proper video duration tracking and playback
    React.useEffect(() => {
      // FIX: Only handle video player if this is actually a video
      if (!isVideo || !player || !mediaUrl) return;

      let isUnmounted = false;
      let endSubscription: any = null;
      let statusSubscription: any = null;

      const setupVideo = async () => {
        if (isUnmounted) return;

        if (isActive) {
          try {
            // FIX: Add small delay to prevent rapid state changes
            await new Promise((resolve) => setTimeout(resolve, 100));
            if (isUnmounted) return;

            // Reset and play video
            player.currentTime = 0;
            player.play();

            // Add listener for video end
            endSubscription = player.addListener("playToEnd", () => {
              if (!isUnmounted) {

                runOnJS(onVideoEnd)();
              }
            });

            // Add status listener for debugging
            statusSubscription = player.addListener(
              "statusChange",
              (status) => {
                console.log("Video status:", status);
              }
            );
          } catch (error) {
            console.log("Error setting up video:", error);
          }
        } else {
          try {
            player.pause();
          } catch (error) {
            console.log("Error pausing video:", error);
          }
        }
      };

      setupVideo();

      return () => {
        isUnmounted = true;
        // Clean up subscriptions
        if (endSubscription) {
          try {
            endSubscription.remove();
          } catch (e) {
            console.log("Error removing end subscription:", e);
          }
        }
        if (statusSubscription) {
          try {
            statusSubscription.remove();
          } catch (e) {
            console.log("Error removing status subscription:", e);
          }
        }
        // Safely pause the video
        if (player && isVideo) {
          try {
            player.pause();
          } catch (e) {
            console.log("Error pausing on cleanup:", e);
          }
        }
      };
    }, [isActive, isVideo, player, storyIndex, user.id, onVideoEnd, mediaUrl]);

    const progress = useSharedValue(0);

    // FIX 1: Separate effect for image timer with proper cleanup
    React.useEffect(() => {
      let imageTimer: NodeJS.Timeout | null = null;
      
      progress.value = 0; // reset

      if (isActive && !isVideo && isImageLoaded) {
        progress.value = withTiming(1, { duration: 5000 });
        // FIX 1: Store timer reference for cleanup
        imageTimer = setTimeout(() => {
          console.log("Image timer completed");
          onVideoEnd();
        }, 5000);
      }

      // FIX 1: Always cleanup timer on unmount or dependency change
      return () => {
        if (imageTimer) {
          clearTimeout(imageTimer);
          imageTimer = null;
        }
      };
    }, [isActive, isVideo, isImageLoaded, storyIndex]);

    // FIX 1: Cleanup player on unmount to prevent memory leaks
    React.useEffect(() => {
      return () => {
        // FIX: Safely cleanup only if this is a video
        if (player && isVideo) {
          try {
            player.pause();
            // FIX 1: Remove any lingering listeners
            player.removeAllListeners();
          } catch (e) {
            console.log("Error cleaning up player:", e);
          }
        }
      };
    }, []);

    const animatedProgressStyle = useAnimatedStyle(() => {
      return {
        width: `${progress.value * 100}%`,
        backgroundColor: "white",
        height: "100%",
        borderRadius: 2,
      };
    });

    return (
      <>
        {isVideo && mediaUrl && player ? (
          <VideoView
            player={player}
            style={styles.image}
            contentFit="cover"
            nativeControls={false}
            // FIX: Disable features that can cause CALayer crashes
            allowsExternalPlayback={false}
            allowsPictureInPicture={false}
            showsPlaybackControls={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
            /** 👇 For Expo SDK ≥51 (expo-video), new prop */
            allowsVisualAnalysis={false}
            // FIX: Prevent visual analysis which causes crashes
            pointerEvents="none"
          />
        ) : (
          <>
            {!isImageLoaded && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFBA00" />
              </View>
            )}
            <Image
              source={typeof mediaUrl === 'number' ? mediaUrl : { uri: mediaUrl }}
              style={styles.image}
              resizeMode="cover"
              onLoad={() => setIsImageLoaded(true)}
              onError={() => setIsImageLoaded(true)} // Set loaded even on error to prevent infinite loading
            />
          </>
        )}
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.progressContainer} pointerEvents="box-none">
            {user.stories?.map((story, index) => {
              const isPast = index < storyIndex;
              const isCurrent = index === storyIndex;
              return (
                <View
                  key={String(story?.id ?? index)}
                  style={[
                    styles.progressSegment,
                    {
                      backgroundColor: isPast ? "white" : "rgba(255, 255, 255, 0.5)",
                    },
                  ]}
                >
                  {isCurrent && (
                    <Animated.View style={animatedProgressStyle} />
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.header}>
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.user.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.username}>{user.user}</Text>
            </View>
            <View style={styles.headerActions}>
              {onDeleteStory &&
                currentStory &&
                userProfile.userId === user.id && (
                  <GestureDetector gesture={deleteTap}>
                    <View style={styles.deleteButton}>
                      <Trash color="white" size={16} />
                    </View>
                  </GestureDetector>
                )}
              <Pressable onPress={onClose} style={styles.closeButton}>
                <X color="white" size={24} />
              </Pressable>
            </View>
          </View>
        </View>
      </>
    );
  }
);

const StoryPage = ({
  user,
  userProfile,
  index,
  scrollX,
  activeUserIndex,
  storyIndex,
  onVideoEnd,
  onDeleteStory,
  onClose,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    // Guard the shared value - if it's not finite fallback to a safe value (0)
    let sx = scrollX.value;
    if (!isFinite(sx) || sx == null) {
      sx = 0;
    }

    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    // Interpolate but guarantee result is finite
    const rotateYRaw = interpolate(sx, inputRange, [45, 0, -45]);
    const rotateY = isFinite(rotateYRaw) ? rotateYRaw : 0;

    const translateXRaw = interpolate(sx, inputRange, [50, 0, -50]);
    const translateX = isFinite(translateXRaw) ? translateXRaw : 0;

    return {
      transform: [
        { perspective: SCREEN_WIDTH * 2.5 },
        { translateX: translateX },
        { rotateY: `${rotateY}deg` },
      ],
    };
  });

  // Clamp story index to avoid out-of-range access
  const safeStoryIndex = Math.max(
    0,
    Math.min((user.stories?.length ?? 1) - 1, storyIndex)
  );

  return (
    <Animated.View
      style={[
        styles.storyContainer,
        { left: index * SCREEN_WIDTH },
        animatedStyle,
      ]}
    >
      <StoryContent
        user={user}
        storyIndex={safeStoryIndex}
        isActive={index === activeUserIndex}
        onVideoEnd={onVideoEnd}
        onDeleteStory={onDeleteStory}
        onClose={onClose}
        userProfile={userProfile}
      />
    </Animated.View>
  );
};

const StoryCubeViewer: React.FC<StoryCubeViewerProps> = ({
  users,
  onClose,
  userProfile,
  initialUserIndex = 0,
  onDeleteStory,
}) => {
  const [storyIndices, setStoryIndices] = useState(
    () => new Map(users.map((u) => [u.id, 0]))
  );
  const [activeUserIndex, setActiveUserIndex] = useState(initialUserIndex);
  const scrollX = useSharedValue(initialUserIndex * SCREEN_WIDTH);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const startX = useSharedValue(0);

  // Helper to close with the same vertical animation
  const closeWithSlideDown = useCallback(() => {
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () =>
      runOnJS(onClose)()
    );
  }, [onClose, translateY]);

  const closeWithSlideOffscreenRight = useCallback(() => {
    // Animate scrollX to a negative screen width to slide the first story
    // completely off the screen to the right.
    scrollX.value = withTiming(-SCREEN_WIDTH, { duration: 300 }, () =>
      runOnJS(onClose)()
    );
  }, [onClose, scrollX]);

  const closeWithSlideLeft = useCallback(() => {
    scrollX.value = withTiming(
      SCREEN_WIDTH * users.length,
      { duration: 300 },
      () => runOnJS(onClose)()
    );
  }, [onClose, scrollX, users.length]);

  //make a smooth closing to right tap and swipe not like left one
  const closeWithSlideRight = useCallback(() => {
    scrollX.value = withTiming(0, { duration: 300 }, () => runOnJS(onClose)());
  }, [onClose, scrollX]);

  const handleDeleteStory = useCallback(
    async (storyId: string | number) => {
      if (onDeleteStory) {
        const currentUser = users[activeUserIndex];
        console.log("Deleting story:", storyId, "for user:", currentUser.id);

        try {
          // Call the delete API
          await onDeleteStory(currentUser.id, storyId);

          // Close the story modal after successful deletion
          onClose();
        } catch (error) {
          console.error("Failed to delete story:", error);
          // You could show an error message here if needed
          // For now, we'll still close the modal
          onClose();
        }
      }
    },
    [onDeleteStory, users, activeUserIndex, onClose]
  );

  const MAX_INDEX = users.length - 1;
  const MAX_OFFSET = MAX_INDEX * SCREEN_WIDTH;

  // FIX: Add debouncing to prevent rapid navigation
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNext = useCallback(() => {
    // FIX: Prevent rapid navigation
    if (isNavigating) return;

    // FIX 1: Add boundary checks to prevent crashes
    if (!users || users.length === 0) return;

    const currentUser = users[activeUserIndex];
    if (!currentUser) return;

    const currentStoryIndex = storyIndices.get(currentUser.id) ?? 0;
    const totalStories = currentUser.stories?.length ?? 0;

    setIsNavigating(true);
    setTimeout(() => setIsNavigating(false), 400); // Reset after animation

    if (currentStoryIndex < totalStories - 1) {
      const newIndices = new Map(storyIndices);
      newIndices.set(currentUser.id, currentStoryIndex + 1);
      setStoryIndices(newIndices);
    } else if (activeUserIndex < users.length - 1) {
      // FIX 1: Add animation completion checka
      scrollX.value = withTiming((activeUserIndex + 1) * SCREEN_WIDTH, {
        duration: 350,
      });
    } else {
      closeWithSlideLeft();
    }
  }, [
    activeUserIndex,
    users,
    storyIndices,
    scrollX,
    closeWithSlideLeft,
    isNavigating,
  ]);

  const handlePrevious = useCallback(() => {
    // FIX: Prevent rapid navigation
    if (isNavigating) return;

    // FIX 1: Add boundary checks to prevent crashes
    if (!users || users.length === 0) return;

    const currentUser = users[activeUserIndex];
    if (!currentUser) return;

    const currentStoryIndex = storyIndices.get(currentUser.id) ?? 0;

    setIsNavigating(true);
    setTimeout(() => setIsNavigating(false), 400); // Reset after animation

    if (currentStoryIndex > 0) {
      const newIndices = new Map(storyIndices);
      newIndices.set(currentUser.id, currentStoryIndex - 1);
      setStoryIndices(newIndices);
    } else if (activeUserIndex > 0) {
      // FIX 1: Add animation completion check
      scrollX.value = withTiming((activeUserIndex - 1) * SCREEN_WIDTH, {
        duration: 350,
      });
    } else {
      // FIX: Close when trying to go back from first story of first user
      closeWithSlideOffscreenRight();
    }
  }, [
    activeUserIndex,
    users,
    storyIndices,
    scrollX,
    closeWithSlideOffscreenRight,
    isNavigating,
  ]);

  // FIX 1: Add debouncing to prevent rapid state updates
  useAnimatedReaction(
    () => {
      "worklet";
      const raw = Math.round(scrollX.value / SCREEN_WIDTH);
      const clamped = Math.max(0, Math.min(MAX_INDEX, raw));
      return clamped;
    },
    (newIndex, previousIndex) => {
      // FIX 1: Add check to prevent unnecessary updates
      if (
        newIndex !== previousIndex &&
        newIndex >= 0 &&
        newIndex <= MAX_INDEX
      ) {
        runOnJS(setActiveUserIndex)(newIndex);
      }
    },
    [MAX_INDEX] // FIX 1: Add dependency
  );

  const horizontalPan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-20, 20])
    // FIX 1: Add minimum distance to prevent accidental triggers
    .minDistance(10)
    .onStart(() => {
      startX.value = scrollX.value;
    })
    .onUpdate((event) => {
      // Allow normal horizontal scrolling
      const next = Math.max(
        0,
        Math.min(MAX_OFFSET, startX.value - event.translationX)
      );
      scrollX.value = next;

      // Scale down the entire container based on how far the user has swiped horizontally.
      scale.value = interpolate(
        Math.abs(event.translationX),
        [0, SCREEN_WIDTH / 2], // Input range: from 0 swipe to a half-screen swipe
        [1, 0.85], // Output range: from full scale to 85% scale
        "clamp" // Clamp ensures it doesn't get smaller than 0.85
      );
    })
    .onEnd((event) => {
      // Animate the scale back to 1 when the gesture ends.
      scale.value = withTiming(1, { duration: 250 });

      let projected =
        startX.value - event.translationX + event.velocityX * -0.2;

      // Protect against NaN/Infinite
      if (!isFinite(projected) || projected == null) {
        projected = startX.value;
      }

      projected = Math.max(0, Math.min(MAX_OFFSET, projected));

      const clampedIndex = Math.round(projected / SCREEN_WIDTH);

      // --- FIX: LOGIC FOR CLOSING ON FIRST ITEM ---
      const startedIndex = Math.round(startX.value / SCREEN_WIDTH);
      const isCurrentlyFirstUser = startedIndex === 0;
      const swipingRightFromStart =
        event.translationX > 50 && event.velocityX > 0;

      if (isCurrentlyFirstUser && swipingRightFromStart) {
        runOnJS(closeWithSlideOffscreenRight)();
        return;
      }

      const isCurrentlyLastUser = startedIndex >= MAX_INDEX;
      const swipingLeftFromEnd =
        event.translationX < -50 && event.velocityX < 0;

      if (isCurrentlyLastUser && swipingLeftFromEnd) {
        runOnJS(closeWithSlideLeft)();
        return;
      }

      // Default snap
      const target = Math.max(
        0,
        Math.min(MAX_OFFSET, clampedIndex * SCREEN_WIDTH)
      );
      scrollX.value = withTiming(target, { duration: 350 });
    });

  const verticalPan = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-20, 20])
    // FIX 1: Add minimum distance to prevent accidental triggers
    .minDistance(10)
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
        scale.value = interpolate(
          event.translationY,
          [0, SCREEN_HEIGHT],
          [1, 0.7]
        );
      }
    })
    .onEnd((event) => {
      if (event.translationY > 150) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () =>
          runOnJS(onClose)()
        );
      } else {
        translateY.value = withTiming(0, { duration: 200 });
        scale.value = withTiming(1, { duration: 200 });
      }
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(250) // To distinguish from a long press
    .onEnd((event, success) => {
      if (success) {
        // Ignore taps in the header area (e.g., where the close button is)
        if (event.y < 120) return;

        // Use event.x which is relative to the gesture detector's view
        if (event.x < SCREEN_WIDTH * 0.33) {
          // Tapped on the left third of the screen
          runOnJS(handlePrevious)();
        } else if (event.x > SCREEN_WIDTH * 0.66) {
          // Tapped on the right third of the screen
          runOnJS(handleNext)();
        }
      }
    });

  const composedGesture = Gesture.Race(tapGesture, horizontalPan, verticalPan);

  const animatedContainerStyle = useAnimatedStyle(() => {
    "worklet";
    let tx = -scrollX.value;
    if (!isFinite(tx) || tx == null) {
      tx = 0;
    }
    let ty = translateY.value;
    if (!isFinite(ty) || ty == null) {
      ty = 0;
    }
    let s = scale.value;
    if (!isFinite(s) || s == null) {
      s = 1;
    }

    return {
      transform: [{ translateX: tx }, { translateY: ty }, { scale: s }],
    };
  });

  // FIX 1: Cleanup on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      // Reset all animated values on unmount
      scrollX.value = 0;
      translateY.value = 0;
      scale.value = 1;
    };
  }, []);

  return (
    <Modal visible={true} transparent={true} animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <GestureDetector gesture={composedGesture}>
            <View style={styles.container} collapsable={false}>
            <Animated.View
              style={[
                {
                  width: SCREEN_WIDTH * users.length,
                  height: "100%",
                  flexDirection: "row",
                },
                animatedContainerStyle,
              ]}
            >
              {users.map((user, index) => (
                <StoryPage
                  key={String(user.id ?? index)}
                  user={user}
                  index={index}
                  scrollX={scrollX}
                  activeUserIndex={activeUserIndex}
                  storyIndex={storyIndices.get(user.id) ?? 0}
                  onVideoEnd={handleNext}
                  onDeleteStory={handleDeleteStory}
                  onClose={onClose}
                  userProfile={userProfile}
                />
              ))}
            </Animated.View>
            </View>
          </GestureDetector>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 1000,
  },
  flex: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  storyContainer: {
    width: SCREEN_WIDTH + 1, // tiny overlap to hide seams
    height: "100%",
    position: "absolute",
    overflow: "hidden",
  },

  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 12,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    zIndex: 999,
    elevation: 10,
  },
  progressContainer: {
    position: "absolute",
    top: 20,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 4,
    height: 3,
    zIndex: 10,
  },
  progressSegment: { flex: 1, height: "100%", borderRadius: 2 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 35,
    zIndex: 10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  userInfo: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFBA00",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#000", fontWeight: "bold", fontSize: 18 },
  username: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    zIndex: 1001, // Higher than tapContainer
    elevation: 5, // For Android
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1001,
  },
  deleteText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    lineHeight: 20,
  },
  tapContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 999,
  },
  tapArea: { flex: 1 },
});

export default StoryCubeViewer;
