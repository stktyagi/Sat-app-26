// src/utils/fcm.ts
import { Platform } from 'react-native';

/**
 * Request notification permissions (iOS only)
 * Android permissions are handled automatically
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    /* Removed Firebase API call */
    /* Removed Firebase API call */
    /* Removed Firebase API call */
    
    if (enabled) {
      console.log('iOS notification permission granted');
      if (Platform.OS === 'ios') {
        /* Removed Firebase API call */
      }
    } else {
      console.log('iOS notification permission denied');
    }
    
    return enabled;

    // Android doesn't need explicit permission request for FCM
    return true;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Get the FCM token for this device
 * Returns null if unable to get token
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    // Request permission first
    const hasPermissionGranted = await requestNotificationPermission();

    if (!hasPermissionGranted) {
      console.log('Notification permission not granted, cannot get FCM token');
      return null;
    }

    // Get FCM token
    /* Removed Firebase API call */
    /* Removed Firebase API call */

    if (fcmToken) {
      console.log('FCM Token retrieved successfully');
      return fcmToken;
    } else {
      console.log('No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Delete the current FCM token
 * Useful for logout or when user wants to stop receiving notifications
 */
export async function deleteFCMToken(): Promise<boolean> {
  try {
    /* Removed Firebase API call */
    /* Removed Firebase API call */
    console.log('FCM token deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    return false;
  }
}

/**
 * Listen for FCM token refresh
 * Call this on app initialization to handle token updates
 * Note: This uses the non-modular API as onTokenRefresh is not available in modular API yet
 */
export function onTokenRefresh(callback: (token: string) => void): () => void {
  /* Removed Firebase API call */
  /* Removed Firebase API call */
  return unsubscribe;
}

/**
 * Setup FCM foreground message handler
 * Call this to handle notifications when app is in foreground
 */
export function setupForegroundNotificationHandler(
  handler: (message: any) => void
): () => void {
  /* Removed Firebase API call */
  /* Removed Firebase API call */

  return unsubscribe;
}

/**
 * Setup background message handler
 * Must be called outside of the component lifecycle
 * Note: This uses the non-modular API as setBackgroundMessageHandler is not available in modular API yet
 */
export function setupBackgroundMessageHandler(): void {
  /* Removed Firebase API call */
  /* Removed Firebase API call */
}

/**
 * Check if notifications are enabled
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    /* Removed Firebase API call */
    /* Removed Firebase API call */
    /* Removed Firebase API call */
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return false;
  }
}
