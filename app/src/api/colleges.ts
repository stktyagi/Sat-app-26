// src/api/colleges.ts
import { API_BASE_URL } from '../config/api';

export interface CollegesResponse {
  colleges?: string[];
  items?: string[];
  total?: number;
}

/**
 * Fetches the complete list of colleges from the public backend endpoint.
 * Always bypasses any HTTP or device cache to ensure latest data from the backend.
 */
export async function fetchColleges(): Promise<string[]> {
  const url = `${API_BASE_URL}/colleges?_t=${Date.now()}`;
  console.log(`[api/colleges] Requesting fresh colleges from ${url}`);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch colleges: HTTP ${res.status}`);
    }
    const data: CollegesResponse = await res.json();
    const list = data.colleges || data.items || [];
    const result = Array.isArray(list) ? list : [];
    console.log(`[api/colleges] Received ${result.length} colleges from server`);
    return result;
  } catch (error) {
    console.warn('[api/colleges] Error fetching colleges from', url, error);
    throw error;
  }
}
