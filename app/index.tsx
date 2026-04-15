import { ThemedButton } from '@/components/ui/ThemedButton';
import { Typography } from '@/constants/theme';
import { useRouter } from 'expo-router';
import React from 'react';
import { ImageBackground, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const router = useRouter();

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
              entering={FadeInDown.delay(400).duration(1000).springify()}
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
                entering={FadeInUp.delay(800).duration(1000).springify()}
                style={styles.heading}
              >
                EXCEPTIONAL{'\n'}SUSHI TODAY.
              </Animated.Text>

              <Animated.View entering={FadeInUp.delay(1000).duration(1000).springify()}>
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
