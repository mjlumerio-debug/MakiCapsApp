import { ThemedButton } from '@/components/ui/ThemedButton';
import { Typography } from '@/constants/theme';
import { useRouter } from 'expo-router';
import React from 'react';
import { ImageBackground, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const router = useRouter();

  const [isChecking, setIsChecking] = React.useState(true);
  
  React.useEffect(() => {
    const checkSession = async () => {
      try {
        const { fetchCurrentUser, refreshToken } = await import('@/lib/auth_api');
        const { setUserId, setSessionStatus } = await import('@/lib/ui_store');
        const { suppressAutoLogout } = await import('@/lib/api');
        const SecureStore = await import('expo-secure-store');
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        
        const token = await SecureStore.getItemAsync('auth_token');
        if (!token) {
          setIsChecking(false);
          return;
        }

        setSessionStatus('validating');
        
        // Suppress the 401 interceptor during startup validation
        // so stale tokens don't trigger "Session Expired" alerts
        suppressAutoLogout(true);
        
        try {
          // Try to validate the current token
          const user = await fetchCurrentUser();
          suppressAutoLogout(false);
          setUserId(user.id);

          // Route based on role
          if (user.role === 'rider') {
            router.replace('/rider/dashboard' as any);
          } else {
            router.replace('/home_dashboard');
          }
        } catch (fetchError) {
          // Token might be stale — try refreshing it
          console.log('[SessionCheck] Initial validation failed, attempting token refresh...');
          const refreshed = await refreshToken();
          
          if (refreshed) {
            // Retry with the new token
            try {
              const user = await fetchCurrentUser();
              suppressAutoLogout(false);
              setUserId(user.id);
              console.log('[SessionCheck] Token refreshed and session restored.');
              
              if (user.role === 'rider') {
                router.replace('/rider/dashboard' as any);
              } else {
                router.replace('/home_dashboard');
              }
              return;
            } catch {
              // Even after refresh, still fails
            }
          }
          
          // Token is truly dead — clean up quietly (no "Session Expired" alert)
          suppressAutoLogout(false);
          console.log('[SessionCheck] Token is invalid. Clearing session.');
          await SecureStore.deleteItemAsync('auth_token');
          await AsyncStorage.removeItem('user_profile');
          setSessionStatus('idle');
          setIsChecking(false);
        }
      } catch (e) {
        // Ensure suppression is cleared on unexpected errors
        try {
          const { suppressAutoLogout } = await import('@/lib/api');
          suppressAutoLogout(false);
        } catch {}
        console.log('[SessionCheck] Unexpected error:', e);
        setIsChecking(false);
      }
    };
    
    checkSession();
  }, []);

  if (isChecking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" />
        <Text style={[styles.logoText, { fontSize: 40 }]}>MakiDesu</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View entering={FadeIn.duration(1200)} style={styles.container}>
        <ImageBackground
          source={require('../assets/images/sushi-hero.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
            <Animated.View
              entering={FadeInDown.delay(400).duration(1000)}
              style={styles.topContainer}
            >
              <Text style={styles.logoText}>MakiDesu</Text>
            </Animated.View>

            <View style={styles.bottomContainer}>
              <Animated.Text
                entering={FadeInUp.delay(600).duration(1000)}
                style={styles.tagline}
              >
                The Art of Japanese Cuisine
              </Animated.Text>

              <Animated.Text
                entering={FadeInUp.delay(800).duration(1000)}
                style={styles.heading}
              >
                EXCEPTIONAL{'\n'}SUSHI TODAY.
              </Animated.Text>

              <Animated.View entering={FadeInUp.delay(1000).duration(1000)}>
                <ThemedButton
                  title="Get Started"
                  variant="dark"
                  onPress={() => router.push('/login')}
                  style={styles.button}
                  textStyle={styles.buttonText}
                />
              </Animated.View>
            </View>
          </SafeAreaView>
        </ImageBackground>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingVertical: 50,
  },
  topContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 55,
    fontFamily: Typography.brand,
    letterSpacing: 4,
  },
  bottomContainer: {
    marginBottom: 40,
  },
  tagline: {
    color: '#FFFFFF',
    fontSize: 20,
    marginBottom: 12,
    fontFamily: Typography.body,
    fontWeight: '500',
    letterSpacing: 1.2,
  },
  heading: {
    color: '#D82E3F',
    fontSize: 48,
    fontFamily: Typography.h1,
    lineHeight: 56,
    marginBottom: 44,
  },
  button: {
    backgroundColor: '#1A1A1A',
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  buttonText: {
    fontSize: 20,
    fontFamily: Typography.button,
  },
});
