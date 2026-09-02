// src/utils/versionCheck.ts
import { Platform } from 'react-native';

export interface VersionInfo {
  currentVersion: string;
  requiredVersion: string;
  updateRequired: boolean;
  updateUrl?: string;
}

export interface MaintenanceInfo {
  isUnderMaintenance: boolean;
  platform: 'ios' | 'android';
}

export interface AppLinks {
  appleStore: string;
  playStore: string;
}

/**
 * Compares two version strings (semantic versioning)
 * Returns:
 *  1 if v1 > v2
 *  0 if v1 === v2
 * -1 if v1 < v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

/**
 * Checks if the current app version meets the minimum required version
 * @param currentVersion - The current app version (from package.json or app.json)
 * @param minRequiredVersion - The minimum required version from Firebase
 * @returns true if update is required, false otherwise
 */
export function isUpdateRequired(
  currentVersion: string,
  minRequiredVersion: string
): boolean {
  return compareVersions(currentVersion, minRequiredVersion) < 0;
}

/**
 * Fetches app store links from Firebase
 * Collection: app, Document: link
 */
export async function fetchAppLinks(): Promise<AppLinks> {
  try {
    /* Removed Firebase API call */
    /* Removed Firebase API call */
    /* Removed Firebase API call */

    if (linkDoc.exists()) {
      const data = linkDoc.data();
      return {
        appleStore: data?.appleStore || 'https://apps.apple.com',
        playStore: data?.playStore || 'https://play.google.com',
      };
    }

    // Return defaults if document doesn't exist
    return {
      appleStore: 'https://apps.apple.com',
      playStore: 'https://play.google.com',
    };
  } catch (error) {
    console.error('Error fetching app links:', error);
    return {
      appleStore: 'https://apps.apple.com',
      playStore: 'https://play.google.com',
    };
  }
}

export async function getDeleteFlag(): Promise<boolean> {
  try {
    /* Removed Firebase API call */
    /* Removed Firebase API call */
    /* Removed Firebase API call */

    if (deleteFlag.exists()) {
      const data = deleteFlag.data();
      return data?.isDelete || false;
    }

    return false;
  } catch (error) {
    console.error('Error fetching delete flag:', error);
    return false;
  }
}

/**
 * Checks if the app is under maintenance
 * Collection: app, Document: maintenance
 */
export async function checkMaintenance(): Promise<MaintenanceInfo> {
  try {
    /* Removed Firebase API call */
    /* Removed Firebase API call */
    /* Removed Firebase API call */

    if (maintenanceDoc.exists()) {
      const data = maintenanceDoc.data();
      const platform = Platform.OS as 'ios' | 'android';
      const isUnderMaintenance = data?.[platform] || false;



      return {
        isUnderMaintenance,
        platform,
      };
    }

    return {
      isUnderMaintenance: false,
      platform: Platform.OS as 'ios' | 'android',
    };
  } catch (error) {
    console.error('[Maintenance Check] Error checking maintenance status:', error);
    return {
      isUnderMaintenance: false,
      platform: Platform.OS as 'ios' | 'android',
    };
  }
}

/**
 * Fetches required version info from Firebase
 * Collection: app, Document: versions
 */
export async function fetchVersionInfo(
  currentVersion: string
): Promise<VersionInfo> {
  try {

    /* Removed Firebase API call */
    /* Removed Firebase API call */

    // Fetch version requirements
    /* Removed Firebase API call */

    if (!versionsDoc.exists()) {
      return {
        currentVersion,
        requiredVersion: '1.0.0',
        updateRequired: false,
      };
    }

    const versionData = versionsDoc.data();
    const platform = Platform.OS as 'ios' | 'android';
    const requiredVersion = versionData?.[platform] || '1.0.0';

    // Fetch app links for update URL
    const appLinks = await fetchAppLinks();
    const updateUrl = platform === 'ios' ? appLinks.appleStore : appLinks.playStore;

    const updateRequired = isUpdateRequired(currentVersion, requiredVersion);



    return {
      currentVersion,
      requiredVersion,
      updateRequired,
      updateUrl,
    };
  } catch (error) {
    console.error('[Version Check] Version check failed:', error);

    // Return safe defaults if Firebase call fails
    return {
      currentVersion,
      requiredVersion: '1.0.0',
      updateRequired: false,
    };
  }
}

/**
 * Comprehensive app status check
 * Checks both maintenance status and version requirements
 */
export async function checkAppStatus(currentVersion: string): Promise<{
  versionInfo: VersionInfo;
  maintenanceInfo: MaintenanceInfo;
  appLinks: AppLinks;
}> {
  try {
  

    // Run all checks in parallel for better performance
    const [versionInfo, maintenanceInfo, appLinks] = await Promise.all([
      fetchVersionInfo(currentVersion),
      checkMaintenance(),
      fetchAppLinks(),
    ]);

  

    return {
      versionInfo,
      maintenanceInfo,
      appLinks,
    };
  } catch (error) {
    console.error('[App Status Check] FAILED:', error);

    // Return safe defaults
    return {
      versionInfo: {
        currentVersion,
        requiredVersion: '1.0.0',
        updateRequired: false,
      },
      maintenanceInfo: {
        isUnderMaintenance: false,
        platform: Platform.OS as 'ios' | 'android',
      },
      appLinks: {
        appleStore: 'https://apps.apple.com',
        playStore: 'https://play.google.com',
      },
    };
  }
}
