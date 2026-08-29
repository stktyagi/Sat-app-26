// src/hooks/useAppInitialization.ts
import { useEffect, useState } from 'react';
import { useUserStore } from '@/state/userStore';
import { useEvents } from './useEvents';

/**
 * Hook to track the initialization status of the app
 * Returns true when both user data and events are loaded
 */
export const useAppInitialization = () => {
  const { isLoadingInitialData, appStatus, authUser } = useUserStore();
  const { loading: eventsLoading } = useEvents();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // For unauthenticated users, we don't need to wait for events
    if (appStatus === 'unauthenticated') {
      setIsInitialized(true);
      return;
    }

    // For authenticated users, wait for both user data and events to load
    if (appStatus === 'authenticated' && !isLoadingInitialData && !eventsLoading) {
      setIsInitialized(true);
      return;
    }

    // For users who need profile, just wait for user data
    if (appStatus === 'needs_profile' && !isLoadingInitialData) {
      setIsInitialized(true);
      return;
    }

    // Still loading
    setIsInitialized(false);
  }, [appStatus, isLoadingInitialData, eventsLoading, authUser]);

  return {
    isInitialized,
    isLoadingUserData: isLoadingInitialData,
    isLoadingEvents: eventsLoading,
  };
};
