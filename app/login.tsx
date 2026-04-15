import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { ThemedInput } from '@/components/ui/ThemedInput';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { loginUser } from '@/lib/auth_api';
import { setUserId } from '@/lib/ui_store';
import { AntDesign, FontAwesome, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
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
    withDelay,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
    const router = useRouter();
    const { height } = useWindowDimensions();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

    const backButtonScale = useSharedValue(1);
    const animatedBackStyle = useAnimatedStyle(() => ({
        transform: [{ scale: backButtonScale.value }],
    }));

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [modalType, setModalType] = useState<'terms' | 'privacy'>('terms');
    const [authError, setAuthError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const successScale = useSharedValue(0);
    const checkmarkScale = useSharedValue(0);

    // Load remembered credentials
    useEffect(() => {
        const loadCredentials = async () => {
            try {
                const savedEmail = await AsyncStorage.getItem('remembered_email');
                const savedPassword = await AsyncStorage.getItem('remembered_password');
                if (savedEmail && savedPassword) {
                    setEmail(savedEmail);
                    setPassword(savedPassword);
                    setRememberMe(true);
                }
            } catch (e) {
                console.error('Failed to load credentials', e);
            }
        };
        loadCredentials();
    }, []);

    // Responsive scaling constants
    const isSmallScreen = height < 800;
    const isExtraSmall = height < 650;
    const verticalGap = isExtraSmall ? 6 : (isSmallScreen ? 12 : 32);

    const handleLogin = async () => {
        const cleanEmail = email.trim().toLowerCase();
        setAuthError('');

        if (!cleanEmail || !password) {
            setAuthError('Please enter your email and password.');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            setAuthError('Please enter a valid email address.');
            return;
        }

        try {
            setIsSubmitting(true);
            const user = await loginUser({ email: cleanEmail, password });

            // Set the active user ID for fetching favorites later
            setUserId(user.id);

            // Persist user profile data for other screens (e.g., Personal Information)
            await AsyncStorage.setItem('user_profile', JSON.stringify({
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                contactNumber: user.contactNumber,
            }));

            // Handle Remember Me
            if (rememberMe) {
                await AsyncStorage.setItem('remembered_email', cleanEmail);
                await AsyncStorage.setItem('remembered_password', password);
            } else {
                await AsyncStorage.removeItem('remembered_email');
                await AsyncStorage.removeItem('remembered_password');
            }

            // Show success animation
            setShowSuccessModal(true);

            // Plot twist: Expand smoothly, barely pause, then snap shrink back to 0
            successScale.value = withSequence(
                withTiming(100, { duration: 900 }),
                withDelay(100, withTiming(0, { duration: 350 })) // Reduced delay and faster shrink
            );

            // Checkmark disappears earlier to sync with shrink
            checkmarkScale.value = withSequence(
                withSpring(1, { damping: 14, stiffness: 120 }),
                withDelay(800, withTiming(0, { duration: 250 }))
            );

            // Redirect as soon as it shrinks back to zero
            setTimeout(() => {
                setShowSuccessModal(false);
                router.replace('/home_dashboard');
            }, 1450);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Login failed.';
            setAuthError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

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
                    <View style={[styles.mainContent, { paddingVertical: isExtraSmall ? 6 : (isSmallScreen ? 12 : 40) }]}>
                        <View>
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

                            <Animated.View
                                entering={FadeInDown.duration(600).springify()}
                                style={[styles.header, { marginBottom: verticalGap, alignItems: 'center', marginTop: isExtraSmall ? 6 : 20 }]}
                            >
                                <View style={styles.greetingRow}>
                                    <Text style={[styles.title, { color: theme.tint, fontSize: isExtraSmall ? 26 : 38, textAlign: 'center', fontFamily: Typography.h1 }]}>
                                        Konnichiwa! <Text style={{ fontFamily: Typography.brand }}>Maki Desu</Text>.
                                    </Text>
                                </View>
                                <Text style={[styles.subtitle, { color: theme.text, marginTop: 4, paddingHorizontal: 20, fontFamily: Typography.body }, isSmallScreen && { fontSize: 13, lineHeight: 18 }]} numberOfLines={3}>
                                    What will you eat today?
                                </Text>
                            </Animated.View>
                        </View>

                        <View style={{ flex: 1, justifyContent: 'center', marginBottom: isExtraSmall ? 2 : (isSmallScreen ? 4 : 0) }}>
                            <Animated.View
                                entering={FadeInDown.delay(200).duration(600).springify()}
                                style={[styles.socialContainer, { marginBottom: isExtraSmall ? 8 : (isSmallScreen ? 10 : verticalGap) }]}
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
                                style={[styles.dividerContainer, { marginBottom: isExtraSmall ? 8 : (isSmallScreen ? 10 : verticalGap) }]}
                            >
                                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                                <Text style={[styles.dividerText, { color: theme.text, fontSize: isExtraSmall ? 7 : (isSmallScreen ? 8 : 10) }]}>Or login with email</Text>
                                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            </Animated.View>

                            {/* Error banner: fixed reserved slot below divider, no layout shift */}
                            <ErrorBanner message={authError} reservedHeight={64} />

                            <Animated.View
                                entering={FadeInUp.delay(400).duration(600).springify()}
                                style={styles.form}
                            >
                                <ThemedInput
                                    label={isSmallScreen ? undefined : "Email"}
                                    placeholder="Email"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    height={isExtraSmall ? 38 : (isSmallScreen ? 44 : 56)}
                                    style={{ marginBottom: isExtraSmall ? 6 : (isSmallScreen ? 8 : 12) }}
                                />
                                <ThemedInput
                                    label={isSmallScreen ? undefined : "Password"}
                                    placeholder="Password"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    height={isExtraSmall ? 38 : (isSmallScreen ? 44 : 56)}
                                    style={{ marginBottom: isExtraSmall ? 6 : (isSmallScreen ? 8 : 12) }}
                                />

                                <View style={[styles.row, { marginBottom: isExtraSmall ? 8 : (isSmallScreen ? 10 : verticalGap) }]}>
                                    <Checkbox
                                        label="Remember me"
                                        checked={rememberMe}
                                        onPress={() => setRememberMe(!rememberMe)}
                                        style={isExtraSmall ? { transform: [{ scale: 0.8 }] } : (isSmallScreen ? { transform: [{ scale: 0.9 }] } : {})}
                                    />
                                    <TouchableOpacity
                                        onPress={() => (router.push as any)('/forgot-password')}
                                        style={{
                                            backgroundColor: 'rgba(216, 46, 63, 0.1)',
                                            paddingVertical: 6,
                                            paddingHorizontal: 12,
                                            borderRadius: 16,
                                        }}
                                    >
                                        <Text style={[styles.forgotPassword, { color: theme.tint, fontSize: isExtraSmall ? 11 : (isSmallScreen ? 12 : 14) }]}>Forgot Password?</Text>
                                    </TouchableOpacity>
                                </View>

                                <ThemedButton
                                    title="Login"
                                    onPress={handleLogin}
                                    loading={isSubmitting}
                                    disabled={isSubmitting}
                                    style={[styles.loginButton, isExtraSmall ? { height: 40, borderRadius: 20 } : (isSmallScreen && { height: 44, borderRadius: 22 }), { marginBottom: 16 }]}
                                />

                                <TouchableOpacity onPress={() => router.replace('/home_dashboard')} style={{ alignItems: 'center', marginBottom: 24 }}>
                                    <Text style={{ fontFamily: Typography.button, color: theme.text, fontSize: isExtraSmall ? 10 : (isSmallScreen ? 12 : 14), opacity: 0.8 }}>
                                        Continue as Guest
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => router.push('/signup')} style={[styles.signupLink, isExtraSmall ? { marginTop: 4 } : (isSmallScreen && { marginTop: 8 })]}>
                                    <Text style={[styles.signupLinkText, { color: theme.text, fontSize: isExtraSmall ? 10 : (isSmallScreen ? 12 : 14) }]}>
                                        Don&apos;t have an account? <Text style={[styles.signupLinkBold, { color: theme.tint }]}>Sign Up</Text>
                                    </Text>
                                </TouchableOpacity>
                            </Animated.View>
                        </View>

                        <Animated.View
                            entering={FadeInUp.delay(600).duration(600)}
                            style={[styles.footer, isExtraSmall ? { marginTop: 2, paddingBottom: 16 } : (isSmallScreen && { marginTop: 4, paddingBottom: 24 })]}
                        >
                            <Text style={[styles.footerText, { color: theme.text, fontSize: isExtraSmall ? 8 : (isSmallScreen ? 10 : 12), lineHeight: isExtraSmall ? 10 : (isSmallScreen ? 14 : 18) }]}>
                                By continuing, you agree to MakiDesu&apos;s{"\n"}
                                <Text
                                    style={[styles.link, { color: theme.tint }]}
                                    onPress={() => { setModalType('terms'); setShowTermsModal(true); }}
                                >
                                    Term of Service
                                </Text> and <Text
                                    style={[styles.link, { color: theme.tint }]}
                                    onPress={() => { setModalType('privacy'); setShowTermsModal(true); }}
                                >
                                    Privacy Policy
                                </Text>
                            </Text>
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
                                        {modalType === 'terms' ? 'Term of Service' : 'Privacy Policy'}
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

1. Data Collection: We collect your name, email, and optionally your birthday to provide a personalized dining experience.

2. Purpose of Use: Your data is used for account verification, secure transactions, order updates, and sending exclusive anniversary gifts if applicable.

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

                    {/* Success Animation Modal */}
                    <Modal
                        transparent
                        visible={showSuccessModal}
                        animationType="none"
                    >
                        <View style={styles.successOverlay}>
                            {/* Expanding Orange Background */}
                            <Animated.View style={[
                                StyleSheet.absoluteFillObject,
                                {
                                    backgroundColor: '#F97316', // Bright Orange as requested
                                    borderRadius: 9999,
                                    width: 50,
                                    height: 50,
                                    left: '50%',
                                    top: '50%',
                                    marginLeft: -25,
                                    marginTop: -25,
                                    transform: [{ scale: successScale }]
                                }
                            ]} />

                            {/* Centered Checkmark */}
                            <Animated.View style={[{ alignItems: 'center', justifyContent: 'center', zIndex: 10 }, { transform: [{ scale: checkmarkScale }] }]}>
                                <Ionicons name="checkmark-circle" size={100} color="#FFFFFF" />
                                <Text style={[styles.successTitle, { color: '#FFFFFF' }]}>Welcome Back!</Text>
                                <Text style={[styles.successSubtitle, { color: '#FFFFFF', opacity: 0.9 }]}>Preparing your kitchen...</Text>
                            </Animated.View>
                        </View>
                    </Modal>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    mainContent: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'space-between',
    },
    backButton: {
        marginBottom: 10,
    },
    header: {
        alignItems: 'center',
    },
    greetingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        fontFamily: Typography.h1,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        fontFamily: Typography.body,
        lineHeight: 22,
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
    form: {
        width: '100%',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    forgotPassword: {
        fontFamily: Typography.button,
        fontSize: 14,
    },
    loginButton: {
        height: 56,
        borderRadius: 28,
        shadowColor: '#D82E3F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        backgroundColor: '#D82E3F',
    },
    signupLink: {
        marginTop: 16,
        alignItems: 'center',
    },
    signupLinkText: {
        fontFamily: Typography.body,
        fontSize: 14,
    },
    signupLinkBold: {
        fontFamily: Typography.button,
    },
    footer: {
        alignItems: 'center',
        marginTop: 10,
    },
    footerText: {
        textAlign: 'center',
        fontSize: 12,
        lineHeight: 18,
        opacity: 0.7,
    },
    link: {
        fontFamily: Typography.button,
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
        maxHeight: '80%',
        borderRadius: 20,
        padding: 24,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: Typography.h1,
    },
    modalBody: {
        marginBottom: 20,
    },
    termsBodyText: {
        fontSize: 14,
        fontFamily: Typography.body,
        lineHeight: 20,
    },
    modalCloseButton: {
        height: 48,
        borderRadius: 24,
    },
    successOverlay: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successCircle: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    successTitle: {
        fontSize: 28,
        fontFamily: Typography.h1,
        color: '#333',
        marginTop: 20,
    },
    successSubtitle: {
        fontSize: 16,
        fontFamily: Typography.body,
        color: '#666',
        marginTop: 8,
    },
});
