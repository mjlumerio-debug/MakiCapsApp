import { Checkbox } from '@/components/ui/Checkbox';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { ThemedInput } from '@/components/ui/ThemedInput';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { requestEmailVerificationCode, signupUser, verifyEmailCode } from '@/lib/auth_api';
import { clearPendingSignup, getPendingSignup, setPendingSignup } from '@/lib/signup_flow';
import {AntDesign, FontAwesome, Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignupScreen() {
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

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
    const [birthday, setBirthday] = useState<Date | null>(null);
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

    // Form helpers removed: Birthday field replaced by Contact Number

    const handleSignup = async () => {
        const cleanFirstName = firstName.trim();
        const cleanLastName = lastName.trim();
        const cleanEmail = email.trim().toLowerCase();

        // Clear all errors
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
            const response = await requestEmailVerificationCode(cleanEmail);
            const sentTo = response.sentTo || cleanEmail;

            setPendingSignup({
                firstName: cleanFirstName,
                lastName: cleanLastName,
                email: sentTo,
                password,
                contactNumber: `+63${contactNumber.trim().replace(/\s/g, '')}`,
            });

            // Show verification modal
            setShowVerificationModal(true);
            setVerificationCode('');
            setResendTimer(30);
            setResendMessage(`Verification code sent to ${sentTo}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to send verification code.';
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

        const pendingSignupData = getPendingSignup();
        if (!pendingSignupData) {
            setVErr('Signup session expired. Please try again.');
            return;
        }

        try {
            setIsVerifying(true);
            const verificationEmail = pendingSignupData.email;
            const verification = await verifyEmailCode(verificationEmail, cleanCode);
            await signupUser({
                firstName: pendingSignupData.firstName,
                lastName: pendingSignupData.lastName,
                email: pendingSignupData.email,
                password: pendingSignupData.password,
                verificationProof: verification.verificationProof,
                contactNumber: pendingSignupData.contactNumber,
            });

            // Show success modal with celebration
            setShowVerificationModal(false);
            setShowSuccessModal(true);

            // Animate success modal
            successScale.value = withSequence(withTiming(1.2, { duration: 300 }), withTiming(1, { duration: 200 }));
            checkmarkScale.value = withSequence(withTiming(1.3, { duration: 400 }), withTiming(1, { duration: 300 }));

            // Redirect after delay
            setTimeout(() => {
                setShowSuccessModal(false);
                clearPendingSignup();
                router.replace('/login');
            }, 2500);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Invalid verification code.';
            setVErr(message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResendCode = async () => {
        const pendingSignupData = getPendingSignup();
        if (!pendingSignupData) {
            setVErr('Signup session expired. Please try again.');
            return;
        }

        setVErr('');
        setResendMessage('');

        try {
            setIsResending(true);
            await requestEmailVerificationCode(pendingSignupData.email);
            setResendTimer(30);
            setResendMessage(`New code sent to ${pendingSignupData.email}`);
        } catch {
            setVErr('Failed to resend code. Please try again.');
        } finally {
            setIsResending(false);
        }
    };

    // Responsive scaling
    const isSmallScreen = height < 750;
    const isExtraSmall = height < 650;
    const imageSize = Math.min(width * 0.22, 100);
    const verticalGap = isExtraSmall ? 4 : (isSmallScreen ? 12 : 24);


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
                    <View style={[styles.mainContent, { paddingVertical: isExtraSmall ? 6 : (isSmallScreen ? 12 : 20) }]}>
                        <View>
                            <TouchableOpacity
                                onPress={() => router.back()}
                                onPressIn={() => {
                                    backButtonScale.value = withSpring(0.8);
                                }}
                                onPressOut={() => {
                                    backButtonScale.value = withSpring(1);
                                }}
                                style={[styles.backButton, isExtraSmall && { marginBottom: 2 }]}
                            >
                                <Animated.View style={animatedBackStyle}>
                                    <Ionicons name="chevron-back" size={isExtraSmall ? 18 : 22} color={theme.text} />
                                </Animated.View>
                            </TouchableOpacity>

                            {!isExtraSmall && (
                                <Animated.View entering={FadeInDown.duration(600)} style={[styles.header, { marginBottom: isSmallScreen ? 4 : verticalGap }]}>
                                    <Image
                                        source={require('../assets/images/chef_tech.png')}
                                        style={[styles.image, { width: isSmallScreen ? imageSize * 0.9 : imageSize * 1.2, height: isSmallScreen ? imageSize * 0.9 : imageSize * 1.2, borderRadius: 20 }]}
                                        resizeMode="contain"
                                    />
                                    <Text style={[styles.title, { color: theme.tint }, isSmallScreen && { fontSize: 18, marginBottom: 2 }]}>Create Account</Text>
                                    <Text style={[styles.subtitle, { color: theme.text, fontFamily: Typography.body }, isSmallScreen && { fontSize: 11, lineHeight: 14 }]}>
                                        <Text style={{ fontFamily: Typography.brand }}>MakiDesu</Text>: Authentic Japanese Cuisine, Swiftly Delivered.
                                    </Text>
                                </Animated.View>
                            )}
                            {isExtraSmall && (
                                <Text style={[styles.title, { color: theme.tint, fontSize: 16, textAlign: 'center', marginBottom: 4 }]}>Create Account</Text>
                            )}
                        </View>

                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Animated.View
                                entering={FadeInDown.delay(200).duration(600).springify()}
                                style={[styles.socialContainer, { marginBottom: isExtraSmall ? 8 : (isSmallScreen ? 12 : verticalGap) }]}
                            >
                                <ThemedButton
                                    title=""
                                    variant="social"
                                    onPress={() => { }}
                                    icon={<AntDesign name="google" size={isExtraSmall ? 18 : (isSmallScreen ? 20 : 24)} color="#DB4437" />}
                                    style={[styles.socialBtn, isExtraSmall ? { width: 36, height: 36 } : (isSmallScreen && { width: 40, height: 40 })]}
                                />
                                <ThemedButton
                                    title=""
                                    variant="social"
                                    onPress={() => { }}
                                    icon={<FontAwesome name="facebook" size={isExtraSmall ? 18 : (isSmallScreen ? 20 : 24)} color="#4267B2" />}
                                    style={[styles.socialBtn, isExtraSmall ? { width: 36, height: 36 } : (isSmallScreen && { width: 40, height: 40 })]}
                                />
                                <ThemedButton
                                    title=""
                                    variant="social"
                                    onPress={() => { }}
                                    icon={<Ionicons name="logo-apple" size={isExtraSmall ? 18 : (isSmallScreen ? 20 : 24)} color="#000000" />}
                                    style={[styles.socialBtn, isExtraSmall ? { width: 36, height: 36 } : (isSmallScreen && { width: 40, height: 40 })]}
                                />
                            </Animated.View>

                            <Animated.View
                                entering={FadeInDown.delay(300).duration(600)}
                                style={[styles.dividerContainer, { marginBottom: isExtraSmall ? 8 : (isSmallScreen ? 12 : verticalGap) }]}
                            >
                                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                                <Text style={[styles.dividerText, { color: theme.text, fontSize: isExtraSmall ? 7 : (isSmallScreen ? 8 : 10) }]}>Or sign up with email</Text>
                                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            </Animated.View>

                            <Animated.View entering={FadeInUp.delay(400).duration(600)} style={[styles.section, { marginBottom: isExtraSmall ? 4 : (isSmallScreen ? 6 : verticalGap) }]}>
                                <View style={styles.row}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <ThemedInput
                                            placeholder="First Name"
                                            value={firstName}
                                            onChangeText={(t) => {
                                                // Normalize: collapse multiple spaces live as user types
                                                setFirstName(t.replace(/\s{2,}/g, ' '));
                                                setFieldErrors(e => ({ ...e, name: undefined }));
                                            }}
                                            height={isExtraSmall ? 36 : (isSmallScreen ? 40 : 56)}
                                            style={isSmallScreen ? { marginBottom: 2 } : {}}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <ThemedInput
                                            placeholder="Last Name"
                                            value={lastName}
                                            onChangeText={(t) => {
                                                // Normalize: collapse multiple spaces live as user types
                                                setLastName(t.replace(/\s{2,}/g, ' '));
                                                setFieldErrors(e => ({ ...e, name: undefined }));
                                            }}
                                            height={isExtraSmall ? 36 : (isSmallScreen ? 40 : 56)}
                                            style={isSmallScreen ? { marginBottom: 2 } : {}}
                                        />
                                    </View>
                                </View>
                                {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}
                            </Animated.View>

                            <Animated.View entering={FadeInUp.delay(450).duration(600)} style={[styles.section, { marginBottom: isExtraSmall ? 4 : (isSmallScreen ? 6 : verticalGap) }]}>
                                <View style={[
                                    styles.phoneInputRow, 
                                    { 
                                        backgroundColor: theme.background, 
                                        borderColor: fieldErrors.contactNumber ? '#C62828' : theme.border,
                                        height: isExtraSmall ? 36 : (isSmallScreen ? 40 : 56)
                                    }
                                ]}>
                                    <View style={styles.phonePrefixContainer}>
                                        <Ionicons name="call-outline" size={isExtraSmall ? 16 : 18} color={theme.tint} />
                                        <Text style={[styles.phonePrefixText, { color: theme.text, fontSize: isExtraSmall ? 14 : 16 }]}>+63</Text>
                                    </View>
                                    <View style={[styles.phonePrefixDivider, { backgroundColor: theme.border }]} />
                                    <TextInput
                                        placeholder="9XXXXXXXXX"
                                        placeholderTextColor={theme.gray === '#F8F8F8' ? '#999' : '#666'}
                                        value={contactNumber}
                                        onChangeText={(t: string) => { 
                                            // Only allow digits and limit to 10
                                            const cleaned = t.replace(/[^0-9]/g, '').slice(0, 10);
                                            setContactNumber(cleaned); 
                                            setFieldErrors(e => ({ ...e, contactNumber: undefined })); 
                                        }}
                                        keyboardType="phone-pad"
                                        style={[styles.phoneInput, { color: theme.text, fontSize: isExtraSmall ? 14 : 16 }]}
                                    />
                                </View>
                                {fieldErrors.contactNumber ? <Text style={styles.fieldError}>{fieldErrors.contactNumber}</Text> : null}
                            </Animated.View>

                            <Animated.View entering={FadeInUp.delay(500).duration(600)} style={[styles.section, { marginBottom: isExtraSmall ? 4 : (isSmallScreen ? 6 : verticalGap) }]}>
                                <ThemedInput
                                    placeholder="Email Address"
                                    value={email}
                                    onChangeText={(t) => { setEmail(t); setFieldErrors(e => ({ ...e, email: undefined })); }}
                                    keyboardType="email-address"
                                    height={isExtraSmall ? 36 : (isSmallScreen ? 40 : 56)}
                                    style={isSmallScreen ? { marginBottom: 2 } : {}}
                                />
                                {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
                                <View style={[styles.row, { marginTop: fieldErrors.email ? 4 : 0 }]}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <ThemedInput
                                            placeholder="Password"
                                            value={password}
                                            onChangeText={(t) => { setPassword(t); setFieldErrors(e => ({ ...e, password: undefined })); }}
                                            secureTextEntry
                                            height={isExtraSmall ? 36 : (isSmallScreen ? 40 : 56)}
                                            style={isSmallScreen ? { marginBottom: 2 } : {}}
                                        />
                                        {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <ThemedInput
                                            placeholder="Confirm Password"
                                            value={confirmPassword}
                                            onChangeText={(t) => { setConfirmPassword(t); setFieldErrors(e => ({ ...e, confirmPassword: undefined })); }}
                                            secureTextEntry
                                            height={isExtraSmall ? 36 : (isSmallScreen ? 40 : 56)}
                                            style={isSmallScreen ? { marginBottom: 2 } : {}}
                                        />
                                        {fieldErrors.confirmPassword ? <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text> : null}
                                    </View>
                                </View>
                            </Animated.View>

                            <Animated.View entering={FadeInUp.delay(600).duration(600)} style={[styles.section, { marginBottom: isExtraSmall ? 4 : (isSmallScreen ? 6 : verticalGap) }]}>
                                <View style={styles.checkboxRow}>
                                    <Checkbox
                                        label=""
                                        checked={agreeTerms}
                                        onPress={() => setAgreeTerms(!agreeTerms)}
                                        style={isExtraSmall ? { transform: [{ scale: 0.8 }] } : {}}
                                    />
                                    <View style={styles.termsTextContainer}>
                                        <Text style={[styles.termsText, { color: theme.text, fontSize: isExtraSmall ? 10 : 13 }]}>
                                            I agree to the{' '}
                                            <Text
                                                style={[styles.termsLink, { color: theme.tint }]}
                                                onPress={() => { setModalType('terms'); setShowTermsModal(true); }}
                                            >
                                                Term and Conditions
                                            </Text>
                                        </Text>
                                    </View>
                                </View>
                            </Animated.View>
                        </View>

                        <Animated.View entering={FadeInUp.delay(800).duration(600)} style={{ paddingTop: isExtraSmall ? 2 : (isSmallScreen ? 2 : 10), paddingBottom: isExtraSmall ? 16 : 30 }}>
                            {fieldErrors.terms ? <Text style={[styles.fieldError, { marginBottom: 8 }]}>{fieldErrors.terms}</Text> : null}
                            {authError ? <Text style={[styles.fieldError, { marginBottom: 8 }]}>{authError}</Text> : null}
                            <ThemedButton
                                title="Create My Account"
                                onPress={handleSignup}
                                loading={isSubmitting}
                                disabled={isSubmitting}
                                style={[styles.signupButton, isExtraSmall ? { height: 40, borderRadius: 20 } : (isSmallScreen && { height: 44, borderRadius: 22 }), { marginBottom: 16 }]}
                            />

                            <TouchableOpacity onPress={() => router.replace('/login')} style={[styles.loginLink, isExtraSmall ? { marginTop: 4 } : (isSmallScreen && { marginTop: 6 })]}>
                                <Text style={[styles.loginLinkText, { color: theme.text, fontSize: isExtraSmall ? 10 : (isSmallScreen ? 12 : 14) }]}>
                                    Already have an account? <Text style={[styles.loginLinkBold, { color: theme.tint }]}>Login</Text>
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>


                    <Modal
                        animationType="slide"
                        transparent={true}
                        visible={showTermsModal}
                        onRequestClose={() => setShowTermsModal(false)}
                    >
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
                                <View style={styles.modalHeader}>
                                    <Text style={[styles.modalTitle, { color: theme.tint }]}>
                                        {modalType === 'terms' ? 'Term and Conditions' : 'Privacy Policy'}
                                    </Text>
                                    <TouchableOpacity onPress={() => setShowTermsModal(false)}>
                                        <Ionicons name="close" size={24} color={theme.text} />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                    {modalType === 'terms' ? (
                                        <Text style={[styles.termsBodyText, { color: theme.text }]}>
                                            {`
Welcome to MakiDesu!

1. Premium Experience: Our app provides a premium Japanese dining experience at your fingertips. By using this app, you agree to our service standards.

2. Freshness Guarantee: All orders are prepared fresh upon confirmation. We follow the principle of "Omotenashi" (Japanese hospitality), ensuring the highest quality in every dish.

3. Order Responsibility: Please ensure your contact and delivery details are correct. Cancellations are only accepted within 2 minutes of order placement.

4. Account Security: You are responsible for maintaining the confidentiality of your account credentials.

5. Termination: We reserve the right to suspend accounts that violate our community standards or engage in fraudulent activities.`}
                                        </Text>
                                    ) : (
                                        <Text style={[styles.termsBodyText, { color: theme.text }]}>
                                            {`
MakiDesu Privacy Commitment

1. Data Collection: We collect your name and email to provide a personalized dining experience.

2. Purpose of Use: Your data is used for account verification, secure transactions, and order updates.

3. Secure Storage: We utilize industry-standard encryption to protect your personal information from unauthorized access.

4. Third-Party Sharing: We do NOT sell your data. Information is only shared with trusted delivery partners to fulfill your orders.

5. Your Rights: You can update your profile or request account deletion at any time through the app settings.

6. Cookies & Tracking: We use minimal tracking to improve app performance and understand your dining preferences for better recommendations.`}
                                        </Text>
                                    )}
                                </ScrollView>
                                <ThemedButton
                                    title="Close"
                                    onPress={() => setShowTermsModal(false)}
                                    style={styles.modalCloseButton}
                                />
                            </View>
                        </View>
                    </Modal>

                    {/* Email Verification Modal */}
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
                                <View style={[styles.verificationModalContent, { backgroundColor: theme.background }]}>
                                    <View style={styles.verificationModalHeader}>
                                        <Ionicons name="mail-unread-outline" size={32} color={theme.tint} />
                                        <Text style={[styles.verificationModalTitle, { color: theme.tint }]}>
                                            Verify Your Email
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setShowVerificationModal(false);
                                                clearPendingSignup();
                                            }}
                                            style={styles.verificationCloseButton}
                                        >
                                            <Ionicons name="close" size={24} color={theme.text} />
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={[styles.verificationModalSubtitle, { color: theme.text }]}>
                                        We&apos;ve sent a verification code to your email. Please enter the 6-digit code below.
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

                                    {verificationError ? (
                                        <Text style={styles.fieldError}>{verificationError}</Text>
                                    ) : null}

                                    {resendMessage ? (
                                        <Text style={styles.resendInfoText}>{resendMessage}</Text>
                                    ) : null}

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
                                        <Text style={[styles.resendButtonText, { color: theme.text }]}>
                                            Didn&apos;t receive code?{' '}
                                            <Text style={[
                                                styles.resendLinkText,
                                                { color: resendTimer > 0 ? '#999' : theme.tint }
                                            ]}>
                                                {resendTimer > 0
                                                    ? `Resend in ${resendTimer}s`
                                                    : (isResending ? 'Resending...' : 'Resend')}
                                            </Text>
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </KeyboardAvoidingView>
                        </View>
                    </Modal>

                    {/* Success Modal with Confetti */}
                    <Modal
                        animationType="fade"
                        transparent={true}
                        visible={showSuccessModal}
                        onRequestClose={() => { }}
                    >
                        <View style={styles.successModalOverlay}>
                            <Animated.View
                                style={[
                                    styles.successModalContent,
                                    { transform: [{ scale: successScale }] }
                                ]}
                            >
                                {/* Confetti Animation */}
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
                                    <View style={styles.successIconContainer}>
                                        <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                                    </View>
                                </Animated.View>

                                <Text style={styles.successTitle}>Account Created!</Text>
                                <Text style={styles.successMessage}>
                                    Welcome to MakiDesu! Your account has been successfully created.
                                </Text>
                            </Animated.View>
                        </View>
                    </Modal>
                </ScrollView>
            </KeyboardAvoidingView >
        </SafeAreaView >
    );

}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    mainContent: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    backButton: {
        alignSelf: 'flex-start',
        marginBottom: 8,
        zIndex: 10,
    },
    header: {
        alignItems: 'center',
    },
    image: {
        marginBottom: 12,
    },
    title: {
        fontSize: 26,
        fontFamily: Typography.h1,
        color: '#D82E3F',
        marginBottom: 4,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
    section: {
        width: '100%',
    },
    socialContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
    },
    socialBtn: {
        width: 50,
        height: 50,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    divider: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        marginHorizontal: 16,
        fontFamily: Typography.body,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    fieldError: {
        color: '#C62828',
        fontFamily: Typography.body,
        fontSize: 12,
        marginTop: 3,
        marginBottom: 4,
        paddingLeft: 4,
    },
    signupButton: {
        height: 56,
        borderRadius: 28,
        shadowColor: '#D82E3F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        backgroundColor: '#D82E3F',
    },
    loginLink: {
        marginTop: 16,
        alignItems: 'center',
    },
    loginLinkText: {
        fontFamily: Typography.body,
        fontSize: 14,
    },
    loginLinkBold: {
        fontFamily: Typography.button,
    },
    dateInputContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
    },
    dateInputContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        fontFamily: Typography.body,
        fontSize: 16,
    },
    clearIcon: {
        padding: 4,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    termsTextContainer: {
        flex: 1,
        marginLeft: 4,
    },
    termsText: {
        fontFamily: Typography.body,
        lineHeight: 18,
    },
    termsLink: {
        fontFamily: Typography.button,
        textDecorationLine: 'underline',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 20,
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: Typography.h2,
    },
    modalBody: {
        maxHeight: 300,
        marginBottom: 20,
    },
    termsBodyText: {
        fontFamily: Typography.body,
        fontSize: 14,
        lineHeight: 22,
    },
    modalCloseButton: {
        height: 48,
        borderRadius: 24,
        backgroundColor: '#D82E3F',
    },
    // Verification modal styles
    verificationModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    verificationModalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 28,
    },
    verificationModalHeader: {
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    verificationModalTitle: {
        fontSize: 22,
        fontFamily: Typography.h1,
        textAlign: 'center',
    },
    verificationCloseButton: {
        position: 'absolute',
        top: 0,
        right: 0,
        padding: 4,
    },
    verificationModalSubtitle: {
        fontSize: 15,
        lineHeight: 22,
        fontFamily: Typography.body,
        textAlign: 'center',
        marginBottom: 20,
    },
    verificationInputContainer: {
        width: '100%',
        marginBottom: 16,
    },
    resendInfoText: {
        fontFamily: Typography.body,
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 12,
        opacity: 0.7,
    },
    verifyButton: {
        height: 52,
        borderRadius: 26,
        backgroundColor: '#D82E3F',
        marginBottom: 12,
    },
    resendButton: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    resendButtonText: {
        fontFamily: Typography.body,
        fontSize: 14,
    },
    resendLinkText: {
        fontFamily: Typography.button,
    },
    // Success modal styles
    successModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    successModalContent: {
        width: '100%',
        maxWidth: 320,
        borderRadius: 24,
        padding: 32,
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    confettiContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        borderRadius: 24,
    },
    confetti: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 2,
        top: -10,
    },
    successIconContainer: {
        marginBottom: 16,
    },
    successTitle: {
        fontSize: 26,
        fontFamily: Typography.h1,
        color: '#D82E3F',
        marginBottom: 8,
        textAlign: 'center',
    },
    successMessage: {
        fontFamily: Typography.body,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        color: '#555',
    },
    // Professional Phone Input Styles
    phoneInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
    },
    phonePrefixContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    phonePrefixText: {
        fontSize: 16,
        fontFamily: Typography.button,
        marginLeft: 8,
    },
    phonePrefixDivider: {
        width: 1,
        height: '60%',
        backgroundColor: '#E5E5E5',
        marginRight: 12,
    },
    phoneInput: {
        flex: 1,
        fontSize: 16,
        fontFamily: Typography.body,
        height: '100%',
    },
});
