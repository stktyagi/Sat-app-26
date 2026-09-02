import { useQuery } from '@tanstack/react-query';
import { getEventDetail } from '@/api/events';
import { useUserStore } from '@/state/userStore';

export const useEventDetail = (eventId: string) => {
  const isAuthReady = useUserStore((s) => s.isAuthReady);

  const query = useQuery({
    queryKey: ['events', 'detail', eventId],
    queryFn: () => getEventDetail(eventId),
    enabled: isAuthReady && !!eventId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
    refresh: query.refetch,
  };
};
