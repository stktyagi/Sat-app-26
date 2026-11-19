// src/utils/appVersion.ts
import Constants from 'expo-constants';
import * as Application from 'expo-application';

/**
 * Get the version the installed binary actually reports
 * (iOS CFBundleShortVersionString / Android versionName).
 *
 * Don't use Constants.expoConfig.version: that's the top-level app.json
 * "version" (the Android one), not ios.version, so iOS compared the wrong
 * number against the server minimum and got stuck on the update screen.
 */
export function getAppVersion(): string {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';
}

/**
 * Get detailed version information for debugging
 */
export function getVersionInfo() {
  return {
    appVersion: getAppVersion(),
    nativeAppVersion: Application.nativeApplicationVersion,
    nativeBuildVersion: Application.nativeBuildVersion,
    expoVersion: Constants.expoVersion,
  };
}
