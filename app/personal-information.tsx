import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { updateUserProfile, fetchCurrentUser } from '@/lib/auth_api';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Animated as RNAnimated,
    Easing as RNEasing,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Modal,
    Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PersonalInformationScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // Tracking initial values for conditional alerts
    const [initialName, setInitialName] = useState('');
    const [initialPhone, setInitialPhone] = useState('');

    // Modal Visibility States
    const [isNameModalVisible, setNameModalVisible] = useState(false);
    const [isPhoneModalVisible, setPhoneModalVisible] = useState(false);
    const [isCountryPickerVisible, setCountryPickerVisible] = useState(false);
    const [isSuccessModalVisible, setSuccessModalVisible] = useState(false);

    // Temp states for editing
    const [tempFirstName, setTempFirstName] = useState('');
    const [tempLastName, setTempLastName] = useState('');
    const [tempPhone, setTempPhone] = useState('');
    
    // Validation states
    const [phoneError, setPhoneError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Entrance animations
    const headerAnim = useRef(new RNAnimated.Value(0)).current;
    const avatarAnim = useRef(new RNAnimated.Value(0)).current;
    const formAnim = useRef(new RNAnimated.Value(0)).current;
    const buttonAnim = useRef(new RNAnimated.Value(0)).current;

    // Load user profile from Backend/AsyncStorage on mount
    useEffect(() => {
        const loadUserProfile = async () => {
            try {
                // Try fetching fresh data from backend first
                let profile;
                try {
                    console.log('[PersonalInformation] Fetching fresh profile from backend...');
                    profile = await fetchCurrentUser();
                    console.log('[PersonalInformation] Profile fetched successfully:', profile);
                    // Update AsyncStorage with fresh data
                    await AsyncStorage.setItem('user_profile', JSON.stringify(profile));
                } catch (apiError) {
                    console.warn('[PersonalInformation] Backend fetch failed, falling back to local storage:', apiError);
                    const profileJson = await AsyncStorage.getItem('user_profile');
                    if (profileJson) {
                        profile = JSON.parse(profileJson);
                    }
                }

                if (profile) {
                    // Map from common fields, prioritizing the ones from our API mapper
                    const first = profile.firstName || profile.first_name || '';
                    const last = profile.lastName || profile.last_name || '';
                    const name = `${first} ${last}`.trim() || 'User Profile';
                    const userEmail = profile.email || '';
                    
                    // Prioritize database column name 'mobile_number' then 'contactNumber'
                    let userPhone = profile.contactNumber || profile.mobile_number || profile.mobileNumber || '';
                    
                    // Strip prefixes for display logic
                    if (userPhone.startsWith('+63')) {
                        userPhone = userPhone.substring(3);
                    } else if (userPhone.startsWith('0')) {
                        userPhone = userPhone.substring(1);
                    } else if (userPhone.startsWith('63')) {
                        userPhone = userPhone.substring(2);
                    }

                    setFullName(name);
                    setEmail(userEmail);
                    setPhone(userPhone);
                    setInitialName(name);
                    setInitialPhone(userPhone);
                    setTempFirstName(first);
                    setTempLastName(last);
                    setTempPhone(userPhone);
                } else {
                    console.log('[PersonalInformation] No profile data found in API or local storage.');
                }
            } catch (e) {
                console.error('Failed to load user profile:', e);
            }
        };
        loadUserProfile();
    }, []);

    useEffect(() => {
        RNAnimated.stagger(60, [
            RNAnimated.timing(headerAnim, {
                toValue: 1, duration: 350,
                easing: RNEasing.out(RNEasing.exp),
                useNativeDriver: true,
            }),
            RNAnimated.timing(avatarAnim, {
                toValue: 1, duration: 380,
                easing: RNEasing.out(RNEasing.exp),
                useNativeDriver: true,
            }),
            RNAnimated.timing(formAnim, {
                toValue: 1, duration: 400,
                easing: RNEasing.out(RNEasing.exp),
                useNativeDriver: true,
            }),
            RNAnimated.timing(buttonAnim, {
                toValue: 1, duration: 350,
                easing: RNEasing.out(RNEasing.exp),
                useNativeDriver: true,
            }),
        ]).start();
    }, [headerAnim, avatarAnim, formAnim, buttonAnim]);

    const makeEntrance = (anim: RNAnimated.Value, offsetY = 20) => ({
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [offsetY, 0] }) }],
    });

    const handleSaveName = () => {
        if (tempFirstName.trim() && tempLastName.trim()) {
            setFullName(`${tempFirstName.trim()} ${tempLastName.trim()}`);
            setNameModalVisible(false);
        }
    };

    const validatePhone = (text: string) => {
        setTempPhone(text);
        if (text.length > 0 && !text.startsWith('9')) {
            setPhoneError('Number must start with 9');
        } else if (text.length > 0 && text.length < 10) {
            setPhoneError('Must be 10 digits');
        } else {
            setPhoneError('');
        }
    };

    const handleSavePhone = () => {
        if (tempPhone.length === 10 && tempPhone.startsWith('9')) {
            setPhone(tempPhone);
            setPhoneModalVisible(false);
        }
    };

    const handleFinalSave = async () => {
        const hasChanges = fullName !== initialName || phone !== initialPhone;
        
        if (hasChanges) {
            setIsSaving(true);
            try {
                // 1. Prepare data for backend
                const nameParts = fullName.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                // Backend expects +63 prefix for Consistency
                const mobileNumber = phone.startsWith('+63') ? phone : `+63${phone}`;

                // 2. Call Backend API
                await updateUserProfile({
                    firstName,
                    lastName,
                    mobileNumber,
                });

                // 3. Persist updated profile back to AsyncStorage locally
                const profileJson = await AsyncStorage.getItem('user_profile');
                if (profileJson) {
                    const profile = JSON.parse(profileJson);
                    profile.firstName = firstName;
                    profile.lastName = lastName;
                    profile.contactNumber = mobileNumber;
                    await AsyncStorage.setItem('user_profile', JSON.stringify(profile));
                }

                setSuccessModalVisible(true);
            } catch (e: any) {
                console.error('Failed to save profile:', e);
                Alert.alert("Update Failed", e.message || "Something went wrong while updating your profile.");
            } finally {
                setIsSaving(false);
            }
        } else {
            router.back();
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            <RNAnimated.View style={[styles.topNav, makeEntrance(headerAnim, 10)]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Feather name="arrow-left" size={22} color="#2C2C2C" />
                </TouchableOpacity>
                <Text style={[styles.pageTitle, { color: '#2C2C2C' }]}>Personal Information</Text>
                <View style={{ width: 40 }} />
            </RNAnimated.View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Avatar */}
                    <RNAnimated.View style={[styles.avatarSection, makeEntrance(avatarAnim, 16)]}>
                        <View style={styles.avatarWrap}>
                            <Image
                                source={require('../assets/images/chef.png')}
                                style={styles.avatar}
                                resizeMode="cover"
                            />
                            <View style={styles.badgeContainer}>
                                <MaterialIcons name="verified" size={13} color="#FFFFFF" />
                            </View>
                        </View>
                        <TouchableOpacity>
                            <Text style={styles.changePhotoText}>Change your photo</Text>
                        </TouchableOpacity>
                    </RNAnimated.View>

                    {/* Form */}
                    <RNAnimated.View style={[styles.form, makeEntrance(formAnim, 20)]}>
                        {/* Full Name */}
                        <TouchableOpacity 
                            style={styles.inputGroup} 
                            onPress={() => setNameModalVisible(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.inputLabel, { color: '#888888' }]}>Full Name</Text>
                            <View style={styles.interactiveInputRow}>
                                <Text style={[styles.staticText, { color: '#2C2C2C' }]}>{fullName}</Text>
                                <Feather name="edit-2" size={14} color="#888888" />
                            </View>
                        </TouchableOpacity>

                        {/* Email */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: '#888888' }]}>Email</Text>
                            <View style={styles.staticInputRow}>
                                <Text style={[styles.staticText, { color: '#888888' }]}>{email}</Text>
                            </View>
                        </View>

                        {/* Mobile Number */}
                        <TouchableOpacity 
                            style={styles.inputGroup} 
                            onPress={() => setPhoneModalVisible(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.inputLabel, { color: '#888888' }]}>Mobile Number</Text>
                            <View style={styles.interactiveInputRow}>
                                <View style={styles.phoneDisplayRow}>
                                    <Text style={[styles.phonePrefix, { color: '#2C2C2C' }]}>+63</Text>
                                    <Text style={[styles.staticText, { color: '#2C2C2C' }]}>{phone}</Text>
                                </View>
                                <Feather name="edit-2" size={14} color="#888888" />
                            </View>
                        </TouchableOpacity>
                    </RNAnimated.View>
                </ScrollView>

                {/* Save Changes Button - Styled with dynamic safe area insets */}
                <RNAnimated.View style={[
                    styles.saveWrap, 
                    { paddingBottom: Math.max(insets.bottom, 24) },
                    makeEntrance(buttonAnim, 12)
                ]}>
                    <TouchableOpacity
                        style={[styles.finalSaveButton, isSaving && { opacity: 0.7 }]}
                        activeOpacity={0.85}
                        onPress={handleFinalSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text style={styles.finalSaveText}>Save Changes</Text>
                        )}
                    </TouchableOpacity>
                </RNAnimated.View>
            </KeyboardAvoidingView>

            {/* Name Edit Modal */}
            <Modal visible={isNameModalVisible} animationType="slide" transparent={false}>
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setNameModalVisible(false)} style={styles.modalCloseBtn}>
                            <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Name</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    
                    <View style={styles.modalContent}>
                        <Text style={styles.modalSubtitle}>This is how we will address you.</Text>
                        
                        <View style={styles.modalInputGroup}>
                            <Text style={styles.modalInputLabel}>First Name <Text style={{color: '#FF4444'}}>*</Text></Text>
                            <TextInput
                                style={styles.modalInput}
                                value={tempFirstName}
                                onChangeText={setTempFirstName}
                                placeholder="Enter first name"
                                autoFocus
                            />
                        </View>

                        <View style={styles.modalInputGroup}>
                            <Text style={styles.modalInputLabel}>Last Name <Text style={{color: '#FF4444'}}>*</Text></Text>
                            <TextInput
                                style={styles.modalInput}
                                value={tempLastName}
                                onChangeText={setTempLastName}
                                placeholder="Enter last name"
                            />
                        </View>
                    </View>

                    <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                        <TouchableOpacity 
                            style={[styles.modalSaveBtn, (!tempFirstName || !tempLastName) && styles.disabledBtn]} 
                            onPress={handleSaveName}
                            disabled={!tempFirstName || !tempLastName}
                        >
                            <Text style={styles.modalSaveBtnText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Phone Edit Modal */}
            <Modal visible={isPhoneModalVisible} animationType="slide" transparent={false}>
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setPhoneModalVisible(false)} style={styles.modalCloseBtn}>
                            <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Mobile Number</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    
                    <View style={styles.modalContent}>
                        <Text style={styles.modalSubtitle}>You will be contacted about your order at this Mobile Number.</Text>
                        
                        <View style={styles.modalInputGroup}>
                            <Text style={styles.modalInputLabel}>Mobile Number</Text>
                        </View>
                        
                        <View style={styles.phoneInputRow}>
                            <TouchableOpacity 
                                style={styles.countryPicker}
                                onPress={() => setCountryPickerVisible(!isCountryPickerVisible)}
                            >
                                <Image 
                                    source={{ uri: 'https://flagcdn.com/w40/ph.png' }} 
                                    style={styles.flagIcon} 
                                />
                                <Text style={styles.countryCode}>+63</Text>
                                <Ionicons name="chevron-down" size={14} color="#888888" />
                            </TouchableOpacity>
                            <TextInput
                                style={[styles.modalInput, styles.phoneTextInput, phoneError ? styles.errorInput : null]}
                                value={tempPhone}
                                onChangeText={validatePhone}
                                placeholder="9XXXXXXXXX"
                                keyboardType="phone-pad"
                                maxLength={10}
                                autoFocus
                            />
                        </View>

                        {phoneError ? (
                            <Text style={styles.errorText}>{phoneError}</Text>
                        ) : null}

                        {/* Country preview visible only when toggled */}
                        {isCountryPickerVisible && (
                            <View style={styles.countryPreview}>
                                <Ionicons name="checkmark" size={16} color="#2C2C2C" />
                                <Text style={styles.countryPreviewText}>+63 Philippines</Text>
                                <Image 
                                    source={{ uri: 'https://flagcdn.com/w40/ph.png' }} 
                                    style={styles.flagIconSmall} 
                                />
                            </View>
                        )}
                    </View>

                    <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                        <TouchableOpacity 
                            style={[
                                styles.modalContinueBtn, 
                                (tempPhone.length !== 10 || !!phoneError) && styles.disabledContinueBtn
                            ]} 
                            onPress={handleSavePhone}
                            disabled={tempPhone.length !== 10 || !!phoneError}
                        >
                            <Text style={[
                                styles.modalContinueBtnText,
                                (tempPhone.length === 10 && !phoneError) && { color: '#FFFFFF' }
                            ]}>Continue</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Custom Success Alert Modal */}
            <Modal
                visible={isSuccessModalVisible}
                transparent={true}
                animationType="fade"
            >
                <View style={styles.modalOverlay}>
                    <RNAnimated.View style={styles.successAlertContent}>
                        <View style={styles.successIconOuter}>
                            <View style={styles.successIconInner}>
                                <Ionicons name="checkmark" size={32} color="#FFFFFF" />
                            </View>
                        </View>
                        
                        <Text style={styles.successTitle}>Profile Updated</Text>
                        <Text style={styles.successSubtitle}>Your changes have been saved successfully!</Text>
                        
                        <TouchableOpacity 
                            style={styles.successOkBtn}
                            onPress={() => {
                                setSuccessModalVisible(false);
                                router.back();
                            }}
                        >
                            <Text style={styles.successOkBtnText}>OK</Text>
                        </TouchableOpacity>
                    </RNAnimated.View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    pageTitle: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.2,
        fontFamily: 'ShipporiMincho-Bold',
    },
    scrollContent: {
        paddingBottom: 24,
    },
    avatarSection: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 28,
    },
    avatarWrap: {
        position: 'relative',
        marginBottom: 10,
    },
    avatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#FDDAD8',
    },
    badgeContainer: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: '#FF5800',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    changePhotoText: {
        fontSize: 14,
        color: '#FF5800',
        fontWeight: '600',
    },
    form: {
        paddingHorizontal: 24,
    },
    inputGroup: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 13,
        marginBottom: 10,
        fontWeight: '600',
        color: '#888888',
    },
    interactiveInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1.5,
        borderBottomColor: '#F0F0F0',
        paddingBottom: 12,
    },
    staticInputRow: {
        borderBottomWidth: 1.5,
        borderBottomColor: '#F0F0F0',
        paddingBottom: 12,
    },
    staticText: {
        fontSize: 16,
        fontWeight: '500',
    },
    phoneDisplayRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    phonePrefix: {
        fontSize: 16,
        fontWeight: '600',
        marginRight: 6,
    },
    saveWrap: {
        paddingHorizontal: 24,
        paddingTop: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F8F9FA',
    },
    finalSaveButton: {
        backgroundColor: '#FF5800', // MakiCaps Orange
        borderRadius: 28, // Fully rounded (half of height 56)
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF5800',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    finalSaveText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalTitle: {
        fontSize: 19,
        fontWeight: '700',
        color: '#2C2C2C',
        fontFamily: 'ShipporiMincho-Bold', // Cozy typography
    },
    modalContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    modalSubtitle: {
        fontSize: 15,
        color: '#666666',
        lineHeight: 22,
        marginBottom: 32,
    },
    modalInputGroup: {
        marginBottom: 24,
    },
    modalInputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2C2C2C',
        marginBottom: 10,
    },
    modalInput: {
        height: 54,
        borderWidth: 1.5,
        borderColor: '#E5E5E5',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#2C2C2C',
        backgroundColor: '#FFFFFF',
    },
    modalFooter: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    modalSaveBtn: {
        backgroundColor: '#FF5800', // MakiCaps Orange
        height: 54,
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF5800',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    modalSaveBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    disabledBtn: {
        opacity: 0.5,
        backgroundColor: '#F5F5F5',
    },

    // Phone Modal specific
    phoneInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    countryPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 54,
        borderWidth: 1.5,
        borderColor: '#E5E5E5',
        borderRadius: 12,
        paddingHorizontal: 12,
        gap: 6,
    },
    flagIcon: {
        width: 24,
        height: 16,
        borderRadius: 2,
    },
    countryCode: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2C2C2C',
    },
    phoneTextInput: {
        flex: 1,
    },
    errorInput: {
        borderColor: '#FF4444',
    },
    errorText: {
        color: '#FF4444',
        fontSize: 12,
        marginTop: 6,
        fontWeight: '500',
    },
    countryPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF7F0', // Light orange tint for cozy look
        padding: 12,
        borderRadius: 10,
        marginTop: 12,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#FFE5D0',
        gap: 8,
    },
    countryPreviewText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2C2C2C',
    },
    flagIconSmall: {
        width: 20,
        height: 13,
        borderRadius: 1,
    },
    modalContinueBtn: {
        backgroundColor: '#FF5800', // MakiCaps Orange
        height: 54,
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledContinueBtn: {
        backgroundColor: '#F5F5F5',
    },
    modalContinueBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2C2C2C',
    },

    // Success Alert Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    successAlertContent: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    successIconOuter: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FFF0E6', // Very light orange
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    successIconInner: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#FF5800', // Brand orange
        justifyContent: 'center',
        alignItems: 'center',
    },
    successTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#2C2C2C',
        marginBottom: 12,
        fontFamily: 'ShipporiMincho-Bold',
    },
    successSubtitle: {
        fontSize: 16,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 28,
    },
    successOkBtn: {
        backgroundColor: '#FF5800',
        width: '100%',
        height: 54,
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF5800',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    successOkBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    }
});
