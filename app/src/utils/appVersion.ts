// src/utils/appVersion.ts
import Constants from 'expo-constants';

/**
 * Get the current app version from app.json
 * This reads from the expo config at runtime
 */
export function getAppVersion(): string {
  try {
    // expo-constants reads from app.json/app.config.js
    const version = Constants.expoConfig?.version || '1.0.3';
    return version;
  } catch (error) {
    console.error('[AppVersion] Error getting app version:', error);
    return '1.0.0'; // Fallback version
  }
}

/**
 * Get detailed version information for debugging
 */
export function getVersionInfo() {
  return {
    appVersion: getAppVersion(),
    nativeAppVersion: Constants.nativeAppVersion,
    nativeBuildVersion: Constants.nativeBuildVersion,
    expoVersion: Constants.expoVersion,
  };
}
