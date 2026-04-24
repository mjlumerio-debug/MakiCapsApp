import { ThemedButton } from '@/components/ui/ThemedButton';
import { ThemedInput } from '@/components/ui/ThemedInput';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { requestEmailVerification } from '@/lib/verification_service';
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
import Animated, {
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RequestVerificationScreen() {
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const backButtonScale = useSharedValue(1);
    const animatedBackStyle = useAnimatedStyle(() => ({
        transform: [{ scale: backButtonScale.value }],
    }));

    const handleRequestCode = async () => {
        Keyboard.dismiss();
        const cleanEmail = email.trim().toLowerCase();
        setErrorMessage('');
        setSuccessMessage('');

        if (!cleanEmail) {
            setErrorMessage('Please enter your email address.');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            setErrorMessage('Please enter a valid email address.');
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await requestEmailVerification(cleanEmail);

            if (response.success) {
                setSuccessMessage(response.message);
                // Navigate to the verify-code screen, passing the email
                setTimeout(() => {
                    router.push({
                        pathname: '/verify-code',
                        params: {
                            email: cleanEmail,
                            context: 'email-verification',
                        },
                    } as any);
                }, 800);
            } else {
                setErrorMessage(response.message);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to send verification code.';
            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Responsive scaling
    const isSmallScreen = height < 700;
    const isExtraSmall = height < 650;
    const imageSizeBase = Math.min(width * 0.50, 200);
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
                                    source={require('../assets/images/chef_verify.png')}
                                    style={[styles.image, { width: imageSize, height: imageSize, borderRadius: imageSize / 2, marginBottom: isExtraSmall ? 10 : 20 }]}
                                    resizeMode="contain"
                                />
                            </Animated.View>

                            <View style={[styles.textContainer, isExtraSmall ? { marginBottom: 10 } : (isSmallScreen && { marginBottom: 16 })]}>
                                <Text style={[styles.title, isExtraSmall ? { fontSize: 18, marginBottom: 2 } : (isSmallScreen && { fontSize: 22, marginBottom: 4 })]}>
                                    Verify Your Email
                                </Text>
                                {!isExtraSmall && (
                                    <Text style={[styles.subtitle, isSmallScreen && { fontSize: 12, lineHeight: 16 }]}>
                                        Enter your email address and we&apos;ll send{'\n'}you a 6-digit verification code.
                                    </Text>
                                )}
                            </View>

                            <Animated.View entering={FadeInUp.delay(400).duration(800)} style={styles.cardContainer}>
                                <View style={[styles.signHeader, isExtraSmall ? { paddingVertical: 3, paddingHorizontal: 12 } : (isSmallScreen && { paddingVertical: 4 })]}>
                                    <Text style={[styles.signHeaderText, isExtraSmall ? { fontSize: 8 } : (isSmallScreen && { fontSize: 10 })]}>EMAIL VERIFICATION</Text>
                                </View>
                                <View style={[styles.inputCard, isExtraSmall ? { padding: 12, borderRadius: 12 } : (isSmallScreen && { padding: 16 })]}>
                                    <ThemedInput
                                        placeholder="Enter your email"
                                        value={email}
                                        onChangeText={(t) => { setEmail(t); setErrorMessage(''); setSuccessMessage(''); }}
                                        keyboardType="email-address"
                                        height={isExtraSmall ? 38 : (isSmallScreen ? 44 : 56)}
                                        style={isExtraSmall ? { marginBottom: 8 } : (isSmallScreen ? { marginBottom: 12 } : { marginBottom: 16 })}
                                    />
                                    <ThemedButton
                                        title="Send Verification Code"
                                        onPress={handleRequestCode}
                                        loading={isSubmitting}
                                        disabled={isSubmitting}
                                        style={[styles.sendButton, isExtraSmall ? { height: 40, borderRadius: 20 } : (isSmallScreen && { height: 44, borderRadius: 22 })]}
                                    />

                                    {errorMessage ? (
                                        <Text style={styles.errorText}>{errorMessage}</Text>
                                    ) : null}

                                    {successMessage ? (
                                        <Text style={styles.successText}>{successMessage}</Text>
                                    ) : null}
                                </View>
                            </Animated.View>

                            <TouchableOpacity
                                onPress={() => router.replace('/login')}
                                style={[styles.loginLink, isExtraSmall ? { marginTop: 8 } : { marginTop: 16 }]}
                            >
                                <Text style={[styles.loginLinkText, isExtraSmall ? { fontSize: 10 } : (isSmallScreen && { fontSize: 12 })]}>
                                    Back to <Text style={styles.loginLinkBold}>Login</Text>
                                </Text>
                            </TouchableOpacity>
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
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
        fontFamily: Typography.body,
        lineHeight: 24,
    },
    cardContainer: {
        width: '100%',
        marginBottom: 24,
    },
    signHeader: {
        backgroundColor: '#D82E3F',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        alignSelf: 'center',
        marginBottom: -1,
        zIndex: 1,
    },
    signHeaderText: {
        color: '#FFFFFF',
        fontFamily: Typography.button,
        fontSize: 12,
        letterSpacing: 2,
    },
    inputCard: {
        backgroundColor: '#F8F8F8',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        width: '100%',
    },
    sendButton: {
        height: 56,
        borderRadius: 28,
        backgroundColor: '#D82E3F',
    },
    errorText: {
        color: '#C62828',
        fontFamily: Typography.body,
        fontSize: 13,
        marginTop: 12,
        textAlign: 'center',
    },
    successText: {
        color: '#2E7D32',
        fontFamily: Typography.body,
        fontSize: 13,
        marginTop: 12,
        textAlign: 'center',
    },
    loginLink: {
        alignItems: 'center',
    },
    loginLinkText: {
        fontSize: 14,
        color: '#999',
        fontFamily: Typography.body,
    },
    loginLinkBold: {
        color: '#D82E3F',
        fontFamily: Typography.button,
    },
});
