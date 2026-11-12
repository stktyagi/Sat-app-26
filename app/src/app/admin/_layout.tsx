import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useThemeStore } from '@/state/themeStore';
import { useUserStore } from '@/state/userStore';
import { isUserAdmin } from '@/utils/roles';

export default function AdminLayout() {
  const { isDark } = useThemeStore();
  const { userData, authUser, isAuthReady, isRehydrating } = useUserStore();

  if (isRehydrating || !isAuthReady) {
    return null;
  }

  if (!authUser || !isUserAdmin(userData)) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: isDark ? '#131316' : '#E0E0E0' },
      }}
    />
  );
}
