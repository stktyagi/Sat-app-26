import { Redirect } from "expo-router";
import { useUserStore, hasCompletedProfile } from "@/state/userStore";

export default function Index() {
  const { authUser, userData, isAuthReady, isRehydrating } = useUserStore();

  // Native splash stays visible until auth resolves (see _layout), so render nothing here.
  if (isRehydrating || !isAuthReady) return null;

  if (!authUser) {
    return <Redirect href="/(auth)" />;
  }

  if (!hasCompletedProfile(userData)) {
    return <Redirect href="/(auth)/UserProfileFormScreen" />;
  }

  return <Redirect href="/(tabs)" />;
}
