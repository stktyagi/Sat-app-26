// src/hooks/useStories.ts
import { useState, useEffect, useCallback } from 'react';
import { UserStory } from '@/types/story';

/**
 * Custom hook to manage stories with automatic expiration
 * Fetches stories and filters out expired ones
 */
export const useStories = () => {
  const [stories, setStories] = useState<UserStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      /* Removed API call: getActiveStories */
      setStories(activeStories);
    } catch (err) {
      console.error('Error fetching stories:', err);
      setError('Failed to load stories');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // Auto-refresh every minute to check for expired stories
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      // Filter out expired stories locally
      setStories((prevStories) =>
        prevStories
          .map((userStory) => ({
            ...userStory,
            stories: userStory.stories.filter(
              (story) => story.storyExpiryTime > now
            ),
          }))
          .filter((userStory) => userStory.stories.length > 0)
      );
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const refresh = useCallback(async () => {
    await fetchStories();
  }, [fetchStories]);

  return {
    stories,
    loading,
    error,
    refresh,
  };
};

/**
 * Hook to automatically cleanup expired stories for a specific user
 * Should be called when user opens the app or after uploading a story
 */
