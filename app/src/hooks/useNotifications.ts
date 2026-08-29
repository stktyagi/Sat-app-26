import { useEffect } from 'react';
import { useUserStore } from '@/state/userStore';

export function useNotifications() {
  const { userData: userProfile } = useUserStore();

  useEffect(() => {
    if (!userProfile) return;
  }, [userProfile]);
}
