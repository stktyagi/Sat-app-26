import { UserProfile, FirebaseEvent } from '@/types/models';

export const ROLE_ADMIN = 'admin';
export const ROLE_EB_EVENTS = 'eb_events';
export const ROLE_EB_OUTREACH = 'eb_outreach';
export const ROLE_EB_FINANCE = 'eb_finance';
export const ROLE_EB_MEDIA = 'eb_media';
export const ROLE_EB_HOSPITALITY = 'eb_hospitality';
export const ROLE_EC_HOSPITALITY = 'ec_hospitality';
export const ROLE_EVENT_POC = 'event_poc';
export const ROLE_USER = 'user';

export const ADMIN_ROLES = [
  ROLE_ADMIN,
  ROLE_EB_EVENTS,
  ROLE_EB_OUTREACH,
  ROLE_EB_FINANCE,
  ROLE_EB_MEDIA,
  ROLE_EB_HOSPITALITY,
  ROLE_EC_HOSPITALITY,
  ROLE_EVENT_POC,
] as const;

/**
 * Normalizes role names and handles aliases/typos gracefully.
 */
export function normalizeRole(role: string): string {
  const lower = (role || '').trim().toLowerCase();
  switch (lower) {
    case 'admin':
    case 'super_admin':
    case 'superadmin':
    case 'dev':
      return ROLE_ADMIN;
    case 'eb_events':
    case 'event_admin':
      return ROLE_EB_EVENTS;
    case 'eb_outreach':
    case 'eb_oureach':
    case 'outreach_admin':
    case 'outreach_member':
      return ROLE_EB_OUTREACH;
    case 'eb_finance':
    case 'finance':
      return ROLE_EB_FINANCE;
    case 'eb_media':
    case 'media':
      return ROLE_EB_MEDIA;
    case 'eb_hospitality':
    case 'hospitality_admin':
      return ROLE_EB_HOSPITALITY;
    case 'ec_hospitality':
    case 'hospitality_member':
      return ROLE_EC_HOSPITALITY;
    case 'event_poc':
    case 'coordinator':
    case 'event_coordinator':
      return ROLE_EVENT_POC;
    case 'user':
      return ROLE_USER;
    default:
      return lower;
  }
}

/**
 * Extracts and normalizes all roles from user profile (both .roles array and .role string).
 */
export function getUserRoles(user: UserProfile | null | undefined): string[] {
  if (!user) return [];
  const set = new Set<string>();

  if (Array.isArray(user.roles)) {
    user.roles.forEach((r) => {
      if (typeof r === 'string' && r.trim()) {
        set.add(normalizeRole(r));
      }
    });
  }

  if (typeof user.role === 'string' && user.role.trim()) {
    set.add(normalizeRole(user.role));
  }

  return Array.from(set);
}

/**
 * Checks if user is a full Administrator.
 */
export function isFullAdmin(user: UserProfile | null | undefined): boolean {
  const roles = getUserRoles(user);
  return roles.includes(ROLE_ADMIN);
}

/**
 * Checks if user has any administrative or elevated management role.
 */
export function isUserAdmin(user: UserProfile | null | undefined): boolean {
  const roles = getUserRoles(user);
  return roles.some((r) => r !== ROLE_USER);
}

/**
 * Checks if user has any of the allowed roles.
 */
export function hasAnyRole(
  user: UserProfile | null | undefined,
  allowedRoles: string[]
): boolean {
  const roles = getUserRoles(user);
  if (roles.includes(ROLE_ADMIN)) return true;

  const normalizedAllowed = allowedRoles.map((r) => normalizeRole(r));
  return roles.some((r) => normalizedAllowed.includes(r));
}

/**
 * Checks if a user is an assigned coordinator for a specific event.
 */
export function isEventCoordinator(
  user: UserProfile | null | undefined,
  event: FirebaseEvent | null | undefined
): boolean {
  if (!user || !event) return false;

  const userEmail = (user.email || '').toLowerCase().trim();
  const userId = user.userId;

  const isCoordinator = event.coordinators?.some((c: any) => {
    const cEmail = (c.email || '').toLowerCase().trim();
    const cId = c.userID || c.userId || '';
    return (
      (userEmail && cEmail && cEmail === userEmail) ||
      (userId && cId && cId === userId)
    );
  });

  return Boolean(isCoordinator);
}

/**
 * Checks if user has permission to edit a specific event.
 * True if:
 * 1. User has admin or eb_events role.
 * 2. User is an assigned coordinator of this event and has event_poc role.
 */
export function canUserEditEvent(
  user: UserProfile | null | undefined,
  event: FirebaseEvent | null | undefined
): boolean {
  if (!user || !event) return false;

  const roles = getUserRoles(user);
  if (roles.some((r) => [ROLE_ADMIN, ROLE_EB_EVENTS].includes(r))) {
    return true;
  }

  if (roles.includes(ROLE_EVENT_POC)) {
    return isEventCoordinator(user, event);
  }

  return false;
}
