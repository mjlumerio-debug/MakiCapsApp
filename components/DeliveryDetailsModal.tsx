import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { MapView, Marker } from '../components/MapComponent';
import { useUiStore, setActiveAddress } from '../lib/ui_store';

type DeliveryDetailsModalProps = {
    visible: boolean;
    onClose: () => void;
    onAddAddress: () => void;
};

export default function DeliveryDetailsModal({
    visible,
    onClose,
    onAddAddress,
}: DeliveryDetailsModalProps) {
    const { addresses, activeAddressId } = useUiStore();

    // Only the active address
    const activeAddress = useMemo(
        () => addresses?.find(a => a.id === activeAddressId) ?? null,
        [addresses, activeAddressId]
    );

    const activeCoord = useMemo(() => {
        if (activeAddress?.latitude && activeAddress?.longitude) {
            return { latitude: activeAddress.latitude, longitude: activeAddress.longitude };
        }
        return null;
    }, [activeAddress]);

    const activeRegion = useMemo(() => {
        if (!activeCoord) return undefined;
        return {
            latitude: activeCoord.latitude,
            longitude: activeCoord.longitude,
            latitudeDelta: 0.0012,
            longitudeDelta: 0.0012,
        };
    }, [activeCoord]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Feather name="x" size={24} color="#2C2C2C" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Delivery Details</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Delivery Tab */}
                    <View style={styles.tabContainer}>
                        <View style={styles.activeTab}>
                            <MaterialCommunityIcons name="bike-fast" size={20} color="#D94F3D" />
                            <Text style={styles.activeTabText}>Delivery</Text>
                        </View>
                    </View>

                    {/* Main Content */}
                    <View style={styles.mainContent}>
                        {activeAddress && activeCoord && activeRegion ? (
                            <>
                                {/* Full Map showing exact pin */}
                                <View style={styles.mapCard}>
                                    <MapView
                                        style={styles.map}
                                        region={activeRegion}
                                        scrollEnabled={false}
                                        zoomEnabled={false}
                                        rotateEnabled={false}
                                        pitchEnabled={false}
                                        showsUserLocation={false}
                                        showsMyLocationButton={false}
                                        showsCompass={false}
                                        showsTraffic={false}
                                        showsBuildings={true}
                                        showsScale={false}
                                        toolbarEnabled={false}
                                    >
                                        <Marker
                                            coordinate={activeCoord}
                                            anchor={{ x: 0.5, y: 1 }}
                                        >
                                            <View style={styles.pinWrapper}>
                                                <View style={styles.pinPulse} />
                                                <View style={styles.pinHead}>
                                                    <View style={styles.pinHeadInner} />
                                                </View>
                                                <View style={styles.pinTail} />
                                                <View style={styles.pinShadow} />
                                            </View>
                                        </Marker>
                                    </MapView>

                                    {/* Active address label over map */}
                                    <View style={styles.mapOverlayTop}>
                                        <View style={styles.activePill}>
                                            <View style={styles.activeDot} />
                                            <Text style={styles.activePillText}>Active Delivery Location</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Active address info card */}
                                <View style={styles.addressCard}>
                                    <View style={styles.addressIconCircle}>
                                        <Feather name="map-pin" size={18} color="#FFFFFF" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.addressName} numberOfLines={1}>
                                            {activeAddress.street || activeAddress.subdivision || activeAddress.fullAddress.split(',')[0] || 'Unnamed Location'}
                                        </Text>
                                        <Text style={styles.addressFull} numberOfLines={2}>
                                            {activeAddress.fullAddress}
                                        </Text>
                                    </View>
                                </View>

                                {/* Manage button */}
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.manageButton}
                                    onPress={onAddAddress}
                                >
                                    <Feather name="edit-2" size={15} color="#D94F3D" style={{ marginRight: 6 }} />
                                    <Text style={styles.manageButtonText}>Manage or Add New Address</Text>
                                </TouchableOpacity>
                            </>
                        ) : addresses && addresses.length > 0 ? (
                            // Has addresses but none active — prompt to pick one
                            <View style={styles.noActiveContainer}>
                                <View style={styles.iconCircle}>
                                    <Feather name="map-pin" size={36} color="#D94F3D" />
                                </View>
                                <Text style={styles.mainTitle}>No Active Address</Text>
                                <Text style={styles.subtitle}>Select an address to use for delivery.</Text>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.addButton}
                                    onPress={onAddAddress}
                                >
                                    <Text style={styles.addButtonText}>Manage Addresses</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            // No addresses at all
                            <View style={styles.noActiveContainer}>
                                <View style={styles.iconCircle}>
                                    <Feather name="map-pin" size={36} color="#D1D1D1" />
                                </View>
                                <Text style={styles.mainTitle}>Where should we deliver?</Text>
                                <Text style={styles.subtitle}>
                                    Add a delivery address to get started.
                                </Text>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.addButton}
                                    onPress={onAddAddress}
                                >
                                    <Text style={styles.addButtonText}>Add Delivery Address</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: '#F5F1E8',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: '75%',
        paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EFEAE0',
    },
    closeButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2C2C2C',
        textAlign: 'center',
    },
    tabContainer: {
        paddingHorizontal: 20,
        marginTop: 14,
        marginBottom: 14,
    },
    activeTab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        paddingHorizontal: 24,
        backgroundColor: '#FAF1F0',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#D94F3D',
        gap: 8,
    },
    activeTabText: {
        color: '#D94F3D',
        fontSize: 16,
        fontWeight: '700',
    },
    mainContent: {
        flex: 1,
        paddingHorizontal: 16,
    },
    // ---- Full Map ----
    mapCard: {
        width: '100%',
        flex: 1,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#D94F3D',
        marginBottom: 12,
    },
    map: {
        width: '100%',
        height: '100%',
    },
    mapOverlayTop: {
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        alignItems: 'flex-start',
    },
    activePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3,
    },
    activeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#D94F3D',
    },
    activePillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#D94F3D',
    },
    // ---- Custom Pin ----
    pinWrapper: {
        alignItems: 'center',
    },
    pinPulse: {
        position: 'absolute',
        top: -8,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(217, 79, 61, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(217, 79, 61, 0.4)',
    },
    pinHead: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#D94F3D',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#D94F3D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 5,
        elevation: 10,
        zIndex: 1,
    },
    pinHeadInner: {
        width: 11,
        height: 11,
        borderRadius: 5.5,
        backgroundColor: '#FFFFFF',
    },
    pinTail: {
        width: 4,
        height: 14,
        backgroundColor: '#D94F3D',
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 4,
        marginTop: -2,
        zIndex: 1,
    },
    pinShadow: {
        width: 12,
        height: 5,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.2)',
        marginTop: 1,
    },
    // ---- Address Card ----
    addressCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: '#D94F3D',
        gap: 12,
    },
    addressIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#D94F3D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addressName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#D94F3D',
        marginBottom: 2,
    },
    addressFull: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 17,
    },
    // ---- Buttons ----
    manageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        width: '100%',
        paddingVertical: 13,
        borderRadius: 30,
        borderWidth: 1.5,
        borderColor: '#D94F3D',
    },
    manageButtonText: {
        color: '#D94F3D',
        fontSize: 14,
        fontWeight: '700',
    },
    // ---- Empty States ----
    noActiveContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EFEAE0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E8E2D2',
    },
    mainTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#2C2C2C',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 14,
        color: '#8A8A8A',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
    },
    addButton: {
        backgroundColor: '#D94F3D',
        width: '100%',
        paddingVertical: 15,
        borderRadius: 30,
        alignItems: 'center',
        shadowColor: '#D94F3D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
});
