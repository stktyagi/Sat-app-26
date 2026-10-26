import { apiFetch, readError } from './client';

export interface AppLinks {
  appleStore: string;
  playStore: string;
}

export interface AppMaintenance {
  android: boolean;
  ios: boolean;
  web: boolean;
}

export interface AppVersions {
  android: string;
  ios: string;
}

export interface AppAccommodation {
  amount: number;
  price?: number;
  technicalAmount?: number;
  culturalAmount?: number;
  foodAmount?: number;
  technicalFoodAmount?: number;
  culturalFoodAmount?: number;
}

export interface AppConfigResponse {
  links: AppLinks;
  maintenance: AppMaintenance;
  versions: AppVersions;
  accommodation?: AppAccommodation;
}

/**
 * Fetch full app configuration (links, maintenance, versions, accommodation) in one call.
 */
export async function getAppConfig(): Promise<AppConfigResponse> {
  const res = await apiFetch('/app/status', { method: 'GET' }, 'none');
  if (!res.ok) {
    const msg = await readError(res, 'Failed to fetch app status');
    throw new Error(msg);
  }
  return res.json();
}

/**
 * Fetch app store & play store links.
 */
export async function getAppLinks(): Promise<AppLinks> {
  const res = await apiFetch('/app/links', { method: 'GET' }, 'none');
  if (!res.ok) {
    const msg = await readError(res, 'Failed to fetch app links');
    throw new Error(msg);
  }
  return res.json();
}

/**
 * Fetch platform maintenance status.
 */
export async function getAppMaintenance(): Promise<AppMaintenance> {
  const res = await apiFetch('/app/maintenance', { method: 'GET' }, 'none');
  if (!res.ok) {
    const msg = await readError(res, 'Failed to fetch maintenance status');
    throw new Error(msg);
  }
  return res.json();
}

/**
 * Fetch platform required versions.
 */
export async function getAppVersions(): Promise<AppVersions> {
  const res = await apiFetch('/app/versions', { method: 'GET' }, 'none');
  if (!res.ok) {
    const msg = await readError(res, 'Failed to fetch app versions');
    throw new Error(msg);
  }
  return res.json();
}

/**
 * Fetch dynamic accommodation & food pass pricing.
 */
export async function getAppAccommodation(): Promise<AppAccommodation> {
  const res = await apiFetch('/app/accommodation', { method: 'GET' }, 'none');
  if (!res.ok) {
    const msg = await readError(res, 'Failed to fetch accommodation pricing');
    throw new Error(msg);
  }
  return res.json();
}

/**
 * Admin: Update app store links.
 */
export async function adminUpdateAppLinks(links: AppLinks): Promise<AppLinks> {
  const res = await apiFetch(
    '/admin/app/links',
    {
      method: 'PATCH',
      body: JSON.stringify(links),
    },
    'required'
  );
  if (!res.ok) {
    const msg = await readError(res, 'Failed to update app links');
    throw new Error(msg);
  }
  const data = await res.json();
  return data.links;
}

/**
 * Admin: Update maintenance flags.
 */
export async function adminUpdateAppMaintenance(maintenance: AppMaintenance): Promise<AppMaintenance> {
  const res = await apiFetch(
    '/admin/app/maintenance',
    {
      method: 'PATCH',
      body: JSON.stringify(maintenance),
    },
    'required'
  );
  if (!res.ok) {
    const msg = await readError(res, 'Failed to update maintenance status');
    throw new Error(msg);
  }
  const data = await res.json();
  return data.maintenance;
}

/**
 * Admin: Update version constraints.
 */
export async function adminUpdateAppVersions(versions: AppVersions): Promise<AppVersions> {
  const res = await apiFetch(
    '/admin/app/versions',
    {
      method: 'PATCH',
      body: JSON.stringify(versions),
    },
    'required'
  );
  if (!res.ok) {
    const msg = await readError(res, 'Failed to update app versions');
    throw new Error(msg);
  }
  const data = await res.json();
  return data.versions;
}

/**
 * Admin: Update accommodation pricing.
 */
export async function adminUpdateAppAccommodation(acc: AppAccommodation): Promise<AppAccommodation> {
  const res = await apiFetch(
    '/admin/app/accommodation',
    {
      method: 'PATCH',
      body: JSON.stringify(acc),
    },
    'required'
  );
  if (!res.ok) {
    const msg = await readError(res, 'Failed to update accommodation pricing');
    throw new Error(msg);
  }
  const data = await res.json();
  return data.accommodation;
}

/**
 * Admin: Fetch full app configuration (links, maintenance, versions, accommodation) with auth.
 */
export async function adminGetAppConfig(): Promise<AppConfigResponse> {
  const res = await apiFetch('/admin/app', { method: 'GET' }, 'required');
  if (!res.ok) {
    const msg = await readError(res, 'Failed to fetch admin app config');
    throw new Error(msg);
  }
  return res.json();
}
