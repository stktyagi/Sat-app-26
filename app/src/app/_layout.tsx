import { useEffect } from 'react';
import { Stack, SplashScreen, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import {
  Outfit_100Thin,
  Outfit_200ExtraLight,
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from "@expo-google-fonts/outfit";
import '../global.css';
import { BackHandler, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StoreProvider } from '@/state/StoreContext';
import { useUserStore } from '@/state/userStore';
import { useAuthListener } from '@/hooks/useAuthListener';
import { AlertProvider } from '@/components/ui/CustomAlert';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded, error] = useFonts({
    Outfit_100Thin,
    Outfit_200ExtraLight,
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });

  const { rehydrateFromStorage } = useUserStore();
  useAuthListener();

  useEffect(() => {
    rehydrateFromStorage();
  }, []);

  useEffect(() => {
    if (fontsLoaded || error) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);

  // Intercept Android hardware back button globally.
  // When there's a screen to pop in the JS stack, go back within the app.
  // When at the root (tabs), let the OS handle it (exits the app).
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
        return true; // consumed — don't exit
      }
      return false; // let Android exit
    });
    return () => handler.remove();
  }, [router]);

  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <AlertProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#040D2D' }}>
            <StatusBar backgroundColor="#040D2D" barStyle="light-content" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#DBE2ED' } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" />
            </Stack>
          </SafeAreaView>
        </AlertProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
