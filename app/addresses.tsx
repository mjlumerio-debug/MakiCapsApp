import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUiStore, removeAddress, setActiveAddress } from '../lib/ui_store';
import * as Haptics from 'expo-haptics';
import MakiModal from '../components/MakiModal';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '@/constants/theme';

export default function AddressesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useAppTheme();
    const { addresses, activeAddressId } = useUiStore();
    const [showSuccessModal, setShowSuccessModal] = React.useState(false);
    
    const sortedAddresses = React.useMemo(() => {
        return [...addresses].sort((a, b) => {
            if (a.id === activeAddressId) return -1;
            if (b.id === activeAddressId) return 1;
            return 0;
        });
    }, [addresses, activeAddressId]);

    const handleSelectAddress = (id: string) => {
        setActiveAddress(id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        setShowSuccessModal(true);
        
        // Auto-close and navigate after 1.5 seconds
        setTimeout(() => {
            setShowSuccessModal(false);
            // Small delay to allow modal close animation to finish before navigation
            setTimeout(() => {
                router.replace('/home_dashboard');
            }, 400);
        }, 1500);
    };


    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.primary + '0A' }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <View style={[styles.backBtnInner, { backgroundColor: colors.primary + '15' }]}>
                        <Feather name="chevron-left" size={24} color={colors.primary} />
                    </View>
                </TouchableOpacity>
                <Text style={[styles.pageTitle, { color: colors.heading }]}>Delivery Address</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Address List or Empty State */}
            {addresses.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="location" size={48} color={colors.primary + '80'} />
                        <View style={styles.mapGrid}>
                            <View style={[styles.mapTile, { backgroundColor: colors.text + '20' }]} />
                            <View style={[styles.mapTile, { backgroundColor: colors.text + '20' }]} />
                            <View style={[styles.mapTile, { backgroundColor: colors.text + '20' }]} />
                            <View style={[styles.mapTile, { backgroundColor: colors.text + '20' }]} />
                            <View style={[styles.mapTile, { backgroundColor: colors.text + '20' }]} />
                            <View style={[styles.mapTile, { backgroundColor: colors.text + '20' }]} />
                        </View>
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.heading }]}>Your address book is empty</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.text }]}>
                        Add your preferred delivery address{'\n'}to help us serve you better
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={sortedAddresses}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => {
                        const isActive = item.id === activeAddressId;
                        
                        // Professional Icon Logic
                        const addressText = `${item.street} ${item.subdivision} ${item.notes}`.toLowerCase();
                        let iconName: keyof typeof Ionicons.glyphMap = 'location-sharp';
                        if (addressText.includes('home') || addressText.includes('house')) iconName = 'home-sharp';
                        else if (addressText.includes('work') || addressText.includes('office') || addressText.includes('business')) iconName = 'business-sharp';
                        else if (addressText.includes('apt') || addressText.includes('condo') || addressText.includes('building')) iconName = 'business-sharp';

                        // Deduplicated Text Logic
                        const primary = (item.subdivision || item.street || 'Unnamed Location').trim();
                        const areaParts = [item.barangay, item.city]
                            .map(p => String(p || '').trim())
                            .filter(p => p && !primary.toLowerCase().includes(p.toLowerCase()));
                        const secondary = areaParts.join(', ') || item.province || '';

                        return (
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => handleSelectAddress(item.id)}
                                style={[
                                    styles.addressCard, 
                                    { backgroundColor: colors.surface, borderColor: colors.primary + '20' },
                                    isActive && [styles.addressCardActive, { borderColor: colors.primary, backgroundColor: colors.primary + '05' }]
                                ]}
                            >
                                <View style={styles.addressInfo}>
                                    <View style={[
                                        styles.locationIconBg, 
                                        { backgroundColor: colors.background },
                                        isActive && { backgroundColor: colors.primary }
                                    ]}>
                                        <Ionicons 
                                            name={iconName} 
                                            size={18} 
                                            color={isActive ? "#FFFFFF" : colors.primary} 
                                        />
                                    </View>
                                    <View style={styles.addressContent}>
                                        <View style={styles.addressHeaderRow}>
                                            <Text style={[styles.addressStreet, { color: colors.heading }]} numberOfLines={1}>
                                                {primary}
                                            </Text>
                                            {isActive && (
                                                <View style={[styles.activeBadge, { backgroundColor: colors.primary + '15' }]}>
                                                    <Text style={[styles.activeBadgeText, { color: colors.primary }]}>SELECTED</Text>
                                                </View>
                                            )}
                                        </View>
                                        
                                        <Text style={[styles.fullAddressText, { color: colors.text }]} numberOfLines={2}>
                                            {secondary}
                                        </Text>
                                        
                                        {item.notes ? (
                                            <View style={styles.noteContainer}>
                                                <Feather name="info" size={10} color={colors.primary} style={{ marginRight: 4 }} />
                                                <Text style={[styles.notesText, { color: colors.primary }]} numberOfLines={1}>
                                                    {item.notes}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>
                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity 
                                            style={[styles.editCardBtn, { backgroundColor: colors.background }]} 
                                            onPress={() => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                router.push({ pathname: '/new-address', params: { id: item.id } } as any);
                                            }}
                                        >
                                            <Feather name="edit-2" size={16} color={colors.text} />
                                        </TouchableOpacity>
                                    </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            {/* Bottom Button */}
            <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 24), backgroundColor: colors.background }]}>
                <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                    activeOpacity={0.85}
                    onPress={() => {
                        router.push('/new-address' as any);
                    }}
                >
                    <Text style={styles.addBtnText}>Add Address</Text>
                </TouchableOpacity>
            </View>

            <MakiModal
                visible={showSuccessModal}
                type="success"
                title="Address Updated"
                message="Your delivery location has been successfully changed. Returning to menu..."
                showFooter={false}
                onConfirm={() => {}}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    backBtnInner: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pageTitle: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: Typography.h1,
        letterSpacing: 0.2,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 24,
        position: 'relative',
    },
    mapGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: 60,
        justifyContent: 'center',
        gap: 2,
        marginTop: 4,
        opacity: 0.3,
    },
    mapTile: {
        width: 16,
        height: 12,
        transform: [{ skewX: '-20deg' }],
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: Typography.h1,
        marginBottom: 12,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        fontFamily: Typography.body,
        textAlign: 'center',
        lineHeight: 22,
    },
    bottomContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    addBtn: {
        height: 56,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    addBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 20,
    },
    addressCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    addressCardActive: {
        borderWidth: 2,
    },
    activeIndicator: {
        marginLeft: 8,
    },
    activeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        gap: 4,
        alignSelf: 'flex-start',
    },
    activeBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    addressHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    noteContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.03)',
        alignSelf: 'flex-start',
    },
    addressInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        minWidth: 0,
        marginRight: 8,
    },
    addressContent: {
        flex: 1,
        minWidth: 0,
        flexShrink: 1,
    },
    locationIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    addressStreet: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: Typography.h1,
        lineHeight: 21,
        flexShrink: 1,
    },
    fullAddressText: {
        fontSize: 13,
        fontFamily: Typography.body,
        lineHeight: 18,
        marginTop: 2,
    },
    notesText: {
        fontSize: 12,
        marginTop: 4,
        fontWeight: '600',
        fontFamily: Typography.button,
    },
    deleteBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionButtons: {
        flexDirection: 'column',
        gap: 8,
        marginLeft: 8,
        flexShrink: 0,
        alignSelf: 'flex-start',
    },
    editCardBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
