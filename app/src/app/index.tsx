import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useUserStore } from "@/state/userStore";

export default function Index() {
  const { authUser, userData, isAuthReady, isRehydrating } = useUserStore();

  if (isRehydrating || !isAuthReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#040D2D' }}>
        <ActivityIndicator size="large" color="#EEB170" />
      </View>
    );
  }

  if (!authUser) {
    return <Redirect href="/(auth)" />;
  }

  if (!userData?.fullyRegistered) {
    return <Redirect href="/(auth)/UserProfileFormScreen" />;
  }

  return <Redirect href="/(tabs)" />;
}
