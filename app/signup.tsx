import { Checkbox } from '@/components/ui/Checkbox';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { ThemedInput } from '@/components/ui/ThemedInput';
import { Colors, Typography } from '@/constants/theme';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import api from '@/lib/api';
import { AntDesign, FontAwesome, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    TouchableWithoutFeedback,
    View,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKGROUND_IMAGE = 'C:\\Users\\Mark\\.gemini\\antigravity\\brain\\83ea3caa-9c54-471f-8005-65dae01c5475\\cozy_japanese_cafe_bg_1776885520916.png';

type PendingSignupData = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    contactNumber: string;
};

export default function SignupScreen() {
    const router = useRouter();
    const { colors, isDark } = useAppTheme();

    const backButtonScale = useSharedValue(1);
    const animatedBackStyle = useAnimatedStyle(() => ({
        transform: [{ scale: backButtonScale.value }],
    }));

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [modalType, setModalType] = useState<'terms' | 'privacy'>('terms');
    const [contactNumber, setContactNumber] = useState('');
    const [authError, setAuthError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{
        name?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
        terms?: string;
        contactNumber?: string;
    }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingSignupData, setPendingSignupData] = useState<PendingSignupData | null>(null);

    // Verification Modal State
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationError, setVErr] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [resendMessage, setResendMessage] = useState('');
    const [isResending, setIsResending] = useState(false);
    const [resendTimer, setResendTimer] = useState(30);

    // Timer effect for resend
    React.useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (showVerificationModal && resendTimer > 0) {
            timer = setTimeout(() => setResendTimer(t => t - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [resendTimer, showVerificationModal]);

    // Success Modal State
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const successScale = useSharedValue(0);
    const checkmarkScale = useSharedValue(0);

    const handleSignup = async () => {
        const cleanFirstName = firstName.trim();
        const cleanLastName = lastName.trim();
        const cleanEmail = email.trim().toLowerCase();

        setAuthError('');
        setFieldErrors({});

        const errors: typeof fieldErrors = {};
        const nameOnlyLetters = /^[a-zA-Z\s\-']+$/;

        if (!cleanFirstName || !cleanLastName) {
            errors.name = 'First and last name are required.';
        } else if (!nameOnlyLetters.test(cleanFirstName)) {
            errors.name = 'First name must contain letters only.';
        } else if (!nameOnlyLetters.test(cleanLastName)) {
            errors.name = 'Last name must contain letters only.';
        }

        if (!cleanEmail) {
            errors.email = 'Email address is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            errors.email = 'Please enter a valid email address.';
        }

        if (!password) {
            errors.password = 'Password is required.';
        } else if (password.length < 8) {
            errors.password = 'Password must be at least 8 characters.';
        } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            errors.password = 'Password must have uppercase, lowercase letters & a number.';
        }

        if (!confirmPassword) {
            errors.confirmPassword = 'Please confirm your password.';
        } else if (password !== confirmPassword) {
            errors.confirmPassword = 'Passwords do not match.';
        }

        if (!agreeTerms) {
            errors.terms = 'You must agree to the Terms and Conditions.';
        }

        if (!contactNumber.trim()) {
            errors.contactNumber = 'Mobile number is required.';
        } else if (!/^\d{10}$/.test(contactNumber.trim().replace(/\s/g, ''))) {
            errors.contactNumber = 'Enter 10 digits (9XXXXXXXXX).';
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        try {
            setIsSubmitting(true);
            await api.post('/send-otp', { email: cleanEmail }, {
                headers: { Accept: 'application/json' },
            });
            const sentTo = cleanEmail;

            setPendingSignupData({
                firstName: cleanFirstName,
                lastName: cleanLastName,
                email: sentTo,
                password,
                contactNumber: `+63${contactNumber.trim().replace(/\s/g, '')}`,
            });

            setShowVerificationModal(true);
            setVerificationCode('');
            setResendTimer(30);
            setResendMessage(`Verification code sent to ${sentTo}`);
        } catch (error) {
            const message = (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Failed to send OTP.');
            setAuthError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyCode = async () => {
        const cleanCode = verificationCode.trim();
        setVErr('');

        if (cleanCode.length < 4) {
            setVErr('Please enter the verification code.');
            return;
        }

        if (!pendingSignupData) {
            setVErr('Signup session expired. Please try again.');
            return;
        }

        try {
            setIsVerifying(true);
            const verificationEmail = pendingSignupData.email;
            await api.post('/verify-otp', {
                email: verificationEmail,
                otp: cleanCode,
            }, {
                headers: { Accept: 'application/json' },
            });

            await api.post('/register', {
                first_name: pendingSignupData.firstName,
                last_name: pendingSignupData.lastName,
                mobile_number: pendingSignupData.contactNumber,
                email: pendingSignupData.email,
                password: pendingSignupData.password,
            }, {
                headers: { Accept: 'application/json' },
            });

            setShowVerificationModal(false);
            setShowSuccessModal(true);

            successScale.value = withSequence(withTiming(1.2, { duration: 300 }), withTiming(1, { duration: 200 }));
            checkmarkScale.value = withSequence(withTiming(1.3, { duration: 400 }), withTiming(1, { duration: 300 }));

            setTimeout(() => {
                setShowSuccessModal(false);
                setPendingSignupData(null);
                router.replace('/login');
            }, 2500);
        } catch (error) {
            const message = (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Invalid or expired OTP.');
            setVErr(message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResendCode = async () => {
        if (!pendingSignupData) {
            setVErr('Signup session expired. Please try again.');
            return;
        }

        setVErr('');
        setResendMessage('');

        try {
            setIsResending(true);
            await api.post('/send-otp', { email: pendingSignupData.email }, {
                headers: { Accept: 'application/json' },
            });
            setResendTimer(30);
            setResendMessage(`New code sent to ${pendingSignupData.email}`);
        } catch (error) {
            const message = (error as any)?.response?.data?.message || 'Failed to resend OTP. Please try again.';
            setVErr(message);
        } finally {
            setIsResending(false);
        }
    };

    return (
        <View style={styles.container}>
            <Image
                source={{ uri: `file://${BACKGROUND_IMAGE}` }}
                style={StyleSheet.absoluteFillObject}
                blurRadius={2}
            />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.5)' }]} />

            <SafeAreaView style={{ flex: 1 }}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'position' : undefined}
                        style={{ flex: 1 }}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? -20 : 0}
                    >
                        <View style={styles.mainContent}>
                            <View style={styles.topSection}>
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
                                        <Animated.View style={[animatedBackStyle, styles.backButtonInner, { backgroundColor: colors.surface }]}>
                                            <Ionicons name="chevron-back" size={24} color={colors.primary} />
                                        </Animated.View>
                                    </TouchableOpacity>

                                <Animated.View
                                    entering={FadeInDown.duration(800)}
                                    style={styles.header}
                                >
                                    <Text style={[styles.title, { color: colors.heading }]}>
                                        Join the Kitchen
                                    </Text>
                                    <Text style={[styles.subtitle, { color: colors.text }]}>
                                        Create your <Text style={{ fontFamily: Typography.brand, color: colors.primary }}>Maki Desu</Text> account for a premium dining experience.
                                    </Text>
                                </Animated.View>
                            </View>

                            <Animated.View
                                entering={FadeInUp.delay(200).duration(1000)}
                                style={[styles.signupCard, { backgroundColor: colors.surface, shadowColor: colors.primary }]}
                            >
                                <View style={styles.socialRow}>
                                    <TouchableOpacity style={[styles.socialIconButton, { backgroundColor: colors.background }]}>
                                        <AntDesign name="google" size={22} color="#DB4437" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.socialIconButton, { backgroundColor: colors.background }]}>
                                        <Ionicons name="logo-apple" size={22} color={colors.heading} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: colors.primary + '1A' }]} />
                                    <Text style={[styles.dividerLabel, { color: colors.text }]}>Or register with email</Text>
                                    <View style={[styles.dividerLine, { backgroundColor: colors.primary + '1A' }]} />
                                </View>

                                {authError ? <Text style={styles.mainError}>{authError}</Text> : null}

                                <View style={styles.form}>
                                    <View style={styles.nameRow}>
                                        <View style={{ flex: 1 }}>
                                            <ThemedInput
                                                placeholder="First Name"
                                                value={firstName}
                                                onChangeText={(t) => {
                                                    setFirstName(t.replace(/\s{2,}/g, ' '));
                                                    setFieldErrors(e => ({ ...e, name: undefined }));
                                                }}
                                                style={styles.input}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <ThemedInput
                                                placeholder="Last Name"
                                                value={lastName}
                                                onChangeText={(t) => {
                                                    setLastName(t.replace(/\s{2,}/g, ' '));
                                                    setFieldErrors(e => ({ ...e, name: undefined }));
                                                }}
                                                style={styles.input}
                                            />
                                        </View>
                                    </View>
                                    {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}

                                    <View style={[styles.phoneInputContainer, { backgroundColor: colors.background, borderColor: fieldErrors.contactNumber ? '#D82E3F' : colors.primary + '1A' }]}>
                                        <View style={[styles.phonePrefix, { backgroundColor: colors.surface, borderRightColor: colors.primary + '1A' }]}>
                                            <Text style={[styles.phonePrefixText, { color: colors.heading }]}>+63</Text>
                                        </View>
                                        <TextInput
                                            placeholder="Mobile Number (9XXXXXXXXX)"
                                            placeholderTextColor={colors.text}
                                            value={contactNumber}
                                            onChangeText={(t) => {
                                                const cleaned = t.replace(/[^0-9]/g, '').slice(0, 10);
                                                setContactNumber(cleaned);
                                                setFieldErrors(e => ({ ...e, contactNumber: undefined }));
                                            }}
                                            keyboardType="phone-pad"
                                            style={[styles.phoneTextInput, { color: colors.heading }]}
                                        />
                                    </View>
                                    {fieldErrors.contactNumber ? <Text style={styles.fieldError}>{fieldErrors.contactNumber}</Text> : null}

                                    <ThemedInput
                                        placeholder="Email Address"
                                        value={email}
                                        onChangeText={(t) => { setEmail(t); setFieldErrors(e => ({ ...e, email: undefined })); }}
                                        keyboardType="email-address"
                                        style={styles.input}
                                    />
                                    {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}

                                    <ThemedInput
                                        placeholder="Password"
                                        value={password}
                                        onChangeText={(t) => { setPassword(t); setFieldErrors(e => ({ ...e, password: undefined })); }}
                                        secureTextEntry
                                        style={styles.input}
                                    />
                                    {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}

                                    <ThemedInput
                                        placeholder="Confirm Password"
                                        value={confirmPassword}
                                        onChangeText={(t) => { setConfirmPassword(t); setFieldErrors(e => ({ ...e, confirmPassword: undefined })); }}
                                        secureTextEntry
                                        style={styles.input}
                                    />
                                    {fieldErrors.confirmPassword ? <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text> : null}

                                    <View style={styles.termsRow}>
                                        <Checkbox
                                            label=""
                                            checked={agreeTerms}
                                            onPress={() => setAgreeTerms(!agreeTerms)}
                                        />
                                        <Text style={[styles.termsText, { color: colors.text }]}>
                                            I agree to the <Text style={[styles.termsLink, { color: colors.primary }]} onPress={() => { setModalType('terms'); setShowTermsModal(true); }}>Terms & Conditions</Text>
                                        </Text>
                                    </View>
                                    {fieldErrors.terms ? <Text style={styles.fieldError}>{fieldErrors.terms}</Text> : null}

                                    <ThemedButton
                                        title="Create Account"
                                        onPress={handleSignup}
                                        loading={isSubmitting}
                                        disabled={isSubmitting}
                                        style={[styles.signupButton, { shadowColor: colors.primary }]}
                                    />

                                    <View style={styles.loginPrompt}>
                                        <Text style={[styles.loginText, { color: colors.text }]}>Already a member? </Text>
                                        <TouchableOpacity 
                                            onPress={() => router.replace('/login')}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.loginLink, { color: colors.primary }]}>Sign In</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </Animated.View>
                        </View>

                        <Modal
                            animationType="slide"
                            transparent={true}
                            visible={showTermsModal}
                            onRequestClose={() => setShowTermsModal(false)}
                        >
                            <View style={styles.modalOverlay}>
                                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                                    <View style={styles.modalHeader}>
                                        <Text style={[styles.modalTitle, { color: colors.primary }]}>
                                            {modalType === 'terms' ? 'Terms and Conditions' : 'Privacy Policy'}
                                        </Text>
                                        <TouchableOpacity onPress={() => setShowTermsModal(false)}>
                                            <Ionicons name="close" size={24} color={colors.heading} />
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                        <Text style={[styles.termsBodyText, { color: colors.text }]}>
                                            {modalType === 'terms' ? `
Welcome to MakiDesu!

1. Premium Experience: Our app provides a premium Japanese dining experience at your fingertips. By using this app, you agree to our service standards.

2. Freshness Guarantee: All orders are prepared fresh upon confirmation. We follow the principle of "Omotenashi" (Japanese hospitality), ensuring the highest quality in every dish.

3. Order Responsibility: Please ensure your contact and delivery details are correct. Cancellations are only accepted within 2 minutes of order placement.

4. Account Security: You are responsible for maintaining the confidentiality of your account credentials.

5. Termination: We reserve the right to suspend accounts that violate our community standards or engage in fraudulent activities.` : `
MakiDesu Privacy Commitment

1. Data Collection: We collect your name and email to provide a personalized dining experience.

2. Purpose of Use: Your data is used for account verification, secure transactions, and order updates.

3. Secure Storage: We utilize industry-standard encryption to protect your personal information from unauthorized access.

4. Third-Party Sharing: We do NOT sell your data. Information is only shared with trusted delivery partners to fulfill your orders.

5. Your Rights: You can update your profile or request account deletion at any time through the app settings.`}
                                        </Text>
                                    </ScrollView>
                                    <ThemedButton
                                        title="Close"
                                        onPress={() => setShowTermsModal(false)}
                                        style={styles.modalCloseButton}
                                    />
                                </View>
                            </View>
                        </Modal>

                        <Modal
                            animationType="slide"
                            transparent={true}
                            visible={showVerificationModal}
                            onRequestClose={() => setShowVerificationModal(false)}
                        >
                            <View style={styles.verificationModalOverlay}>
                                <KeyboardAvoidingView
                                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                                    style={{ width: '100%', justifyContent: 'flex-end' }}
                                >
                                    <View style={[styles.verificationModalContent, { backgroundColor: colors.surface }]}>
                                        <View style={styles.verificationModalHeader}>
                                            <Ionicons name="mail-unread-outline" size={32} color={colors.primary} />
                                            <Text style={[styles.verificationModalTitle, { color: colors.primary }]}>
                                                Verify Your Email
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setShowVerificationModal(false);
                                                    setPendingSignupData(null);
                                                }}
                                            >
                                                <Ionicons name="close" size={24} color={colors.heading} />
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={[styles.verificationModalSubtitle, { color: colors.text }]}>
                                            We have sent a verification code to your email. Please enter the 6-digit code below.
                                        </Text>

                                        <View style={styles.verificationInputContainer}>
                                            <ThemedInput
                                                placeholder="Enter 6-digit code"
                                                value={verificationCode}
                                                onChangeText={setVerificationCode}
                                                keyboardType="number-pad"
                                                height={56}
                                            />
                                        </View>

                                        {verificationError ? <Text style={styles.fieldError}>{verificationError}</Text> : null}
                                        {resendMessage ? <Text style={styles.resendInfoText}>{resendMessage}</Text> : null}

                                        <ThemedButton
                                            title="Verify & Create Account"
                                            onPress={handleVerifyCode}
                                            loading={isVerifying}
                                            disabled={isVerifying}
                                            style={styles.verifyButton}
                                        />

                                        <TouchableOpacity
                                            onPress={handleResendCode}
                                            disabled={isResending || resendTimer > 0}
                                            style={styles.resendButton}
                                        >
                                            <Text style={[styles.resendButtonText, { color: colors.text }]}>
                                                Did not receive code?{' '}
                                                <Text style={[styles.resendLinkText, { color: resendTimer > 0 ? colors.text + '80' : colors.primary }]}>
                                                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : (isResending ? 'Resending...' : 'Resend')}
                                                </Text>
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </KeyboardAvoidingView>
                            </View>
                        </Modal>

                        <Modal
                            animationType="fade"
                            transparent={true}
                            visible={showSuccessModal}
                            onRequestClose={() => { }}
                        >
                            <View style={[styles.successModalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)' }]}>
                                <Animated.View
                                    style={[
                                        styles.successModalContent,
                                        { backgroundColor: colors.surface, transform: [{ scale: successScale }] }
                                    ]}
                                >
                                    <View style={styles.confettiContainer}>
                                        {[...Array(20)].map((_, i) => (
                                            <Animated.View
                                                key={i}
                                                style={[
                                                    styles.confetti,
                                                    {
                                                        left: `${Math.random() * 100}%`,
                                                        backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C00'][i % 7],
                                                        transform: [{ rotate: `${Math.random() * 360}deg` }],
                                                    }
                                                ]}
                                            />
                                        ))}
                                    </View>

                                    <Animated.View style={{ transform: [{ scale: checkmarkScale }] }}>
                                        <View style={[styles.successIconContainer, { backgroundColor: colors.background }]}>
                                            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                                        </View>
                                    </Animated.View>

                                    <Text style={[styles.successTitle, { color: colors.heading }]}>Account Created!</Text>
                                    <Text style={[styles.successMessage, { color: colors.text }]}>
                                        Welcome to MakiDesu! Your account has been successfully created.
                                    </Text>
                                </Animated.View>
                            </View>
                        </Modal>
                    </KeyboardAvoidingView>
                </TouchableWithoutFeedback>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    mainContent: {
        flex: 1,
        paddingHorizontal: 24,
        paddingBottom: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 30,
    },
    topSection: {
        marginTop: 0,
        marginBottom: 12,
    },
    backButton: {
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    backButtonInner: {
        width: 38,
        height: 38,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        alignItems: 'flex-start',
    },
    title: {
        fontSize: 22,
        fontFamily: Typography.h1,
    },
    subtitle: {
        fontSize: 12,
        fontFamily: Typography.body,
        marginTop: 2,
        lineHeight: 16,
    },
    signupCard: {
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 12,
    },
    socialIconButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerLabel: {
        marginHorizontal: 12,
        fontSize: 11,
        fontFamily: Typography.body,
        color: '#B2BEC3',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    form: {
        gap: 8,
    },
    nameRow: {
        flexDirection: 'row',
        gap: 8,
    },
    input: {
        borderRadius: 12,
        borderWidth: 1,
        height: 48,
    },
    phoneInputContainer: {
        flexDirection: 'row',
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    phonePrefix: {
        paddingHorizontal: 16,
        justifyContent: 'center',
        borderRightWidth: 1,
    },
    phonePrefixText: {
        fontSize: 16,
        fontFamily: Typography.button,
        color: '#2D3436',
    },
    phoneTextInput: {
        flex: 1,
        paddingHorizontal: 16,
        fontSize: 16,
        fontFamily: Typography.body,
        color: '#2D3436',
    },
    termsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    termsText: {
        fontSize: 13,
        fontFamily: Typography.body,
        color: '#636E72',
    },
    termsLink: {
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    signupButton: {
        height: 52,
        borderRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        marginTop: 8,
    },
    loginPrompt: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    loginText: {
        fontSize: 14,
        fontFamily: Typography.body,
        color: '#636E72',
    },
    loginLink: {
        fontWeight: '700',
    },
    fieldError: {
        color: '#D82E3F',
        fontSize: 12,
        fontFamily: Typography.body,
        marginTop: -8,
        paddingLeft: 4,
    },
    mainError: {
        color: '#D82E3F',
        fontSize: 13,
        fontFamily: Typography.body,
        textAlign: 'center',
        marginBottom: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        padding: 32,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 24,
        fontFamily: Typography.h1,
    },
    modalBody: {
        marginBottom: 30,
    },
    termsBodyText: {
        fontSize: 15,
        fontFamily: Typography.body,
        lineHeight: 24,
        color: '#636E72',
    },
    modalCloseButton: {
        height: 54,
        borderRadius: 16,
    },
    verificationModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    verificationModalContent: {
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        padding: 32,
    },
    verificationModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    verificationModalTitle: {
        fontSize: 24,
        fontFamily: Typography.h1,
        flex: 1,
    },
    verificationModalSubtitle: {
        fontSize: 15,
        fontFamily: Typography.body,
        lineHeight: 22,
        marginBottom: 24,
        opacity: 0.8,
    },
    verificationInputContainer: {
        marginBottom: 20,
    },
    verifyButton: {
        height: 56,
        borderRadius: 16,
        marginTop: 12,
    },
    resendButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    resendButtonText: {
        fontSize: 14,
        fontFamily: Typography.body,
    },
    resendLinkText: {
        fontWeight: '700',
    },
    resendInfoText: {
        fontSize: 12,
        color: '#4CAF50',
        textAlign: 'center',
        marginBottom: 8,
    },
    successModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successModalContent: {
        width: '85%',
        padding: 40,
        borderRadius: 32,
        backgroundColor: '#FFF',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 20,
    },
    successIconContainer: {
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 28,
        fontFamily: Typography.h1,
        color: '#2D3436',
        textAlign: 'center',
        marginBottom: 12,
    },
    successMessage: {
        fontSize: 16,
        fontFamily: Typography.body,
        color: '#636E72',
        textAlign: 'center',
        lineHeight: 24,
    },
    confettiContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
    },
    confetti: {
        position: 'absolute',
        top: -10,
        width: 10,
        height: 10,
        borderRadius: 2,
    },
});
