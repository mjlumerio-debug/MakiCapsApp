import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    Easing,
    useAnimatedStyle,
    withTiming
} from 'react-native-reanimated';
import { useMenuStore, resolveProductImage } from '../lib/menu_store';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { useLocation } from '@/state/contexts/LocationContext';
import { useBranch } from '@/state/contexts/BranchContext';
import { getDistanceKm } from '../lib/google_location';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const { height } = Dimensions.get('window');
const DELIVERY_FEE = 38.00;

// TypeScript Interfaces
interface CheckoutItem {
    id: string;
    title: string;
    image: any;
    price: string | number;
    quantity: number;
}
export default function OrderScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { menuItems: storeItems } = useMenuStore();
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useAppTheme();
    const { state: locationState } = useLocation();
    const { state: branchState } = useBranch();
    
    const { selectedAddress: activeAddress } = locationState;
    const { selectedBranch } = branchState;

    // 1. Parse Cart Items from Params and Resolve from Store
    const initialCart: CheckoutItem[] = useMemo(() => {
        try {
            if (params.cart) {
                const sparseCart = JSON.parse(params.cart as string);
                // Resolve full details from store
                return sparseCart.map((item: { id: string, quantity: number }) => {
                    const storeItem = storeItems.find(s => s.id === String(item.id));
                    if (storeItem) {
                        return { 
                            ...storeItem, 
                            id: String(storeItem.id),
                            title: storeItem.name,
                            image: resolveProductImage(storeItem.image_path),
                            price: storeItem.selling_price,
                            quantity: item.quantity 
                        };
                    }
                    return null;
                }).filter(Boolean);
            }
        } catch (e) {
            console.error('Failed to parse cart:', e);
        }
        return [];
    }, [params.cart, storeItems]);

    const [menuItems, setMenuItems] = useState<CheckoutItem[]>(initialCart);

    // Keep state in sync if initialCart changes (e.g. store updates)
    React.useEffect(() => {
        setMenuItems(initialCart);
    }, [initialCart]);

    // 2. State for Payment and Summary Collapse
    const [selectedCategory, setSelectedCategory] = useState('E-Wallet');
    const [selectedMethod, setSelectedMethod] = useState('GCash');
    const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);

    // ── Address Serviceability Monitor ──
    React.useEffect(() => {
        if (!activeAddress || !selectedBranch) return;

        const distance = getDistanceKm(
            activeAddress.latitude || 0,
            activeAddress.longitude || 0,
            selectedBranch.latitude || 0,
            selectedBranch.longitude || 0
        );

        const isOutOfRange = selectedBranch.delivery_radius_km && distance > selectedBranch.delivery_radius_km;
        
        if (isOutOfRange) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
                "Outside Delivery Range",
                `The selected address is outside the delivery range of ${selectedBranch.name}. Please select a different address or branch.`,
                [
                    { 
                        text: "Return to Cart", 
                        onPress: () => router.replace('/home_dashboard' as any) 
                    }
                ],
                { cancelable: false }
            );
        }
    }, [activeAddress?.id, selectedBranch?.id]);

    // 3. Logic Functions
    const paymentCategories = ['Cash on Delivery', 'E-Wallet'];
    const eWallets = [
        { id: 'gcash', name: 'GCash', desc: 'Secure payment via GCash.', icon: 'https://upload.wikimedia.org/wikipedia/commons/5/52/GCash_logo.svg' },
        { id: 'maya', name: 'Maya', desc: 'Fast payment via Maya.', icon: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/PayMaya_Logo.png' }
    ];

    const updateQuantity = (id: string, delta: number) => {
        setMenuItems(current =>
            current.map(item =>
                item.id === id
                    ? { ...item, quantity: Math.max(1, item.quantity + delta) }
                    : item
            )
        );
    };

    const removeItem = (id: string) => {
        setMenuItems(current => current.filter(item => item.id !== id));
    };

    const calculateSubtotal = () => {
        return menuItems.reduce((total, item) => {
            const priceValue = typeof item.price === 'string'
                ? parseFloat(item.price.replace(/[^\d.]/g, ''))
                : item.price;
            return total + (priceValue * item.quantity);
        }, 0);
    };

    const calculateTotal = () => calculateSubtotal() + DELIVERY_FEE;
    

    // 4. Animation Styles
    const summaryAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{
                translateY: withTiming(isSummaryCollapsed ? 240 : 0, {
                    duration: 400,
                    easing: Easing.out(Easing.back(0.8))
                })
            }],
            opacity: withTiming(isSummaryCollapsed ? 0 : 1, { duration: 300 })
        };
    });

    // 5. Rendering logic
    const renderMenuItem = ({ item }: { item: CheckoutItem }) => (
        <View style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.primary + '1A' }]}>
            <Image 
                source={typeof item.image === 'string' ? { uri: item.image } : item.image} 
                style={styles.itemImage} 
                resizeMode="cover"
            />
            <View style={styles.itemInfo}>
                <View style={styles.itemHeader}>
                    <Text style={[styles.itemName, { color: colors.heading }]} numberOfLines={1}>{item.title}</Text>
                    <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.trashBtn}>
                        <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                </View>

                <Text style={[styles.itemPriceSingle, { color: colors.text }]}>
                    ₱{(typeof item.price === 'string' ? parseFloat(item.price.replace(/[^\d.]/g, '')) : item.price).toFixed(2)} / unit
                </Text>

                <View style={styles.cardFooter}>
                    <View style={[styles.stepper, { backgroundColor: colors.background }]}>
                        <TouchableOpacity
                            onPress={() => updateQuantity(item.id, -1)}
                            style={[styles.stepBtn, { backgroundColor: colors.surface }, item.quantity === 1 && styles.stepBtnDisabled]}
                        >
                            <Feather name="minus" size={14} color={item.quantity === 1 ? colors.text + '40' : colors.heading} />
                        </TouchableOpacity>
                        <Text style={[styles.stepValue, { color: colors.heading }]}>{item.quantity}</Text>
                        <TouchableOpacity
                            onPress={() => updateQuantity(item.id, 1)}
                            style={[styles.stepBtn, { backgroundColor: colors.surface }]}
                        >
                            <Feather name="plus" size={14} color={colors.heading} />
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.itemTotalPrice, { color: colors.primary }]}>₱{((typeof item.price === 'string' ? parseFloat(item.price.replace(/[^\d.]/g, '')) : item.price) * item.quantity).toFixed(2)}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Header */}
            <View style={[
                styles.header, 
                { 
                    backgroundColor: colors.surface, 
                    borderBottomColor: colors.primary + '1A',
                    paddingTop: Math.max(insets.top, 16)
                }
            ]}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.primary + '1A' }]}>
                    <Feather name="chevron-left" size={22} color={colors.heading} />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <Text style={[styles.headerTitle, { color: colors.heading }]}>Checkout Order</Text>
                </View>
                <View style={styles.headerBtnPlaceholder} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: isSummaryCollapsed ? 100 : 300 }
                ]}
            >
                {/* Items Section */}
                <Text style={[styles.sectionTitle, { color: colors.heading }]}>Items ({menuItems.length})</Text>
                {menuItems.length > 0 ? (
                    <View style={[
                        styles.itemsContainer,
                        { backgroundColor: 'transparent' },
                        menuItems.length > 5 && { height: height * 0.4 }
                    ]}>
                        <FlatList
                            data={menuItems}
                            renderItem={renderMenuItem}
                            keyExtractor={item => item.id}
                            scrollEnabled={menuItems.length > 5}
                            nestedScrollEnabled={true}
                            showsVerticalScrollIndicator={true}
                        />
                    </View>
                ) : (
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="cart-variant" size={48} color={colors.primary + '20'} />
                        <Text style={[styles.emptyText, { color: colors.text }]}>Your order is empty</Text>
                        <TouchableOpacity onPress={() => router.back()} style={[styles.browseBtn, { backgroundColor: colors.primary + '15' }]}>
                            <Text style={[styles.browseBtnText, { color: colors.primary }]}>Go back to Menu</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Address Section */}
                <Text style={[styles.sectionTitle, { color: colors.heading }]}>Address</Text>
                <View style={[styles.addressContainer, { backgroundColor: colors.surface, borderColor: colors.primary + '1A' }]}>
                    <View style={[styles.addressBox, { borderBottomColor: colors.primary + '1A' }]}>
                        <View style={styles.addressLeft}>
                             <View style={[styles.addressIconCircle, { backgroundColor: colors.primary + '15' }]}>
                                 <Ionicons name="location" size={18} color={colors.primary} />
                             </View>
                             <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={2}>
                                 {activeAddress?.fullAddress || 'Choose delivery address'}
                             </Text>
                        </View>
                        <TouchableOpacity style={styles.editBtn}>
                            <Feather name="edit-3" size={16} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.addAddressBtn}>
                        <Text style={[styles.addAddressBtnText, { color: colors.primary }]}>Add new address</Text>
                    </TouchableOpacity>
                </View>

                {/* Payment Method Section */}
                <Text style={[styles.sectionTitle, { color: colors.heading }]}>Payment Method</Text>
                <View style={[styles.paymentContainer, { backgroundColor: colors.surface, borderColor: colors.primary + '1A' }]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                        {paymentCategories.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                onPress={() => setSelectedCategory(cat)}
                                style={[
                                    styles.categoryTab, 
                                    { backgroundColor: colors.background, borderColor: colors.primary + '1A' },
                                    selectedCategory === cat && { backgroundColor: colors.primary + '15', borderColor: colors.primary }
                                ]}
                            >
                                <Text style={[
                                    styles.categoryTabText, 
                                    { color: colors.text },
                                    selectedCategory === cat && { color: colors.primary }
                                ]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {selectedCategory === 'E-Wallet' && (
                        <View style={styles.methodList}>
                            {eWallets.map(m => (
                                <TouchableOpacity
                                    key={m.id}
                                    onPress={() => setSelectedMethod(m.name)}
                                    style={[styles.methodRow, { borderBottomColor: colors.background }]}
                                >
                                    <View style={[styles.radio, { borderColor: colors.text + '40' }, selectedMethod === m.name && { borderColor: colors.primary }]}>
                                        {selectedMethod === m.name && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                                    </View>
                                    <View style={[styles.methodIconBox, { backgroundColor: '#FFF' }]}>
                                        <Image source={{ uri: m.icon }} style={styles.methodIcon} resizeMode="contain" />
                                    </View>
                                    <View style={styles.methodInfo}>
                                        <Text style={[styles.methodName, { color: colors.heading }]}>{m.name}</Text>
                                        <Text style={[styles.methodDesc, { color: colors.text }]} numberOfLines={1}>{m.desc}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Collapsible Order Summary & Bottom Footer */}
            <Animated.View style={[styles.summaryContainer, { backgroundColor: colors.surface }, summaryAnimatedStyle]}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setIsSummaryCollapsed(true)}
                    style={styles.handleWrapper}
                >
                    <View style={[styles.handle, { backgroundColor: colors.primary + '20' }]} />
                </TouchableOpacity>

                <View style={styles.summaryContent}>
                    <Text style={[styles.summaryTitle, { color: colors.heading }]}>Order Summary</Text>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.text }]}>Subtotal</Text>
                        <Text style={[styles.summaryValue, { color: colors.heading }]}>₱{calculateSubtotal().toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.text }]}>Delivery fee</Text>
                        <Text style={[styles.summaryValue, { color: colors.heading }]}>₱{DELIVERY_FEE.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.primary + '1A' }]} />
                    <View style={[styles.summaryRow, { marginTop: 10, marginBottom: 15 }]}>
                        <Text style={[styles.totalLabel, { color: colors.heading }]}>Total ({menuItems.length} {menuItems.length === 1 ? 'item' : 'items'}):</Text>
                        <Text style={[styles.totalValue, { color: colors.primary }]}>₱{calculateTotal().toFixed(2)}</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.processBtn, { backgroundColor: colors.primary }, menuItems.length === 0 && styles.processBtnDisabled]}
                        disabled={menuItems.length === 0}
                        onPress={() => console.log("Processing transaction...")}
                    >
                        <Text style={styles.processBtnText} numberOfLines={1} adjustsFontSizeToFit>Process Transaction</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>

            {isSummaryCollapsed && (
                <TouchableOpacity
                    style={[styles.maximizeBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setIsSummaryCollapsed(false)}
                    activeOpacity={0.8}
                >
                    <Ionicons name="chevron-up" size={22} color="#FFF" />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 15,
        borderBottomWidth: 1,
    },
    headerBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    headerBtnPlaceholder: {
        width: 38,
    },
    headerTitleWrap: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        marginTop: 18,
        marginBottom: 12,
    },
    itemsContainer: {
        marginBottom: 6,
    },
    itemCard: {
        flexDirection: 'row',
        borderRadius: 15,
        padding: 10,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
    },
    itemImage: {
        width: 65,
        height: 65,
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
    },
    itemInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'space-between',
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    itemName: {
        fontSize: 13,
        fontWeight: '700',
        flex: 1,
        marginRight: 6,
    },
    trashBtn: {
        padding: 2,
    },
    itemPriceSingle: {
        fontSize: 11,
        marginTop: 1,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        padding: 3,
    },
    stepBtn: {
        width: 24,
        height: 24,
        borderRadius: 7,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepBtnDisabled: {
        opacity: 0.5,
    },
    stepValue: {
        fontSize: 12,
        fontWeight: '700',
        marginHorizontal: 8,
    },
    itemTotalPrice: {
        fontSize: 14,
        fontWeight: '800',
    },
    addressContainer: {
        borderRadius: 15,
        padding: 12,
        borderWidth: 1,
    },
    addressBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 10,
        borderBottomWidth: 1,
    },
    addressLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    addressIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    addressText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
    },
    editBtn: {
        padding: 6,
    },
    addAddressBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 10,
    },
    addAddressBtnText: {
        fontSize: 12,
        fontWeight: '600',
    },
    paymentContainer: {
        borderRadius: 15,
        padding: 12,
        borderWidth: 1,
    },
    categoryScroll: {
        marginBottom: 12,
    },
    categoryTab: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        marginRight: 6,
        borderWidth: 1,
    },
    categoryTabText: {
        fontSize: 11,
        fontWeight: '600',
    },
    methodList: {
        marginTop: 2,
    },
    methodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    radio: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    radioInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    methodIconBox: {
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
        marginRight: 10,
    },
    methodIcon: {
        width: '100%',
        height: '100%',
    },
    methodInfo: {
        flex: 1,
    },
    methodName: {
        fontSize: 13,
        fontWeight: '700',
    },
    methodDesc: {
        fontSize: 11,
        marginTop: 1,
    },
    summaryContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: -8 },
        shadowRadius: 15,
        elevation: 15,
        zIndex: 100,
    },
    handleWrapper: {
        width: '100%',
        paddingTop: 8,
        paddingBottom: 12,
        alignItems: 'center',
    },
    handle: {
        width: 44,
        height: 5,
        borderRadius: 2.5,
    },
    summaryContent: {
        paddingHorizontal: 22,
        paddingTop: 5,
        paddingBottom: Platform.OS === 'ios' ? 45 : 40,
    },
    summaryTitle: {
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: -0.3,
        marginBottom: 18,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 13,
    },
    summaryValue: {
        fontSize: 13,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        marginTop: 8,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '900',
    },
    processBtn: {
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    processBtnDisabled: {
        opacity: 0.5,
        shadowOpacity: 0,
        elevation: 0,
    },
    processBtnText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    maximizeBtn: {
        position: 'absolute',
        bottom: 80,
        right: 16,
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
        zIndex: 1000,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    emptyText: {
        fontSize: 14,
        marginTop: 12,
        marginBottom: 18,
    },
    browseBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 15,
    },
    browseBtnText: {
        fontSize: 13,
        fontWeight: '700',
    }
});
