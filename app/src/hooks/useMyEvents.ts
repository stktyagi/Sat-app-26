import { useQuery } from '@tanstack/react-query';
import { getMyEvents } from '@/api/events';
import { useUserStore } from '@/state/userStore';

export const useMyEvents = () => {
  const isAuthReady = useUserStore((s) => s.isAuthReady);
  const authUser = useUserStore((s) => s.authUser);

  const query = useQuery({
    queryKey: ['events', 'mine', authUser?.uid],
    queryFn: () => getMyEvents(),
    enabled: isAuthReady && !!authUser,
  });



  return {
    data: query.data || [],
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
    refresh: query.refetch,
  };
};
