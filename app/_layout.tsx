import {
  Outfit_400Regular,
  Outfit_700Bold
} from '@expo-google-fonts/outfit';
import {
  ShipporiMincho_400Regular,
  ShipporiMincho_700Bold,
  ShipporiMincho_800ExtraBold
} from '@expo-google-fonts/shippori-mincho';
import {
  YujiBoku_400Regular
} from '@expo-google-fonts/yuji-boku';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initRealtime } from '@/lib/realtime';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

import { AppProvider } from '@/state/AppProvider';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
    'ShipporiMincho-Regular': ShipporiMincho_400Regular,
    'ShipporiMincho-Bold': ShipporiMincho_700Bold,
    'ShipporiMincho-ExtraBold': ShipporiMincho_800ExtraBold,
    'Outfit-Regular': Outfit_400Regular,
    'Outfit-Bold': Outfit_700Bold,
    'YujiBoku-Regular': YujiBoku_400Regular,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    // Realtime disabled for stability
  }, []);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ animation: 'none' }} />
            <Stack.Screen name="home_dashboard" options={{ animation: 'none' }} />
            <Stack.Screen name="favorite" options={{ animation: 'none' }} />
            <Stack.Screen name="favorite_page" options={{ animation: 'none' }} />
            <Stack.Screen name="profile" options={{ animation: 'none' }} />
            <Stack.Screen name="personal-information" options={{ animation: 'none' }} />
            <Stack.Screen name="cart" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="forgot-password" />
            <Stack.Screen name="verify-code" />
            <Stack.Screen name="reset-password" />
            <Stack.Screen name="my-orders" />
            <Stack.Screen name="track-order" options={{ animation: 'slide_from_right' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
