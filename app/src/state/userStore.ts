import { create } from 'zustand';
import type { User as FirebaseUser } from '@react-native-firebase/auth';
import { UserProfile } from '@/types/models';
import { storage } from '@/utils/storage';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { isHostStudent } from '@/utils/paymentHelpers';

export type AppStatus =
  | 'loading'
  | 'unauthenticated'
  | 'authenticated'
  | 'needs_profile';

export type AuthState =
  | { status: 'BOOTSTRAPPING' }
  | { status: 'UNAUTHENTICATED' }
  | { status: 'SIGNING_IN' }
  | { status: 'SYNCING_BACKEND'; firebaseUser: FirebaseUser }
  | { status: 'PROFILE_INCOMPLETE'; firebaseUser: FirebaseUser; profile: UserProfile | null }
  | { status: 'AUTHENTICATED'; firebaseUser: FirebaseUser; profile: UserProfile };

interface UserState {
  appStatus: AppStatus;
  authState: AuthState;
  authUser: FirebaseUser | null;
  userData: UserProfile | null;
  isSigningIn: boolean;
  isSyncing: boolean;
  isRehydrating: boolean;
  isAuthReady: boolean;
  isLoadingInitialData: boolean;

  initializeAppState: () => void;
  rehydrateFromStorage: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  syncBackendSession: (user: FirebaseUser) => Promise<UserProfile | null>;
  setAppStatus: (status: AppStatus) => void;
  setAuthUser: (user: FirebaseUser | null) => void;
  setUserData: (profile: UserProfile | null) => void;
  setSigningIn: (isSigningIn: boolean) => void;
  setLoadingInitialData: (isLoading: boolean) => void;
  setAuthReady: (ready: boolean) => void;
  clearUserState: () => void;
  logout: () => void;
}

/**
 * Validates if the user profile satisfies all onboarding requirements.
 * - Host college students: requires rollNumber and collegeName.
 * - Outside college students: requires rollNumber, collegeName, profile photo, AND college ID card.
 */
export const hasCompletedProfile = (p?: UserProfile | null): boolean => {
  if (!p?.rollNumber || !p?.collegeName || !p?.phoneNumber) return false;
  if (!isHostStudent(p)) {
    const hasPhoto = Boolean(p.photoUrl || (p as any).photoURL);
    const hasCollegeId = Boolean(p.collegeIdUrl);
    if (!hasPhoto || !hasCollegeId) return false;
  }
  return true;
};

const resolveStatus = (
  isRehydrating: boolean,
  isAuthReady: boolean,
  authUser: FirebaseUser | null,
  profile: UserProfile | null
): { appStatus: AppStatus; authState: AuthState } => {
  if (isRehydrating || !isAuthReady) {
    return { appStatus: 'loading', authState: { status: 'BOOTSTRAPPING' } };
  }
  if (!authUser) {
    return { appStatus: 'unauthenticated', authState: { status: 'UNAUTHENTICATED' } };
  }
  if (hasCompletedProfile(profile)) {
    return {
      appStatus: 'authenticated',
      authState: { status: 'AUTHENTICATED', firebaseUser: authUser, profile: profile as UserProfile },
    };
  }
  return {
    appStatus: 'needs_profile',
    authState: { status: 'PROFILE_INCOMPLETE', firebaseUser: authUser, profile },
  };
};

export const useUserStore = create<UserState>((set, get) => ({
  appStatus: 'loading',
  authState: { status: 'BOOTSTRAPPING' },
  authUser: null,
  userData: null,
  isSigningIn: false,
  isSyncing: false,
  isRehydrating: true,
  isAuthReady: false,
  isLoadingInitialData: true,

  initializeAppState: () => {
    set({
      appStatus: 'loading',
      authState: { status: 'BOOTSTRAPPING' },
      isRehydrating: true,
      isAuthReady: false,
    });
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
      const { authUser, userData, isAuthReady } = get();
      const resolved = resolveStatus(false, isAuthReady, authUser, userData);
      set({
        isRehydrating: false,
        ...resolved,
      });
    }
  },

  refreshUserProfile: async () => {
    try {
      const firebaseUser = get().authUser ?? getAuth(getApp()).currentUser;
      if (!firebaseUser) return;

      const { fetchCurrentUser } = await import('@/api/auth');
      const userProfile = await fetchCurrentUser(firebaseUser);
      get().setUserData(userProfile);
    } catch (error) {
      console.error('Error refreshing user profile:', error);
      throw error;
    }
  },

  syncBackendSession: async (user: FirebaseUser) => {
    if (get().isSyncing) return get().userData;
    set({
      isSyncing: true,
      authState: { status: 'SYNCING_BACKEND', firebaseUser: user },
    });
    try {
      const { syncBackendSession } = await import('@/api/auth');
      const session = await syncBackendSession(user);
      get().setUserData(session.user);
      return session.user;
    } finally {
      set({ isSyncing: false });
    }
  },

  setAppStatus: (status) => set({ appStatus: status }),

  setAuthUser: (user) => {
    set({ authUser: user });
    storage.setAuthState(!!user);

    const { userData, isRehydrating, isAuthReady } = get();
    if (isRehydrating) return;

    const resolved = resolveStatus(isRehydrating, isAuthReady, user, userData);
    set(resolved);
  },

  setUserData: (profile) => {
    set({ userData: profile });
    if (profile) {
      storage.setUserProfile(profile);
    }

    const { authUser, isRehydrating, isAuthReady } = get();
    if (isRehydrating) return;

    const resolved = resolveStatus(isRehydrating, isAuthReady, authUser, profile);
    set(resolved);
  },

  setSigningIn: (isSigningIn) => {
    set({
      isSigningIn,
      ...(isSigningIn ? { authState: { status: 'SIGNING_IN' } } : {}),
    });
  },

  setLoadingInitialData: (isLoading) => set({ isLoadingInitialData: isLoading }),

  setAuthReady: (ready) => {
    set({ isAuthReady: ready });
    const { authUser, userData, isRehydrating } = get();
    if (!isRehydrating) {
      const resolved = resolveStatus(false, ready, authUser, userData);
      set(resolved);
    }
  },

  clearUserState: () => {
    storage.clearAllData();
    set({
      authUser: null,
      userData: null,
      appStatus: 'unauthenticated',
      authState: { status: 'UNAUTHENTICATED' },
      isSigningIn: false,
      isSyncing: false,
    });
  },

  logout: () => {
    storage.clearAllData();
    set({
      authUser: null,
      userData: null,
      appStatus: 'unauthenticated',
      authState: { status: 'UNAUTHENTICATED' },
      isSigningIn: false,
      isSyncing: false,
    });
  },
}));
