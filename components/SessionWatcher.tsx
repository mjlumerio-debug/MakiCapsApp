import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useUiStore } from '@/lib/ui_store';

export const SessionWatcher = () => {
  const router = useRouter();
  const { sessionStatus } = useUiStore();

  useEffect(() => {
    if (sessionStatus === 'expired') {
      Alert.alert(
        'Session Expired',
        'Your session has expired or was revoked. Please log in again to continue.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/login');
            },
          },
        ],
        { cancelable: false }
      );
    } else if (sessionStatus === 'unauthorized') {
      // Manual logout or invalid state - ensure we are not on a protected screen
      // For simplicity, we just force redirect to login
      router.replace('/login');
    }
  }, [sessionStatus, router]);

  return null;
};
