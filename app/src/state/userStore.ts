// src/state/userStore.ts
import { create } from 'zustand';
import { UserProfile } from '@/types/models';
import { storage } from '@/utils/storage';
export type AppStatus =
  | 'loading'           // Initial app load, checking auth state
  | 'unauthenticated'   // No user signed in
  | 'authenticated'     // User signed in with complete profile
  | 'needs_profile';    // User signed in but needs to complete profile

interface UserState {
  appStatus: AppStatus;
  authUser: FirebaseAuthTypes.User | null;
  userData: UserProfile | null;
  isSigningIn: boolean;
  isRehydrating: boolean;
  isLoadingInitialData: boolean;
  
  // Actions
  initializeAppState: () => void;
  rehydrateFromStorage: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  setAppStatus: (status: AppStatus) => void;
  setAuthUser: (user: FirebaseAuthTypes.User | null) => void;
  setUserData: (profile: UserProfile | null) => void;
  setSigningIn: (isSigningIn: boolean) => void;
  setLoadingInitialData: (isLoading: boolean) => void;
  clearUserState: () => void;
  logout: () => void;
}
 
export const useUserStore = create<UserState>((set, get) => ({
  appStatus: 'loading',
  authUser: null,
  userData: null,
  isSigningIn: false,
  isRehydrating: true,
  isLoadingInitialData: true,
  
  initializeAppState: () => {
    set({ appStatus: 'loading', isRehydrating: true });
  },

  rehydrateFromStorage: async () => {
    try {
      set({ isRehydrating: true });
      
      // Load stored user profile
      const storedUserData = await storage.getUserProfile();
      
      if (storedUserData) {
        set({ userData: storedUserData });
        // console.log('Rehydrated user profile from storage:', storedUserData.displayName);
      }
      
      set({ isRehydrating: false });
    } catch (error) {
      console.error('Error rehydrating from storage:', error);
      set({ isRehydrating: false });
    }
  },

  refreshUserProfile: async () => {
    try {
      /* Removed API call: getCurrentUser */
      set({ userData: userProfile });
      
      // Store updated profile
      if (userProfile) {
        storage.setUserProfile(userProfile);
        // console.log('Refreshed user profile:', userProfile.displayName);
      }
    } catch (error) {
      console.error('Error refreshing user profile:', error);
      throw error;
    }
  },
  
  setAppStatus: (status) => set({ appStatus: status }),
  
  setAuthUser: (user) => {
    set({ authUser: user });
    
    // Store auth state
    storage.setAuthState(!!user);
    
    // Auto-update app status based on auth user and profile
    const { userData, isRehydrating } = get();
    if (isRehydrating) return; // Don't update status during rehydration
    
    if (!user) {
      set({ appStatus: 'unauthenticated' });
    } else if (userData) {
      set({ appStatus: 'authenticated' });
    } else {
      set({ appStatus: 'needs_profile' });
    }
  },
  
  setUserData: (profile) => {
    set({ userData: profile });
    
    // Store user profile in AsyncStorage
    storage.setUserProfile(profile);
    
    // Auto-update app status based on profile and auth user
    const { authUser, isRehydrating } = get();
    if (isRehydrating) return; // Don't update status during rehydration
    
    if (authUser && profile) {
      set({ appStatus: 'authenticated' });
    } else if (authUser && !profile) {
      set({ appStatus: 'needs_profile' });
    }
  },
  
  setSigningIn: (isSigningIn) => set({ isSigningIn }),

  setLoadingInitialData: (isLoading) => set({ isLoadingInitialData: isLoading }),

  clearUserState: () => {
    storage.clearAllData();
    set({ 
      authUser: null, 
      userData: null, 
      appStatus: 'unauthenticated',
      isSigningIn: false 
    });
  },
  
  logout: () => {
    storage.clearAllData();
    set({ 
      authUser: null, 
      userData: null, 
      appStatus: 'unauthenticated',
      isSigningIn: false 
    });
  },
}));