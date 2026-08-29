// src/hooks/useAuthListener.ts
import { useEffect } from 'react';
import { useUserStore } from '@/state/userStore';
export const useAuthListener = () => {
  const { setAuthUser, setUserData, initializeAppState, rehydrateFromStorage, setLoadingInitialData } = useUserStore();

  /* Removed API call: getCurrentUser */
};