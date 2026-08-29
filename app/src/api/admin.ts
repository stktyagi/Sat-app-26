/**
 * src/api/admin.ts
 *
 * Unified admin API layer.
 * - Real endpoints: events, registrations (backed by Go backend)
 * - Everything else: mock data until the backend adds those routes
 */

import { apiFetch, readError } from './client';
import { API_BASE_URL } from '@/config/api';

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
  collegeName?: string;
  accommodationNeeded: boolean;
  checkInStatus?: Record<string, boolean>;
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
  // TODO: replace with real endpoint
  console.log('[mock] updateUserRole', userId, role);
}

// ─── Accommodation (mock) ─────────────────────────────────────────────────────

export async function fetchAccommodationStats(_forceRefresh?: boolean): Promise<any> {
  return [];
}

export async function fetchIncomingUsers(..._args: any[]): Promise<UserAccommodation[]> {
  return [];
}

export async function fetchOutgoingUsers(..._args: any[]): Promise<UserAccommodation[]> {
  return [];
}

export async function updateAccommodationCheckIn(
  _userId: string,
  _day: string,
  _status: boolean,
): Promise<void> {
  console.log('[mock] updateAccommodationCheckIn');
}

export async function clearAccommodationCache(): Promise<void> {
  console.log('[mock] clearAccommodationCache');
}

// ─── Venues (mock) ────────────────────────────────────────────────────────────

export async function listVenues(): Promise<AdminVenue[]> {
  return [
    { id: 'main-auditorium', name: 'Main Auditorium', location: 'Campus' },
    { id: 'cos-complex', name: 'COS Complex', location: 'Campus' },
  ];
}

export async function createVenue(_data: Partial<AdminVenue>): Promise<void> {
  console.log('[mock] createVenue');
}

export async function updateVenue(_id: string, _data: Partial<AdminVenue>): Promise<boolean> {
  console.log('[mock] updateVenue');
  return true;
}

export async function deleteVenue(_id: string): Promise<boolean> {
  console.log('[mock] deleteVenue');
  return true;
}

// ─── FAQs (mock) ──────────────────────────────────────────────────────────────

export interface FAQ { id: string; question: string; answer: string; order: number; }

export async function listFAQs(): Promise<FAQ[]> {
  return [];
}

export async function createFAQ(_data: Partial<FAQ>): Promise<void> {
  console.log('[mock] createFAQ');
}

export async function updateFAQ(_id: string, _data: Partial<FAQ>): Promise<boolean> {
  console.log('[mock] updateFAQ');
  return true;
}

export async function deleteFAQ(_id: string): Promise<boolean> {
  console.log('[mock] deleteFAQ');
  return true;
}

// ─── Banners (mock) ───────────────────────────────────────────────────────────

export async function listBanners(): Promise<AdminBanner[]> {
  return [];
}

export async function createBanner(_data: Partial<AdminBanner>): Promise<void> {
  console.log('[mock] createBanner');
}

export async function updateBanner(_id: string, _data: Partial<AdminBanner>): Promise<void> {
  console.log('[mock] updateBanner');
}

export async function deleteBanner(_id: string): Promise<void> {
  console.log('[mock] deleteBanner');
}

// ─── Polls (mock) ─────────────────────────────────────────────────────────────

export interface Poll { id: string; question: string; options: string[]; isActive: boolean; }

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

export const searchUsers = async (_term: string) => [] as any[];
export const searchVenues = async (term: string) => {
  const venues = await listVenues();
  const q = term.toLowerCase();
  return venues.filter((v) => v.name.toLowerCase().includes(q) || (v.id || '').toLowerCase().includes(q));
};
export const uploadFile = async (_uri: string) => ({ success: false, error: 'Upload is not available yet' });

export interface UserEventRegistration {
  userId: string;
  eventId: string;
  registeredAt: string;
  status?: string;
  teamId?: string;
  user: {
    email: string;
    name?: string;
    displayName?: string;
    phoneNumber?: string;
    collegeName?: string;
  };
}

const mapReg = (r: any): UserEventRegistration => ({
  userId: r.userId,
  eventId: r.eventId,
  registeredAt: r.registeredAt,
  status: r.status,
  teamId: r.teamId,
  user: {
    email: r.user?.email ?? r.email ?? '',
    name: r.user?.name ?? r.user?.displayName ?? r.displayName,
    displayName: r.user?.displayName ?? r.displayName,
    phoneNumber: r.user?.phoneNumber ?? '',
    collegeName: r.user?.collegeName ?? '',
  },
});

