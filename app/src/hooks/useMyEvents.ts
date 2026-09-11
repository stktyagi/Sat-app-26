import { useState, useCallback, useEffect } from 'react';
import { getMyEvents } from '@/api/events';
import { useUserStore } from '@/state/userStore';

export const useMyEvents = () => {
  const isAuthReady = useUserStore((s) => s.isAuthReady);
  const authUser = useUserStore((s) => s.authUser);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!isAuthReady || !authUser) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const events = await getMyEvents();
      setData(events);
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [isAuthReady, authUser]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    data,
    loading,
    error,
    refresh: fetchEvents,
  };
};
