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
  const res = await apiFetch('/events?limit=200', {}, 'required');
  if (!res.ok) throw new Error(await readError(res, 'Failed to load events'));
  const data = await res.json();
  return (data.items ?? []).map((e: any) => ({
    id: e.id ?? e.eventId,
    eventId: e.eventId ?? e.id,
    title: e.title ?? '',
    category: e.category ?? '',
    startDateTime: e.startDateTime ?? e.dateTime ?? '',
    endDateTime: e.endDateTime ?? '',
    isPublic: e.isPublic !== false,
    isFeatured: !!e.isFeatured,
    venueId: e.venueId,
    venueName: e.venueName,
    registeredCount: e.registeredCount,
    maxParticipants: e.maxParticipants,
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

export async function fetchAccommodationStats(): Promise<AccommodationStats> {
  return { total: 0, checkedIn: 0, pending: 0 };
}

export async function fetchIncomingUsers(): Promise<UserAccommodation[]> {
  return [];
}

export async function fetchOutgoingUsers(): Promise<UserAccommodation[]> {
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
  return [];
}

export async function createVenue(_data: Partial<AdminVenue>): Promise<void> {
  console.log('[mock] createVenue');
}

export async function updateVenue(_id: string, _data: Partial<AdminVenue>): Promise<void> {
  console.log('[mock] updateVenue');
}

export async function deleteVenue(_id: string): Promise<void> {
  console.log('[mock] deleteVenue');
}

// ─── FAQs (mock) ──────────────────────────────────────────────────────────────

export interface FAQ { id: string; question: string; answer: string; order: number; }

export async function listFAQs(): Promise<FAQ[]> {
  return [];
}

export async function createFAQ(_data: Partial<FAQ>): Promise<void> {
  console.log('[mock] createFAQ');
}

export async function updateFAQ(_id: string, _data: Partial<FAQ>): Promise<void> {
  console.log('[mock] updateFAQ');
}

export async function deleteFAQ(_id: string): Promise<void> {
  console.log('[mock] deleteFAQ');
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

export const getAllEventsForAdmin = adminListEvents;
export const getEventByIdForAdmin = async (id: string) => {
  const events = await adminListEvents();
  return events.find(e => e.eventId === id || e.id === id) ?? null;
};

export const getFAQs = listFAQs;
export const addFAQWithId = createFAQ;

export const getRewards = async () => [] as any[];
export const getStoreItems = async () => [] as any[];
export type StoreItem = { id: string; name: string; price: number; isActive: boolean; category: string };

export const getRegistrationTransaction = async (_regId: string) => null;

export const createUpdate = async (_data: any) => { console.log('[mock] createUpdate'); };
export const getUpdates = async () => [] as any[];
export const deleteUpdate = async (_id: string) => { console.log('[mock] deleteUpdate'); };

export const uploadStoryMedia = async (_data: any) => { console.log('[mock] uploadStoryMedia'); };

export interface UserEventRegistration {
  userId: string;
  eventId: string;
  registeredAt: string;
}

// QR scanner helpers — screens use these shapes
export const handleQRScan = async (_data: string, _role: string) => null;
export const updateUserCheckingStatus = async (_userId: string, _field: string, _value: any) => { console.log('[mock] updateUserCheckingStatus'); };
export type UserRegistrationData = any;
export type UserGateData = any;
