/**
 * src/api/admin.ts
 *
 * Unified admin API layer.
 * - Real endpoints: events, registrations (backed by Go backend)
 * - Everything else: mock data until the backend adds those routes
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { apiFetch, getIdTokenIfSignedIn, readError } from './client';
import { API_BASE_URL } from '@/config/api';
import {
  adminListBanners,
  adminCreateBanner,
  adminUpdateBanner,
  adminDeleteBanner,
  fetchBanners,
  Banner,
} from './banners';
import {
  adminListReels,
  adminCreateReel,
  adminUpdateReel,
  adminDeleteReel,
  fetchReels,
} from './reels';
import {
  adminListStories,
  adminCreateStory,
  adminUpdateStory,
  adminDeleteStory,
  listStories,
} from './stories';
import { useContentCacheStore } from '@/state/contentCacheStore';

export * from './banners';
export * from './reels';
export * from './stories';

// ─── ImageKit Media Upload ───────────────────────────────────────────────────

export async function adminUploadMedia(
  fileUri: string,
  options?: { folder?: string; fileName?: string; mimeType?: string }
): Promise<{ url: string; ref: string; name: string }> {
  const folder = options?.folder || 'general';

  if (Platform.OS === 'web') {
    const resp = await fetch(fileUri);
    const blob = await resp.blob();
    const formData = new FormData();
    formData.append('file', blob, options?.fileName || 'upload');
    formData.append('folder', folder);
    const res = await apiFetch('/admin/media/upload', {
      method: 'POST',
      body: formData,
    }, 'required');
    if (!res.ok) throw new Error(await readError(res, 'Failed to upload media'));
    return res.json();
  }

  // Native (Android/iOS): use native FileSystem streaming upload
  const token = await getIdTokenIfSignedIn();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const result = await FileSystem.uploadAsync(
    `${API_BASE_URL}/admin/media/upload`,
    fileUri,
    {
      fieldName: 'file',
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      headers,
      parameters: {
        folder,
      },
    }
  );

  if (result.status < 200 || result.status >= 300) {
    let errMsg = 'Failed to upload media';
    try {
      const parsed = JSON.parse(result.body);
      if (typeof parsed?.error === 'string') {
        errMsg = parsed.error;
      } else if (typeof parsed?.error?.message === 'string') {
        errMsg = parsed.error.message;
      } else if (typeof parsed?.message === 'string') {
        errMsg = parsed.message;
      }
    } catch {}
    throw new Error(errMsg);
  }

  return JSON.parse(result.body);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminEvent {
  id: string;
  eventId: string;
  title: string;
  category: string;
  startDateTime: string;
  endDateTime: string;
  isPublic: boolean;
  isFeatured: boolean;
  venueId?: string;
  venueName?: string;
  registeredCount?: number;
  maxParticipants?: number;
}

export interface AdminRegistration {
  id: string;
  userId: string;
  eventId: string;
  teamId?: string;
  registeredAt: string;
  paymentStatus?: string;
  qrToken?: string;
  displayName?: string;
  email?: string;
}

export interface AdminUser {
  userId: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: string;
  roles?: string[];
  isHostCollegeStudent: boolean;
  collegeName?: string;
  fullyRegistered: boolean;
  coins?: number;
  createdAt?: string;
}

export interface AdminVenue {
  id: string;
  name: string;
  description?: string;
  capacity?: number;
  location?: string;
}

export interface AdminBanner {
  id: string;
  imageUrl: string;
  linkUrl?: string;
  isActive: boolean;
  order: number;
}

export interface AccommodationStats {
  total: number;
  checkedIn: number;
  pending: number;
}

export interface UserAccommodation {
  userId: string;
  displayName: string;
  email?: string;
  phoneNumber?: string;
  collegeName?: string;
  accommodationNeeded: boolean;
  accommodationStatus?: Record<string, boolean>;
  foodStatus?: Record<string, boolean>;
  checkInStatus?: Record<string, any>;
}

// ─── Events (real backend) ─────────────────────────────────────────────────

export async function adminListEvents(): Promise<AdminEvent[]> {
  const { listEvents } = await import('./events');
  const items = await listEvents();
  return items.map((e) => ({
    id: e.eventId,
    eventId: e.eventId,
    title: e.title ?? '',
    category: e.category ?? '',
    startDateTime: e.startDateTime ?? e.dateTime ?? '',
    endDateTime: e.endDateTime ?? '',
    isPublic: e.isPublic !== false,
    isFeatured: !!e.isFeatured,
    venueId: e.venueId,
    venueName: e.venueName,
    registeredCount: undefined,
    maxParticipants: undefined,
  }));
}

export async function adminCreateEvent(data: Record<string, any>): Promise<AdminEvent> {
  const res = await apiFetch('/admin/events', { method: 'POST', body: JSON.stringify(data) }, 'required');
  if (!res.ok) throw new Error(await readError(res, 'Failed to create event'));
  return res.json();
}

export async function adminUpdateEvent(id: string, data: Record<string, any>): Promise<void> {
  const res = await apiFetch(`/admin/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, 'required');
  if (!res.ok) throw new Error(await readError(res, 'Failed to update event'));
}

export async function adminDeleteEvent(id: string): Promise<void> {
  const res = await apiFetch(`/admin/events/${id}`, { method: 'DELETE' }, 'required');
  if (!res.ok) throw new Error(await readError(res, 'Failed to delete event'));
}

export async function adminListRegistrations(eventId: string): Promise<AdminRegistration[]> {
  const res = await apiFetch(`/admin/events/${eventId}/registrations?limit=500`, {}, 'required');
  if (!res.ok) throw new Error(await readError(res, 'Failed to load registrations'));
  const data = await res.json();
  return data.items ?? [];
}

// ─── Users (mock — no backend endpoint yet) ──────────────────────────────────

const MOCK_USERS: AdminUser[] = [
  { userId: 'mock-1', displayName: 'Alice Singh', email: 'alice@thapar.edu', role: 'user', isHostCollegeStudent: true, collegeName: 'Thapar Institute', fullyRegistered: true, coins: 150 },
  { userId: 'mock-2', displayName: 'Bob Sharma', email: 'bob@example.com', role: 'user', isHostCollegeStudent: false, collegeName: 'IIT Delhi', fullyRegistered: true, coins: 80 },
];

export async function adminListUsers(_params?: { q?: string; role?: string }): Promise<AdminUser[]> {
  // TODO: replace with real endpoint when backend adds GET /admin/users
  return MOCK_USERS;
}

export async function adminUpdateUserRole(userId: string, role: string): Promise<void> {
  console.log('[mock] updateUserRole', userId, role);
}

export async function adminUpdateUser(email: string, data: Record<string, any>): Promise<AdminUser> {
  const res = await apiFetch(`/admin/users/by-email/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, 'required');
  if (!res.ok) throw new Error(await readError(res, 'Failed to update user'));
  const json = await res.json();
  return json.user;
}

export async function adminDeleteUser(email: string): Promise<void> {
  const res = await apiFetch(`/admin/users/by-email/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  }, 'required');
  if (!res.ok) throw new Error(await readError(res, 'Failed to delete user'));
}

export async function adminGetUserRegistrations(email: string): Promise<any[]> {
  const res = await apiFetch(`/admin/users/by-email/${encodeURIComponent(email)}/registrations`, {}, 'required');
  if (!res.ok) throw new Error(await readError(res, 'Failed to get user registrations'));
  const data = await res.json();
  return data.items || [];
}

// ─── Accommodation ──────────────────────────────────────────────────────────

const accommodationCache = new Map<string, { data: any; timestamp: number }>();
const ACCOM_CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function clearAccommodationCache(): Promise<void> {
  accommodationCache.clear();
}

export async function fetchAccommodationStats(
  forceRefresh?: boolean
): Promise<AccommodationStats[]> {
  const cacheKey = 'stats';
  const cached = accommodationCache.get(cacheKey);
  const now = Date.now();
  if (!forceRefresh && cached && now - cached.timestamp < ACCOM_CACHE_TTL_MS) {
    return cached.data;
  }
  const res = await apiFetch('/admin/accommodation/stats', {}, 'required');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to fetch accommodation stats'));
  }
  const data = await res.json();
  const result = data.stats || [];
  accommodationCache.set(cacheKey, { data: result, timestamp: now });
  return result;
}

export async function fetchIncomingUsers(
  day: string,
  forceRefresh?: boolean
): Promise<UserAccommodation[]> {
  const cacheKey = `incoming:${day}`;
  const cached = accommodationCache.get(cacheKey);
  const now = Date.now();
  if (!forceRefresh && cached && now - cached.timestamp < ACCOM_CACHE_TTL_MS) {
    return cached.data;
  }
  const res = await apiFetch(`/admin/accommodation?day=${day}&type=incoming`, {}, 'required');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to fetch incoming accommodation users'));
  }
  const data = await res.json();
  const result = data.users || [];
  accommodationCache.set(cacheKey, { data: result, timestamp: now });
  return result;
}

export async function fetchOutgoingUsers(
  day: string,
  forceRefresh?: boolean
): Promise<UserAccommodation[]> {
  const cacheKey = `outgoing:${day}`;
  const cached = accommodationCache.get(cacheKey);
  const now = Date.now();
  if (!forceRefresh && cached && now - cached.timestamp < ACCOM_CACHE_TTL_MS) {
    return cached.data;
  }
  const res = await apiFetch(`/admin/accommodation?day=${day}&type=outgoing`, {}, 'required');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to fetch outgoing accommodation users'));
  }
  const data = await res.json();
  const result = data.users || [];
  accommodationCache.set(cacheKey, { data: result, timestamp: now });
  return result;
}

export async function updateAccommodationCheckIn(
  userId: string,
  status: boolean,
  hostel?: string
): Promise<void> {
  const body: Record<string, any> = {
    userId,
    accommodation: status,
  };
  if (hostel !== undefined) {
    body.Hostel = hostel;
  }
  const res = await apiFetch(`/admin/qr/hostel/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }, 'required');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to update accommodation check-in'));
  }
  await clearAccommodationCache();
}


// ─── Venues ───────────────────────────────────────────────────────────────────

import {
  listVenues,
  getVenue,
  adminListVenues,
  createVenue,
  updateVenue,
  updateVenueCoordinates,
  batchUpdateVenues,
  deleteVenue,
} from './venues';

export {
  listVenues,
  getVenue,
  adminListVenues,
  createVenue,
  updateVenue,
  updateVenueCoordinates,
  batchUpdateVenues,
  deleteVenue,
};



// ─── FAQs (mock) ──────────────────────────────────────────────────────────────

export interface FAQ { id: string; question: string; answer: string; order: number; }

export async function listFAQs(): Promise<FAQ[]> {
  const res = await apiFetch('/faqs', {}, 'none');
  if (!res.ok) throw new Error(await readError(res, 'Failed to load faqs'));
  const body = await res.json();
  return body.items || [];
}

export async function createFAQ(data: Partial<FAQ>): Promise<void> {
  const res = await apiFetch('/admin/faqs', { method: 'POST', body: JSON.stringify(data) }, 'required');
  if (!res.ok) throw new Error(await readError(res, 'Failed to create faq'));
  return res.json();
}

export async function updateFAQ(id: string, data: Partial<FAQ>): Promise<boolean> {
  const res = await apiFetch(`/admin/faqs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, 'required');
  if (!res.ok) throw new Error(await readError(res, 'Failed to update faq'));
  return res.json();
}

export async function deleteFAQ(id: string): Promise<boolean> {
  const res = await apiFetch(`/admin/faqs/${id}`, { method: 'DELETE' }, 'required');
  if (!res.ok) throw new Error(await readError(res, 'Failed to delete faq'));
  return true;
}

// ─── Banners (Real Backend) ───────────────────────────────────────────────────

export async function listBanners(): Promise<AdminBanner[]> {
  const items = await adminListBanners();
  return items.map((b) => ({
    id: b.id,
    imageUrl: b.imageUrl,
    linkUrl: b.link,
    isActive: b.isActive,
    order: b.order,
  }));
}

export async function createBanner(data: Partial<AdminBanner>): Promise<void> {
  await adminCreateBanner({
    title: (data as any).title || 'Banner',
    description: (data as any).description || '',
    imageUrl: data.imageUrl,
    link: data.linkUrl || (data as any).link || '',
    isActive: data.isActive !== false,
    order: data.order || 0,
  });
  useContentCacheStore.getState().invalidateBanners();
}

export async function updateBanner(id: string, data: Partial<AdminBanner>): Promise<void> {
  await adminUpdateBanner(id, {
    title: (data as any).title,
    description: (data as any).description,
    imageUrl: data.imageUrl,
    link: data.linkUrl ?? (data as any).link,
    isActive: data.isActive,
    order: data.order,
  });
  useContentCacheStore.getState().invalidateBanners();
}

export async function deleteBanner(id: string): Promise<void> {
  await adminDeleteBanner(id);
  useContentCacheStore.getState().invalidateBanners();
}

// ─── Polls (mock) ─────────────────────────────────────────────────────────────

export interface Poll { id: string; question: string; options: string[]; isActive: boolean; votes?: Record<string, number>; voters?: string[]; }

export async function listPolls(): Promise<Poll[]> {
  return [];
}

export async function createPoll(_data: Partial<Poll>): Promise<void> {
  console.log('[mock] createPoll');
}

// ─── Transactions (mock) ──────────────────────────────────────────────────────

export interface AdminTransaction {
  id: string;
  userId: string;
  amount: number;
  type: string;
  status: string;
  createdAt: string;
}

export async function listTransactions(_params?: { q?: string; type?: string }): Promise<AdminTransaction[]> {
  return [];
}

// ─── Aliases — names the admin screens import by (from old API layer) ─────────

export const getAllEventsForAdmin = async () => {
  const { listEvents } = await import('./events');
  return listEvents();
};

export const getEventByIdForAdmin = async (id: string) => {
  const { getEvent } = await import('./events');
  return getEvent(id);
};

export const updateEventInfo = async (id: string, data: Record<string, any>) => {
  try {
    await adminUpdateEvent(id, data);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update event' };
  }
};

export const searchUsers = async (term: string) => {
  const q = term?.trim();
  if (!q) return [];
  try {
    const { apiFetch } = await import('./client');
    // If search term looks like an email or partial email
    if (q.includes('@')) {
      const res = await apiFetch(`/admin/users/by-email/${encodeURIComponent(q)}`, {}, 'required');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          return [{
            userId: data.user.userId || data.user.id || '',
            displayName: data.user.displayName || data.user.name || '',
            email: data.user.email || '',
            phoneNumber: data.user.phoneNumber || data.user.phone || '',
            collegeName: data.user.collegeName || '',
          }];
        }
      }
    } else if (q.length >= 8 && !q.includes(' ')) {
      // Try by userId
      try {
        const res = await apiFetch(`/admin/users/${encodeURIComponent(q)}`, {}, 'required');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            return [{
              userId: data.user.userId || data.user.id || '',
              displayName: data.user.displayName || data.user.name || '',
              email: data.user.email || '',
              phoneNumber: data.user.phoneNumber || data.user.phone || '',
              collegeName: data.user.collegeName || '',
            }];
          }
        }
      } catch {}
    }
  } catch (e) {
    console.error('searchUsers error:', e);
  }
  return [] as any[];
};
export const searchVenues = async (term: string) => {
  const venues = await listVenues();
  const q = term.toLowerCase();
  return venues.filter((v: any) => v.venueName.toLowerCase().includes(q) || (v.venueId || '').toLowerCase().includes(q));
};
export const uploadFile = async (_uri: string) => ({ success: false, error: 'Upload is not available yet' });

export interface UserEventRegistration {
  userId: string;
  eventId: string;
  registeredAt: string;
  status?: string;
  teamId?: string;
  teamName?: string;
  teamInviteCode?: string;
  eventType?: string;
  responses?: any[];
  paymentStatus?: string;
  user: {
    email: string;
    name?: string;
    displayName?: string;
    phoneNumber?: string;
    collegeName?: string;
    rollNumber?: string;
  };
}

const mapReg = (item: any): UserEventRegistration => {
  const reg = item?.registration ?? item ?? {};
  const user = item?.user ?? item?.registration?.user ?? item ?? {};
  const team = item?.team;
  return {
    userId: reg.userId ?? item.userId ?? '',
    eventId: reg.eventId ?? item.eventId ?? '',
    registeredAt: reg.registeredAt ?? reg.createdAt ?? item.registeredAt ?? '',
    status: reg.status ?? item.status ?? 'confirmed',
    teamId: reg.teamId ?? item.teamId ?? '',
    teamName: team?.teamName ?? team?.name ?? reg.teamName ?? item.teamName ?? '',
    teamInviteCode: team?.inviteCode ?? reg.teamInviteCode ?? item.teamInviteCode ?? '',
    eventType: reg.eventType ?? item.eventType,
    responses: reg.responses ?? item.responses,
    paymentStatus: reg.paymentStatus ?? item.paymentStatus,
    user: {
      email: user?.email ?? item.email ?? '',
      name: user?.name ?? user?.displayName ?? item.name ?? item.displayName ?? '',
      displayName: user?.displayName ?? user?.name ?? item.displayName ?? '',
      phoneNumber: user?.phoneNumber ?? '',
      collegeName: user?.collegeName ?? '',
      rollNumber: user?.rollNumber ?? '',
    },
  };
};

const registrationsCache = new Map<string, { data: UserEventRegistration[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export const invalidateEventRegistrationsCache = (eventId?: string) => {
  if (eventId) {
    registrationsCache.delete(eventId);
  } else {
    registrationsCache.clear();
  }
};

export const getEventRegistrations = async (eventId: string, forceRefresh = false): Promise<UserEventRegistration[]> => {
  const cached = registrationsCache.get(eventId);
  const now = Date.now();
  if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = (await adminListRegistrations(eventId)).map(mapReg);
  registrationsCache.set(eventId, { data, timestamp: now });
  return data;
};

export const getAllEventRegistrations = getEventRegistrations;

export interface TeamSummary {
  teamId: string;
  teamName: string;
  leaderId: string;
  memberCount: number;
  maxSize: number;
  status: 'confirmed' | 'pending' | 'payment_pending' | 'rejected';
  createdAt: string;
  inviteCode: string;
  firstMemberCollegeName?: string;
  members?: UserEventRegistration[];
}

export const getEventTeamSummaries = async (eventId: string): Promise<TeamSummary[]> => {
  const regs = await getEventRegistrations(eventId);
  const groups = new Map<string, UserEventRegistration[]>();
  for (const reg of regs) {
    const key = reg.teamId || `solo-${reg.userId}`;
    const list = groups.get(key) ?? [];
    list.push(reg);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([teamId, members]) => {
    const first = members[0];
    const isSolo = teamId.startsWith('solo-');
    const computedName = isSolo
      ? first?.user?.name || first?.user?.displayName || 'Individual Participant'
      : first?.teamName || `Team ${teamId.slice(0, 6)}`;

    return {
      teamId,
      teamName: computedName,
      leaderId: first?.userId ?? '',
      memberCount: members.length,
      maxSize: members.length,
      status: (first?.status as TeamSummary['status']) || 'confirmed',
      createdAt: first?.registeredAt ?? '',
      inviteCode: first?.teamInviteCode || '',
      firstMemberCollegeName: first?.user?.collegeName,
    };
  });
};

export const getTeamMembers = async (eventId: string, teamId: string) => {
  const regs = await getEventRegistrations(eventId);
  return regs.filter((r) => (r.teamId || `solo-${r.userId}`) === teamId);
};

export const getAllTeamRegistrationsWithMembers = async (eventId: string) => {
  const regs = await getEventRegistrations(eventId);
  const groups = new Map<string, UserEventRegistration[]>();
  for (const reg of regs) {
    const key = reg.teamId || `solo-${reg.userId}`;
    const list = groups.get(key) ?? [];
    list.push(reg);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([teamId, members]) => {
    const first = members[0];
    const isSolo = teamId.startsWith('solo-');
    const computedName = isSolo
      ? first?.user?.name || first?.user?.displayName || 'Individual Participant'
      : first?.teamName || `Team ${teamId.slice(0, 6)}`;

    return {
      teamId,
      teamName: computedName,
      leaderId: first?.userId ?? '',
      memberCount: members.length,
      maxSize: members.length,
      status: (first?.status as TeamSummary['status']) || 'confirmed',
      createdAt: first?.registeredAt ?? '',
      inviteCode: first?.teamInviteCode || '',
      firstMemberCollegeName: first?.user?.collegeName,
      members,
    };
  });
};

export const updateTeamRegistrationStatus = async (
  eventId: string,
  teamId: string,
  status: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const res = await apiFetch(`/admin/events/${eventId}/registrations/${encodeURIComponent(teamId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, 'required');
    if (!res.ok) {
      const err = await readError(res, 'Failed to update status');
      return { success: false, error: err };
    }
    invalidateEventRegistrationsCache(eventId);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to update status:', err);
    return { success: false, error: err?.message || 'Failed to update status' };
  }
};



export const getRegistrationTransaction = async (..._args: any[]) => null;

export const getFAQs = listFAQs;

export const getVenues = listVenues;

export const getRewards = async () => [] as any[];
export const getStoreItems = async (_includeInactive?: boolean): Promise<{ success: boolean; data: StoreItem[]; error?: string }> => ({
  success: true,
  data: [],
});
export type StoreItem = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  category: string;
  images?: string[];
  description?: string;
  sizeOptions?: any[];
  currentInventory?: number;
};

export const createUpdate = async (_data: any) => { console.log('[mock] createUpdate'); };
export const getUpdates = (cb?: (items: any[]) => void) => {
  cb?.([]);
  return () => {};
};
export const deleteUpdate = async (_id: string) => { console.log('[mock] deleteUpdate'); return true; };

export const getAllPolls = (cb?: (polls: any[]) => void) => {
  cb?.([]);
  return () => {};
};
export const togglePollStatus = async (_id: string, _isActive: boolean) => {
  console.log('[mock] togglePollStatus');
};
export const voteOnPoll = async (_pollId: string, _optionId: string, _userId?: string): Promise<{ success: boolean; message?: string }> => {
  console.log('[mock] voteOnPoll');
  return { success: true };
};

export const getCorousal = async () => {
  const banners = await adminListBanners();
  return banners.map((b) => ({
    id: b.id,
    imageUrl: b.imageUrl,
    link: b.link,
    corousalType: 1,
    isPublic: b.isActive,
    date: b.createdAt,
    title: b.title,
    description: b.description,
    order: b.order,
  }));
};

export const createCorousal = async (data: any) => {
  const banner = await adminCreateBanner({
    title: data.title || 'Promotional Banner',
    description: data.description || '',
    imageUrl: data.imageUrl,
    link: data.link || '',
    isActive: data.isPublic !== false,
    order: data.order || 0,
  });
  useContentCacheStore.getState().invalidateBanners();
  return banner;
};

export const deleteCorousal = async (id: string) => {
  await adminDeleteBanner(id);
  useContentCacheStore.getState().invalidateBanners();
  return true;
};

export const uploadStoryMedia = async (
  uri: string,
  type?: string
): Promise<{ success: boolean; url?: string; ref?: string; error?: string }> => {
  try {
    const res = await adminUploadMedia(uri, {
      folder: type === 'video' ? 'reels' : 'stories',
      mimeType: type === 'video' ? 'video/mp4' : 'image/jpeg',
    });
    return { success: true, url: res.url, ref: res.ref };
  } catch (err: any) {
    console.warn('uploadStoryMedia error:', err);
    return { success: false, error: err?.message || 'Failed to upload media' };
  }
};

export const fetchUsers = async (filters?: any, _loadMore?: boolean) => {
  const term = filters?.searchTerm?.trim() || '';
  if (term.includes('@')) {
    try {
      const { apiFetch } = await import('./client');
      const res = await apiFetch(`/admin/users/by-email/${encodeURIComponent(term)}`, {}, 'required');
      if (res.ok) {
        const data = await res.json();
        return { users: [data.user], hasMore: false };
      }
    } catch (e) {
      console.error('fetchUsers error:', e);
    }
  }
  return { users: [], hasMore: false };
};

export const getUserById = async (userId: string) => {
  try {
    const { apiFetch } = await import('./client');
    const res = await apiFetch(`/admin/users/${encodeURIComponent(userId)}`, {}, 'required');
    if (res.ok) {
      const data = await res.json();
      return { success: true, user: data.user };
    }
    return { success: false, error: 'User not found' };
  } catch (e: any) {
    console.error('getUserById error:', e);
    return { success: false, error: e.message || 'User not found' };
  }
};

export const clearUsersCache = () => {};
export const hasActiveFilters = (filters?: { searchTerm?: string }) =>
  !!filters?.searchTerm?.trim();

let cachedRawPayments: any[] | null = null;
let paymentsCacheTimestamp = 0;
const PAYMENTS_CACHE_TTL_MS = 45 * 1000; // 45 seconds

export const clearTransactionsCache = () => {
  cachedRawPayments = null;
  paymentsCacheTimestamp = 0;
};

export const fetchTransactions = async (filters?: any, loadMore?: boolean) => {
  const now = Date.now();
  let rawItems: any[] = [];

  if (cachedRawPayments && now - paymentsCacheTimestamp < PAYMENTS_CACHE_TTL_MS && !loadMore) {
    rawItems = cachedRawPayments;
  } else {
    const response = await apiFetch("/admin/payments", {}, "required");
    if (!response.ok) {
      throw new Error(await readError(response, "Failed to load transactions"));
    }
    const data = await response.json();
    rawItems = data.items || [];
    cachedRawPayments = rawItems;
    paymentsCacheTimestamp = now;
  }

  let items = [...rawItems];

  if (filters) {
    if (filters.statusFilter && filters.statusFilter !== 'all') {
      items = items.filter((p: any) => p.status === filters.statusFilter);
    }
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      items = items.filter((p: any) => 
        (p.merchantOrderId || '').toLowerCase().includes(term) ||
        (p.userId || '').toLowerCase().includes(term) ||
        (p.easebuzzTxnId || '').toLowerCase().includes(term)
      );
    }
    if (filters.paymentTypeFilter && filters.paymentTypeFilter !== 'all') {
      items = items.filter((p: any) => {
        const type = p.paymentType || (p.processedIntentions?.eventRegistration ? 'event' : 'other');
        return type === filters.paymentTypeFilter;
      });
    }
  }

  return {
    transactions: items,
    hasMore: false,
  };
};

export const updatePaymentStatus = async (merchantOrderId: string, status: string, remarks?: string) => {
  const response = await apiFetch(`/admin/payments/${merchantOrderId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, remarks })
  }, "required");
  
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to update payment status"));
  }
  clearTransactionsCache();
  return response.json();
};


export const getOrderByQR = async (_data: string): Promise<{ success: boolean; order?: any; error?: string }> => ({
  success: false,
  error: 'Store orders are not available yet',
});
export const updateOrderStatus = async (_id: string, _status: string) => ({ success: false, error: 'Not available' });
export const getAllOrders = async () => [] as any[];
export type UserOrder = any;

export interface UserRegistrationData {
  registrationId: string;
  userId: string;
  eventId: string;
  eventName: string;
  name?: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  status: string;
  checkingStatus: string;
  paymentStatus?: string;
  teamId?: string;
}

export interface UserGateData {
  userId: string;
  displayName: string;
  name?: string;
  email: string;
  phoneNumber?: string;
  collegeName: string;
  isHostCollegeStudent: boolean;
  accommodationNeeded: boolean;
  accommodation?: Record<string, boolean>;
  food?: Record<string, boolean>;
  checkInStatus: {
    fest: boolean;
    remark?: string | null;
    accommodation: boolean;
    Hostel?: string | null;
  };
  userEvents?: {
    eventId: string;
    eventName: string;
    status: string;
    checkingStatus?: string;
  }[];
}

export const handleQRScan = async (
  data: string,
  category: string
): Promise<{ success: boolean; data?: any; error?: string; message?: string }> => {
  try {
    const res = await apiFetch('/admin/qr/scan', {
      method: 'POST',
      body: JSON.stringify({ data, category }),
    }, 'required');

    if (!res.ok) {
      const err = await readError(res, 'Scan processing failed');
      return { success: false, error: err, message: err };
    }
    const json = await res.json();
    return { success: true, data: json.data };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Scan failed',
      message: error.message || 'Scan failed',
    };
  }
};

export const updateUserCheckingStatus = async (
  registrationId: string,
  status: string
): Promise<{ success: boolean; error?: string; message?: string }> => {
  try {
    const res = await apiFetch('/admin/qr/event-checkin', {
      method: 'POST',
      body: JSON.stringify({ registrationId, status }),
    }, 'required');

    if (!res.ok) {
      const err = await readError(res, 'Failed to update check-in status');
      return { success: false, error: err, message: err };
    }
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to update check-in status',
      message: error.message || 'Failed to update check-in status',
    };
  }
};

export const updateGateFestStatus = async (
  userId: string,
  fest: boolean,
  remark?: string
): Promise<{ success: boolean; error?: string; message?: string; data?: any }> => {
  try {
    const res = await apiFetch(`/admin/qr/gate/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fest, remark }),
    }, 'required');

    if (!res.ok) {
      const err = await readError(res, 'Failed to update fest entry status');
      return { success: false, error: err, message: err };
    }
    const json = await res.json();
    return { success: true, data: json.data };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to update fest entry status',
      message: error.message || 'Failed to update fest entry status',
    };
  }
};

export const updateHostelStatus = async (
  userId: string,
  accommodation: boolean,
  hostel?: string
): Promise<{ success: boolean; error?: string; message?: string; data?: any }> => {
  try {
    const res = await apiFetch(`/admin/qr/hostel/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ accommodation, hostel }),
    }, 'required');

    if (!res.ok) {
      const err = await readError(res, 'Failed to update accommodation status');
      return { success: false, error: err, message: err };
    }
    const json = await res.json();
    return { success: true, data: json.data };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to update accommodation status',
      message: error.message || 'Failed to update accommodation status',
    };
  }
};

export const getUserRegisteredEvents = async (
  userId: string
): Promise<{ eventId: string; eventName: string; status: string; checkingStatus?: string }[]> => {
  try {
    const res = await apiFetch(`/admin/users/${userId}/events`, {
      method: 'GET',
    }, 'required');

    if (!res.ok) return [];
    const json = await res.json();
    return json.events || [];
  } catch {
    return [];
  }
};

export const getCurrentEventDay = () => 'day1';
export const updateUserMealStatus = async (
  _userId?: string,
  _day?: string,
  _mealIndex?: number
): Promise<{ success: boolean; error?: string; message?: string }> => {
  return { success: true };
};
export const checkMealAvailability = async (
  _userId?: string,
  _day?: string,
  _mealIndex?: number
): Promise<{ available: boolean; message: string }> => {
  return { available: true, message: 'Meal available' };
};

