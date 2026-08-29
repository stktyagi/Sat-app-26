import { create } from 'zustand';
import type { User as FirebaseUser } from '@react-native-firebase/auth';
import { UserProfile } from '@/types/models';
import { storage } from '@/utils/storage';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';

export type AppStatus =
  | 'loading'
  | 'unauthenticated'
  | 'authenticated'
  | 'needs_profile';

interface UserState {
  appStatus: AppStatus;
  authUser: FirebaseUser | null;
  userData: UserProfile | null;
  isSigningIn: boolean;
  isRehydrating: boolean;
  isAuthReady: boolean;
  isLoadingInitialData: boolean;

  initializeAppState: () => void;
  rehydrateFromStorage: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  setAppStatus: (status: AppStatus) => void;
  setAuthUser: (user: FirebaseUser | null) => void;
  setUserData: (profile: UserProfile | null) => void;
  setSigningIn: (isSigningIn: boolean) => void;
  setLoadingInitialData: (isLoading: boolean) => void;
  setAuthReady: (ready: boolean) => void;
  clearUserState: () => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  appStatus: 'loading',
  authUser: null,
  userData: null,
  isSigningIn: false,
  isRehydrating: true,
  isAuthReady: false,
  isLoadingInitialData: true,

  initializeAppState: () => {
    set({ appStatus: 'loading', isRehydrating: true, isAuthReady: false });
  },

  rehydrateFromStorage: async () => {
    try {
      set({ isRehydrating: true });
      const storedUserData = await storage.getUserProfile();
      if (storedUserData) {
        set({ userData: storedUserData });
      }
    } catch (error) {
      console.error('Error rehydrating from storage:', error);
    } finally {
      // After rehydration, resolve appStatus based on the current auth state.
      // This handles the race where onAuthStateChanged fired while isRehydrating
      // was still true (so setAuthUser/setUserData skipped updating appStatus).
      const { authUser, userData } = get();
      if (authUser) {
        const profile = userData ?? get().userData; // pick up freshly stored profile
        if (profile?.fullyRegistered) {
          set({ appStatus: 'authenticated', isRehydrating: false });
        } else {
          set({ appStatus: 'needs_profile', isRehydrating: false });
        }
      } else {
        // Auth listener hasn't fired yet or user is signed out; leave appStatus
        // as 'loading' so the auth listener can set it when it resolves.
        set({ isRehydrating: false });
      }
    }
  },

  refreshUserProfile: async () => {
    try {
      const firebaseUser = get().authUser ?? getAuth(getApp()).currentUser;
      if (!firebaseUser) return;

      const { fetchCurrentUser } = await import('@/api/auth');
      const userProfile = await fetchCurrentUser(firebaseUser);
      set({ userData: userProfile });
      if (userProfile) {
        storage.setUserProfile(userProfile);
      }
    } catch (error) {
      console.error('Error refreshing user profile:', error);
      throw error;
    }
  },

  setAppStatus: (status) => set({ appStatus: status }),

  setAuthUser: (user) => {
    set({ authUser: user });
    storage.setAuthState(!!user);

    const { userData, isRehydrating } = get();
    if (isRehydrating) return;

    if (!user) {
      set({ appStatus: 'unauthenticated' });
    } else if (userData?.fullyRegistered) {
      set({ appStatus: 'authenticated' });
    } else {
      set({ appStatus: 'needs_profile' });
    }
  },

  setUserData: (profile) => {
    set({ userData: profile });
    storage.setUserProfile(profile);

    const { authUser, isRehydrating } = get();
    if (isRehydrating) return;

    if (authUser && profile?.fullyRegistered) {
      set({ appStatus: 'authenticated' });
    } else if (authUser && !profile?.fullyRegistered) {
      set({ appStatus: 'needs_profile' });
    }
  },

  setSigningIn: (isSigningIn) => set({ isSigningIn }),

  setLoadingInitialData: (isLoading) => set({ isLoadingInitialData: isLoading }),

  setAuthReady: (ready) => set({ isAuthReady: ready }),

  clearUserState: () => {
    storage.clearAllData();
    set({
      authUser: null,
      userData: null,
      appStatus: 'unauthenticated',
      isSigningIn: false,
    });
  },

  logout: () => {
    storage.clearAllData();
    set({
      authUser: null,
      userData: null,
      appStatus: 'unauthenticated',
      isSigningIn: false,
    });
  },
}));
