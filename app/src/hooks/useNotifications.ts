import { useEffect } from 'react';
import { useUserStore } from '@/state/userStore';
import { getFCMToken } from '@/utils/fcm';
import { getAuth } from '@react-native-firebase/auth';
import { API_BASE_URL } from '@/config/api';

export function useNotifications() {
  const { userData: userProfile } = useUserStore();

  useEffect(() => {
    if (!userProfile) return;
    
    (async () => {
      try {
        const token = await getFCMToken();
        if (!token) return;
        
        const auth = getAuth();
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) return;
        
        const idToken = await firebaseUser.getIdToken(true);
        
        const response = await fetch(`${API_BASE_URL}/me/fcm-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ fcmToken: token }),
        });
        
        if (response.ok) {
          console.log('FCM token registered with backend successfully');
        } else {
          console.error('Failed to register FCM token with backend, status:', response.status);
        }
      } catch (error) {
        console.error('Failed to register FCM token with backend:', error);
      }
    })();
  }, [userProfile]);
}
