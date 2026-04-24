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
import { SessionWatcher } from '@/components/SessionWatcher';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

import { AppProvider } from '@/state/AppProvider';

import { useAppTheme } from '@/state/contexts/ThemeContext';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSequence } from 'react-native-reanimated';
import { useState } from 'react';

function InnerLayout() {
  const { isDark, colors } = useAppTheme();
  const opacity = useSharedValue(0);
  const [currentThemeIsDark, setCurrentThemeIsDark] = useState(isDark);

  // Smooth fade transition when theme changes
  useEffect(() => {
    if (currentThemeIsDark !== isDark) {
      opacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0, { duration: 150 })
      );
      
      // Toggle the actual theme halfway through the animation (when overlay is opaque)
      const timeout = setTimeout(() => {
        setCurrentThemeIsDark(isDark);
      }, 150);
      
      return () => clearTimeout(timeout);
    }
  }, [isDark]);

  const transitionOverlayStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: opacity.value,
    zIndex: 99999,
  }));

  return (
    <ThemeProvider value={currentThemeIsDark ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
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

        <SessionWatcher />
        
        {/* Theme Transition Overlay */}
        <Animated.View style={transitionOverlayStyle} pointerEvents="none" />
      </View>
      <StatusBar style={currentThemeIsDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
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

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <InnerLayout />
      </AppProvider>
    </SafeAreaProvider>
  );
}
