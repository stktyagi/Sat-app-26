import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useUserStore } from "@/state/userStore";
import { checkAuthStatus } from "@/api/auth";

export default function Index() {
  const { userData, isRehydrating } = useUserStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!isRehydrating) {
      const authStatus = checkAuthStatus();
      setIsAuthenticated(authStatus);
      setAuthChecked(true);
    }
  }, [isRehydrating]);

  if (isRehydrating || !authChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#040D2D' }}>
        <ActivityIndicator size="large" color="#EEB170" />
      </View>
    );
  }

  // 1. If not authenticated with Firebase, go to login
  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  // 2. If authenticated but missing user profile data or not fully registered
  if (!userData || !userData.fullyRegistered) {
    return <Redirect href="/(auth)/UserProfileFormScreen" />;
  }

  // 3. Fully authenticated and registered
  return <Redirect href="/(tabs)" />;
}
