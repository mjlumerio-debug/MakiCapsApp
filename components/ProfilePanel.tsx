import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchCurrentUser } from '@/lib/auth_api';
import { setUserId } from '@/lib/ui_store';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Animated as RNAnimated,
    Easing as RNEasing,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type ProfilePanelProps = {
    bottomPadding: number;
};

const MenuRow = ({ iconProvider: IconProvider, iconName, title, onPress, theme, rightIcon }: any) => (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.menuLeft}>
            <View style={styles.iconContainer}>
                <IconProvider name={iconName} size={20} color="#2C2C2C" />
            </View>
            <Text style={[styles.menuText, { color: '#2C2C2C' }]}>{title}</Text>
        </View>
        <Feather name={rightIcon || "chevron-right"} size={20} color="#C4C4C4" />
    </TouchableOpacity>
);

export default function ProfilePanel({ bottomPadding }: ProfilePanelProps) {
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

    const logoutSheetAnim = useRef(new RNAnimated.Value(0)).current;
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const deleteSheetAnim = useRef(new RNAnimated.Value(0)).current;
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const verifyDeleteSheetAnim = useRef(new RNAnimated.Value(0)).current;
    const [showVerifyDeleteModal, setShowVerifyDeleteModal] = useState(false);

    const changePwdSheetAnim = useRef(new RNAnimated.Value(0)).current;
    const [showChangePwdModal, setShowChangePwdModal] = useState(false);

    const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

    // Change password form state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('Guest User');
    const [displayEmail, setDisplayEmail] = useState('No email available');
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    useEffect(() => {
        let mounted = true;

        const hydrateProfile = async (): Promise<void> => {
            try {
                const cachedProfile = await AsyncStorage.getItem('user_profile');
                if (cachedProfile && mounted) {
                    const parsed = JSON.parse(cachedProfile);
                    const localName = `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim();
                    setDisplayName(localName || 'Guest User');
                    setDisplayEmail(parsed.email || 'No email available');
                }
            } catch (error) {
                console.error('Failed to read cached user profile', error);
            }

            try {
                const user = await fetchCurrentUser();
                if (!mounted) return;

                const fullName = `${user.firstName} ${user.lastName}`.trim();
                setDisplayName(fullName || 'Guest User');
                setDisplayEmail(user.email || 'No email available');

                await AsyncStorage.setItem(
                    'user_profile',
                    JSON.stringify({
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        contactNumber: user.contactNumber,
                    })
                );
            } catch (error) {
                console.error('Failed to fetch authenticated user profile', error);
            } finally {
                if (mounted) {
                    setIsLoadingProfile(false);
                }
            }
        };

        hydrateProfile();

        return () => {
            mounted = false;
        };
    }, []);

    const handleLogout = () => {
        setUserId(null);
        // Cart and favorites intentionally NOT cleared so items persist across logout
        router.replace('/login');
    };

    const openLogoutSheet = useCallback(() => {
        setShowLogoutModal(true);
        RNAnimated.spring(logoutSheetAnim, {
            toValue: 1,
            useNativeDriver: true,
            damping: 24,
            stiffness: 280,
        }).start();
    }, [logoutSheetAnim]);

    const closeLogoutSheet = useCallback(() => {
        RNAnimated.timing(logoutSheetAnim, {
            toValue: 0,
            duration: 200,
            easing: RNEasing.out(RNEasing.cubic),
            useNativeDriver: true,
        }).start(() => setShowLogoutModal(false));
    }, [logoutSheetAnim]);

    const performLogout = () => {
        closeLogoutSheet();
        setTimeout(() => {
            handleLogout();
        }, 250);
    };

    const openDeleteSheet = useCallback(() => {
        setShowDeleteModal(true);
        RNAnimated.spring(deleteSheetAnim, {
            toValue: 1,
            useNativeDriver: true,
            damping: 24,
            stiffness: 280,
        }).start();
    }, [deleteSheetAnim]);

    const closeDeleteSheet = useCallback(() => {
        RNAnimated.timing(deleteSheetAnim, {
            toValue: 0,
            duration: 200,
            easing: RNEasing.out(RNEasing.cubic),
            useNativeDriver: true,
        }).start(() => setShowDeleteModal(false));
    }, [deleteSheetAnim]);

    const openVerifyDeleteSheet = useCallback(() => {
        setShowVerifyDeleteModal(true);
        RNAnimated.spring(verifyDeleteSheetAnim, {
            toValue: 1,
            useNativeDriver: true,
            damping: 24,
            stiffness: 280,
        }).start();
    }, [verifyDeleteSheetAnim]);

    const closeVerifyDeleteSheet = useCallback(() => {
        RNAnimated.timing(verifyDeleteSheetAnim, {
            toValue: 0,
            duration: 200,
            easing: RNEasing.out(RNEasing.cubic),
            useNativeDriver: true,
        }).start(() => setShowVerifyDeleteModal(false));
    }, [verifyDeleteSheetAnim]);

    const performVerifyDelete = () => {
        closeVerifyDeleteSheet();
        setTimeout(() => {
            handleLogout();
        }, 250);
    };

    const performDeleteAccount = () => {
        closeDeleteSheet();
        setTimeout(() => {
            openVerifyDeleteSheet();
        }, 250);
    };

    const openChangePwdSheet = useCallback(() => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowChangePwdModal(true);
        RNAnimated.spring(changePwdSheetAnim, {
            toValue: 1,
            useNativeDriver: true,
            damping: 24,
            stiffness: 280,
        }).start();
    }, [changePwdSheetAnim]);

    const closeChangePwdSheet = useCallback(() => {
        RNAnimated.timing(changePwdSheetAnim, {
            toValue: 0,
            duration: 200,
            easing: RNEasing.out(RNEasing.cubic),
            useNativeDriver: true,
        }).start(() => setShowChangePwdModal(false));
    }, [changePwdSheetAnim]);

    const performChangePassword = () => {
        closeChangePwdSheet();
        // Assume API success for now
    };

    return (
        <View style={{ flex: 1 }}>
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Avatar + Name */}
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        <Image
                            source={require('../assets/images/chef.png')}
                            style={styles.avatar}
                            contentFit="cover"
                        />
                        <View style={styles.badgeContainer}>
                            <MaterialIcons name="verified" size={14} color="#FFFFFF" />
                        </View>
                    </View>
                    {isLoadingProfile ? (
                        <ActivityIndicator size="small" color="#FF5800" style={{ marginBottom: 8 }} />
                    ) : null}
                    <Text style={[styles.name, { color: '#2C2C2C' }]}>{displayName}</Text>
                    <Text style={styles.email}>{displayEmail}</Text>
                </View>

                {/* Menu items */}
                <View style={styles.menuList}>
                    <MenuRow iconProvider={Feather} iconName="user" title="Personal Information" onPress={() => router.push('/personal-information' as any)} theme={theme} />
                    <MenuRow iconProvider={Feather} iconName="tag" title="My Orders" onPress={() => {
                        router.push('/my-orders');
                    }} theme={theme} />
                    <MenuRow iconProvider={Ionicons} iconName="location-outline" title="Addresses" onPress={() => router.push('/addresses' as any)} theme={theme} />
                    <MenuRow iconProvider={Ionicons} iconName="wallet-outline" title="Payment Methods" onPress={() => router.push('/payment-methods' as any)} theme={theme} />
                    <MenuRow
                        iconProvider={Feather}
                        iconName="settings"
                        title="Settings"
                        onPress={() => setIsSettingsExpanded(!isSettingsExpanded)}
                        theme={theme}
                        rightIcon={isSettingsExpanded ? "chevron-down" : "chevron-right"}
                    />
                    {isSettingsExpanded && (
                        <View style={styles.submenuContainer}>
                            <TouchableOpacity style={styles.submenuRow} onPress={openChangePwdSheet} activeOpacity={0.7}>
                                <View style={styles.submenuLeft}>
                                    <Feather name="lock" size={18} color="#2C2C2C" />
                                    <Text style={[styles.submenuText, { color: '#2C2C2C' }]}>Change Password</Text>
                                </View>
                                <Feather name="chevron-right" size={18} color="#C4C4C4" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.submenuRow} onPress={openDeleteSheet} activeOpacity={0.7}>
                                <View style={styles.submenuLeft}>
                                    <Feather name="user-x" size={18} color="#DC2626" />
                                    <Text style={[styles.submenuText, { color: '#DC2626' }]}>Delete Account</Text>
                                </View>
                                <Feather name="chevron-right" size={18} color="#C4C4C4" />
                            </TouchableOpacity>
                        </View>
                    )}
                    <MenuRow
                        iconProvider={Feather}
                        iconName="log-out"
                        title="Logout"
                        onPress={openLogoutSheet}
                        theme={theme}
                    />
                </View>
            </ScrollView>

            {/* --- Logout Modal --- */}
            {showLogoutModal && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
                    <RNAnimated.View
                        style={[
                            styles.modalBackdrop,
                            {
                                opacity: logoutSheetAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 1],
                                }),
                            },
                        ]}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            style={{ flex: 1 }}
                            onPress={closeLogoutSheet}
                        />
                    </RNAnimated.View>

                    <View style={styles.modalCenterContainer} pointerEvents="box-none">
                        <RNAnimated.View
                            style={[
                                styles.logoutModalCard,
                                {
                                    opacity: logoutSheetAnim,
                                    transform: [
                                        {
                                            scale: logoutSheetAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.85, 1],
                                            }),
                                        },
                                        {
                                            translateY: logoutSheetAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [20, 0],
                                            }),
                                        }
                                    ],
                                },
                            ]}
                        >
                            <View style={styles.logoutIconCircle}>
                                <Feather name="log-out" size={28} color="#D94F3D" />
                            </View>
                            <Text style={styles.logoutTitle}>Logout Session?</Text>
                            <Text style={styles.logoutSubtitle}>
                                Are you sure you want to end your session? You can log back in later.
                            </Text>

                            <View style={styles.logoutButtonsRow}>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.logoutCancelButton}
                                    onPress={closeLogoutSheet}
                                >
                                    <Text style={styles.logoutCancelText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.logoutConfirmButton}
                                    onPress={performLogout}
                                >
                                    <Text style={styles.logoutConfirmText}>Confirm</Text>
                                </TouchableOpacity>
                            </View>
                        </RNAnimated.View>
                    </View>
                </View>
            )}

            {/* --- Delete Account Modal --- */}
            {showDeleteModal && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
                    <RNAnimated.View
                        style={[
                            styles.modalBackdrop,
                            {
                                opacity: deleteSheetAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 1],
                                }),
                            },
                        ]}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            style={{ flex: 1 }}
                            onPress={closeDeleteSheet}
                        />
                    </RNAnimated.View>

                    <View style={styles.modalCenterContainer} pointerEvents="box-none">
                        <RNAnimated.View
                            style={[
                                styles.logoutModalCard,
                                {
                                    opacity: deleteSheetAnim,
                                    transform: [
                                        {
                                            scale: deleteSheetAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.85, 1],
                                            }),
                                        },
                                        {
                                            translateY: deleteSheetAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [20, 0],
                                            }),
                                        }
                                    ],
                                },
                            ]}
                        >
                            <View style={[styles.logoutIconCircle, { backgroundColor: '#FEE2E2' }]}>
                                <Feather name="alert-triangle" size={28} color="#DC2626" />
                            </View>
                            <Text style={styles.logoutTitle}>Delete Account?</Text>
                            <Text style={styles.logoutSubtitle}>
                                Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.
                            </Text>

                            <View style={styles.logoutButtonsRow}>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.logoutCancelButton}
                                    onPress={closeDeleteSheet}
                                >
                                    <Text style={styles.logoutCancelText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={[styles.logoutConfirmButton, { backgroundColor: '#DC2626', shadowColor: '#DC2626' }]}
                                    onPress={performDeleteAccount}
                                >
                                    <Text style={styles.logoutConfirmText}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </RNAnimated.View>
                    </View>
                </View>
            )}

            {/* --- Verify Delete Account Modal --- */}
            {showVerifyDeleteModal && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
                    <RNAnimated.View
                        style={[
                            styles.modalBackdrop,
                            {
                                opacity: verifyDeleteSheetAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 1],
                                }),
                            },
                        ]}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            style={{ flex: 1 }}
                            onPress={closeVerifyDeleteSheet}
                        />
                    </RNAnimated.View>

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCenterContainer} pointerEvents="box-none">
                        <RNAnimated.View
                            style={[
                                styles.logoutModalCard,
                                {
                                    opacity: verifyDeleteSheetAnim,
                                    transform: [
                                        {
                                            scale: verifyDeleteSheetAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.85, 1],
                                            }),
                                        },
                                        {
                                            translateY: verifyDeleteSheetAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [20, 0],
                                            }),
                                        }
                                    ],
                                },
                            ]}
                        >
                            <View style={[styles.logoutIconCircle, { backgroundColor: '#FEE2E2' }]}>
                                <Feather name="mail" size={28} color="#DC2626" />
                            </View>
                            <Text style={styles.logoutTitle}>Verify to Delete</Text>
                            <Text style={styles.logoutSubtitle}>
                                For your security, please check your Gmail (mjlumerio@gmail.com) and enter the 6-digit verification code to confirm account deletion.
                            </Text>

                            <View style={[styles.inputContainer, { marginBottom: 32 }]}>
                                <TextInput
                                    style={[styles.modalInput, { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '600' }]}
                                    placeholder="000000"
                                    placeholderTextColor="#D1D5DB"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                />
                            </View>

                            <View style={styles.logoutButtonsRow}>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.logoutCancelButton}
                                    onPress={closeVerifyDeleteSheet}
                                >
                                    <Text style={styles.logoutCancelText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={[styles.logoutConfirmButton, { backgroundColor: '#DC2626', shadowColor: '#DC2626' }]}
                                    onPress={performVerifyDelete}
                                >
                                    <Text style={styles.logoutConfirmText}>Confirm</Text>
                                </TouchableOpacity>
                            </View>
                        </RNAnimated.View>
                    </KeyboardAvoidingView>
                </View>
            )}

            {/* --- Change Password Modal --- */}
            {showChangePwdModal && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
                    <RNAnimated.View
                        style={[
                            styles.modalBackdrop,
                            {
                                opacity: changePwdSheetAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 1],
                                }),
                            },
                        ]}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            style={{ flex: 1 }}
                            onPress={closeChangePwdSheet}
                        />
                    </RNAnimated.View>

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCenterContainer} pointerEvents="box-none">
                        <RNAnimated.View
                            style={[
                                styles.logoutModalCard,
                                {
                                    opacity: changePwdSheetAnim,
                                    transform: [
                                        {
                                            scale: changePwdSheetAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.85, 1],
                                            }),
                                        },
                                        {
                                            translateY: changePwdSheetAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [20, 0],
                                            }),
                                        }
                                    ],
                                },
                            ]}
                        >
                            <View style={[styles.logoutIconCircle, { backgroundColor: '#FFF0E6' }]}>
                                <Feather name="lock" size={28} color="#FF5800" />
                            </View>
                            <Text style={styles.logoutTitle}>Change Password</Text>

                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Current Password"
                                    placeholderTextColor="#9CA3AF"
                                    secureTextEntry
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                />
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="New Password"
                                    placeholderTextColor="#9CA3AF"
                                    secureTextEntry
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                />
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Confirm New Password"
                                    placeholderTextColor="#9CA3AF"
                                    secureTextEntry
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                            </View>

                            <View style={styles.logoutButtonsRow}>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.logoutCancelButton}
                                    onPress={closeChangePwdSheet}
                                >
                                    <Text style={styles.logoutCancelText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={[styles.logoutConfirmButton, { backgroundColor: '#FF5800', shadowColor: '#FF5800' }]}
                                    onPress={performChangePassword}
                                >
                                    <Text style={styles.logoutConfirmText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </RNAnimated.View>
                    </KeyboardAvoidingView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingTop: 0,
    },
    header: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 14,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FDDAD8',
    },
    badgeContainer: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: '#FF5800',
        borderRadius: 12,
        width: 22,
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#F8F9FA',
    },
    name: {
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 4,
    },
    email: {
        fontSize: 14,
        color: '#888888',
    },
    menuList: {
        paddingHorizontal: 20,
    },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        padding: 16,
        marginBottom: 12,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    menuLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        marginRight: 16,
    },
    menuText: {
        fontSize: 16,
        fontWeight: '500',
    },
    submenuContainer: {
        backgroundColor: '#F3F4F6', // Subtle background for accordion
        borderRadius: 16,
        paddingVertical: 4,
        paddingHorizontal: 16,
        marginBottom: 12,
        marginTop: -8, // Pull closer to Settings
    },
    submenuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    submenuLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    submenuText: {
        fontSize: 15,
        fontWeight: '500',
    },
    inputContainer: {
        width: '100%',
        marginBottom: 24,
        gap: 12,
    },
    modalInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: '#1F2937',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalCenterContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    logoutModalCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    logoutIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FDDAD8',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    logoutTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#2C2C2C',
        marginBottom: 8,
    },
    logoutSubtitle: {
        fontSize: 14,
        color: '#8A8A8A',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    logoutButtonsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    logoutCancelButton: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#F8F9FB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoutCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#2C2C2C',
    },
    logoutConfirmButton: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#D94F3D',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#D94F3D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    logoutConfirmText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
