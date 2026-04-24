import { ThemedButton } from '@/components/ui/ThemedButton';
import { ThemedInput } from '@/components/ui/ThemedInput';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import api from '@/lib/api';
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
    View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKGROUND_IMAGE = 'C:\\Users\\Mark\\.gemini\\antigravity\\brain\\83ea3caa-9c54-471f-8005-65dae01c5475\\cozy_japanese_cafe_bg_1776885520916.png';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const [email, setEmail] = useState('');
    const [step, setStep] = useState<'email' | 'otp' | 'reset'>('email');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const backButtonScale = useSharedValue(1);
    const animatedBackStyle = useAnimatedStyle(() => ({
        transform: [{ scale: backButtonScale.value }],
    }));

    const handleSendOtp = async () => {
        Keyboard.dismiss();
        const cleanEmail = email.trim().toLowerCase();
        setAuthError('');
        setStatusMessage('');

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
            await api.post('/send-otp', { email: cleanEmail }, {
                headers: { Accept: 'application/json' },
            });
            setEmail(cleanEmail);
            setStep('otp');
            setStatusMessage(`OTP sent to ${cleanEmail}`);
        } catch (error) {
            const message = (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Failed to send OTP.');
            setAuthError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyOtp = async () => {
        Keyboard.dismiss();
        const cleanEmail = email.trim().toLowerCase();
        const cleanOtp = otp.trim();
        setAuthError('');
        setStatusMessage('');

        if (!cleanOtp) {
            setAuthError('Please enter the OTP code.');
            return;
        }

        try {
            setIsSubmitting(true);
            await api.post('/verify-otp', {
                email: cleanEmail,
                otp: cleanOtp,
            }, {
                headers: { Accept: 'application/json' },
            });
            setStep('reset');
            setStatusMessage('OTP verified. You can now reset your password.');
        } catch (error) {
            const message = (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Invalid or expired OTP.');
            setAuthError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetPassword = async () => {
        Keyboard.dismiss();
        const cleanEmail = email.trim().toLowerCase();
        const newPassword = password;
        const confirmedPassword = confirmPassword;
        setAuthError('');
        setStatusMessage('');

        if (step !== 'reset') {
            setAuthError('Please verify OTP first.');
            return;
        }

        if (!newPassword) {
            setAuthError('Please enter your new password.');
            return;
        }

        if (newPassword.length < 8) {
            setAuthError('Password must be at least 8 characters.');
            return;
        }

        if (newPassword !== confirmedPassword) {
            setAuthError('Passwords do not match.');
            return;
        }

        try {
            setIsSubmitting(true);
            await api.post('/reset-password', {
                email: cleanEmail,
                password: newPassword,
                password_confirmation: confirmedPassword,
            }, {
                headers: { Accept: 'application/json' },
            });
            setStatusMessage('Password reset successful. Please sign in.');
            setTimeout(() => {
                router.replace('/login');
            }, 900);
        } catch (error) {
            const message = (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Failed to reset password.');
            setAuthError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendOtp = async () => {
        const cleanEmail = email.trim().toLowerCase();
        setAuthError('');
        setStatusMessage('');

        try {
            setIsSubmitting(true);
            await api.post('/send-otp', { email: cleanEmail }, {
                headers: { Accept: 'application/json' },
            });
            setStatusMessage(`OTP resent to ${cleanEmail}`);
        } catch (error) {
            const message = (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Failed to resend OTP.');
            setAuthError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
            <Image
                source={{ uri: `file://${BACKGROUND_IMAGE}` }}
                style={StyleSheet.absoluteFillObject}
                blurRadius={2}
            />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255, 255, 255, 0.4)' }]} />

            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.mainContent}>
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
                                <Animated.View style={[animatedBackStyle, styles.backButtonInner, { backgroundColor: 'rgba(255, 255, 255, 0.8)' }]}>
                                    <Ionicons name="chevron-back" size={24} color={theme.tint} />
                                </Animated.View>
                            </TouchableOpacity>

                            <View style={styles.centerSection}>
                                <Animated.View 
                                    entering={FadeInDown.duration(800).springify()}
                                    style={[styles.glassCard, { backgroundColor: 'rgba(255, 255, 255, 0.9)' }]}
                                >
                                    <View style={styles.imageContainer}>
                                        <Image
                                            source={require('../assets/images/chef_forgot.png')}
                                            style={styles.chefImage}
                                            resizeMode="contain"
                                        />
                                    </View>

                                    <Text style={[styles.title, { color: '#2D3436' }]}>
                                        Lost your path?
                                    </Text>
                                    <Text style={[styles.subtitle, { color: '#636E72' }]}>
                                        Oto-San is ready to help you find your way back to the kitchen.
                                    </Text>

                                    <View style={styles.form}>
                                        {step === 'email' ? (
                                            <ThemedInput
                                                placeholder="Enter your registered email"
                                                value={email}
                                                onChangeText={setEmail}
                                                keyboardType="email-address"
                                                style={styles.input}
                                            />
                                        ) : null}

                                        {step === 'otp' ? (
                                            <>
                                                <ThemedInput
                                                    placeholder="Your email"
                                                    value={email}
                                                    onChangeText={setEmail}
                                                    keyboardType="email-address"
                                                    style={styles.input}
                                                />
                                                <ThemedInput
                                                    placeholder="Enter OTP"
                                                    value={otp}
                                                    onChangeText={setOtp}
                                                    keyboardType="number-pad"
                                                    style={styles.input}
                                                />
                                            </>
                                        ) : null}

                                        {step === 'reset' ? (
                                            <>
                                                <ThemedInput
                                                    placeholder="New Password"
                                                    value={password}
                                                    onChangeText={setPassword}
                                                    secureTextEntry
                                                    style={styles.input}
                                                />
                                                <ThemedInput
                                                    placeholder="Confirm New Password"
                                                    value={confirmPassword}
                                                    onChangeText={setConfirmPassword}
                                                    secureTextEntry
                                                    style={styles.input}
                                                />
                                            </>
                                        ) : null}

                                        {authError ? (
                                            <Animated.Text entering={FadeInUp} style={styles.errorText}>
                                                {authError}
                                            </Animated.Text>
                                        ) : null}
                                        {statusMessage ? (
                                            <Animated.Text entering={FadeInUp} style={styles.successText}>
                                                {statusMessage}
                                            </Animated.Text>
                                        ) : null}

                                        <ThemedButton
                                            title={
                                                step === 'email'
                                                    ? 'Send OTP'
                                                    : step === 'otp'
                                                        ? 'Verify OTP'
                                                        : 'Reset Password'
                                            }
                                            onPress={
                                                step === 'email'
                                                    ? handleSendOtp
                                                    : step === 'otp'
                                                        ? handleVerifyOtp
                                                        : handleResetPassword
                                            }
                                            loading={isSubmitting}
                                            disabled={isSubmitting}
                                            style={styles.resetButton}
                                        />
                                        {step === 'otp' ? (
                                            <TouchableOpacity onPress={handleResendOtp} disabled={isSubmitting} style={styles.resendButton}>
                                                <Text style={[styles.resendText, { color: theme.tint }]}>Resend OTP</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>

                                    <View style={styles.returnLink}>
                                        <Text style={styles.returnText}>Wait, I remember now! </Text>
                                        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                                            <Text style={[styles.returnBold, { color: theme.tint }]}>Go back</Text>
                                        </TouchableOpacity>
                                    </View>
                                </Animated.View>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F1E3',
    },
    mainContent: {
        flex: 1,
        paddingHorizontal: 28,
        paddingBottom: 40,
    },
    backButton: {
        marginTop: 20,
        marginBottom: 20,
    },
    backButtonInner: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    centerSection: {
        flex: 1,
        justifyContent: 'center',
    },
    glassCard: {
        borderRadius: 32,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    imageContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    chefImage: {
        width: 100,
        height: 100,
    },
    title: {
        fontSize: 28,
        fontFamily: Typography.h1,
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 15,
        fontFamily: Typography.body,
        color: '#636E72',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    form: {
        width: '100%',
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F2F6',
        marginBottom: 8,
    },
    resetButton: {
        height: 58,
        borderRadius: 18,
        shadowColor: '#D82E3F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 5,
        marginTop: 16,
    },
    errorText: {
        color: '#D82E3F',
        fontSize: 13,
        fontFamily: Typography.body,
        textAlign: 'center',
        marginTop: 4,
    },
    successText: {
        color: '#2E7D32',
        fontSize: 13,
        fontFamily: Typography.body,
        textAlign: 'center',
        marginTop: 4,
    },
    resendButton: {
        alignItems: 'center',
        marginTop: 12,
    },
    resendText: {
        fontSize: 14,
        fontFamily: Typography.button,
        fontWeight: '700',
    },
    returnLink: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
    },
    returnText: {
        fontFamily: Typography.body,
        fontSize: 14,
        color: '#636E72',
    },
    returnBold: {
        fontFamily: Typography.button,
        fontWeight: '700',
    },
});
