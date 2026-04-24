import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatAddressForDisplay, useUiStore, setActiveAddress, setAddressFromPlace } from '../lib/ui_store';
import { searchPlaces, getPlaceDetails } from '../lib/google_location';
import * as Haptics from 'expo-haptics';

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
    const insets = useSafeAreaInsets();
    const { addresses, activeAddressId } = useUiStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [predictions, setPredictions] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    const activeAddress = useMemo(
        () => addresses?.find(a => a.id === activeAddressId) ?? null,
        [addresses, activeAddressId]
    );

    // Debounced search
    useEffect(() => {
        if (searchQuery.length < 3) {
            setPredictions([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            const results = await searchPlaces(searchQuery, process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '');
            setPredictions(results);
            setIsSearching(false);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelectAddress = useCallback((id: string) => {
        setActiveAddress(id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onClose();
    }, [onClose]);

    const handleSelectPrediction = useCallback(async (prediction: any) => {
        setIsSearching(true);
        const details = await getPlaceDetails(prediction.place_id, process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '');
        if (details) {
            const id = await setAddressFromPlace(details);
            if (id) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onClose();
            }
        }
        setIsSearching(false);
    }, [onClose]);

    const renderAddressItem = ({ item }: { item: any }) => {
        const isActive = item.id === activeAddressId;
        return (
            <TouchableOpacity
                style={[styles.addressItem, isActive && styles.addressItemActive]}
                onPress={() => handleSelectAddress(item.id)}
            >
                <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
                    <Feather 
                        name={item.notes?.toLowerCase().includes('home') ? 'home' : item.notes?.toLowerCase().includes('work') ? 'briefcase' : 'map-pin'} 
                        size={18} 
                        color={isActive ? '#FFF' : '#D94F3D'} 
                    />
                </View>
                <View style={styles.addressInfo}>
                    <Text style={styles.addressTitle} numberOfLines={1}>
                        {item.street || 'Saved Location'}
                    </Text>
                    <Text style={styles.addressSubtitle} numberOfLines={1}>
                        {item.fullAddress}
                    </Text>
                </View>
                {isActive && <Ionicons name="checkmark-circle" size={20} color="#D94F3D" />}
            </TouchableOpacity>
        );
    };

    const renderPredictionItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.predictionItem}
            onPress={() => handleSelectPrediction(item)}
        >
            <Ionicons name="location-outline" size={20} color="#8A8A8A" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
                <Text style={styles.predictionTitle} numberOfLines={1}>{item.structured_formatting.main_text}</Text>
                <Text style={styles.predictionSubtitle} numberOfLines={1}>{item.structured_formatting.secondary_text}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.overlay}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={styles.content}
                    >
                        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
                            {/* Handle */}
                            <View style={styles.handle} />
                            
                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={styles.headerTitle}>Delivery Address</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                    <Ionicons name="close" size={24} color="#2C2C2C" />
                                </TouchableOpacity>
                            </View>

                            {/* Search Bar */}
                            <View style={styles.searchContainer}>
                                <Ionicons name="search" size={20} color="#8A8A8A" style={{ marginLeft: 12 }} />
                                <TextInput
                                    placeholder="Search for a new address..."
                                    style={styles.searchInput}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholderTextColor="#8A8A8A"
                                />
                                {isSearching && <ActivityIndicator size="small" color="#D94F3D" style={{ marginRight: 12 }} />}
                                {searchQuery.length > 0 && !isSearching && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={20} color="#CCC" style={{ marginRight: 12 }} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.body}>
                                {searchQuery.length >= 3 ? (
                                    <FlatList
                                        data={predictions}
                                        keyExtractor={(item) => item.place_id}
                                        renderItem={renderPredictionItem}
                                        ListEmptyComponent={
                                            !isSearching ? (
                                                <Text style={styles.emptyText}>No addresses found</Text>
                                            ) : null
                                        }
                                    />
                                ) : (
                                    <>
                                        <TouchableOpacity 
                                            style={styles.currentLocationBtn}
                                            onPress={() => {
                                                // Trigger GPS detection
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                onClose();
                                                // Note: HomeDashboard will handle GPS detection if no active address
                                            }}
                                        >
                                            <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#D94F3D" />
                                            <Text style={styles.currentLocationText}>Use Current Location</Text>
                                        </TouchableOpacity>

                                        <Text style={styles.sectionTitle}>Saved Addresses</Text>
                                        <FlatList
                                            data={addresses}
                                            keyExtractor={(item) => item.id}
                                            renderItem={renderAddressItem}
                                            contentContainerStyle={{ paddingBottom: 20 }}
                                            ListEmptyComponent={
                                                <View style={styles.emptyContainer}>
                                                    <Text style={styles.emptyText}>No saved addresses yet</Text>
                                                    <TouchableOpacity style={styles.addFirstBtn} onPress={onAddAddress}>
                                                        <Text style={styles.addFirstBtnText}>Add your first address</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            }
                                        />
                                        
                                        {addresses.length > 0 && (
                                            <TouchableOpacity 
                                                style={styles.manageBtn}
                                                onPress={onAddAddress}
                                            >
                                                <Feather name="plus" size={18} color="#D94F3D" />
                                                <Text style={styles.manageBtnText}>Add New Address</Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    content: {
        width: '100%',
    },
    sheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        minHeight: '60%',
        maxHeight: '90%',
    },
    handle: {
        width: 40,
        height: 5,
        backgroundColor: '#E0E0E0',
        borderRadius: 2.5,
        alignSelf: 'center',
        marginTop: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#2C2C2C',
        fontFamily: 'Outfit_800ExtraBold',
    },
    closeButton: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        marginHorizontal: 24,
        borderRadius: 16,
        height: 52,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        paddingHorizontal: 12,
        fontSize: 16,
        color: '#2C2C2C',
        fontFamily: 'Outfit_500Medium',
    },
    body: {
        flex: 1,
        paddingHorizontal: 24,
    },
    currentLocationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 16,
    },
    currentLocationText: {
        marginLeft: 12,
        fontSize: 16,
        fontWeight: '600',
        color: '#D94F3D',
        fontFamily: 'Outfit_600SemiBold',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8A8A8A',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginTop: 8,
        fontFamily: 'Outfit_700Bold',
    },
    addressItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    addressItemActive: {
        // Option highlight
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FDECEB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    iconBoxActive: {
        backgroundColor: '#D94F3D',
    },
    addressInfo: {
        flex: 1,
    },
    addressTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2C2C2C',
        fontFamily: 'Outfit_700Bold',
    },
    addressSubtitle: {
        fontSize: 13,
        color: '#8A8A8A',
        marginTop: 2,
        fontFamily: 'Outfit_400Regular',
    },
    predictionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    predictionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2C2C2C',
        fontFamily: 'Outfit_600SemiBold',
    },
    predictionSubtitle: {
        fontSize: 13,
        color: '#8A8A8A',
        marginTop: 2,
        fontFamily: 'Outfit_400Regular',
    },
    manageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        marginTop: 8,
        borderWidth: 1.5,
        borderColor: '#D94F3D',
        borderRadius: 16,
        borderStyle: 'dashed',
    },
    manageBtnText: {
        marginLeft: 8,
        fontSize: 15,
        fontWeight: '700',
        color: '#D94F3D',
        fontFamily: 'Outfit_700Bold',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 15,
        color: '#8A8A8A',
        textAlign: 'center',
        fontFamily: 'Outfit_400Regular',
    },
    addFirstBtn: {
        marginTop: 16,
        backgroundColor: '#D94F3D',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 30,
    },
    addFirstBtnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 15,
        fontFamily: 'Outfit_700Bold',
    }
});
