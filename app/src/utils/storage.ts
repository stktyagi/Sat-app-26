// src/utils/storage.ts
import { UserProfile } from '@/types/models';

// Temporarily disable AsyncStorage until app restarts with proper configuration
let AsyncStorage: any;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (error) {
  console.warn('AsyncStorage not available, using mock implementation');
  AsyncStorage = {
    setItem: async () => {},
    getItem: async () => null,
    multiRemove: async () => {},
  };
}

const STORAGE_KEYS = {
  USER_PROFILE: 'user_profile',
  USER_AUTH_STATE: 'user_auth_state',
} as const;

export interface StoredUserState {
  userData: UserProfile | null;
  lastUpdated: string;
}

export const storage = {
  // Store user profile data
  setUserProfile: async (userData: UserProfile | null): Promise<void> => {
    try {
      const storedState: StoredUserState = {
        userData,
        lastUpdated: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(storedState));
    } catch (error) {
      console.error('Error storing user profile:', error);
    }
  },

  // Get user profile data
  getUserProfile: async (): Promise<UserProfile | null> => {
    try {
      const storedData = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (storedData) {
        const parsed: StoredUserState = JSON.parse(storedData);
        return parsed.userData;
      }
      return null;
    } catch (error) {
      console.error('Error retrieving user profile:', error);
      return null;
    }
  },

  // Store auth state flag (just to track if user was previously authenticated)
  setAuthState: async (isAuthenticated: boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_AUTH_STATE, JSON.stringify(isAuthenticated));
    } catch (error) {
      console.error('Error storing auth state:', error);
    }
  },

  // Get auth state flag
  getAuthState: async (): Promise<boolean> => {
    try {
      const storedData = await AsyncStorage.getItem(STORAGE_KEYS.USER_AUTH_STATE);
      return storedData ? JSON.parse(storedData) : false;
    } catch (error) {
      console.error('Error retrieving auth state:', error);
      return false;
    }
  },

  // Clear all stored data (on sign out)
  clearAllData: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEYS.USER_PROFILE, STORAGE_KEYS.USER_AUTH_STATE]);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },
};