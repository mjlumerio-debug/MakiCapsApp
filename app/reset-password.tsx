import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { ThemedInput } from '@/components/ui/ThemedInput';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { changePassword, requestPasswordReset, verifyEmailCode } from '@/lib/auth_api';
import { getRemainingCooldown, setLastResendTimestamp } from '@/lib/timer_store';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    NativeSyntheticEvent,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TextInputKeyPressEventData,
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

export default function ResetPasswordScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ email: string }>();
    const { width, height } = useWindowDimensions();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

    // States for the two-step flow
    const [isVerified, setIsVerified] = useState(false);
    const [verificationProof, setVerificationProof] = useState('');
    const [firstName, setFirstName] = useState<string | null>(null);
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const inputRefs = useRef<any[]>([]);

    const email = params.email || '';
    const initialRemaining = getRemainingCooldown(email, 300000);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showGreeting, setShowGreeting] = useState(false);
    const [resendTimer, setResendTimer] = useState(initialRemaining);
    const [canResend, setCanResend] = useState(initialRemaining === 0);
    const [modalCountdown, setModalCountdown] = useState(3);

    const backButtonScale = useSharedValue(1);
    const animatedBackStyle = useAnimatedStyle(() => ({
        transform: [{ scale: backButtonScale.value }],
    }));

    // Auto-transition for greeting modal with real-time countdown
    useEffect(() => {
        let interval: any;
        if (showGreeting) {
            setModalCountdown(3);
            interval = setInterval(() => {
                setModalCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        setIsVerified(true);
                        setShowGreeting(false);
                        setErrorMessage('');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [showGreeting]);

    // Resend countdown timer
    useEffect(() => {
        let interval: any;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        } else if (resendTimer === 0) {
            setCanResend(true);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    };

    const handleOtpChange = (text: string, index: number) => {
        const newCode = [...code];
        newCode[index] = text.slice(-1);
        setCode(newCode);

        // Move to next input if text is entered with a small delay for Android stability
        if (text && index < 5) {
            setTimeout(() => {
                inputRefs.current[index + 1]?.focus();
            }, 50);
        }
    };

    const handleOtpKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handleVerifyCode = async () => {
        Keyboard.dismiss();
        const fullCode = code.join('');
        setErrorMessage('');

        if (fullCode.length < 6) {
            setErrorMessage('Please enter the full 6-digit code.');
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await verifyEmailCode(email, fullCode);
            setVerificationProof(response.verificationProof || '');
            setFirstName(response.firstName || 'User');
            setShowGreeting(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Invalid verification code.';
            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendCode = async () => {
        Keyboard.dismiss();
        if (!canResend) return;

        try {
            setIsSubmitting(true);
            setErrorMessage('');

            // Using specifically the password reset request logic
            await requestPasswordReset(email);

            setCanResend(false);
            const cooldownSeconds = 300;
            setResendTimer(cooldownSeconds); // 5 minutes cooldown
            await setLastResendTimestamp(email, Date.now());
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to resend code.';
            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePasswordChange = async () => {
        Keyboard.dismiss();
        setErrorMessage('');

        if (!verificationProof) {
            setErrorMessage('Verification session expired. Please try again.');
            setIsVerified(false);
            return;
        }

        if (!newPassword || newPassword.length < 8) {
            setErrorMessage('Password must be at least 8 characters.');
            return;
        }

        const hasUpper = /[A-Z]/.test(newPassword);
        const hasLower = /[a-z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);

        if (!hasUpper || !hasLower || !hasNumber) {
            setErrorMessage('Password must contain uppercase, lowercase letters and numbers.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setErrorMessage('Passwords do not match.');
            return;
        }

        try {
            setIsSubmitting(true);
            await changePassword(email, verificationProof, newPassword);
            setIsSuccess(true);
            setTimeout(() => {
                router.replace('/login');
            }, 2000);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to change password.';
            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Responsive scaling
    const isSmallScreen = height < 700;
    const isExtraSmall = height < 650;
    const imageSizeBase = Math.min(width * 0.45, 180);
    const imageSize = isExtraSmall ? imageSizeBase * 0.5 : (isSmallScreen ? imageSizeBase * 0.7 : imageSizeBase);

    if (isSuccess) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Animated.View entering={FadeInDown.duration(600)} style={{ alignItems: 'center', padding: 24 }}>
                    <Ionicons name="checkmark-circle" size={80} color={theme.tint} />
                    <Text style={[styles.title, { marginTop: 20 }]}>Success!</Text>
                    <Text style={[styles.subtitle, { color: theme.text }]}>Your password has been updated. Redirecting to login...</Text>
                </Animated.View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Greeting Modal */}
            <Modal
                visible={showGreeting}
                transparent={true}
                animationType="fade"
            >
                <View style={styles.modalOverlay}>
                    <Animated.View entering={FadeInUp.duration(600)} style={[styles.modalContent, { backgroundColor: theme.background }]}>
                        <View style={styles.modalIconContainer}>
                            <Ionicons name="sparkles" size={40} color={theme.tint} />
                        </View>
                        <Text style={styles.greetingText}>Hello, {firstName}!</Text>
                        <Text style={styles.greetingSubtext}>
                            Verification successful.{"\n"}Preparing your password reset...
                        </Text>
                        <View style={styles.autoTransitionIndicator}>
                            <Text style={styles.autoTransitionText}>Moving to next step in {modalCountdown}s...</Text>
                        </View>
                    </Animated.View>
                </View>
            </Modal>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 50}
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
                            <Text style={[styles.title, isExtraSmall ? { fontSize: 18, marginBottom: 2 } : (isSmallScreen && { fontSize: 22, marginBottom: 4 })]}>
                                {isVerified ? "Create New Password" : "Verify Reset Request"}
                            </Text>
                            {!isExtraSmall && (
                                <Text style={[styles.subtitle, isSmallScreen && { fontSize: 12, lineHeight: 16 }]}>
                                    {isVerified
                                        ? "Enter and confirm your strong new password below."
                                        : `Enter the 6-digit code sent to${'\n'}${email}`}
                                </Text>
                            )}
                        </Animated.View>

                        <Animated.View entering={FadeInUp.delay(600).duration(800)} style={[styles.cardContainer, isExtraSmall ? { marginBottom: 8 } : (isSmallScreen && { marginBottom: 12 })]}>
                            <View style={[styles.inputCard, isExtraSmall ? { padding: 12, borderRadius: 12 } : (isSmallScreen && { padding: 16 })]}>
                                <View style={styles.cardContentWrapper}>
                                    {!isVerified ? (
                                        <View key="otp-step">
                                            <View style={styles.otpContainer}>
                                                {code.map((digit, index) => (
                                                    <TextInput
                                                        key={index}
                                                        ref={(ref) => { inputRefs.current[index] = ref; }}
                                                        style={[
                                                            styles.otpBox,
                                                            {
                                                                borderColor: digit ? theme.tint : theme.border,
                                                                color: theme.text,
                                                                backgroundColor: theme.background
                                                            }
                                                        ]}
                                                        maxLength={1}
                                                        keyboardType="number-pad"
                                                        value={digit}
                                                        onChangeText={(text: string) => handleOtpChange(text, index)}
                                                        onKeyPress={(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => handleOtpKeyPress(e, index)}
                                                    />
                                                ))}
                                            </View>
                                            <ThemedButton
                                                title="Verify Gmail"
                                                onPress={handleVerifyCode}
                                                loading={isSubmitting}
                                                disabled={isSubmitting}
                                                style={[styles.verifyButton, isExtraSmall ? { height: 40, borderRadius: 20 } : (isSmallScreen && { height: 44, borderRadius: 22 })]}
                                            />
                                            <TouchableOpacity
                                                onPress={handleResendCode}
                                                disabled={!canResend || isSubmitting}
                                                style={styles.resendContainer}
                                            >
                                                <Text style={[styles.resendText, { color: canResend ? theme.tint : '#999' }]}>
                                                    {canResend ? "Resend Code" : `Resend in ${formatTime(resendTimer)}`}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View key="pass-step">
                                            {/* Error shown above the New Password field */}
                                            <ErrorBanner message={errorMessage} reserved={false} style={{ marginBottom: 12 }} />
                                            <ThemedInput
                                                placeholder="New Password"
                                                value={newPassword}
                                                onChangeText={setNewPassword}
                                                secureTextEntry
                                                height={isExtraSmall ? 38 : (isSmallScreen ? 44 : 56)}
                                                style={{ marginBottom: 12 }}
                                            />
                                            <ThemedInput
                                                placeholder="Confirm Password"
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                                secureTextEntry
                                                height={isExtraSmall ? 38 : (isSmallScreen ? 44 : 56)}
                                                style={{ marginBottom: 16 }}
                                            />
                                            <ThemedButton
                                                title="Reset Password"
                                                onPress={handlePasswordChange}
                                                loading={isSubmitting}
                                                disabled={isSubmitting}
                                                style={[styles.verifyButton, isExtraSmall ? { height: 40, borderRadius: 20 } : (isSmallScreen && { height: 44, borderRadius: 22 })]}
                                            />
                                        </View>
                                    )}
                                </View>
                                {/* OTP step error at the bottom; password step has its own error above */}
                                {!isVerified && <ErrorBanner message={errorMessage} />}
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
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
        fontFamily: Typography.body,
        lineHeight: 22,
    },
    cardContainer: {
        width: '100%',
        marginBottom: 24,
    },
    inputCard: {
        backgroundColor: '#F8F8F8',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        width: '100%',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        width: '100%',
    },
    otpBox: {
        width: 45,
        height: 55,
        borderWidth: 2,
        borderRadius: 10,
        textAlign: 'center',
        fontSize: 24,
        fontFamily: Typography.h1,
    },
    verifyButton: {
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FF5800',
    },
    greetingContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    greetingText: {
        fontSize: 28,
        fontFamily: Typography.h1,
        color: '#D82E3F',
        marginBottom: 10,
    },
    greetingSubtext: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
        fontFamily: Typography.body,
        lineHeight: 22,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    modalIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFF4F4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalButton: {
        width: '100%',
        height: 56,
        borderRadius: 28,
    },
    autoTransitionIndicator: {
        marginTop: 10,
        padding: 8,
        borderRadius: 12,
        backgroundColor: '#F0F0F0',
    },
    autoTransitionText: {
        fontSize: 12,
        fontFamily: Typography.body,
        color: '#666',
    },
    resendContainer: {
        marginTop: 16,
        alignItems: 'center',
    },
    resendText: {
        fontSize: 14,
        fontFamily: Typography.body,
        fontWeight: '600',
    },
    cardContentWrapper: {
        minHeight: 240,
        justifyContent: 'center',
    },
});
