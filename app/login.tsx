import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { ThemedInput } from '@/components/ui/ThemedInput';
import { Colors, Typography } from '@/constants/theme';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import api from '@/lib/api';
import { mobileLogin } from '@/lib/auth_api';
import { resolveGoogleSmartLocation } from '@/lib/google_location';
import {
    resolveAndSetBestActiveAddress,
    setSelectedBranch,
    setUserId,
    setUser,
    upsertAutoDetectedAddress
} from '@/lib/ui_store';
import { AntDesign, FontAwesome, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
    BackHandler,
    Alert,
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

const BACKGROUND_IMAGE = 'C:\\Users\\Mark\\.gemini\\antigravity\\brain\\83ea3caa-9c54-471f-8005-65dae01c5475\\cozy_japanese_cafe_bg_1776885520916.png';
const PLUS_CODE_REGEX = /\b[A-Z0-9]{2,8}\+[A-Z0-9]{2,}\b/i;

const stripPlusCode = (value: string): string =>
    String(value || '')
        .replace(PLUS_CODE_REGEX, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/,\s*,/g, ',')
        .trim();

const GENERIC_LABEL_REGEX = /\b(current\s*location|unknown|unnamed|pin\s*location)\b/i;

const isInvalidLabel = (label: string): boolean => {
    const cleaned = stripPlusCode(label);
    return (
        !cleaned ||
        cleaned.length < 6 ||
        PLUS_CODE_REGEX.test(String(label || '')) ||
        GENERIC_LABEL_REGEX.test(cleaned)
    );
};

const formatDeliveryAddress = (
    geo: { barangay?: string; city?: string; municipality?: string; province?: string },
    establishmentName?: string
): string => {
    const line1 = stripPlusCode(establishmentName || '');
    const line2 = [
        stripPlusCode(geo.barangay || ''),
        stripPlusCode(geo.city || geo.municipality || ''),
        stripPlusCode(geo.province || ''),
    ]
        .filter(Boolean)
        .join(', ');

    if (line1 && line2) {
        return `${line1}\n${line2}`;
    }
    return line1 || line2;
};

export default function LoginScreen() {
    const router = useRouter();
    const { height } = useWindowDimensions();
    const { colors, isDark } = useAppTheme();


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
    
    // Handle hardware back button on Android to prevent navigator "leak"
    useEffect(() => {
        const backAction = () => {
            if (!router.canGoBack()) {
                router.replace('/');
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, [router]);

    // Responsive scaling constants
    const isSmallScreen = height < 800;
    const isExtraSmall = height < 650;
    const detectBranchAndAddressAfterLogin = async (): Promise<void> => {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
            return;
        }

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        const latitude = location.coords.latitude;
        const longitude = location.coords.longitude;

        const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
        const firstAddress = geocoded[0];

        let street = stripPlusCode(
            firstAddress?.street ||
            firstAddress?.name ||
            firstAddress?.district ||
            'Current Location'
        );
        const city = stripPlusCode(
            firstAddress?.city ||
            firstAddress?.subregion ||
            ''
        );
        const province = stripPlusCode(
            firstAddress?.region ||
            firstAddress?.country ||
            ''
        );
        const barangay = stripPlusCode(firstAddress?.district || '');
        let subdivision = stripPlusCode(firstAddress?.name || '');

        let formatted = [street, city, province].filter(Boolean).join(', ');
        const smart = await resolveGoogleSmartLocation(
            latitude,
            longitude,
            process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
        );
        const smartLandmark = stripPlusCode(smart.landmark || '');
        const smartBarangay = stripPlusCode(smart.barangay || barangay);
        const smartCity = stripPlusCode(smart.city || city);
        const smartProvince = stripPlusCode(smart.province || province);

        if (smartLandmark && !isInvalidLabel(smartLandmark)) {
            formatted = formatDeliveryAddress(
                {
                    barangay: smartBarangay,
                    municipality: smartCity,
                    province: smartProvince,
                },
                smartLandmark
            );
            subdivision = smartLandmark;
            if (!street || isInvalidLabel(street)) {
                street = smartLandmark;
            }
        } else if (!isInvalidLabel(smart.smartAddress)) {
            formatted = stripPlusCode(smart.smartAddress);
        } else if (isInvalidLabel(formatted)) {
            const labelParts = [smartBarangay, smartCity, smartProvince].filter(Boolean);
            formatted = labelParts.join(', ');
        }

        upsertAutoDetectedAddress({
            latitude,
            longitude,
            street,
            barangay: smartBarangay || barangay,
            subdivision,
            city: smartCity || city,
            province: smartProvince || province,
            fullAddress: formatted || 'Current Location',
        });
        resolveAndSetBestActiveAddress({ latitude, longitude });

        const productsResponse = await api.get('customer/products', {
            params: { lat: latitude, lng: longitude },
        });
        const branch = productsResponse?.data?.branch;
        if (branch?.id) {
            setSelectedBranch({
                id: Number(branch.id),
                name: branch.name || 'Nearest Branch',
                address: branch.address || '',
                latitude: Number(branch.latitude),
                longitude: Number(branch.longitude),
                delivery_radius_km: Number(branch.delivery_radius_km),
                status: branch.status === 'closed' ? 'closed' : 'open',
                status_text: branch.status_text,
            });
        }
    };


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
            const user = await mobileLogin({ email: cleanEmail, password });

            // Clear old profile cache to prevent role mixups
            await AsyncStorage.removeItem('user_profile');

            if (user.role === 'admin' || user.role === 'cashier') {
                setIsSubmitting(false);
                setAuthError('Access Denied: This app is only for Customers and Riders.');
                Alert.alert("Access Denied", "Admins and Cashiers must use the web dashboard.");
                return;
            }

            setUserId(user.id);
            setUser(user);

            await AsyncStorage.setItem('user_profile', JSON.stringify({
                firstName: user.firstName,
                lastName: user.lastName,
                name: user.name,
                email: user.email,
                contactNumber: user.contactNumber,
                role: user.role,
                branchId: user.branchId,
                riderId: user.riderId,
                avatarId: user.avatarId || 1,
                profilePictureUrl: user.profilePictureUrl || null
            }));

            try {
                await detectBranchAndAddressAfterLogin();
            } catch (locationError) {
                console.log('Location/branch auto-detection skipped:', locationError);
            }

            if (rememberMe) {
                await AsyncStorage.setItem('remembered_email', cleanEmail);
                await AsyncStorage.setItem('remembered_password', password);
            } else {
                await AsyncStorage.removeItem('remembered_email');
                await AsyncStorage.removeItem('remembered_password');
            }

            setShowSuccessModal(true);

            successScale.value = withSequence(
                withTiming(100, { duration: 900 }),
                withDelay(100, withTiming(0, { duration: 350 }))
            );

            checkmarkScale.value = withSequence(
                withSpring(1, { damping: 14, stiffness: 120 }),
                withDelay(800, withTiming(0, { duration: 250 }))
            );

            setTimeout(() => {
                setShowSuccessModal(false);
                // Redirect based on role
                if (user.role === 'rider') {
                    router.replace('/rider/dashboard' as any);
                } else {
                    router.replace('/home_dashboard');
                }
            }, 1450);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to connect. Try again.';
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
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.5)' }]} />

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
                            <View style={styles.topSection}>
                                <Animated.View
                                    entering={FadeInDown.duration(800)}
                                    style={styles.header}
                                >
                                    <Text style={[styles.title, { color: colors.heading }]}>
                                        Konnichiwa!
                                    </Text>
                                    <Text style={[styles.brandText, { color: colors.primary }]}>
                                        Maki Desu
                                    </Text>
                                    <Text style={[styles.subtitle, { color: colors.text }]}>
                                        Discover your favorite Japanese flavors today.
                                    </Text>
                                </Animated.View>
                            </View>

                            <Animated.View
                                entering={FadeInUp.delay(200).duration(1000)}
                                style={[styles.loginCard, { backgroundColor: colors.surface, shadowColor: colors.primary }]}
                            >
                                <View style={styles.socialRow}>
                                    <TouchableOpacity style={[styles.socialIconButton, { backgroundColor: colors.background }]}>
                                        <AntDesign name="google" size={22} color="#DB4437" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.socialIconButton, { backgroundColor: colors.background }]}>
                                        <FontAwesome name="facebook" size={22} color="#4267B2" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.socialIconButton, { backgroundColor: colors.background }]}>
                                        <Ionicons name="logo-apple" size={22} color={colors.heading} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: colors.primary + '1A' }]} />
                                    <Text style={[styles.dividerLabel, { color: colors.text }]}>Or login with email</Text>
                                    <View style={[styles.dividerLine, { backgroundColor: colors.primary + '1A' }]} />
                                </View>

                                <ErrorBanner message={authError} reservedHeight={40} />

                                <View style={styles.inputContainer}>
                                    <ThemedInput
                                        placeholder="Email Address"
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    />
                                    <ThemedInput
                                        placeholder="Password"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    />
                                </View>

                                <View style={styles.actionRow}>
                                    <Checkbox
                                        label="Stay signed in"
                                        checked={rememberMe}
                                        onPress={() => setRememberMe(!rememberMe)}
                                    />
                                    <TouchableOpacity onPress={() => (router.push as any)('/forgot-password')}>
                                        <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
                                    </TouchableOpacity>
                                </View>

                                <ThemedButton
                                    title="Sign In"
                                    onPress={handleLogin}
                                    loading={isSubmitting}
                                    disabled={isSubmitting}
                                    style={[styles.signInButton, { shadowColor: colors.primary }]}
                                />

                                <View style={styles.signUpPrompt}>
                                    <Text style={[styles.signUpText, { color: colors.text }]}>New here? </Text>
                                    <TouchableOpacity onPress={() => router.push('/signup')} activeOpacity={0.7}>
                                        <Text style={[styles.signUpLink, { color: colors.primary }]}>Create an account</Text>
                                    </TouchableOpacity>
                                </View>

                            </Animated.View>

                            <Animated.View
                                entering={FadeInUp.delay(400).duration(800)}
                                style={styles.footerSection}
                            >
                                <Text style={styles.legalText}>
                                    By signing in, you agree to our{"\n"}
                                    <Text style={styles.legalLink} onPress={() => { setModalType('terms'); setShowTermsModal(true); }}>Terms</Text> & <Text style={styles.legalLink} onPress={() => { setModalType('privacy'); setShowTermsModal(true); }}>Privacy Policy</Text>
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
                                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                                    <View style={styles.modalHeader}>
                                        <Text style={[styles.modalTitle, { color: colors.primary }]}>
                                            {modalType === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
                                        </Text>
                                        <TouchableOpacity onPress={() => setShowTermsModal(false)}>
                                            <Ionicons name="close" size={24} color={colors.heading} />
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                        <Text style={[styles.modalBodyText, { color: colors.text }]}>
                                            {modalType === 'terms' ? `
 1. Welcome: Our app provides a premium Japanese dining experience.
 2. Quality: All dishes are prepared fresh upon order.
 3. Responsibility: Ensure your delivery details are accurate.
 4. Privacy: We value your data security above all else.
                                            ` : `
 1. Data: we collect minimal data to improve your experience.
 2. Purpose: For order fulfillment and personalization.
 3. Protection: Industry-standard security protocols applied.
 4. Sharing: We never sell your data to third parties.
                                             `}
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
                            transparent
                            visible={showSuccessModal}
                            animationType="none"
                        >
                            <View style={[styles.successOverlay, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)' }]}>
                                <Animated.View style={[
                                    styles.successCircle,
                                    {
                                        backgroundColor: colors.primary,
                                        transform: [{ scale: successScale }]
                                    }
                                ]} />
                                <Animated.View style={[{ zIndex: 10, alignItems: 'center' }, { transform: [{ scale: checkmarkScale }] }]}>
                                    <Ionicons name="checkmark-circle" size={100} color={isDark ? colors.background : '#FFF'} />
                                    <Text style={[styles.successTitle, { color: isDark ? colors.background : '#FFF' }]}>Welcome Back!</Text>
                                    <Text style={[styles.successSubtitle, { color: isDark ? colors.background : '#FFF' }]}>Preparing your kitchen...</Text>
                                </Animated.View>
                            </View>
                        </Modal>
                    </ScrollView>
                </KeyboardAvoidingView>
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
        paddingHorizontal: 28,
        paddingBottom: 40,
    },
    topSection: {
        marginTop: 20,
        marginBottom: 30,
    },
    header: {
        alignItems: 'flex-start',
    },
    title: {
        fontSize: 34,
        fontFamily: Typography.h1,
        lineHeight: 40,
    },
    brandText: {
        fontSize: 40,
        fontFamily: Typography.brand,
        marginTop: -4,
    },
    subtitle: {
        fontSize: 16,
        fontFamily: Typography.body,
        marginTop: 10,
        lineHeight: 24,
        opacity: 0.8,
    },
    loginCard: {
        borderRadius: 32,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginBottom: 24,
    },
    socialIconButton: {
        width: 54,
        height: 54,
        borderRadius: 16,
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
        marginBottom: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerLabel: {
        marginHorizontal: 12,
        fontSize: 12,
        fontFamily: Typography.body,
        color: '#B2BEC3',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    inputContainer: {
        gap: 12,
        marginBottom: 16,
    },
    input: {
        borderRadius: 16,
        borderWidth: 1,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    forgotText: {
        fontFamily: Typography.button,
        fontSize: 14,
    },
    signInButton: {
        height: 58,
        borderRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 5,
        marginBottom: 20,
    },
    signUpPrompt: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    signUpText: {
        fontFamily: Typography.body,
        fontSize: 14,
        color: '#636E72',
    },
    signUpLink: {
        fontFamily: Typography.button,
        fontWeight: '700',
    },
    guestLink: {
        alignItems: 'center',
    },
    guestText: {
        fontFamily: Typography.button,
        fontSize: 13,
        color: '#B2BEC3',
        textDecorationLine: 'underline',
    },
    footerSection: {
        marginTop: 30,
        alignItems: 'center',
    },
    legalText: {
        textAlign: 'center',
        fontSize: 12,
        fontFamily: Typography.body,
        color: '#B2BEC3',
        lineHeight: 18,
    },
    legalLink: {
        fontWeight: '600',
        textDecorationLine: 'underline',
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
    modalBodyText: {
        fontSize: 15,
        fontFamily: Typography.body,
        lineHeight: 24,
        color: '#636E72',
    },
    modalCloseButton: {
        height: 54,
        borderRadius: 16,
    },
    successOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    successCircle: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    successTitle: {
        fontSize: 32,
        fontFamily: Typography.h1,
        color: '#FFF',
        marginTop: 20,
    },
    successSubtitle: {
        fontSize: 18,
        fontFamily: Typography.body,
        color: '#FFF',
        opacity: 0.9,
        marginTop: 8,
    },
});
