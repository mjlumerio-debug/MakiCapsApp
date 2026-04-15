import { ThemedButton } from '@/components/ui/ThemedButton';
import { ThemedInput } from '@/components/ui/ThemedInput';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { requestPasswordReset } from '@/lib/auth_api';
import { getRemainingCooldown } from '@/lib/timer_store';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const [email, setEmail] = useState('');
    const [authError, setAuthError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const backButtonScale = useSharedValue(1);
    const animatedBackStyle = useAnimatedStyle(() => ({
        transform: [{ scale: backButtonScale.value }],
    }));

    const handleReset = async () => {
        Keyboard.dismiss();
        const cleanEmail = email.trim().toLowerCase();
        setAuthError('');

        if (!cleanEmail) {
            setAuthError('Please enter your email address.');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            setAuthError('Please enter a valid email address.');
            return;
        }

        try {
            setIsSubmitting(true);

            // Anti-spam: If there's an active cooldown, skip sending a new code and just navigate
            const remaining = getRemainingCooldown(cleanEmail, 300000); // 5 mins
            if (remaining > 0) {
                setIsSubmitting(false);
                router.push({
                    pathname: '/reset-password',
                    params: { email: cleanEmail }
                } as any);
                return;
            }

            await requestPasswordReset(cleanEmail);
            // REMOVED: Automatic cooldown on initial request

            // Navigate directly to integrated reset password screen
            router.push({
                pathname: '/reset-password',
                params: {
                    email: cleanEmail
                }
            } as any);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to request password reset.';
            setAuthError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Responsive scaling
    const isSmallScreen = height < 700;
    const isExtraSmall = height < 650;
    const imageSizeBase = Math.min(width * 0.45, 180);
    const imageSize = isExtraSmall ? imageSizeBase * 0.6 : (isSmallScreen ? imageSizeBase * 0.8 : imageSizeBase);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[styles.content, { paddingVertical: isExtraSmall ? 4 : (isSmallScreen ? 10 : 30) }]}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            onPressIn={() => {
                                backButtonScale.value = withSpring(0.8);
                            }}
                            onPressOut={() => {
                                backButtonScale.value = withSpring(1);
                            }}
                            style={[styles.backButton, isExtraSmall && { marginBottom: 4 }]}
                        >
                            <Animated.View style={animatedBackStyle}>
                                <Ionicons name="chevron-back" size={isExtraSmall ? 20 : 24} color={theme.text} />
                            </Animated.View>
                        </TouchableOpacity>

                        <Animated.View entering={FadeInUp.duration(600)} style={[styles.cozyContainer, isExtraSmall ? { paddingBottom: 20 } : { paddingBottom: 40 }]}>
                            <Animated.View entering={FadeInDown.delay(200).duration(800)}>
                                <Image
                                    source={require('../assets/images/chef_forgot.png')}
                                    style={[styles.image, { width: imageSize, height: imageSize, borderRadius: imageSize / 2, marginBottom: isExtraSmall ? 10 : 20 }]}
                                    resizeMode="contain"
                                />
                            </Animated.View>

                            <View style={[styles.textContainer, isExtraSmall ? { marginBottom: 10 } : (isSmallScreen && { marginBottom: 16 })]}>
                                <Text style={[styles.title, isExtraSmall ? { fontSize: 18, marginBottom: 2 } : (isSmallScreen && { fontSize: 20, marginBottom: 4 })]}>Forgot Password</Text>
                                {!isExtraSmall && (
                                    <Text style={[styles.subtitle, isSmallScreen && { fontSize: 12, marginBottom: 8, lineHeight: 16 }]}>
                                        Oto-San is checking his list... {"\n"}Please enter your email below.
                                    </Text>
                                )}
                            </View>

                            <ThemedInput
                                placeholder="Enter your email"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                height={isExtraSmall ? 38 : (isSmallScreen ? 44 : 56)}
                                style={isSmallScreen ? { marginBottom: 10 } : {}}
                            />

                            <ThemedButton
                                title="Reset Password"
                                onPress={handleReset}
                                loading={isSubmitting}
                                disabled={isSubmitting}
                                style={[styles.button, isExtraSmall ? { height: 40, borderRadius: 20, marginTop: 10 } : (isSmallScreen && { height: 44, borderRadius: 22 }), { marginBottom: 30 }]}
                            />

                            <View style={styles.errorContainer}>
                                {authError ? (
                                    <Text style={styles.errorText}>{authError}</Text>
                                ) : null}
                            </View>
                        </Animated.View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    backButton: {
        alignSelf: 'flex-start',
        marginBottom: 10,
        zIndex: 10,
    },
    cozyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        paddingBottom: 40,
    },
    image: {
        marginBottom: 20,
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontFamily: Typography.h1,
        color: '#D82E3F',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 24,
        fontFamily: Typography.body,
        lineHeight: 26,
    },
    button: {
        marginTop: 20,
        width: '100%',
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FF5800',
    },
    errorText: {
        color: '#C62828',
        fontFamily: Typography.body,
        fontSize: 13,
        textAlign: 'center',
    },
    errorContainer: {
        height: 25,
        justifyContent: 'center',
        marginTop: 10,
    },
});
