import { useState, useEffect, useCallback } from 'react';
import { UserStory } from '@/types/story';

export const useStories = () => {
  const [stories, setStories] = useState<UserStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Stories are not part of the current API. Keep the hook settled so
      // home can render dummy stories instead of an infinite skeleton.
      setStories([]);
    } catch (err) {
      console.error('Error fetching stories:', err);
      setError('Failed to load stories');
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
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
    }, 60000);

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
