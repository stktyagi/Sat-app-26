import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { useUserStore } from '@/state/userStore';
import {
  getFCMToken,
  setupForegroundNotificationHandler,
  setupTokenRefreshListener,
} from '@/utils/fcm';
import {
  consumeProfileStale,
  isProfileUpdateMessage,
  registerPushToken,
} from '@/utils/pushSync';

// Don't refetch the profile on every quick app switch.
const FOREGROUND_REFRESH_MIN_MS = 30_000;

export function useNotifications() {
  const userId = useUserStore((s) => s.userData?.userId);
  const lastRefresh = useRef(0);

  const refreshProfile = (force = false) => {
    const now = Date.now();
    if (!force && now - lastRefresh.current < FOREGROUND_REFRESH_MIN_MS) return;
    lastRefresh.current = now;
    useUserStore
      .getState()
      .refreshUserProfile()
      .catch(() => {});
  };

  // Foreground messages: silent profile pushes refresh roles; others alert.
  useEffect(() => {
    const unsubscribe = setupForegroundNotificationHandler((message) => {
      if (isProfileUpdateMessage(message.data)) {
        refreshProfile(true);
        return;
      }
      if (message.notification) {
        Alert.alert(
          message.notification.title || 'New Notification',
          message.notification.body || ''
        );
      }
    });
    return unsubscribe;
  }, []);

  // Register this device's token, and re-register whenever FCM rotates it.
  useEffect(() => {
    if (!userId) return;
    getFCMToken().then((token) => {
      if (token) registerPushToken(token);
    });
    return setupTokenRefreshListener((token) => registerPushToken(token));
  }, [userId]);

  // Returning to the app: refresh the profile (always if a silent push
  // arrived while backgrounded, otherwise throttled).
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const stale = await consumeProfileStale();
      refreshProfile(stale);
    });
    return () => sub.remove();
  }, [userId]);
}
