import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef, useState, useMemo } from 'react';
import {
    Alert,
    Dimensions,
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

const { width } = Dimensions.get('window');

interface Branch {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    openTime: string;
    closeTime: string;
    distance: string;
    deliveryTime?: string;
    isClosed?: boolean;
}

const BRANCHES: Branch[] = []; // Currently empty as requested

interface StoresPanelProps {
    onOrderNow: () => void;
    bottomPadding: number;
}

export default function StoresPanel({ onOrderNow, bottomPadding }: StoresPanelProps) {
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const mapRef = useRef<MapViewInstance>(null);

    const filteredBranches = useMemo(() => {
        if (!search.trim()) return BRANCHES;
        return BRANCHES.filter(b => 
            b.name.toLowerCase().includes(search.toLowerCase()) || 
            b.address.toLowerCase().includes(search.toLowerCase())
        );
    }, [search]);

    const handleNavigate = (branch: Branch) => {
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

    const renderBranchCard = ({ item }: { item: Branch }) => {
        return (
            <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                
                <View style={styles.statusRow}>
                    <View style={[styles.badge, item.isClosed ? styles.badgeClosed : styles.badgeOpen]}>
                        <Text style={[styles.badgeText, item.isClosed ? styles.badgeTextClosed : styles.badgeTextOpen]}>
                            {item.isClosed ? 'Closed' : 'Open'}
                        </Text>
                    </View>
                    <Text style={styles.statusText}>
                        {item.isClosed ? `Opens at ${item.openTime}` : `Closes at ${item.closeTime}`}
                    </Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoText}>{item.distance}</Text>
                    {item.deliveryTime && (
                        <>
                            <View style={styles.dot} />
                            <Text style={styles.infoText}>{item.deliveryTime}</Text>
                        </>
                    )}
                </View>

                <Text style={styles.addressText}>{item.address}</Text>

                <View style={styles.btnRow}>
                    <TouchableOpacity 
                        style={styles.outlineBtn} 
                        onPress={() => handleNavigate(item)}
                    >
                        <Feather name="navigation" size={14} color="#2C2C2C" />
                        <Text style={styles.outlineBtnText}>Directions</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.filledBtn, item.isClosed && styles.filledBtnSecondary]} 
                        onPress={() => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            onOrderNow();
                        }}
                    >
                        <Text style={[styles.filledBtnText, item.isClosed && styles.filledBtnTextSecondary]}>
                            {item.isClosed ? 'View Menu' : 'Order Now'}
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
                <View style={{ width: 40 }} />
                <Text style={styles.headerTitle}>Store List</Text>
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
                            <TouchableOpacity>
                                <MaterialCommunityIcons name="target" size={20} color="#D94F3D" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <FlatList
                        data={filteredBranches}
                        keyExtractor={item => item.id}
                        renderItem={renderBranchCard}
                        ListHeaderComponent={filteredBranches.length > 0 ? <Text style={styles.listSectionTitle}>Nearby Stores</Text> : null}
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
                            latitude: 14.3,
                            longitude: 121.2,
                            latitudeDelta: 0.8,
                            longitudeDelta: 0.8,
                        }}
                    >
                        {BRANCHES.map(b => (
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
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#2C2C2C',
    },
    headerIconBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchWrapper: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 50,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: '#2C2C2C',
        fontWeight: '500',
    },
    listSectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8A8A8A',
        marginHorizontal: 16,
        marginTop: 4,
        marginBottom: 16,
    },
    listContent: {
        paddingBottom: 20,
    },
    card: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#2C2C2C',
        marginBottom: 8,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginRight: 8,
    },
    badgeOpen: {
        backgroundColor: '#E6F7ED',
    },
    badgeClosed: {
        backgroundColor: '#FDECEB',
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    badgeTextOpen: {
        color: '#1DB954',
    },
    badgeTextClosed: {
        color: '#D94F3D',
    },
    statusText: {
        fontSize: 14,
        color: '#2C2C2C',
        fontWeight: '500',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    infoText: {
        fontSize: 14,
        color: '#8A8A8A',
        fontWeight: '500',
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
        color: '#B0B0B0',
        fontWeight: '600',
        marginBottom: 16,
        letterSpacing: 0.3,
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
        height: 44,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: '#E8E8E8',
        backgroundColor: '#FFFFFF',
        gap: 6,
    },
    outlineBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#2C2C2C',
    },
    filledBtn: {
        flex: 1,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#D94F3D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    filledBtnSecondary: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E8E8E8',
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
        backgroundColor: '#FDECEB',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyGreeting: {
        fontSize: 24,
        fontWeight: '900',
        color: '#2C2C2C',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2C2C2C',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 24,
    },
    emptySubText: {
        fontSize: 14,
        color: '#8A8A8A',
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
