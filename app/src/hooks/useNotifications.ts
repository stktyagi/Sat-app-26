// src/hooks/useNotifications.ts
import { useEffect } from 'react';
import { Platform, Alert,Linking } from 'react-native';
import { showAlert } from '../components';
import { useUserStore } from '@/state/userStore';


/**
 * 
 * Hook to setup and handle push notifications
 */
//useNotifications
export function useNotifications() {
  const { userData: userProfile } = useUserStore(); // ✅ call hook at top-level

  /* Removed Firebase API call */ // include userProfile as dependency
}


/**
 * Request notification permissions
 */
async function requestUserPermission() {
  try {
    /* Removed Firebase API call */
    
    if (Platform.OS === 'ios') {
      await messaging.registerDeviceForRemoteMessages();
    }
    /* Removed Firebase API call */
    /* Removed Firebase API call */

    if (enabled && Platform.OS === 'android') {
      console.log('Notification authorization status:', authStatus);
      /* Removed Firebase API call */
      console.log('FCM Token:', token);
    } else {
      // Permission denied - show alert to open settings
      showAlert(
        'Notifications Disabled',
        'To receive important updates and announcements, please enable notifications in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => {
              Linking.openSettings().catch(() => {
                console.error('Cannot open settings');
              });
            }
          },
        ]
      );
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
}

/**
 * Subscribe to notification topics
 */
async function subscribeToTopics(userProfile: any) {
  try {
    /* Removed Firebase API call */
    
    // Subscribe to the 'all' topic to receive all notifications
    /* Removed Firebase API call */
    console.log('Subscribed to topic: all');

    // Subscribe to additional topics based on user type
    if (userProfile?.isHostCollegeStudent) {
      /* Removed Firebase API call */
      console.log('Subscribed to topic: host');
    } else {
      /* Removed Firebase API call */
      console.log('Subscribed to topic: outside');
    }
  } catch (error) {
    console.error('Error subscribing to topics:', error);
  }
}

/**
 * Handle notification action/navigation
 */
function handleNotificationAction(remoteMessage: any) {
  try {
    const { data } = remoteMessage;
    // Handle different notification types
    if (data?.type === 'event') {
      // Navigate to event details
      console.log('Navigate to event:', data.eventId);
      // You can use navigation here if needed
    } else if (data?.type === 'announcement') {
      // Show announcement
      console.log('Show announcement:', data.message);
      showAlert(
        remoteMessage.notification?.title || 'Announcement',
        remoteMessage.notification?.body || data.message
      );
    } else {
      // Default action
      console.log('Default notification action');
    }
  } catch (error) {
    console.error('Error handling notification action:', error);
  }
}
