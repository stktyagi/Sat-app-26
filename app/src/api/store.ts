import { apiFetch } from './client';

export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  priceText?: string;
}

export type StoreItem = StoreProduct;

export interface LeaderboardUser {
  rank: number;
  userId: string;
  displayName: string;
  collegeName: string;
  coins: number;
  photoUrl?: string;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardUser[];
  total: number;
  userRank: number;
  userCoins: number;
}

export interface GameClaimResponse {
  success: boolean;
  alreadyClaimed: boolean;
  coins: number;
  awarded: number;
  message: string;
}

/**
 * Fetch products from the backend store API
 */
export async function fetchStoreItems(): Promise<StoreProduct[]> {
  try {
    const res = await apiFetch('/store', { method: 'GET' }, 'optional');
    if (!res.ok) {
      throw new Error(`Failed to load store items: ${res.status}`);
    }
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      id: item.id || item.ID || `prod-${Math.random()}`,
      name: item.name || item.Name || 'Saturnalia Merch',
      description: item.description || item.Description || '',
      price: Number(item.price || item.Price || 0),
      image: item.image || item.Image || '',
      priceText: `Rs. ${item.price || item.Price || 0}`,
    }));
  } catch (error) {
    console.warn('Error fetching store items:', error);
    return [];
  }
}

/**
 * Fetch a single product by ID
 */
export async function fetchStoreItem(id: string): Promise<StoreProduct | null> {
  const items = await fetchStoreItems();
  return items.find((i) => i.id === id) || null;
}

/**
 * Fetch the leaderboard from backend
 */
export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  try {
    const res = await apiFetch('/store/leaderboard', { method: 'GET' }, 'optional');
    if (!res.ok) {
      throw new Error(`Failed to load leaderboard: ${res.status}`);
    }
    const data = await res.json();
    return {
      leaderboard: data.leaderboard || [],
      total: data.total || 0,
      userRank: data.userRank || 0,
      userCoins: data.userCoins || 0,
    };
  } catch (error) {
    console.warn('Error fetching leaderboard:', error);
    return {
      leaderboard: [],
      total: 0,
      userRank: 0,
      userCoins: 0,
    };
  }
}

/**
 * Claim daily coins from backend upon completing a game level
 */
export async function claimGameCoins(game: 'zip' | 'patches' | 'quiz'): Promise<GameClaimResponse> {
  const res = await apiFetch('/me/games/complete', {
    method: 'POST',
    body: JSON.stringify({ game }),
  }, 'required');

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to claim game reward');
  }

  return await res.json();
}
