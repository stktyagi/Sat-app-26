// src/components/system/ConnectivityWrapper.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  AppState,
  AppStateStatus,
  View,
} from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import NoInternetScreen from '../../screens/System/NoInternetScreen';
import UpdateRequiredScreen from '../../screens/System/UpdateRequiredScreen';
import MaintenanceScreen from '../../screens/System/MaintenanceScreen';
import { checkAppStatus, VersionInfo, MaintenanceInfo } from '@/utils/versionCheck';

interface ConnectivityWrapperProps {
  children: React.ReactNode;
  currentVersion: string;
  enableVersionCheck?: boolean;
  enableMaintenanceCheck?: boolean;
}

export default function ConnectivityWrapper({
  children,
  currentVersion,
  enableVersionCheck = true,
  enableMaintenanceCheck = true,
}: ConnectivityWrapperProps) {
  // 1. ALL HOOKS CALLED AT TOP LEVEL BEFORE ANY RETURN
  const networkStatus = useNetworkStatus();

  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [maintenanceInfo, setMaintenanceInfo] = useState<MaintenanceInfo | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<number>(Date.now());

  const checkStatus = useCallback(async () => {
    try {
      // Timeout guard of 3.5 seconds so app never hangs indefinitely on boot
      const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
        setTimeout(() => resolve({ timeout: true }), 3500)
      );
      const statusPromise = checkAppStatus(currentVersion);

      const result = await Promise.race([statusPromise, timeoutPromise]);

      if ('timeout' in result) {
        console.warn('[ConnectivityWrapper] Status check timed out after 3.5s');
      } else {
        if (enableVersionCheck) {
          setVersionInfo(result.versionInfo);
        }
        if (enableMaintenanceCheck) {
          setMaintenanceInfo(result.maintenanceInfo);
        }
        setLastCheckTime(Date.now());
      }
    } catch (error) {
      console.error('[ConnectivityWrapper] Status check failed:', error);
    }
  }, [currentVersion, enableVersionCheck, enableMaintenanceCheck]);

  // Initial check on mount + periodic check every 30 minutes
  useEffect(() => {
    if (enableVersionCheck || enableMaintenanceCheck) {
      checkStatus();

      const intervalId = setInterval(() => {
        console.log('[ConnectivityWrapper] Running periodic app status check (30 min)');
        checkStatus();
      }, 30 * 60 * 1000);

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [checkStatus, enableVersionCheck, enableMaintenanceCheck]);

  // Check when app comes to foreground (if 5+ minutes since last check)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const timeSinceLastCheck = Date.now() - lastCheckTime;
        const fiveMinutes = 5 * 60 * 1000;

        if (timeSinceLastCheck > fiveMinutes) {
          console.log('[ConnectivityWrapper] App foregrounded, re-checking status');
          checkStatus();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [checkStatus, lastCheckTime]);

  const handleRetryConnection = async () => {
    try {
      const state = await networkStatus.refresh();
      console.log('[ConnectivityWrapper] Network state refreshed:', state);
      if (state.isConnected && state.isInternetReachable !== false) {
        await checkStatus();
      }
    } catch (error) {
      console.error('[ConnectivityWrapper] Failed to refresh network state:', error);
    }
  };

  const handleRetryStatus = async () => {
    await checkStatus();
  };

  const isOffline =
    networkStatus.isOffline ||
    networkStatus.isConnected === false ||
    networkStatus.isInternetReachable === false;


  // 2. CONDITIONAL RENDERING (NO HOOKS BELOW THIS POINT)

  // Priority 1: Show maintenance screen (blocking)
  if (enableMaintenanceCheck && maintenanceInfo?.isUnderMaintenance) {
    return <MaintenanceScreen onRetry={handleRetryStatus} />;
  }

  // Priority 2: Show update required screen (blocking)
  if (enableVersionCheck && versionInfo?.updateRequired) {
    return (
      <UpdateRequiredScreen
        currentVersion={currentVersion}
        requiredVersion={versionInfo.requiredVersion}
        updateUrl={versionInfo.updateUrl}
        isOptional={false}
      />
    );
  }

  // Priority 3: Show normal app with offline overlay if disconnected
  return (
    <View style={{ flex: 1 }}>
      {children}
      {isOffline && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            elevation: 99999,
          }}
        >
          <NoInternetScreen onRetry={handleRetryConnection} />
        </View>
      )}
    </View>
  );
}
