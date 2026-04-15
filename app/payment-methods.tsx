import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { requestPaymentLink, verifyPaymentOtp } from '@/lib/auth_api';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AccountType = 'gcash' | 'paymaya';

interface SavedAccount {
    id: string;
    type: AccountType;
    name: string;
    accountNumber: string;
}

export default function PaymentScreen() {
    const router = useRouter();

    // The single selected payment method ID
    const [selectedMethodId, setSelectedMethodId] = useState<string | null>('gcash_test');

    // Initial state: with temporary accounts already showing
    const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([
        {
            id: 'gcash_test',
            type: 'gcash',
            name: 'MakiCaps User',
            accountNumber: '09171234567',
        },
        {
            id: 'paymaya_test',
            type: 'paymaya',
            name: 'MakiCaps User',
            accountNumber: '09181234567',
        }
    ]);

    // Modal state for adding a new method
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedTypeToAdd, setSelectedTypeToAdd] = useState<AccountType | null>(null);
    const [accountName, setAccountName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    
    // Cozy Alert State
    const [alertConfig, setAlertConfig] = useState<{ visible: boolean; title: string; message: string; type: 'warning' | 'success' }>({ visible: false, title: '', message: '', type: 'warning' });

    const showCozyAlert = (title: string, message: string, type: 'warning' | 'success' = 'warning') => {
        setAlertConfig({ visible: true, title, message, type });
    };
    
    // OTP verification state inside the modal
    const [isVerifying, setIsVerifying] = useState(false);
    const [showOtpView, setShowOtpView] = useState(false);
    const [otp, setOtp] = useState('');

    const openAddModal = (type: AccountType) => {
        setSelectedTypeToAdd(type);
        setAccountName('');
        setAccountNumber('');
        setOtp('');
        setShowOtpView(false);
        setShowAddModal(true);
    };

    const closeAddModal = () => {
        setShowAddModal(false);
        setSelectedTypeToAdd(null);
        setAccountName('');
        setAccountNumber('');
        setOtp('');
        setShowOtpView(false);
    };

    const handleNextOtp = async () => {
        const cleanName = accountName.trim();
        const cleanNumber = accountNumber.trim();

        if (!cleanName) {
            showCozyAlert("Missing Information", "Please enter the Account Name.");
            return;
        }

        if (!cleanNumber) {
            showCozyAlert("Missing Information", "Please enter your Mobile Number.");
            return;
        }

        // Philippine mobile number strict validation (e.g., 09123456789)
        const phoneRegex = /^09\d{9}$/;
        if (!phoneRegex.test(cleanNumber)) {
            showCozyAlert("Invalid Input", "Please enter a valid 11-digit registered mobile number starting with '09'.");
            return;
        }

        Keyboard.dismiss();
        setIsVerifying(true);
        
        try {
            if (!selectedTypeToAdd) throw new Error("No type selected.");
            await requestPaymentLink(selectedTypeToAdd, cleanName, cleanNumber);
            setShowOtpView(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to link account.";
            showCozyAlert("Account Not Found", message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleVerifyAndSave = async () => {
        if (otp.length < 6) {
            showCozyAlert("Invalid OTP", "Please enter the 6-digit verification code.");
            return;
        }

        Keyboard.dismiss();
        setIsVerifying(true);

        try {
            if (!selectedTypeToAdd) throw new Error("No type selected.");
            const response = await verifyPaymentOtp(selectedTypeToAdd, accountNumber.trim(), otp);
            
            const newAccount: SavedAccount = {
                id: `${selectedTypeToAdd}_${Date.now()}`,
                type: selectedTypeToAdd,
                name: accountName.trim(),
                accountNumber: accountNumber.trim(),
            };
            setSavedAccounts([newAccount, ...savedAccounts]);
            setSelectedMethodId(newAccount.id);

            closeAddModal();
            showCozyAlert("Success", response.message, 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : "Verification failed.";
            showCozyAlert("Verification Failed", message);
        } finally {
            setIsVerifying(false);
        }
    };


    const getTypeDetails = (type: AccountType) => {
        if (type === 'gcash') {
            return { name: 'GCash', iconName: 'wallet', color: '#005CE6', bg: '#EAF2FF' };
        }
        return { name: 'PayMaya', iconName: 'credit-card', color: '#1CBF75', bg: '#E5FAF0' };
    };

    const renderMethodOption = (type: AccountType) => {
        const details = getTypeDetails(type);
        // Determine whether this general option is "selected".
        // Usually, the user selects a *saved* account. If they select a general option, maybe they just want to add it.
        // We'll map the "Add Payment Method" directly to these options instead, simplifying the flow.
        return (
            <TouchableOpacity
                style={styles.paymentCard}
                activeOpacity={0.7}
                onPress={() => openAddModal(type)}
            >
                <View style={styles.cardLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: details.bg }]}>
                        <MaterialCommunityIcons name={details.iconName as any} size={24} color={details.color} />
                    </View>
                    <Text style={styles.cardTitle}>Add {details.name} Account</Text>
                </View>
                <Feather name="plus" size={20} color="#9CA3AF" />
            </TouchableOpacity>
        );
    };

    const renderSavedAccount = (account: SavedAccount) => {
        const details = getTypeDetails(account.type);
        const isSelected = selectedMethodId === account.id;
        
        // Mask account number properly
        const masked = account.accountNumber.length >= 4 
            ? `${account.accountNumber.substring(0, 4)}****${account.accountNumber.substring(account.accountNumber.length - 4)}` 
            : '****';

        return (
            <TouchableOpacity
                key={account.id}
                style={[styles.paymentCard, isSelected && styles.paymentCardSelected]}
                activeOpacity={0.7}
                onPress={() => setSelectedMethodId(account.id)}
            >
                <View style={styles.cardLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: details.bg }]}>
                        <MaterialCommunityIcons name={details.iconName as any} size={24} color={details.color} />
                    </View>
                    <View>
                        <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>{details.name} • {account.name}</Text>
                        <Text style={styles.accountMask}>{masked}</Text>
                    </View>
                </View>
                <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
            
            {/* 1. Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Feather name="arrow-left" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payment</Text>
                <View style={{ width: 40 }} />{/* Spacer for centering */}
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent} 
                showsVerticalScrollIndicator={false}
            >
                {/* 2. Link New Account Section */}
                <Text style={styles.sectionTitle}>Link New Account</Text>
                {renderMethodOption('gcash')}
                {renderMethodOption('paymaya')}

                {/* 3. Saved Methods Section */}
                {savedAccounts.length > 0 && (
                    <View>
                        <View style={styles.divider} />
                        <Text style={styles.sectionTitle}>Saved Methods</Text>
                        {savedAccounts.map(account => renderSavedAccount(account))}
                    </View>
                )}
                
                {savedAccounts.length === 0 && (
                    <View style={styles.emptyStateContainer}>
                        <Feather name="shield" size={40} color="#D1D5DB" style={{ marginBottom: 12 }} />
                        <Text style={styles.emptyStateTitle}>No Saved Methods</Text>
                        <Text style={styles.emptyStateDesc}>Link a GCash or PayMaya account securely to streamline your checkout process.</Text>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>


            {/* Link Modal Overlay */}
            {showAddModal && (
                <View style={[StyleSheet.absoluteFill, styles.modalOverlay, { zIndex: 900, elevation: 900 }]}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                        style={styles.modalContent}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Link {selectedTypeToAdd === 'gcash' ? 'GCash' : 'PayMaya'} Account
                            </Text>
                            <TouchableOpacity onPress={closeAddModal} style={styles.closeBtn}>
                                <Feather name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalBody}>
                            {!showOtpView ? (
                                <>
                                    <Text style={styles.modalSubtitle}>Please provide your account details to initiate a secure connection.</Text>
                                    
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Account Name</Text>
                                        <TextInput
                                            style={styles.inputField}
                                            placeholder="Ex: Mark Lumerio"
                                            value={accountName}
                                            onChangeText={setAccountName}
                                            autoCapitalize="words"
                                            placeholderTextColor="#9CA3AF"
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Mobile Number</Text>
                                        <TextInput
                                            style={styles.inputField}
                                            placeholder="09XXXXXXXXX"
                                            value={accountNumber}
                                            onChangeText={setAccountNumber}
                                            keyboardType="phone-pad"
                                            maxLength={11}
                                            placeholderTextColor="#9CA3AF"
                                        />
                                        <Text style={{ fontSize: 13, color: '#888', marginTop: 10, fontStyle: 'italic' }}>
                                            *For testing, please use <Text style={{fontWeight: '700', color: '#FF5800'}}>{selectedTypeToAdd === 'gcash' ? '09171234567' : '09181234567'}</Text> to proceed.
                                        </Text>
                                    </View>

                                    <TouchableOpacity 
                                        style={styles.actionButton} 
                                        onPress={handleNextOtp}
                                        disabled={isVerifying}
                                    >
                                        {isVerifying ? (
                                            <ActivityIndicator color="#FFFFFF" />
                                        ) : (
                                            <Text style={styles.actionButtonText}>Proceed to Verification</Text>
                                        )}
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.modalSubtitle}>
                                        A 6-digit One Time Password (OTP) has been sent to +63 {accountNumber.substring(1)}.
                                    </Text>
                                    
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Enter OTP</Text>
                                        <TextInput
                                            style={[styles.inputField, { textAlign: 'center', fontSize: 24, letterSpacing: 8 }]}
                                            placeholder="000000"
                                            value={otp}
                                            onChangeText={setOtp}
                                            keyboardType="number-pad"
                                            maxLength={6}
                                            placeholderTextColor="#D1D5DB"
                                        />
                                    </View>

                                    <TouchableOpacity 
                                        style={[styles.actionButton, otp.length < 6 && styles.actionButtonDisabled]} 
                                        onPress={handleVerifyAndSave}
                                        disabled={isVerifying || otp.length < 6}
                                    >
                                        {isVerifying ? (
                                            <ActivityIndicator color="#FFFFFF" />
                                        ) : (
                                            <Text style={styles.actionButtonText}>Link Seamlessly</Text>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            )}

            {/* Cozy Alert Overlay */}
            {alertConfig.visible && (
                <View style={[StyleSheet.absoluteFill, styles.alertOverlay, { zIndex: 1000, elevation: 1000 }]}>
                    <View style={styles.alertContent}>
                        <View style={[styles.alertIconBox, { backgroundColor: alertConfig.type === 'success' ? '#E5FAF0' : '#FFF0E6' }]}>
                            {alertConfig.type === 'success' ? (
                                <Feather name="check" size={32} color="#1CBF75" />
                            ) : (
                                <Feather name="alert-triangle" size={32} color="#FF5800" />
                            )}
                        </View>
                        <Text style={styles.alertTitle}>{alertConfig.title}</Text>
                        <Text style={styles.alertMessage}>{alertConfig.message}</Text>
                        <TouchableOpacity style={styles.alertBtn} onPress={() => setAlertConfig(prev => ({ ...prev, visible: false }))}>
                            <Text style={styles.alertBtnText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#F8F9FA',
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        letterSpacing: 0.3,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 16,
        marginTop: 8,
    },
    paymentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    paymentCardSelected: {
        borderColor: '#FF5800',
        backgroundColor: '#FFF5F0',
        shadowColor: '#FF5800',
        shadowOpacity: 0.15,
        elevation: 4,
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2C2C2C',
    },
    cardTitleSelected: {
        color: '#1A1A1A',
    },
    accountMask: {
        fontSize: 13,
        color: '#888888',
        marginTop: 4,
    },
    radioCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioCircleSelected: {
        borderColor: '#FF5800',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FF5800',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 16,
    },
    emptyStateContainer: {
        alignItems: 'center',
        paddingVertical: 32,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        borderStyle: 'dashed',
    },
    emptyStateTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
        marginBottom: 6,
    },
    emptyStateDesc: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        paddingHorizontal: 24,
        lineHeight: 20,
    },
    footerWrap: {
        paddingHorizontal: 24,
        paddingVertical: 20,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
    },
    payButton: {
        backgroundColor: '#FFC107', // Yellow
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FFC107',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    payButtonDisabled: {
        backgroundColor: '#FDE68A',
        shadowOpacity: 0,
        elevation: 0,
    },
    payButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        letterSpacing: 0.5,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    closeBtn: {
        padding: 4,
    },
    modalBody: {
        padding: 24,
        paddingBottom: 40,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    inputField: {
        height: 54,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#111827',
    },
    actionButton: {
        backgroundColor: '#FF5800',
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
    },
    actionButtonDisabled: {
        backgroundColor: '#FFB28A',
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    // Alert Styles
    alertOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    alertContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 10,
    },
    alertIconBox: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    alertTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 10,
        textAlign: 'center',
    },
    alertMessage: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    alertBtn: {
        backgroundColor: '#FF5800',
        height: 50,
        width: '100%',
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    alertBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