export const getEventRegistrations = async (eventId: string) =>
  (await adminListRegistrations(eventId)).map(mapReg);

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
  return Array.from(groups.entries()).map(([teamId, members]) => ({
    teamId,
    teamName: teamId.startsWith('solo-') ? members[0]?.user?.name || 'Team' : `Team ${teamId.slice(0, 6)}`,
    leaderId: members[0]?.userId ?? '',
    memberCount: members.length,
    maxSize: members.length,
    status: (members[0]?.status as TeamSummary['status']) || 'confirmed',
    createdAt: members[0]?.registeredAt ?? '',
    inviteCode: '',
    firstMemberCollegeName: members[0]?.user?.collegeName,
  }));
};

export const getTeamMembers = async (eventId: string, teamId: string) => {
  const regs = await getEventRegistrations(eventId);
  return regs.filter((r) => r.teamId === teamId);
};

export const getAllTeamRegistrationsWithMembers = async (eventId: string) => {
  const teams = await getEventTeamSummaries(eventId);
  return Promise.all(
    teams.map(async (team) => ({
      ...team,
      members: await getTeamMembers(eventId, team.teamId),
    })),
  );
};

export const updateTeamRegistrationStatus = async (
  _eventId: string,
  _teamId: string,
  _status: string,
) => {
  console.log('[mock] updateTeamRegistrationStatus');
  return { success: true };
};

export const getRegistrationTransaction = async (..._args: any[]) => null;

const MOCK_FAQ_ITEMS = [
  { faqId: 'faq-1', question: 'When is Saturnalia?', answer: 'Dates will be announced on the home screen.', order: 1, isPublic: true, createdAt: new Date().toISOString() },
  { faqId: 'faq-2', question: 'How do I register for events?', answer: 'Open an event and tap Register.', order: 2, isPublic: true, createdAt: new Date().toISOString() },
];

export const getFAQs = async () => MOCK_FAQ_ITEMS;
export const addFAQWithId = async (_id: string, _data: any) => {
  console.log('[mock] addFAQWithId');
  return true;
};

const MOCK_VENUE_ITEMS = [
  { venueId: 'main-auditorium', venueName: 'Main Auditorium', lat: 30.356, lng: 76.364 },
  { venueId: 'cos-complex', venueName: 'COS Complex', lat: 30.354, lng: 76.362 },
];

export const getVenues = async () => MOCK_VENUE_ITEMS;
export const addVenueWithId = async (_id: string, _data: any) => {
  console.log('[mock] addVenueWithId');
  return true;
};

export const getRewards = async () => [] as any[];
export const getStoreItems = async (_includeInactive?: boolean) => [] as any[];
export type StoreItem = { id: string; name: string; price: number; isActive: boolean; category: string };

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

export const getCorousal = async () => [] as any[];
export const createCorousal = async (_data: any) => { console.log('[mock] createCorousal'); };
export const deleteCorousal = async (_id: string) => { console.log('[mock] deleteCorousal'); return true; };

export const uploadStoryMedia = async (uri: string, _type?: string) => ({
  success: true,
  url: uri,
});

export const fetchUsers = async (_filters?: any, _loadMore?: boolean) => ({
  users: MOCK_USERS.map((u) => ({
    ...u,
    phoneNumber: '',
    isAmbassador: false,
    isVerified: true,
    createdAt: new Date().toISOString(),
    accommodationNeeded: false,
  })),
  hasMore: false,
});

export const getUserById = async (userId: string) => {
  const users = (await fetchUsers()).users;
  const user = users.find((u) => u.userId === userId);
  return user ? { success: true, user } : { success: false, error: 'User not found' };
};

export const clearUsersCache = () => {};
export const hasActiveFilters = (filters?: { searchTerm?: string }) =>
  !!filters?.searchTerm?.trim();

export const fetchTransactions = async (_filters?: any, _loadMore?: boolean) => ({
  transactions: [] as any[],
  hasMore: false,
});
export const clearTransactionsCache = () => {};

export const getOrderByQR = async (_data: string) => ({ success: false, error: 'Store orders are not available yet' });
export const updateOrderStatus = async (_id: string, _status: string) => ({ success: false, error: 'Not available' });
export const getAllOrders = async () => [] as any[];
export type UserOrder = any;

export const handleQRScan = async (_data: string, _role: string) => null;
export const updateUserCheckingStatus = async (_userId: string, _field: string, _value: any) => {
  console.log('[mock] updateUserCheckingStatus');
};
export type UserRegistrationData = any;
export type UserGateData = any;

export const getCurrentEventDay = () => 'day1';
export const updateUserMealStatus = async (_userId: string, _mealKey: string, _value: boolean) => {
  console.log('[mock] updateUserMealStatus');
};
export const checkMealAvailability = async (_mealKey: string) => true;
