import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Modal,
    Alert,
    TextInput
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { Typography } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useUiStore, logoutUser } from '@/lib/ui_store';
import { updateProfilePassword, deleteAccount } from '@/lib/auth_api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AVATARS = [
    require('../assets/images/avatar_1.png'),
    require('../assets/images/avatar_2.png'),
    require('../assets/images/avatar_3.png'),
    require('../assets/images/avatar_4.png'),
];

export function ProfilePanel({ bottomPadding = 0 }: { bottomPadding?: number }) {
    const { colors, isDark, themeMode, setThemeMode } = useAppTheme();
    const router = useRouter();
    const { user } = useUiStore();
    
    const [avatarId, setAvatarId] = useState(0);
    const [displayName, setDisplayName] = useState('Valued Customer');
    const [displayEmail, setDisplayEmail] = useState('');
    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const role = user?.role || 'customer';

    useEffect(() => {
        const loadProfile = async () => {
            setIsLoadingProfile(true);
            try {
                const cached = await AsyncStorage.getItem('user_profile');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const fullName = `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim();
                    setDisplayName(fullName || parsed.name || 'Valued Customer');
                    setDisplayEmail(parsed.email || '');
                    setAvatarId(parsed.avatarId || 0);
                    setProfilePictureUrl(parsed.profilePictureUrl || null);
                } else if (user) {
                    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                    setDisplayName(fullName || user.name || 'Valued Customer');
                    setDisplayEmail(user.email || '');
                    setAvatarId(user.avatarId || 0);
                    setProfilePictureUrl(user.profilePictureUrl || null);
                }
            } catch (e) {
                console.error('Failed to load profile cache', e);
            } finally {
                setIsLoadingProfile(false);
            }
        };
        loadProfile();
    }, [user]);

    const cycleAvatar = async () => {
        const nextId = (avatarId + 1) % AVATARS.length;
        setAvatarId(nextId);
        try {
            const cached = await AsyncStorage.getItem('user_profile');
            if (cached) {
                const parsed = JSON.parse(cached);
                parsed.avatarId = nextId;
                await AsyncStorage.setItem('user_profile', JSON.stringify(parsed));
            }
        } catch (e) {
            console.error('Failed to save avatar choice', e);
        }
    };

    const [isLogoutModalVisible, setLogoutModalVisible] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isChangePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
    const [isDeleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);

    // Form States
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleLogout = async () => {
        setLogoutModalVisible(false);
        await logoutUser();
        router.replace('/login');
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert("Error", "Please fill in all fields.");
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert("Error", "New passwords do not match.");
            return;
        }

        try {
            setIsLoadingProfile(true);
            await updateProfilePassword({
                current_password: currentPassword,
                new_password: newPassword,
                new_password_confirmation: confirmPassword
            });
            Alert.alert("Success", "Password changed successfully!");
            setChangePasswordModalVisible(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            Alert.alert("Failed", error.message || "Could not change password.");
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const handleDeleteAccount = async () => {
        try {
            setIsLoadingProfile(true);
            await deleteAccount();
            Alert.alert("Account Deleted", "Your account has been permanently removed.");
            setDeleteAccountModalVisible(false);
            handleLogout();
        } catch (error: any) {
            Alert.alert("Failed", error.message || "Could not delete account.");
        } finally {
            setIsLoadingProfile(false);
        }
    };

    return (
        <ScrollView 
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={{ paddingBottom: bottomPadding + 40 }}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.content}>
                {/* Avatar + Name Section */}
                <View style={styles.header}>
                    <TouchableOpacity 
                        style={styles.avatarContainer} 
                        onPress={cycleAvatar}
                        activeOpacity={0.8}
                    >
                        <Image
                            source={profilePictureUrl ? { uri: profilePictureUrl } : AVATARS[avatarId]}
                            style={[styles.avatar, { backgroundColor: colors.surface }]}
                            contentFit="cover"
                        />
                        <View style={[styles.badgeContainer, { backgroundColor: colors.primary }]}>
                            <MaterialIcons name="edit" size={12} color="#FFF" />
                        </View>
                    </TouchableOpacity>
                    
                    {isLoadingProfile ? (
                        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
                    ) : (
                        <>
                            <Text style={[styles.name, { color: colors.heading }]}>{displayName}</Text>
                            <Text style={[styles.email, { color: colors.text, opacity: 0.6 }]}>{displayEmail || '...'}</Text>
                        </>
                    )}
                </View>

                {/* Menu List */}
                <View style={styles.menuContainer}>
                    <MenuRow 
                        iconProvider={Feather} 
                        iconName="user" 
                        title="Personal Information" 
                        onPress={() => router.push('/personal-information' as any)} 
                        colors={colors} 
                    />
                    
                    <MenuRow 
                        iconProvider={Feather} 
                        iconName="shopping-bag" 
                        title="My Orders" 
                        onPress={() => router.push('/my-orders' as any)} 
                        colors={colors} 
                    />
                    
                    <MenuRow 
                        iconProvider={Feather} 
                        iconName="map-pin" 
                        title="Addresses" 
                        onPress={() => router.push('/addresses' as any)} 
                        colors={colors} 
                    />
                    
                    <MenuRow 
                        iconProvider={Feather} 
                        iconName="credit-card" 
                        title="Payment Methods" 
                        onPress={() => router.push('/payment-methods' as any)} 
                        colors={colors} 
                    />
                    
                    {/* Settings Accordion */}
                    <TouchableOpacity 
                        style={[styles.menuRow, { borderBottomColor: colors.border + '15' }]} 
                        onPress={() => setIsSettingsOpen(!isSettingsOpen)}
                    >
                        <View style={styles.menuLeft}>
                            <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
                                <Feather name="settings" size={18} color={colors.primary} />
                            </View>
                            <Text style={[styles.menuTitle, { color: colors.heading }]}>Settings</Text>
                        </View>
                        <Feather name={isSettingsOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.text} opacity={0.3} />
                    </TouchableOpacity>

                    {isSettingsOpen && (
                        <View style={[styles.subMenu, { backgroundColor: colors.background }]}>
                            <MenuRow 
                                iconProvider={Feather} 
                                iconName="lock" 
                                title="Change Password" 
                                onPress={() => setChangePasswordModalVisible(true)} 
                                colors={colors} 
                            />

                            <MenuRow 
                                iconProvider={Feather} 
                                iconName="user-x" 
                                title="Delete Account" 
                                onPress={() => setDeleteAccountModalVisible(true)} 
                                colors={colors} 
                                titleStyle={{ color: '#FF4444' }}
                            />

                            {/* Appearance Section now INSIDE Settings */}
                            <View style={styles.appearanceSection}>
                                <Text style={[styles.sectionLabel, { color: colors.text, opacity: 0.5 }]}>APPEARANCE</Text>
                                <View style={[styles.themeToggleWrap, { backgroundColor: colors.surface }]}>
                                    <TouchableOpacity 
                                        style={[styles.themeBtn, themeMode === 'light' && styles.activeThemeBtn, themeMode === 'light' && { backgroundColor: colors.background }]}
                                        onPress={() => setThemeMode('light')}
                                    >
                                        <Feather name="sun" size={14} color={themeMode === 'light' ? colors.primary : colors.text} />
                                        <Text style={[styles.themeBtnText, { color: themeMode === 'light' ? colors.primary : colors.text }]}>Light</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.themeBtn, themeMode === 'dark' && styles.activeThemeBtn, themeMode === 'dark' && { backgroundColor: colors.background }]}
                                        onPress={() => setThemeMode('dark')}
                                    >
                                        <Feather name="moon" size={14} color={themeMode === 'dark' ? colors.primary : colors.text} />
                                        <Text style={[styles.themeBtnText, { color: themeMode === 'dark' ? colors.primary : colors.text }]}>Dark</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.themeBtn, themeMode === 'system' && styles.activeThemeBtn, themeMode === 'system' && { backgroundColor: colors.background }]}
                                        onPress={() => setThemeMode('system')}
                                    >
                                        <Feather name="sliders" size={14} color={themeMode === 'system' ? colors.primary : colors.text} />
                                        <Text style={[styles.themeBtnText, { color: themeMode === 'system' ? colors.primary : colors.text }]}>System</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}

                    <MenuRow 
                        iconProvider={Feather} 
                        iconName="log-out" 
                        title="Logout" 
                        onPress={() => setLogoutModalVisible(true)} 
                        colors={colors} 
                        isLast
                    />
                </View>
            </View>

            {/* Change Password Modal */}
            <Modal
                visible={isChangePasswordModalVisible}
                transparent={true}
                animationType="slide"
            >
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: '#FFF9F2' }]}>
                        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '10' }]}>
                            <Feather name="lock" size={24} color={colors.primary} />
                        </View>
                        <Text style={[styles.modalTitle, { color: '#4A2B2B' }]}>Change Password</Text>
                        
                        <View style={styles.inputGroup}>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Current Password"
                                secureTextEntry
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder="New Password"
                                secureTextEntry
                                value={newPassword}
                                onChangeText={setNewPassword}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Confirm New Password"
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity 
                                style={[styles.cancelBtn, { backgroundColor: '#D38C9D' }]}
                                onPress={() => setChangePasswordModalVisible(false)}
                            >
                                <Text style={styles.btnTextWhite}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.saveBtn, { backgroundColor: '#FF5800' }]}
                                onPress={handleChangePassword}
                            >
                                <Text style={styles.btnTextWhite}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Delete Account Modal */}
            <Modal
                visible={isDeleteAccountModalVisible}
                transparent={true}
                animationType="fade"
            >
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: '#FFF9F2' }]}>
                        <View style={[styles.iconCircle, { backgroundColor: '#FFEBEB' }]}>
                            <Feather name="alert-triangle" size={24} color="#FF4444" />
                        </View>
                        <Text style={[styles.modalTitle, { color: '#4A2B2B' }]}>Delete Account?</Text>
                        <Text style={styles.warningText}>
                            Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.
                        </Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity 
                                style={[styles.cancelBtn, { backgroundColor: '#D38C9D' }]}
                                onPress={() => setDeleteAccountModalVisible(false)}
                            >
                                <Text style={styles.btnTextWhite}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.deleteBtn, { backgroundColor: '#E53935' }]}
                                onPress={handleDeleteAccount}
                            >
                                <Text style={styles.btnTextWhite}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Logout Modal */}
            <Modal
                visible={isLogoutModalVisible}
                transparent={true}
                animationType="fade"
            >
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <View style={[styles.logoutModalContent, { backgroundColor: colors.surface }]}>
                        <View style={[styles.logoutIconBox, { backgroundColor: colors.primary + '10' }]}>
                            <Feather name="log-out" size={32} color={colors.primary} />
                        </View>
                        <Text style={[styles.logoutModalTitle, { color: colors.heading }]}>Logout Session?</Text>
                        <Text style={[styles.logoutModalSubtitle, { color: colors.text }]}>
                            Are you sure you want to end your session? You can log back in later.
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity 
                                style={[styles.cancelBtn, { backgroundColor: '#D38C9D' }]}
                                onPress={() => setLogoutModalVisible(false)}
                            >
                                <Text style={styles.btnTextWhite}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                                onPress={handleLogout}
                            >
                                <Text style={styles.btnTextWhite}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

function MenuRow({ iconProvider: Icon, iconName, title, onPress, colors, isLast }: any) {
    return (
        <TouchableOpacity 
            style={[styles.menuRow, { borderBottomColor: isLast ? 'transparent' : colors.border + '15' }]} 
            onPress={onPress}
        >
            <View style={styles.menuLeft}>
                <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
                    <Icon name={iconName} size={18} color={colors.primary} />
                </View>
                <Text style={[styles.menuTitle, { color: colors.heading }]}>{title}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.text} opacity={0.3} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 20,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: '#FFF',
    },
    badgeContainer: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    name: {
        fontSize: 22,
        fontFamily: Typography.h2,
        marginBottom: 4,
        textAlign: 'center',
    },
    email: {
        fontSize: 14,
        fontFamily: Typography.body,
        textAlign: 'center',
    },
    menuContainer: {
        borderRadius: 24,
        overflow: 'hidden',
    },
    subMenu: {
        paddingLeft: 12,
        borderRadius: 16,
        marginTop: -1,
    },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    menuLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuTitle: {
        fontSize: 16,
        fontFamily: Typography.h2,
    },
    appearanceSection: {
        marginTop: 24,
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 12,
        letterSpacing: 1,
    },
    themeToggleWrap: {
        flexDirection: 'row',
        padding: 4,
        borderRadius: 14,
        height: 52,
    },
    themeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        gap: 8,
    },
    activeThemeBtn: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    themeBtnText: {
        fontSize: 13,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 32,
        padding: 28,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    iconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 20,
        textAlign: 'center',
        fontFamily: Typography.h1,
    },
    inputGroup: {
        width: '100%',
        gap: 12,
        marginBottom: 24,
    },
    modalInput: {
        height: 56,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#4A2B2B',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    warningText: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
        paddingHorizontal: 10,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelBtn: {
        flex: 1,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveBtn: {
        flex: 1,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#FF5800',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    deleteBtn: {
        flex: 1,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#E53935',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    confirmBtn: {
        flex: 1,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnTextWhite: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    logoutModalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 32,
        padding: 24,
        alignItems: 'center',
    },
    logoutIconBox: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    logoutModalTitle: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 12,
        textAlign: 'center',
        fontFamily: Typography.h1,
    },
    logoutModalSubtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
        paddingHorizontal: 10,
        fontFamily: Typography.body,
    },
});

export default ProfilePanel;
