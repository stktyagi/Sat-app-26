// src/components/system/ConnectivityWrapper.tsx
import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, View, DeviceEventEmitter } from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import NoInternetScreen from '../../screens/System/NoInternetScreen';
import UpdateRequiredScreen from '../../screens/System/UpdateRequiredScreen';
import MaintenanceScreen from '../../screens/System/MaintenanceScreen';
import { checkAppStatus, VersionInfo, MaintenanceInfo } from '@/utils/versionCheck';
import NetInfo from '@react-native-community/netinfo';

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
  const networkStatus = useNetworkStatus();
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [maintenanceInfo, setMaintenanceInfo] = useState<MaintenanceInfo | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [lastCheckTime, setLastCheckTime] = useState<number>(Date.now());

  // Check app status on mount and set up periodic checks
  useEffect(() => {
    if (enableVersionCheck || enableMaintenanceCheck) {
      // Initial check
      checkStatus();

      // Set up periodic check every 30 minutes (1800000 ms)
      const intervalId = setInterval(() => {
        console.log('Running periodic app status check (30 min interval)');
        checkStatus();
      }, 30 * 60 * 1000); // 30 minutes

      // Cleanup interval on unmount
      return () => {
        clearInterval(intervalId);
      };
    } else {
      setIsCheckingStatus(false);
    }
  }, [enableVersionCheck, enableMaintenanceCheck]);

  // Check when app comes to foreground (if 5+ minutes since last check)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const timeSinceLastCheck = Date.now() - lastCheckTime;
        const fiveMinutes = 5 * 60 * 1000;

        // Only check if it's been more than 5 minutes since last check
        if (timeSinceLastCheck > fiveMinutes) {
          console.log('App foregrounded, checking status (5+ min since last check)');
          checkStatus();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [lastCheckTime, enableVersionCheck, enableMaintenanceCheck]);

  const checkStatus = async () => {
    try {
      setIsCheckingStatus(true);

      // Fetch all app status info from Firebase
      const status = await checkAppStatus(currentVersion);

      if (enableVersionCheck) {
        setVersionInfo(status.versionInfo);
      }

      if (enableMaintenanceCheck) {
        setMaintenanceInfo(status.maintenanceInfo);
      }

      // Update last check time
      setLastCheckTime(Date.now());
    } catch (error) {
      console.error('App status check failed:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleRetryConnection = async () => {
    // Force a network state refresh
    const state = await NetInfo.refresh();
    console.log('Network state refreshed:', state);
  };

  const handleRetryStatus = async () => {
    // Retry checking app status (maintenance/version)
    await checkStatus();
  };

  // Priority 1: Show maintenance screen (highest priority - blocking)
  if (
    enableMaintenanceCheck &&
    maintenanceInfo?.isUnderMaintenance &&
    !isCheckingStatus
  ) {
    return <MaintenanceScreen onRetry={handleRetryStatus} />;
  }

  // Priority 2: Show update required screen (blocking)
  if (
    enableVersionCheck &&
    versionInfo?.updateRequired &&
    !isCheckingStatus
  ) {
    return (
      <UpdateRequiredScreen
        currentVersion={currentVersion}
        requiredVersion={versionInfo.requiredVersion}
        updateUrl={versionInfo.updateUrl}
        isOptional={false}
      />
    );
  }

  const [allowOfflinePayment, setAllowOfflinePayment] = useState(false);

  // Listen to SatPayOfflineScreen mount state to handle offline overlay
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('SatPayOfflineScreenMounted', (isMounted: boolean) => {
      setAllowOfflinePayment(isMounted);
    });
    return () => sub.remove();
  }, []);

  // If internet comes back, we don't necessarily reset allowOfflinePayment because
  // the user might still be on the SatPayOfflineScreen. It will reset automatically
  // when the screen unmounts via the event above.

  // Priority 3: Show no internet screen (overlay)
  return (
    <View style={{ flex: 1 }}>
      {children}
      {!networkStatus.isConnected && !allowOfflinePayment && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          <NoInternetScreen 
            onRetry={handleRetryConnection} 
            onPayOffline={() => setAllowOfflinePayment(true)}
          />
        </View>
      )}
    </View>
  );
}
