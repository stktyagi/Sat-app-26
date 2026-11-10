import { useState, useEffect, useCallback } from 'react';
import { UserStory } from '@/types/story';
import { listStories, BackendStory } from '@/api/stories';
import { API_BASE_URL } from '@/config/api';

export const LOCAL_STORY_IMAGES: Record<string, any> = {};

export function resolveStoryImage(pathOrUrl: string): any {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  return `${API_BASE_URL.replace(/\/api\/v1\/?$/, '')}/static/${pathOrUrl}`;
}

export const SEEDED_STORIES: UserStory[] = [];

export const useStories = () => {
  const { useContentCacheStore } = require('@/state/contentCacheStore');
  const stories: UserStory[] = useContentCacheStore((s: any) => s.stories);
  const loading: boolean = useContentCacheStore((s: any) => s.storiesLoading);
  const error: string | null = useContentCacheStore((s: any) => s.storiesError);
  const getStories = useContentCacheStore((s: any) => s.getStories);

  useEffect(() => {
    getStories();
  }, [getStories]);

  const refresh = useCallback(async () => {
    return getStories(true);
  }, [getStories]);

  return {
    stories,
    loading,
    error,
    refresh,
  };
};
