import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import * as Location from 'expo-location';
import api from '@/lib/api';
import { clearCart, setSelectedBranch, useUiStore, type SelectedBranch } from '@/lib/ui_store';

type Branch = {
    name: string;
    id: number;
    address: string;
    latitude: number;
    longitude: number;
    delivery_radius_km: number;
    distance_km: number;
    is_available: boolean;
    status: 'open' | 'closed';
    status_text: string;
};

type ApiBranch = {
    id: number | string;
    name?: string;
    address?: string;
    latitude?: number | string;
    longitude?: number | string;
    delivery_radius_km?: number | string;
    distance_km?: number | string;
    distance?: number | string;
    is_available?: boolean;
    status?: 'open' | 'closed';
    status_text?: string;
};
const EARTH_RADIUS_KM = 6371;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;
const toNumberOrNull = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const toBooleanOrNull = (value: unknown): boolean | null => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (v === '1' || v === 'true') return true;
        if (v === '0' || v === 'false') return false;
    }
    return null;
};

const calculateDistanceKm = (
    userLat: number,
    userLng: number,
    branchLat: number,
    branchLng: number
): number => {
    const dLat = toRadians(branchLat - userLat);
    const dLng = toRadians(branchLng - userLng);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(userLat)) *
            Math.cos(toRadians(branchLat)) *
            Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

interface StoresPanelProps {
    onOrderNow: () => void;
    bottomPadding: number;
}

