// src/components/story/StoryList.tsx
import React, { useState } from 'react';
import { View, ScrollView, Pressable, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useStories } from '@/hooks/useStories';
import StoryCubeViewer from '../interactive/StoryCubeViewer';
import StoryUploadButton from './StoryUploadButton';

interface StoryListProps {
  currentUserId: string;
  currentUserName: string;
  currentUserPhotoURL?: string;
}

/**
 * StoryList component displays user stories in a horizontal scrollable list
 * Includes upload button and opens StoryCubeViewer when a story is tapped
 */
const StoryList: React.FC<StoryListProps> = ({
  currentUserId,
  currentUserName,
  currentUserPhotoURL,
}) => {
  const { stories, loading, refresh } = useStories();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [initialUserIndex, setInitialUserIndex] = useState(0);

  // Auto cleanup expired stories for current user

  const handleStoryPress = (userIndex: number) => {
    setInitialUserIndex(userIndex);
    setViewerVisible(true);
  };

  const handleUploadComplete = () => {
    // Refresh stories after upload
    refresh();
  };

  // Convert UserStory[] to the format expected by StoryCubeViewer
  const formattedStories = stories.map((userStory) => ({
    id: userStory.userId,
    user: userStory.name,
    stories: userStory.stories.map((story) => ({
      id: story.storyId,
      uri: story.storyLink,
      mediaType: story.mediaType,
    })),
  }));

  if (loading && stories.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#FFBA00" />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* Upload Button */}
        <View style={styles.storyItem}>
          <StoryUploadButton
            userId={currentUserId}
            userName={currentUserName}
            userPhotoURL={currentUserPhotoURL}
            onUploadComplete={handleUploadComplete}
          />
          <Text style={styles.storyLabel}>Add Story</Text>
        </View>

        {/* User Stories */}
        {stories.map((userStory, index) => (
          <Pressable
            key={userStory.userId}
            style={styles.storyItem}
            onPress={() => handleStoryPress(index)}
          >
            <View style={styles.storyRing}>
              {userStory.photoURL ? (
                <Image
                  source={{ uri: userStory.photoURL }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {userStory.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.storyLabel} numberOfLines={1}>
              {userStory.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Story Viewer */}
      {viewerVisible && formattedStories.length > 0 && (
        <StoryCubeViewer
          users={formattedStories}
          initialUserIndex={initialUserIndex}
          onClose={() => setViewerVisible(false)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  storyItem: {
    alignItems: 'center',
    width: 72,
  },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    borderWidth: 2,
    borderColor: '#FFBA00',
    backgroundColor: '#fff',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  storyLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
});

export default StoryList;
