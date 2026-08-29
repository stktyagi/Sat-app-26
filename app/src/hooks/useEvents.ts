import { useState, useEffect } from 'react';
import { FirebaseEvent } from '@/types/models';

export const useEvents = () => {
  const [events, setEvents] = useState<FirebaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Removed API call: subscribeToEvents */

  return { events, loading, error };
};

export const useEventsByCategory = (selectedCategory: string) => {
  const { events, loading, error } = useEvents();

  const filteredEvents = selectedCategory === 'All'
    ? events
    : events.filter(e => (e.category || '').toLowerCase() === selectedCategory.toLowerCase());

  return { events: filteredEvents, loading, error };
};

export const useEventsSearch = (searchText: string) => {
  const { events, loading, error } = useEvents();

  const filteredEvents = searchText.trim() === ''
    ? events
    : events.filter(event =>
        event.title.toLowerCase().includes(searchText.toLowerCase()) ||
        event.category.toLowerCase().includes(searchText.toLowerCase()) ||
        (event.venueName && event.venueName.toLowerCase().includes(searchText.toLowerCase())) ||
        (event.description && event.description.toLowerCase().includes(searchText.toLowerCase())) ||
        (event.shortDescription && event.shortDescription.toLowerCase().includes(searchText.toLowerCase()))
      );

  return { events: filteredEvents, loading, error };
};