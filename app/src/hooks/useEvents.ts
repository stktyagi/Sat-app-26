import { useState, useEffect, useCallback } from 'react';
import { FirebaseEvent } from '@/types/models';
import { listEvents } from '@/api/events';
import { useUserStore } from '@/state/userStore';

export const useEvents = () => {
  const [events, setEvents] = useState<FirebaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAuthReady = useUserStore((s) => s.isAuthReady);

  const fetchEvents = useCallback(async () => {
    try {
      setError(null);
      const items = await listEvents();
      setEvents(items);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    setLoading(true);
    fetchEvents();
  }, [isAuthReady, fetchEvents]);

  return { events, loading, error, refresh: fetchEvents };
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
