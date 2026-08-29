// src/types/story.ts

export interface StoryItem {
  storyId: string;
  storyLink: string;
  storyUploadTime: number; // Unix timestamp in milliseconds
  storyExpiryTime: number; // Unix timestamp in milliseconds
  mediaType: 'image' | 'video';
}

export interface UserStory {
  userId: string;
  name: string;
  photoURL?: string;
  stories: StoryItem[];
  lastUploadTime: number; // Unix timestamp for sorting
}

export interface StoryUploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}
