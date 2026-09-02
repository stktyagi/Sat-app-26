import { useQuery } from '@tanstack/react-query';
import { FirebaseEvent } from '@/types/models';
import { listEvents } from '@/api/events';
import { useUserStore } from '@/state/userStore';

export const useEvents = () => {
  const isAuthReady = useUserStore((s) => s.isAuthReady);

  const query = useQuery({
    queryKey: ['events', 'list'],
    queryFn: () => listEvents(),
    enabled: isAuthReady,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return { 
    events: query.data || [], 
    loading: query.isLoading, 
    error: query.error ? query.error.message : null, 
    refresh: query.refetch 
  };
};

export const useEventsByCategory = (selectedCategory: string) => {
  const { events, loading, error, refresh } = useEvents();

  const filteredEvents = selectedCategory === 'All'
    ? events
    : events.filter(e => (e.category || '').toLowerCase() === selectedCategory.toLowerCase());

  return { events: filteredEvents, loading, error, refresh };
};

export const useEventsSearch = (searchText: string) => {
  const { events, loading, error, refresh } = useEvents();

  const filteredEvents = searchText.trim() === ''
    ? events
    : events.filter(event =>
        event.title.toLowerCase().includes(searchText.toLowerCase()) ||
        event.category.toLowerCase().includes(searchText.toLowerCase()) ||
        (event.venueName && event.venueName.toLowerCase().includes(searchText.toLowerCase())) ||
        (event.description && event.description.toLowerCase().includes(searchText.toLowerCase())) ||
        (event.shortDescription && event.shortDescription.toLowerCase().includes(searchText.toLowerCase()))
      );

  return { events: filteredEvents, loading, error, refresh };
};
