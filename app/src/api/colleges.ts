// src/api/colleges.ts
import { apiFetch, readError } from './client';

export interface CollegesResponse {
  colleges?: string[];
  items?: string[];
  total?: number;
}

/**
 * Fetches the complete list of colleges from the public backend endpoint.
 */
export async function fetchColleges(): Promise<string[]> {
  try {
    const res = await apiFetch('/colleges', { method: 'GET' }, 'none');
    if (!res.ok) {
      const err = await readError(res, 'Failed to fetch colleges');
      throw new Error(err);
    }
    const data: CollegesResponse = await res.json();
    const list = data.colleges || data.items || [];
    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.warn('[api/colleges] Error fetching colleges from server:', error);
    throw error;
  }
}
