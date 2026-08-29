import { useEffect, useRef } from 'react';
import { Stack, SplashScreen, useRouter, useSegments } from "expo-router";
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
import { BackHandler, StatusBar, ToastAndroid, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StoreProvider } from '@/state/StoreContext';
import { useUserStore } from '@/state/userStore';
import { useAuthListener } from '@/hooks/useAuthListener';
import { AlertProvider } from '@/components/ui/CustomAlert';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const lastExitPress = useRef(0);
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

  // Hardware back: pop stack screens, then go to Home tab, then confirm exit.
  // Do not use canGoBack() first — after login the tabs screen often has auth
  // in history, and back would leave the app on the login screen.
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      const segs = segments as string[];
      const root = segs[0];
      const tab = segs[1];
      const onTabs = !root || root === '(tabs)';
      const onAuth = root === '(auth)';
      const onHomeTab = onTabs && (!tab || tab === 'index');
      const onStack = !!root && root !== '(tabs)' && root !== '(auth)' && root !== 'index';

      if (onStack) {
        if (router.canGoBack()) {
          router.back();
          return true;
        }
        router.replace('/(tabs)');
        return true;
      }

      if (onTabs && !onHomeTab) {
        router.replace('/(tabs)');
        return true;
      }

      if (onHomeTab || onAuth) {
        const now = Date.now();
        if (now - lastExitPress.current < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastExitPress.current = now;
        if (Platform.OS === 'android') {
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        }
        return true;
      }

      return true;
    });
    return () => handler.remove();
  }, [router, segments]);

  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <StoreProvider>
        <AlertProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#040D2D' }}>
            <StatusBar backgroundColor="#040D2D" barStyle="light-content" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#DBE2ED' } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="admin" />
              <Stack.Screen name="events" />
              <Stack.Screen name="profile" />
              <Stack.Screen name="map" />
              <Stack.Screen name="store" />
            </Stack>
          </SafeAreaView>
        </AlertProvider>
      </StoreProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