export default function StoresPanel({ onOrderNow, bottomPadding }: StoresPanelProps) {
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
    const mapRef = useRef<MapViewInstance>(null);
    const { selectedBranch, cartItems, addresses, activeAddressId } = useUiStore();

    const fallbackCoords = useMemo(() => {
        const activeAddress = addresses.find((a) => a.id === activeAddressId) || null;
        const addressCoords =
            Number.isFinite(Number(activeAddress?.latitude)) &&
            Number.isFinite(Number(activeAddress?.longitude))
                ? {
                      lat: Number(activeAddress?.latitude),
                      lng: Number(activeAddress?.longitude),
                  }
                : null;
        if (addressCoords) return addressCoords;

        const branchCoords =
            Number.isFinite(Number(selectedBranch?.latitude)) &&
            Number.isFinite(Number(selectedBranch?.longitude))
                ? {
                      lat: Number(selectedBranch?.latitude),
                      lng: Number(selectedBranch?.longitude),
                  }
                : null;
        return branchCoords;
    }, [addresses, activeAddressId, selectedBranch?.latitude, selectedBranch?.longitude]);

    const effectiveLocation = userLocation || fallbackCoords;
    const effectiveLat = effectiveLocation?.lat;
    const effectiveLng = effectiveLocation?.lng;

    const requestUserLocation = useCallback(async (): Promise<void> => {
        try {
            setIsRefreshingLocation(true);
            const lastKnown = await Location.getLastKnownPositionAsync({});
            if (lastKnown?.coords) {
                setUserLocation({
                    lat: lastKnown.coords.latitude,
                    lng: lastKnown.coords.longitude,
                });
            }

            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== 'granted') {
                return;
            }

            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            setUserLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            });
        } catch (error) {
            console.error('Failed to get user GPS location:', error);
        } finally {
            setIsRefreshingLocation(false);
        }
    }, []);

    useEffect(() => {
        requestUserLocation();
    }, [requestUserLocation]);

    useEffect(() => {
        const fetchBranches = async (): Promise<void> => {
            try {
                const response = await api.get('/branches', {
                    params: effectiveLat !== undefined && effectiveLng !== undefined
                        ? { lat: effectiveLat, lng: effectiveLng }
                        : undefined,
                });
                const payload = response.data;
                const rows: ApiBranch[] = Array.isArray(payload)
                    ? payload
                    : (payload?.data || payload?.branches || []);

                const mapped: Branch[] = rows
                    .map((row) => ({
                        id: Number(row.id),
                        name: row.name || 'Branch',
                        address: row.address || 'No address',
                        latitude: toNumberOrNull(row.latitude) ?? 0,
                        longitude: toNumberOrNull(row.longitude) ?? 0,
                        delivery_radius_km: Number(row.delivery_radius_km || 0),
                        distance_km:
                            toNumberOrNull(row.distance_km) ??
                            toNumberOrNull(row.distance) ??
                            Number.NaN,
                        is_available: toBooleanOrNull(row.is_available) ?? false,
                        status: (row.status === 'open' || row.status === 'closed') ? row.status : 'open',
                        status_text: row.status_text || '24hrs Open',
                    }))
                    .filter(
                        (row) =>
                            Number.isFinite(row.id)
                    );

                const withComputedDistance = mapped.map((row) => {
                    const hasCoords = row.latitude !== 0 || row.longitude !== 0;
                    const computedDistance =
                        effectiveLat !== undefined && effectiveLng !== undefined && hasCoords
                            ? calculateDistanceKm(
                                  effectiveLat,
                                  effectiveLng,
                                  row.latitude,
                                  row.longitude
                              )
                            : Number.NaN;

                    const distance_km = Number.isFinite(row.distance_km)
                        ? row.distance_km
                        : computedDistance;

                    const apiAvailability = toBooleanOrNull((rows.find((r) => Number(r.id) === row.id) || {}).is_available);
                    const is_available =
                        apiAvailability !== null
                            ? apiAvailability
                            : (Number.isFinite(distance_km) && distance_km <= row.delivery_radius_km);

                    return {
                        ...row,
                        distance_km,
                        is_available,
                    };
                });

                setBranches(withComputedDistance.sort((a, b) => a.distance_km - b.distance_km));
            } catch (error) {
                console.error('Failed to fetch branches:', error);
                // Keep existing list to avoid blank UI flashes on transient failures.
            }
        };

        fetchBranches();
    }, [effectiveLat, effectiveLng]);

    const nearestAvailableBranch = useMemo(() => {
        const available = branches
            .filter((branch) => branch.is_available)
            .sort((a, b) => a.distance_km - b.distance_km);
        return available[0] || null;
    }, [branches]);

    useEffect(() => {
        if (!nearestAvailableBranch) return;
        const autoSelected: SelectedBranch = {
            id: nearestAvailableBranch.id,
            name: nearestAvailableBranch.name,
            address: nearestAvailableBranch.address,
            distance_km: nearestAvailableBranch.distance_km,
            is_available: nearestAvailableBranch.is_available,
            latitude: nearestAvailableBranch.latitude,
            longitude: nearestAvailableBranch.longitude,
            delivery_radius_km: nearestAvailableBranch.delivery_radius_km,
            status: nearestAvailableBranch.status,
            status_text: nearestAvailableBranch.status_text,
        };

        // Always lock selected branch to the nearest available one.
        if (selectedBranch?.id !== autoSelected.id) {
            setSelectedBranch(autoSelected);
        }
    }, [branches, nearestAvailableBranch, selectedBranch]);

    const filteredBranches = useMemo(() => {
        if (!search.trim()) return branches;
        const query = search.toLowerCase();

        return branches.filter(
            (b) =>
                b.name.toLowerCase().includes(query) ||
                b.address.toLowerCase().includes(query)
        );
    }, [branches, search]);

    const handleNavigate = (branch: Branch) => {
        if (!Number.isFinite(branch.latitude) || !Number.isFinite(branch.longitude) || (branch.latitude === 0 && branch.longitude === 0)) {
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

    const applyBranchSelection = (branch: Branch): void => {
        setSelectedBranch({
            id: branch.id,
            name: branch.name,
            address: branch.address,
            distance_km: branch.distance_km,
            is_available: branch.is_available,
            latitude: branch.latitude,
            longitude: branch.longitude,
            delivery_radius_km: branch.delivery_radius_km,
            status: branch.status,
            status_text: branch.status_text,
        });
    };

    const handleSelectBranch = (branch: Branch): void => {
        if (!branch.is_available) {
            Alert.alert(
                'Delivery Not Available',
                'This branch does not currently deliver to your location. Please select a nearby branch.'
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
                'Your cart belongs to another branch. Switching branch will clear your cart.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Switch Branch',
                        style: 'destructive',
                        onPress: () => {
                            clearCart();
                            applyBranchSelection(branch);
                            onOrderNow();
                        },
                    },
                ]
            );
            return;
        }

        applyBranchSelection(branch);
        onOrderNow();
    };

    const renderBranchCard = ({ item, index }: { item: Branch; index: number }) => {
        const distanceKm = Number(item.distance_km ?? 0);
        const inRange = item.is_available;
        const isSelected = selectedBranch?.id === item.id;
        const isRecommended = nearestAvailableBranch?.id === item.id && index === 0;

        return (
            <View style={[styles.card, isSelected && styles.cardSelected]}>
                <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <View style={styles.badgeRow}>
                        {isSelected ? (
                            <View style={styles.selectedBadge}>
                                <Feather name="check-circle" size={12} color="#FFFFFF" />
                                <Text style={styles.selectedBadgeText}>Selected</Text>
                            </View>
                        ) : isRecommended ? (
                            <View style={styles.recommendedBadge}>
                                <Text style={styles.recommendedText}>Recommended</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
                
                <View style={styles.statusRow}>
                    <View style={[styles.badge, item.status === 'open' ? styles.badgeOpen : styles.badgeClosed]}>
                        <Text style={[styles.badgeText, item.status === 'open' ? styles.badgeTextOpen : styles.badgeTextClosed]}>
                            {item.status === 'open' ? 'Open' : 'Closed'}
                        </Text>
                    </View>
                    <Text style={styles.statusText}>{item.status_text}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Feather name="map-pin" size={13} color="#D94F3D" style={styles.infoIcon} />
                    <Text style={styles.infoText}>
                        {Number.isFinite(distanceKm) ? `${distanceKm.toFixed(1)} km away` : 'Distance unavailable'}
                    </Text>
                </View>

                <Text style={styles.addressText}>{item.address}</Text>
                <Text style={styles.branchMetaText}>
                    {`Delivery Range: ${item.delivery_radius_km.toFixed(1)} km`}
                </Text>
                {isSelected ? <Text style={styles.servingTag}>Serving from this branch</Text> : null}

                <View style={styles.btnRow}>
                    <TouchableOpacity 
                        style={styles.outlineBtn} 
                        onPress={() => handleNavigate(item)}
                    >
                        <Feather name="navigation" size={14} color="#2C2C2C" />
                        <Text style={styles.outlineBtnText}>Directions</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.filledBtn, isSelected && styles.filledBtnSecondary, !inRange && styles.filledBtnDisabled]} 
                        onPress={() => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            handleSelectBranch(item);
                        }}
                    >
                        <Text style={[styles.filledBtnText, isSelected && styles.filledBtnTextSecondary]}>
                            {isSelected ? 'Selected Branch' : (inRange ? 'Order Now' : 'Unavailable')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ width: 44 }} />
                <View style={styles.headerTitleWrap}>
                    <Text style={styles.headerTitle}>Store List</Text>
                    <Text style={styles.headerSubtitle}>Choose your nearest branch</Text>
                </View>
                <TouchableOpacity 
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setViewMode(viewMode === 'list' ? 'map' : 'list');
                    }}
                    style={styles.headerIconBtn}
                >
                    <Feather name={viewMode === 'list' ? "map" : "list"} size={22} color="#2C2C2C" />
                </TouchableOpacity>
            </View>

            {viewMode === 'list' ? (
                <>
                    {/* Search Bar */}
                    <View style={styles.searchWrapper}>
                        <View style={styles.searchContainer}>
                            <Feather name="search" size={20} color="#8A8A8A" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Store name or location"
                                value={search}
                                onChangeText={setSearch}
                                placeholderTextColor="#8A8A8A"
                            />
                            <TouchableOpacity onPress={requestUserLocation} style={styles.targetButton}>
                                <MaterialCommunityIcons
                                    name={isRefreshingLocation ? 'crosshairs-gps' : 'target'}
                                    size={18}
                                    color="#D94F3D"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <FlatList
                        data={filteredBranches}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderBranchCard}
                        ListHeaderComponent={filteredBranches.length > 0 ? <Text style={styles.listSectionTitle}>All Branches</Text> : null}
                        ListEmptyComponent={
                            <Animated.View 
                                entering={FadeInUp.delay(200).duration(800)}
                                style={styles.emptyContainer}
                            >
                                <View style={styles.emptyIconCircle}>
                                    <MaterialCommunityIcons name="store-clock-outline" size={48} color="#D94F3D" />
                                </View>
                                <Text style={styles.emptyGreeting}>Konnichiwa!</Text>
                                <Text style={styles.emptyText}>
                                    Welcome to Maki-Caps. We are currently expanding our reach to serve you better.
                                </Text>
                                <Text style={styles.emptySubText}>
                                    Our physical stores are currently being prepared. In the meantime, feel free to explore our menu and enjoy our fresh Japanese favorites through delivery!
                                </Text>
                                <TouchableOpacity 
                                    style={styles.exploreBtn}
                                    onPress={onOrderNow}
                                >
                                    <Text style={styles.exploreBtnText}>Explore Menu</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        }
                        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding + 40 }]}
                        showsVerticalScrollIndicator={false}
                    />
                </>
            ) : (
                <View style={styles.mapContainer}>
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        initialRegion={{
                            latitude: effectiveLocation?.lat || 14.3,
                            longitude: effectiveLocation?.lng || 121.2,
                            latitudeDelta: 0.8,
                            longitudeDelta: 0.8,
                        }}
                    >
                        {filteredBranches.map(b => (
                            <Marker
                                key={b.id}
                                coordinate={{ latitude: b.latitude, longitude: b.longitude }}
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
        backgroundColor: '#FFF8F2',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 72,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F2E8DE',
        backgroundColor: '#FFFDF9',
    },
    headerTitleWrap: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#2F241F',
        letterSpacing: 0.2,
    },
    headerSubtitle: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '600',
        color: '#A68D7A',
    },
    headerIconBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F0E5D9',
        shadowColor: '#2C1B10',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    searchWrapper: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 14,
        height: 54,
        borderWidth: 1,
        borderColor: '#F0E5D9',
        shadowColor: '#351F12',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: '#2C2C2C',
        fontWeight: '600',
    },
    targetButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#FDECEB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listSectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#B0927C',
        letterSpacing: 0.7,
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
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F3E7DC',
        marginHorizontal: 2,
        marginBottom: 12,
        shadowColor: '#2C1E14',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 4,
    },
    cardSelected: {
        borderColor: '#D94F3D',
        borderWidth: 2,
        backgroundColor: '#FFFBF9',
        shadowColor: '#D94F3D',
        shadowOpacity: 0.12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#2F241F',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    selectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D94F3D',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        gap: 4,
    },
    selectedBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.2,
    },
    recommendedBadge: {
        backgroundColor: '#FFF4DA',
        borderColor: '#F7D69D',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    recommendedText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#AA6121',
        letterSpacing: 0.2,
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
        color: '#5F4C3F',
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
        color: '#D94F3D',
        fontWeight: '700',
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#8A8A8A',
        marginHorizontal: 6,
    },
    addressText: {
        fontSize: 13,
        color: '#9A8577',
        fontWeight: '600',
        marginBottom: 6,
        letterSpacing: 0.2,
        lineHeight: 18,
    },
    branchMetaText: {
        fontSize: 12,
        color: '#A68D7A',
        fontWeight: '600',
        marginBottom: 8,
    },
    servingTag: {
        fontSize: 12,
        fontWeight: '700',
        color: '#D94F3D',
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
        borderWidth: 1.3,
        borderColor: '#DCCFC2',
        backgroundColor: '#FFFDFB',
        gap: 6,
    },
    outlineBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3B3029',
    },
    filledBtn: {
        flex: 1,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#D94F3D',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#B53E2E',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
        elevation: 3,
    },
    filledBtnSecondary: {
        backgroundColor: '#FFF3E8',
        borderWidth: 1.3,
        borderColor: '#FFD5B8',
    },
    filledBtnDisabled: {
        backgroundColor: '#E8E3DF',
        borderWidth: 1.2,
        borderColor: '#D3C9C2',
        shadowOpacity: 0,
        elevation: 0,
    },
    filledBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    filledBtnTextSecondary: {
        color: '#2C2C2C',
    },
    mapContainer: {
        flex: 1,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingTop: 60,
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFF0E6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyGreeting: {
        fontSize: 24,
        fontWeight: '900',
        color: '#2F241F',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#3A3029',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 24,
    },
    emptySubText: {
        fontSize: 14,
        color: '#8E7A6E',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
    },
    exploreBtn: {
        backgroundColor: '#D94F3D',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 25,
        shadowColor: '#D94F3D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    exploreBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
