// src/utils/fcm.ts
import {
  getMessaging,
  requestPermission,
  getToken,
  deleteToken,
  onTokenRefresh,
  onMessage,
  setBackgroundMessageHandler,
  hasPermission,
  AuthorizationStatus,
  RemoteMessage
} from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

/**
 * Request notification permissions (iOS only)
 * Android permissions are handled automatically
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const messagingInstance = getMessaging();
    const authStatus = await requestPermission(messagingInstance);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;
    
    if (enabled) {
      console.log('Notification permission granted');
    } else {
      console.log('Notification permission denied');
    }
    
    return enabled;
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
    const messagingInstance = getMessaging();
    const fcmToken = await getToken(messagingInstance);

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
    const messagingInstance = getMessaging();
    await deleteToken(messagingInstance);
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
 */
export function setupTokenRefreshListener(callback: (token: string) => void): () => void {
  const messagingInstance = getMessaging();
  const unsubscribe = onTokenRefresh(messagingInstance, token => {
    callback(token);
  });
  return unsubscribe;
}

/**
 * Setup FCM foreground message handler
 * Call this to handle notifications when app is in foreground
 */
export function setupForegroundNotificationHandler(
  handler: (message: RemoteMessage) => void
): () => void {
  const messagingInstance = getMessaging();
  const unsubscribe = onMessage(messagingInstance, async remoteMessage => {
    handler(remoteMessage);
  });
  return unsubscribe;
}

/**
 * Setup background message handler
 * Must be called outside of the component lifecycle
 */
export function setupBackgroundMessageHandler(): void {
  const messagingInstance = getMessaging();
  setBackgroundMessageHandler(messagingInstance, async remoteMessage => {
    console.log('Message handled in the background!', remoteMessage);
  });
}

/**
 * Check if notifications are enabled
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const messagingInstance = getMessaging();
    const authStatus = await hasPermission(messagingInstance);
    return (
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return false;
  }
}
