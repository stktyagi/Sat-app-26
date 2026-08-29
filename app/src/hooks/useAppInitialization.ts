import { useEffect, useState } from 'react';
import { useUserStore } from '@/state/userStore';
import { useEvents } from './useEvents';

export const useAppInitialization = () => {
  const { isLoadingInitialData, appStatus, authUser, isAuthReady } = useUserStore();
  const { loading: eventsLoading } = useEvents();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isAuthReady) {
      setIsInitialized(false);
      return;
    }

    if (appStatus === 'unauthenticated') {
      setIsInitialized(true);
      return;
    }

    if (appStatus === 'authenticated' && !isLoadingInitialData && !eventsLoading) {
      setIsInitialized(true);
      return;
    }

    if (appStatus === 'needs_profile' && !isLoadingInitialData) {
      setIsInitialized(true);
      return;
    }

    setIsInitialized(false);
  }, [appStatus, isLoadingInitialData, eventsLoading, authUser, isAuthReady]);

  return {
    isInitialized,
    isLoadingUserData: isLoadingInitialData,
    isLoadingEvents: eventsLoading,
  };
};
