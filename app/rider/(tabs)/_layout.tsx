import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppState, AppStateStatus } from 'react-native';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { useUiStore } from '@/lib/ui_store';
import { startRiderRealtimeSync, stopRiderRealtimeSync } from '@/lib/rider_store';
import { updateRiderStatus } from '@/lib/rider_api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RiderTabsLayout() {
  const { colors } = useAppTheme();
  const { riderStatus } = useUiStore();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Start realtime sync (polling + heartbeat) when the rider is in the tabs
    startRiderRealtimeSync(riderStatus);
    return () => {
      stopRiderRealtimeSync();
    };
  }, [riderStatus]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground!
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background
        updateRiderStatus('offline');
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text + '60',
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border + '20',
          height: 60 + (insets.bottom > 0 ? insets.bottom : 0),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 0,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'EXPLORE',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "compass" : "compass-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="completed"
        options={{
          title: 'HISTORY',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "clipboard-check" : "clipboard-check-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PROFILE',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "account-circle" : "account-circle-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
