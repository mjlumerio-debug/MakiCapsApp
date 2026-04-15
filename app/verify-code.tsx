import { ThemedButton } from '@/components/ui/ThemedButton';
import { ThemedInput } from '@/components/ui/ThemedInput';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { requestEmailVerificationCode, signupUser, verifyEmailCode as verifyEmailCodeAuth } from '@/lib/auth_api';
import { clearPendingSignup, getPendingSignup } from '@/lib/signup_flow';
import { requestEmailVerification, verifyEmailCode as verifyEmailCodeService } from '@/lib/verification_service';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Image,
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

export default function VerifyCodeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ context?: string; email?: string; devCode?: string }>();
    const { width, height } = useWindowDimensions();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const [code, setCode] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resendMessage, setResendMessage] = useState('');
    const [isResending, setIsResending] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const pendingSignup = getPendingSignup();

    const isSignupVerification = params.context === 'signup' && !!pendingSignup;
    const isEmailVerification = params.context === 'email-verification';

    const emailHint =
        typeof params.email === 'string' && params.email
            ? params.email
            : pendingSignup?.email || '';
    const initialDevCode = typeof params.devCode === 'string' ? params.devCode : '';

    const backButtonScale = useSharedValue(1);
    const animatedBackStyle = useAnimatedStyle(() => ({
        transform: [{ scale: backButtonScale.value }],
    }));

    useEffect(() => {
        if (initialDevCode) {
            setResendMessage(`Check your email for the code.`);
        }
    }, [initialDevCode]);

    const handleVerify = async () => {
        const cleanCode = code.trim();
        setErrorMessage('');
        setResendMessage('');
        setSuccessMessage('');

        if (cleanCode.length < 4) {
            setErrorMessage('Please enter the verification code.');
            return;
        }

        // --- Email Verification Context (new system) ---
        if (isEmailVerification) {
            if (!emailHint) {
                setErrorMessage('Email address is missing.');
                return;
            }

            try {
                setIsSubmitting(true);
                const result = await verifyEmailCodeService(emailHint, cleanCode);

                if (result.success) {
                    setSuccessMessage(result.message);
                    setTimeout(() => {
                        router.replace('/login');
                    }, 1500);
                } else {
                    setErrorMessage(result.message);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Verification failed.';
                setErrorMessage(message);
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // --- Reset Password Context ---
        const isResetFlow = params.context === 'reset';

        if (!isResetFlow && (!isSignupVerification || !pendingSignup)) {
            router.replace('/login');
            return;
        }

        try {
            setIsSubmitting(true);
            const verificationEmail = emailHint || (pendingSignup ? pendingSignup.email : '');

            if (!verificationEmail) {
                setErrorMessage('Email address is missing.');
                return;
            }

            const verification = await verifyEmailCodeAuth(verificationEmail, cleanCode);

            if (params.context === 'reset') {
                // Navigate to reset password (change password) screen
                router.push({
                    pathname: '/reset-password',
                    params: {
                        email: verificationEmail,
                        verificationProof: verification.verificationProof
                    }
                } as any);
                return;
            }

            // Default signup flow
            if (!pendingSignup) {
                router.replace('/login');
                return;
            }

            await signupUser({
                firstName: pendingSignup.firstName,
                lastName: pendingSignup.lastName,
                email: pendingSignup.email,
                password: pendingSignup.password,
                verificationProof: verification.verificationProof,
                contactNumber: pendingSignup.contactNumber,
            });
            clearPendingSignup();
            router.replace('/login');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create account.';
            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResend = async () => {
        if (!emailHint) {
            setErrorMessage('Email address is missing for resend.');
            return;
        }

        setErrorMessage('');
        setResendMessage('');
        setSuccessMessage('');

        try {
            setIsResending(true);

            if (isEmailVerification) {
                // Use the new verification service for email-verification context
                const result = await requestEmailVerification(emailHint);
                if (result.success) {
                    setResendMessage(`A new code was sent to ${emailHint}.`);
                } else {
                    setErrorMessage(result.message);
                }
            } else {
                // Use existing auth_api for signup/reset contexts
                const response = await requestEmailVerificationCode(emailHint);
                const sentTo = response.sentTo || emailHint;
                setResendMessage(`A new code was sent to ${sentTo}.`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to resend code.';
            setErrorMessage(message);
        } finally {
            setIsResending(false);
        }
    };

    // Responsive scaling
    const isSmallScreen = height < 700;
    const isExtraSmall = height < 650;
    const imageSizeBase = Math.min(width * 0.55, 220);
    const imageSize = isExtraSmall ? imageSizeBase * 0.5 : (isSmallScreen ? imageSizeBase * 0.8 : imageSizeBase);

    // Dynamic header text based on context
    const headerLabel = isEmailVerification ? 'VERIFICATION CODE' : 'RESET CODE';
    const buttonLabel = isEmailVerification
        ? 'Verify Email'
        : params.context === 'reset'
            ? 'Verify Gmail'
            : 'Verify Account';

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
                    <View style={[styles.header, { paddingTop: isExtraSmall ? 4 : (isSmallScreen ? 10 : 20), paddingHorizontal: 24 }]}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            onPressIn={() => {
                                backButtonScale.value = withSpring(0.8);
                            }}
                            onPressOut={() => {
                                backButtonScale.value = withSpring(1);
                            }}
                            style={styles.backButton}
                        >
                            <Animated.View style={animatedBackStyle}>
                                <Ionicons name="chevron-back" size={isExtraSmall ? 20 : 24} color={theme.text} />
                            </Animated.View>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.content, { paddingHorizontal: isExtraSmall ? 16 : (isSmallScreen ? 20 : 30) }]}>
                        <Animated.View entering={FadeInDown.delay(200).duration(800)}>
                            <Image
                                source={require('../assets/images/chef_verify.png')}
                                style={[styles.image, { width: imageSize, height: imageSize, borderRadius: imageSize / 2, marginBottom: isExtraSmall ? 8 : (isSmallScreen ? 12 : 24) }]}
                                resizeMode="contain"
                            />
                        </Animated.View>

                        <Animated.View entering={FadeInUp.delay(400).duration(800)} style={[styles.textContainer, isExtraSmall ? { marginBottom: 8 } : (isSmallScreen && { marginBottom: 16 })]}>
                            <Text style={[styles.title, isExtraSmall ? { fontSize: 18, marginBottom: 2 } : (isSmallScreen && { fontSize: 22, marginBottom: 4 })]}>Verification</Text>
                            {!isExtraSmall && (
                                <Text style={[styles.subtitle, isSmallScreen && { fontSize: 12, lineHeight: 16 }]}>
                                    {emailHint
                                        ? `Enter the verification code sent to${'\n'}${emailHint}`
                                        : `Oto-San is getting worried... ${'\n'}He hasn't seen your code yet!`}
                                </Text>
                            )}
                        </Animated.View>

                        <Animated.View entering={FadeInUp.delay(600).duration(800)} style={[styles.cardContainer, isExtraSmall ? { marginBottom: 8 } : (isSmallScreen && { marginBottom: 12 })]}>
                            <View style={[styles.signHeader, isExtraSmall ? { paddingVertical: 3, paddingHorizontal: 12 } : (isSmallScreen && { paddingVertical: 4 })]}>
                                <Text style={[styles.signHeaderText, isExtraSmall ? { fontSize: 8 } : (isSmallScreen && { fontSize: 10 })]}>{headerLabel}</Text>
                            </View>
                            <View style={[styles.inputCard, isExtraSmall ? { padding: 12, borderRadius: 12 } : (isSmallScreen && { padding: 16 })]}>
                                <ThemedInput
                                    placeholder="6-digit code"
                                    value={code}
                                    onChangeText={(t) => { setCode(t); setErrorMessage(''); setSuccessMessage(''); }}
                                    keyboardType="number-pad"
                                    height={isExtraSmall ? 38 : (isSmallScreen ? 44 : 56)}
                                    style={isExtraSmall ? { marginBottom: 8 } : (isSmallScreen ? { marginBottom: 12 } : { marginBottom: 16 })}
                                />
                                <ThemedButton
                                    title={buttonLabel}
                                    onPress={handleVerify}
                                    loading={isSubmitting}
                                    disabled={isSubmitting}
                                    style={[styles.verifyButton, isExtraSmall ? { height: 40, borderRadius: 20 } : (isSmallScreen && { height: 44, borderRadius: 22 })]}
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
                            onPress={handleResend}
                            disabled={isResending}
                            style={[styles.resendContainer, isExtraSmall ? { marginTop: 4, paddingBottom: 20 } : (isSmallScreen && { marginTop: 8, paddingBottom: 30 })]}
                        >
                            <Text style={[styles.resendText, isExtraSmall ? { fontSize: 10 } : (isSmallScreen && { fontSize: 12 })]}>
                                Didn&apos;t receive code? <Text style={styles.resendLink}>{isResending ? 'Resending...' : 'Resend'}</Text>
                            </Text>
                        </TouchableOpacity>
                        {resendMessage ? <Text style={styles.resendInfo}>{resendMessage}</Text> : null}
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
    header: {
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    backButton: {
        alignSelf: 'flex-start',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 30,
        justifyContent: 'center',
    },
    image: {
        marginBottom: 24,
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
        color: '#333',
        textAlign: 'center',
        fontFamily: Typography.body,
        lineHeight: 26,
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
    verifyButton: {
        height: 56,
        borderRadius: 28,
        backgroundColor: '#D82E3F',
    },
    errorText: {
        color: '#C62828',
        fontFamily: Typography.body,
        fontSize: 13,
        marginTop: 10,
        textAlign: 'center',
    },
    successText: {
        color: '#2E7D32',
        fontFamily: Typography.body,
        fontSize: 13,
        marginTop: 10,
        textAlign: 'center',
    },
    resendContainer: {
        marginTop: 20,
    },
    resendText: {
        fontSize: 14,
        color: '#999',
        fontFamily: Typography.body,
    },
    resendLink: {
        color: '#D82E3F',
        fontFamily: Typography.button,
    },
    resendInfo: {
        color: '#374151',
        fontSize: 12,
        fontFamily: Typography.body,
        marginTop: 6,
        textAlign: 'center',
    },
});
