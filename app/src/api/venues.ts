import { apiFetch, readError } from './client';
import { Venue } from '@/types/models';

// ─── Public Fetch ────────────────────────────────────────────────────────────

/**
 * Fetch all venues. Used when the map screen opens and cached in the frontend.
 */
export async function listVenues(): Promise<Venue[]> {
  const res = await apiFetch('/venues', { method: 'GET' }, 'none');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load venues'));
  }
  const body = await res.json();
  return body.items || [];
}

/**
 * Fetch a single venue by its slug ID.
 */
export async function getVenue(id: string): Promise<Venue> {
  const res = await apiFetch(`/venues/${id}`, { method: 'GET' }, 'none');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load venue'));
  }
  const body = await res.json();
  return body.venue;
}

// ─── Admin Endpoints ─────────────────────────────────────────────────────────

/**
 * Admin: List all venues.
 */
export async function adminListVenues(): Promise<Venue[]> {
  const res = await apiFetch('/admin/venues', { method: 'GET' }, 'required');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load venues for admin'));
  }
  const body = await res.json();
  return body.items || [];
}

/**
 * Admin: Create a new venue with name and coordinates.
 */
export async function createVenue(data: {
  venueName: string;
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
}): Promise<boolean> {
  const res = await apiFetch(
    '/admin/venues',
    { method: 'POST', body: JSON.stringify(data) },
    'required'
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to create venue'));
  }
  return true;
}

/**
 * Admin: Update venue name or coordinates.
 */
export async function updateVenue(
  id: string,
  data: Partial<Venue>
): Promise<boolean> {
  const res = await apiFetch(
    `/admin/venues/${id}`,
    { method: 'PATCH', body: JSON.stringify(data) },
    'required'
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to update venue'));
  }
  return true;
}

/**
 * Admin: Update only latitude and longitude coordinates of a map venue.
 */
export async function updateVenueCoordinates(
  id: string,
  lat: number,
  lng: number
): Promise<boolean> {
  const res = await apiFetch(
    `/admin/venues/${id}/coordinates`,
    {
      method: 'PATCH',
      body: JSON.stringify({ lat, lng }),
    },
    'required'
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to update venue coordinates'));
  }
  return true;
}

/**
 * Admin: Batch update multiple venues and their coordinates in a single call.
 */
export async function batchUpdateVenues(
  venues: Array<{
    venueId: string;
    venueName?: string;
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  }>
): Promise<boolean> {
  const res = await apiFetch(
    '/admin/venues/batch',
    {
      method: 'PATCH',
      body: JSON.stringify({ venues }),
    },
    'required'
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to batch update venues'));
  }
  return true;
}

/**
 * Admin: Delete a venue (only succeeds if no events reference it).
 */
export async function deleteVenue(id: string): Promise<boolean> {
  const res = await apiFetch(
    `/admin/venues/${id}`,
    { method: 'DELETE' },
    'required'
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to delete venue'));
  }
  return true;
}
