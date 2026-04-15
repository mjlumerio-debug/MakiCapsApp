import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Alert,
    FlatList,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUiStore, removeAddress, setActiveAddress } from '../lib/ui_store';
import * as Haptics from 'expo-haptics';
import MakiModal from '../components/MakiModal';

export default function AddressesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { addresses, activeAddressId } = useUiStore();
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
    
    const sortedAddresses = React.useMemo(() => {
        return [...addresses].sort((a, b) => {
            if (a.id === activeAddressId) return -1;
            if (b.id === activeAddressId) return 1;
            return 0;
        });
    }, [addresses, activeAddressId]);

    const handleSelectAddress = (id: string) => {
        setActiveAddress(id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleDelete = (id: string) => {
        setPendingDeleteId(id);
        setShowDeleteModal(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <View style={styles.backBtnInner}>
                        <Feather name="chevron-left" size={24} color="#FF5800" />
                    </View>
                </TouchableOpacity>
                <Text style={styles.pageTitle}>Delivery Address</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Address List or Empty State */}
            {addresses.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="location" size={48} color="#FF9B6A" />
                        <View style={styles.mapGrid}>
                            <View style={styles.mapTile} />
                            <View style={styles.mapTile} />
                            <View style={styles.mapTile} />
                            <View style={styles.mapTile} />
                            <View style={styles.mapTile} />
                            <View style={styles.mapTile} />
                        </View>
                    </View>
                    <Text style={styles.emptyTitle}>Your address book is empty</Text>
                    <Text style={styles.emptySubtitle}>
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
                        return (
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => handleSelectAddress(item.id)}
                                style={[styles.addressCard, isActive && styles.addressCardActive]}
                            >
                                <View style={styles.addressInfo}>
                                    <View style={[styles.locationIconBg, isActive && styles.locationIconBgActive]}>
                                        <Ionicons name="location-sharp" size={20} color={isActive ? "#FFFFFF" : "#FF5800"} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={styles.addressStreet} numberOfLines={1}>
                                                {item.street || item.subdivision || item.fullAddress.split(',')[0] || 'Unnamed Location'}
                                            </Text>
                                            {isActive && (
                                                <View style={styles.activeIndicator}>
                                                    <View style={styles.activeBadge}>
                                                        <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                                                        <Text style={styles.activeBadgeText}>ACTIVE</Text>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.fullAddressText} numberOfLines={2}>
                                            {item.fullAddress}
                                        </Text>
                                        {item.notes ? (
                                            <Text style={styles.notesText} numberOfLines={1}>
                                                Note: {item.notes}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>
                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity 
                                            style={styles.editCardBtn} 
                                            onPress={() => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                router.push({ pathname: '/new-address', params: { id: item.id } } as any);
                                            }}
                                        >
                                            <Feather name="edit-2" size={16} color="#4B5563" />
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            style={styles.deleteBtn} 
                                            onPress={() => handleDelete(item.id)}
                                        >
                                            <Feather name="trash-2" size={16} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            {/* Bottom Button */}
            <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
                <TouchableOpacity
                    style={styles.addBtn}
                    activeOpacity={0.85}
                    onPress={() => {
                        router.push('/new-address' as any);
                    }}
                >
                    <Text style={styles.addBtnText}>Add Address</Text>
                </TouchableOpacity>
            </View>

            <MakiModal
                visible={showDeleteModal}
                type="delete"
                title="Delete Address?"
                message="Are you sure you want to remove this address? This action cannot be undone."
                confirmText="Delete"
                cancelText="Keep it"
                onConfirm={() => {
                    if (pendingDeleteId) {
                        removeAddress(pendingDeleteId);
                    }
                    setShowDeleteModal(false);
                    setPendingDeleteId(null);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setPendingDeleteId(null);
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FCFCFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
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
        backgroundColor: '#FFF0E6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pageTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
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
        backgroundColor: '#9CA3AF',
        transform: [{ skewX: '-20deg' }],
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
    },
    bottomContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        backgroundColor: '#FCFCFC',
    },
    addBtn: {
        backgroundColor: '#FF5800',
        height: 56,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF5800',
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
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
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
        borderColor: '#FF5800',
        borderWidth: 2,
        backgroundColor: '#FFF9F6',
    },
    locationIconBgActive: {
        backgroundColor: '#FF5800',
    },
    activeIndicator: {
        marginLeft: 8,
    },
    activeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF5800',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        gap: 4,
    },
    activeBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    addressInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF0E6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    addressStreet: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    fullAddressText: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
        marginTop: 2,
    },
    notesText: {
        fontSize: 12,
        color: '#FF5800',
        marginTop: 4,
        fontWeight: '600',
    },
    deleteBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionButtons: {
        flexDirection: 'column',
        gap: 8,
        marginLeft: 8,
    },
    editCardBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
