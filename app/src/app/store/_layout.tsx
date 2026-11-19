import { Stack } from 'expo-router';
import { useThemeStore } from '@/state/themeStore';

export default function StoreLayout() {
  const { colors } = useThemeStore();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
