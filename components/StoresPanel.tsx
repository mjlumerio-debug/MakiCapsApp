import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Linking,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { MapView, Marker, type MapViewInstance } from './MapComponent';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { useBranch } from '@/state/contexts/BranchContext';
import { useAppStateFlow } from '@/hooks/useAppStateFlow';
import { useCart } from '@/state/contexts/CartContext';
import { type SelectedBranch } from '@/lib/ui_store';

interface StoresPanelProps {
    onOrderNow: () => void;
    bottomPadding: number;
}

export default function StoresPanel({ onOrderNow, bottomPadding }: StoresPanelProps) {
    const { colors, isDark } = useAppTheme();
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    
    // 🧠 CENTRAL STATE ENGINE SUBSCRIPTION
    const { state: branchState } = useBranch();
    const { setBranch } = useAppStateFlow();
    const { state: cartState } = useCart();

    const { availableBranches: branches, selectedBranch, isLoading } = branchState;
    const { items: cartItems } = cartState;

    const filteredBranches = useMemo(() => {
        if (!search.trim()) return branches;
        const query = search.toLowerCase();
        return branches.filter(
            (b) =>
                b.name.toLowerCase().includes(query) ||
                b.address.toLowerCase().includes(query)
        );
    }, [branches, search]);

    const handleNavigate = (branch: SelectedBranch) => {
        if (!branch.latitude || !branch.longitude) {
            Alert.alert('Location unavailable', 'This branch has no map coordinates yet.');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
        const latLng = `${branch.latitude},${branch.longitude}`;
        const label = branch.name;
        const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`,
            web: `https://www.google.com/maps/search/?api=1&query=${branch.latitude},${branch.longitude}`
        });

        if (url) {
            Linking.openURL(url).catch(() => {
                Alert.alert('Error', 'Could not open maps application.');
            });
        }
    };

    const handleSelectBranch = async (branch: SelectedBranch): Promise<void> => {
        if (!branch.is_available) {
            Alert.alert(
                'Outside Delivery Area',
                'This branch is currently unavailable for delivery to your selected location.'
            );
            return;
        }

        if (selectedBranch?.id === branch.id) {
            onOrderNow();
            return;
        }

        if (cartItems.length > 0) {
            Alert.alert(
                'Change Branch?',
                'Switching branches will clear your current cart.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Switch Branch',
                        style: 'destructive',
                        onPress: async () => {
                            await setBranch(branch, true);
                            onOrderNow();
                        },
                    },
                ]
            );
            return;
        }

        await setBranch(branch, true);
        onOrderNow();
    };

    const renderBranchCard = ({ item, index }: { item: SelectedBranch; index: number }) => {
        const distanceKm = Number(item.distance_km ?? 0);
        const inRange = !!item.is_available;
        const isSelected = selectedBranch?.id === item.id;

        return (
            <Animated.View 
                entering={FadeInUp.delay(index * 50).duration(400)}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary + '33', shadowColor: colors.primary }, isSelected && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.background }]}
            >
                <View style={styles.titleRow}>
                    <Text style={[styles.cardTitle, { color: colors.heading }]}>{item.name}</Text>
                    {isSelected && (
                        <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                            <Feather name="check-circle" size={12} color={colors.background} />
                            <Text style={[styles.selectedBadgeText, { color: colors.background }]}>Active</Text>
                        </View>
                    )}
                </View>
                
                <View style={styles.statusRow}>
                    <View style={[styles.badge, item.status === 'open' ? styles.badgeOpen : styles.badgeClosed]}>
                        <Text style={[styles.badgeText, item.status === 'open' ? styles.badgeTextOpen : styles.badgeTextClosed]}>
                            {item.status === 'open' ? 'Open' : 'Closed'}
                        </Text>
                    </View>
                    <Text style={[styles.statusText, { color: colors.text }]}>{item.status_text || '24hrs Open'}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Feather name="map-pin" size={13} color={colors.primary} style={styles.infoIcon} />
                    <Text style={[styles.infoText, { color: colors.primary }]}>
                        {Number.isFinite(distanceKm) ? `${distanceKm.toFixed(1)} km away` : 'Distance unavailable'}
                    </Text>
                </View>

                <Text style={[styles.addressText, { color: colors.text }]}>{item.address}</Text>
                <Text style={[styles.branchMetaText, { color: colors.text }]}>
                    {`Delivery Range: ${item.delivery_radius_km?.toFixed(1) || '0.0'} km`}
                </Text>

                <View style={styles.btnRow}>
                    <TouchableOpacity 
                        style={[styles.outlineBtn, { borderColor: colors.primary }]} 
                        onPress={() => handleNavigate(item)}
                    >
                        <Feather name="navigation" size={14} color={colors.heading} />
                        <Text style={[styles.outlineBtnText, { color: colors.heading }]}>Directions</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[
                            styles.filledBtn, 
                            { backgroundColor: colors.primary },
                            isSelected && { backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.primary }, 
                            !inRange && { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' }
                        ]} 
                        onPress={() => {
                            if (!inRange) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                handleSelectBranch(item);
                                return;
                            }
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            handleSelectBranch(item);
                        }}
                    >
                        <View style={styles.statusIndicatorRow}>
                            <View style={[styles.statusDotSmall, { backgroundColor: inRange ? '#4CAF50' : '#D1D5DB' }]} />
                            <Text style={[
                                styles.filledBtnText, 
                                { color: '#FFFFFF' }, 
                                isSelected && { color: colors.primary },
                                !inRange && { color: '#6B7280' }
                            ]}>
                                {isSelected ? 'Selected' : (inRange ? 'Order Now' : 'Unavailable')}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.primary + '33' }]}>
                <View style={{ width: 44 }} />
                <View style={styles.headerTitleWrap}>
                    <Text style={[styles.headerTitle, { color: colors.heading }]}>Store List</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.text }]}>Choose your nearest branch</Text>
                </View>
                <TouchableOpacity 
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setViewMode(viewMode === 'list' ? 'map' : 'list');
                    }}
                    style={[styles.headerIconBtn, { backgroundColor: colors.background, borderColor: colors.primary + '33' }]}
                >
                    <Feather name={viewMode === 'list' ? "map" : "list"} size={22} color={colors.heading} />
                </TouchableOpacity>
            </View>

            {viewMode === 'list' ? (
                <>
                    <View style={styles.searchWrapper}>
                        <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.primary + '66' }]}>
                            <Feather name="search" size={20} color={colors.text} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.heading }]}
                                placeholder="Store name or location"
                                value={search}
                                onChangeText={setSearch}
                                placeholderTextColor={colors.text}
                            />
                        </View>
                    </View>

                    <FlatList
                        data={filteredBranches}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderBranchCard}
                        ListHeaderComponent={filteredBranches.length > 0 ? <Text style={[styles.listSectionTitle, { color: colors.text }]}>All Branches</Text> : null}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={[styles.emptyText, { color: colors.text }]}>No branches found</Text>
                            </View>
                        }
                        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding + 40 }]}
                        showsVerticalScrollIndicator={false}
                    />
                </>
            ) : (
                <View style={styles.mapContainer}>
                    <MapView
                        style={styles.map}
                        initialRegion={{
                            latitude: branches[0]?.latitude || 14.3,
                            longitude: branches[0]?.longitude || 121.2,
                            latitudeDelta: 0.8,
                            longitudeDelta: 0.8,
                        }}
                    >
                        {filteredBranches.map(b => (
                            <Marker
                                key={b.id}
                                coordinate={{ latitude: b.latitude || 0, longitude: b.longitude || 0 }}
                                title={b.name}
                                description={b.address}
                            />
                        ))}
                    </MapView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FBEAD6', // 60% Champagne
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 72,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#D38C9D',
        backgroundColor: '#D38C9D', // 30% Blush
    },
    headerTitleWrap: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#4A2C35', // Heading Mauve
    },
    headerSubtitle: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '600',
        color: '#7A5560', // Body Mauve
    },
    headerIconBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 14,
        backgroundColor: '#FBEAD6', // Champagne
        borderWidth: 1,
        borderColor: '#D38C9D',
    },
    searchWrapper: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FBEAD6', // Champagne
        borderRadius: 16,
        paddingHorizontal: 14,
        height: 54,
        borderWidth: 1.5,
        borderColor: '#D38C9D',
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: '#4A2C35', // Mauve
    },
    listSectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7A5560', // Body Mauve
        textTransform: 'uppercase',
        marginHorizontal: 20,
        marginTop: 4,
        marginBottom: 10,
    },
    listContent: {
        paddingBottom: 20,
        paddingHorizontal: 14,
    },
    card: {
        paddingHorizontal: 16,
        paddingVertical: 18,
        backgroundColor: '#D38C9D', // 30% Blush
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#D38C9D',
        marginBottom: 12,
        elevation: 4,
        shadowColor: '#D38C9D',
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    cardSelected: {
        borderColor: '#D38C9D', // Antique Rose
        borderWidth: 2,
        backgroundColor: '#FBEAD6', // Champagne for selected
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#4A2C35', // Heading Mauve
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    selectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D38C9D', // Antique Rose
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        gap: 4,
    },
    selectedBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        marginRight: 8,
    },
    badgeOpen: {
        backgroundColor: '#EAF8EF',
    },
    badgeClosed: {
        backgroundColor: '#FCEBEA',
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    badgeTextOpen: {
        color: '#1E8F4A',
    },
    badgeTextClosed: {
        color: '#C14F47',
    },
    statusText: {
        fontSize: 13,
        color: '#7A5560', // Body Mauve
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    infoIcon: {
        marginRight: 4,
    },
    infoText: {
        fontSize: 13,
        color: '#D38C9D', // Antique Rose
        fontWeight: '700',
    },
    addressText: {
        fontSize: 13,
        color: '#7A5560', // Body Mauve
        fontWeight: '600',
        marginBottom: 6,
    },
    branchMetaText: {
        fontSize: 12,
        color: '#7A5560', // Body Mauve
        fontWeight: '600',
        marginBottom: 14,
    },
    btnRow: {
        flexDirection: 'row',
        gap: 12,
    },
    outlineBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 46,
        borderRadius: 23,
        borderWidth: 1.5,
        borderColor: '#D38C9D', // Antique Rose
    },
    outlineBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#4A2C35', // Mauve
    },
    filledBtn: {
        flex: 1,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#D38C9D', // Antique Rose
        justifyContent: 'center',
        alignItems: 'center',
    },
    filledBtnSecondary: {
        backgroundColor: '#FBEAD6', // Champagne
        borderWidth: 1.5,
        borderColor: '#D38C9D',
    },
    filledBtnDisabled: {
        backgroundColor: '#D38C9D', // Blush
        opacity: 0.5,
        borderWidth: 1.2,
        borderColor: '#D38C9D',
    },
    statusIndicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusDotSmall: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    filledBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    filledBtnTextSecondary: {
        color: '#D38C9D', // Antique Rose
    },
    mapContainer: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#7A5560', // Body Mauve
        fontSize: 14,
    },
});

