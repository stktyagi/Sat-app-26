// src/components/story/StoryUploadButton.tsx
import React, { useState } from 'react';
import { View, Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { showAlert } from '../index';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

interface StoryUploadButtonProps {
  userId: string;
  userName: string;
  userPhotoURL?: string;
  onUploadComplete?: () => void;
}

const MAX_VIDEO_DURATION = 20000; // 15 seconds in milliseconds

// Helper function to send notification
const sendStoryNotification = async (userName: string, mediaType: 'image' | 'video') => {
  // API call removed
};

const StoryUploadButton: React.FC<StoryUploadButtonProps> = ({
  userId,
  userName,
  userPhotoURL,
  onUploadComplete,
}) => {
  const [isUploading, setIsUploading] = useState(false);

  const pickMedia = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        showAlert('Permission Required', 'Please allow access to your photo library to upload stories.');
        return;
      }

      // Launch image picker with video support
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 20, // 15 seconds max
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Validate video duration
        if (asset.type === 'video' && asset.duration && asset.duration > MAX_VIDEO_DURATION) {
          showAlert(
            'Video Too Long',
            'Please select a video that is 15 seconds or shorter.'
          );
          return;
        }

        await handleUpload(asset.uri, asset.type === 'video' ? 'video' : 'image');
      }
    } catch (error) {
      console.error('Error picking media:', error);
      showAlert('Error', 'Failed to pick media. Please try again.');
    }
  };

  const handleUpload = async (uri: string, mediaType: 'image' | 'video') => {
    setIsUploading(true);

    try {
      // Step 1: Upload to backend (using dummy for now)
      /* Removed API call */

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Step 2: Save to Firebase
      /* Removed API call */

      // Step 3: Send notification to all users
      await sendStoryNotification(userName, mediaType);

      showAlert('Success', 'Story uploaded successfully!');

      // Notify parent component
      onUploadComplete?.();
    } catch (error) {
      console.error('Upload error:', error);
      showAlert('Upload Failed', 'Failed to upload story. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Pressable
      onPress={pickMedia}
      disabled={isUploading}
      className="p-[2.5px] bg-[#FFD430] rounded-full shadow-lg"
      style={({ pressed }) => [
        pressed && styles.pressed,
        isUploading && styles.uploading,
      ]}
    >
      <View className="w-20 h-20 rounded-full bg-white border-[2px] border-black items-center justify-center overflow-hidden">
        {isUploading ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <Ionicons name="add" size={40} color="black" />
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  uploading: {
    opacity: 0.6,
  },
});

export default StoryUploadButton;
