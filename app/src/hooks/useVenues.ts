import { useEffect, useCallback } from 'react';
import { useContentCacheStore } from '@/state/contentCacheStore';
import { Venue } from '@/types/models';

/**
 * useVenues hook.
 * Fetches map venues and their coordinates when the component (e.g. MapScreen) opens.
 * The venues are cached strictly in frontend state (Zustand) so repeated visits
 * do not make redundant network calls.
 */
export function useVenues() {
  const venues = useContentCacheStore((s) => s.venues);
  const loading = useContentCacheStore((s) => s.venuesLoading);
  const error = useContentCacheStore((s) => s.venuesError);
  const getVenues = useContentCacheStore((s) => s.getVenues);

  useEffect(() => {
    // Only fetches from backend if not already cached in frontend
    getVenues();
  }, [getVenues]);

  const refresh = useCallback(async (): Promise<Venue[]> => {
    return getVenues(true);
  }, [getVenues]);

  return {
    venues,
    loading,
    error,
    refresh,
  };
}
