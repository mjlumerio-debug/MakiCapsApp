import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
    Easing,
    useAnimatedStyle,
    withTiming
} from 'react-native-reanimated';
import { useMenuStore, resolveProductImage } from '../lib/menu_store';
import { addOrder, formatAddressForDisplay, Order, useUiStore, showGlobalAlert } from '../lib/ui_store';
import { useLocation } from '@/state/contexts/LocationContext';
import { useBranch } from '@/state/contexts/BranchContext';
import { useCart } from '@/state/contexts/CartContext';
import { getDistanceKm } from '../lib/google_location';
import { submitOrder, validateCartStock, type OrderPayload } from '../lib/order_api';
import DeliveryDetailsModal from '../components/DeliveryDetailsModal';
import StockLimitModal from '../components/StockLimitModal';
import OutOfRangeModal from '../components/OutOfRangeModal';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { StatusBar } from 'expo-status-bar';

const { height } = Dimensions.get('window');

// TypeScript Interfaces
interface CheckoutItem {
    id: string;
    title: string;
    image: any;
    price: string | number;
    quantity: number;
    stock?: number;
    max_quantity?: number;
}

export default function CheckoutScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { menuItems: storeItems } = useMenuStore();
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useAppTheme();

    // 1. Parse Cart Items from Params and Resolve from Store
    const initialCart: CheckoutItem[] = useMemo(() => {
        try {
            if (params.cart) {
                const sparseCart = JSON.parse(params.cart as string);
                // Resolve full details from store
                return sparseCart.map((item: any) => {
                    const storeItem = storeItems.find(s => s.id === String(item.id));
                    if (storeItem) {
                        return { 
                            ...storeItem, 
                            id: String(storeItem.id),
                            title: storeItem.name,
                            image: resolveProductImage(storeItem.image_path),
                            price: storeItem.selling_price,
                            quantity: item.quantity,
                            stock: storeItem.stock ?? null,
                            max_quantity: storeItem.stock ?? null,
                        };
                    }
                    // Fallback to persisted details if not in store
                    if (item.title && (item.price || item.selling_price)) {
                        return { 
                            ...item, 
                            id: String(item.id),
                            image: resolveProductImage(item.image_path || item.image),
                            price: item.selling_price || item.price,
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

    const { userId } = useUiStore();
    const { state: locationState } = useLocation();
    const { state: branchState } = useBranch();
    const { state: cartState, dispatch: cartDispatch } = useCart();

    const { selectedAddress: activeAddress } = locationState;
    const { selectedBranch } = branchState;
    const { items: cartItems } = cartState;

    const formattedActiveAddress = activeAddress ? formatAddressForDisplay(activeAddress) : '';
    const formattedMainAddress = formattedActiveAddress.split('\n')[0]?.split(',')[0] || '';

    // 2. State for Address Modal, Payment, and Summary Collapse
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
    const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
    const [userProfile, setUserProfile] = useState<{ firstName: string; lastName: string; email: string; contactNumber: string } | null>(null);
    const [stockLimitModal, setStockLimitModal] = useState<{ visible: boolean; maxQuantity: number; currentInCart: number; itemName: string }>({ visible: false, maxQuantity: 0, currentInCart: 0, itemName: '' });
    
    // ── Dynamic Delivery Fee States ──
    const [deliveryFee, setDeliveryFee] = useState<number>(0);
    const [distanceKm, setDistanceKm] = useState<number>(0);
    const [isDeliverable, setIsDeliverable] = useState<boolean>(true);
    const [checkingFee, setCheckingFee] = useState<boolean>(false);
    const [deliveryError, setDeliveryError] = useState<string>('');
    const hasTriggeredOutOfRange = useRef(false);

    const fetchFee = async () => {
        if (!activeAddress?.latitude || !activeAddress?.longitude || !selectedBranch?.id) return;
        
        setCheckingFee(true);
        setDeliveryError('');
        try {
            const { checkDeliveryFee } = require('../lib/order_api');
            const res = await checkDeliveryFee({
                branch_id: selectedBranch.id,
                latitude: activeAddress.latitude,
                longitude: activeAddress.longitude
            });
            
            setDeliveryFee(res.delivery_fee);
            setDistanceKm(res.distance_km);
            setIsDeliverable(res.is_deliverable);
            if (!res.is_deliverable) {
                setDeliveryError(res.message || 'Address out of delivery range.');
            }
        } catch (err) {
            console.error('Check fee failed:', err);
            setDeliveryError('Could not calculate delivery fee.');
        } finally {
            setCheckingFee(false);
        }
    };

    // Load user profile on mount
    React.useEffect(() => {
        let isMounted = true;
        const loadProfile = async () => {
            const profile = await AsyncStorage.getItem('user_profile');
            if (profile && isMounted) setUserProfile(JSON.parse(profile));
        };
        loadProfile();
        return () => { isMounted = false; };
    }, []);

    // ── Trigger Fee Check ──
    React.useEffect(() => {
        fetchFee();
    }, [activeAddress?.latitude, activeAddress?.longitude, selectedBranch?.id]);

    // ── Address Serviceability Monitor ──
    // Debounced: only fires once per location change cycle to avoid
    // false negatives from API delays or rapid state transitions.
    React.useEffect(() => {
        if (!activeAddress || !selectedBranch) return;
        if (checkingFee) {
            // Still calculating — don't decide yet
            return;
        }
        if (!isDeliverable && !hasTriggeredOutOfRange.current) {
            // Mark as triggered so we don't re-fire on re-renders
            hasTriggeredOutOfRange.current = true;

            // 1. Clear cart BEFORE showing modal
            cartDispatch({ type: 'CLEAR_CART' });

            // 2. Show professional global modal
            showGlobalAlert(
                "Outside Delivery Area",
                deliveryError || 'Your cart has been cleared because your current location is outside our delivery range.',
                'out_of_range',
                () => {
                    setTimeout(() => {
                        if (router.dismissAll) router.dismissAll();
                        router.replace('/home_dashboard' as any);
                    }, 100);
                }
            );
        }

        // Reset the guard when deliverability restores (e.g. user changed address back)
        if (isDeliverable) {
            hasTriggeredOutOfRange.current = false;
        }
    }, [isDeliverable, checkingFee, activeAddress?.id, selectedBranch?.id]);

    // 3. Logic Functions
    const paymentCategories = ['Cash on Delivery', 'E-Wallet'];
    const eWallets = [
        { id: 'gcash', name: 'GCash', desc: 'Secure payment via GCash.', icon: 'https://upload.wikimedia.org/wikipedia/commons/5/52/GCash_logo.svg' },
        { id: 'maya', name: 'Maya', desc: 'Fast payment via Maya.', icon: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/PayMaya_Logo.png' }
    ];

    const updateQuantity = (id: string, delta: number) => {
        setMenuItems((current) => {
            const next = current.map((item) => {
                if (item.id !== id) {
                    return item;
                }
                const maxQuantity = Number(item.max_quantity ?? item.stock ?? 0);
                const hasStockLimit = maxQuantity > 0;
                const requested = Math.max(1, item.quantity + delta);
                const clamped = hasStockLimit ? Math.min(requested, maxQuantity) : requested;

                if (hasStockLimit && requested > maxQuantity) {
                    setStockLimitModal({ visible: true, maxQuantity, currentInCart: item.quantity, itemName: item.title || 'Item' });
                }

                return {
                    ...item,
                    quantity: hasStockLimit ? clamped : requested,
                };
            });
            return next;
        });
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

    const calculateTotal = () => calculateSubtotal() + deliveryFee;

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleProcessTransaction = async () => {
        // 1. Validation
        if (!activeAddress || !activeAddress.latitude || !activeAddress.longitude) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showGlobalAlert(
                "Incomplete Address",
                "Your delivery address must include a pinned map location. Please update your address with a map pin.",
                'generic'
            );
            return;
        }

        if (!selectedBranch?.id) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showGlobalAlert("Missing Information", "Please select a delivery branch first.", 'generic');
            return;
        }

        // Distance Validation
        if (activeAddress.latitude && activeAddress.longitude && selectedBranch?.latitude && selectedBranch?.longitude) {
            const distance = getDistanceKm(activeAddress.latitude, activeAddress.longitude, selectedBranch.latitude, selectedBranch.longitude);
            if (selectedBranch.delivery_radius_km && distance > selectedBranch.delivery_radius_km) {
                cartDispatch({ type: 'CLEAR_CART' });
                showGlobalAlert(
                    "Outside Delivery Area",
                    "Your current location is outside our delivery range for this branch.",
                    'out_of_range',
                    () => router.replace('/home_dashboard' as any)
                );
                return;
            }
        }

        if (!selectedMethod && selectedCategory !== 'Cash on Delivery') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showGlobalAlert("Missing Information", "Please select a payment method.", 'generic');
            return;
        }

        if (menuItems.length === 0) {
            showGlobalAlert("Empty Cart", "Your cart is empty.", 'generic');
            return;
        }

        // Strict Availability & Branch Ownership Check
        const invalidItems = menuItems.filter(item => {
            const storeItem = storeItems.find(s => s.id === item.id);
            // 🛡️ Validate item exists, is available, AND belongs to the selected branch
            return !storeItem || !storeItem.is_available || (storeItem.branch_id && Number(storeItem.branch_id) !== Number(selectedBranch.id));
        });

        if (invalidItems.length > 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showGlobalAlert(
                "Items Unavailable", 
                "Some items in your cart are no longer available or do not belong to the selected branch. Please update your cart to continue.",
                'generic',
                () => router.back()
            );
            return;
        }

        const hasExceededLocalStock = menuItems.some((item) => {
            const maxQuantity = Number(item.max_quantity ?? item.stock ?? 0);
            // Only block if there's a real stock limit and the quantity exceeds it
            return maxQuantity > 0 && item.quantity > maxQuantity;
        });

        if (hasExceededLocalStock) {
            const overItem = menuItems.find((item) => {
                const mq = Number(item.max_quantity ?? item.stock ?? 0);
                return mq > 0 && item.quantity > mq;
            });
            setStockLimitModal({ visible: true, maxQuantity: Number(overItem?.max_quantity ?? overItem?.stock ?? 0), currentInCart: overItem?.quantity ?? 0, itemName: overItem?.title || 'Item' });
            return;
        }

        setIsSubmitting(true);

        // 2. Build payload for Laravel
        const fullName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}`.trim() : 'Customer';
        
        const orderPayload: OrderPayload = {
            user_id: userId || null as any,
            branch_id: Number(selectedBranch.id),
            customer_name: fullName || 'Customer',
            mobile_number: userProfile?.contactNumber || (userProfile as any)?.mobile_number || '',
            address: formattedActiveAddress || activeAddress.fullAddress,
            latitude: activeAddress.latitude || 0,
            longitude: activeAddress.longitude || 0,
            landmark: activeAddress.subdivision || '',
            notes: activeAddress.notes || '',
            items: menuItems.map(item => ({
                product_id: Number(item.id) || 0,
                name: item.title,
                quantity: item.quantity,
                price: typeof item.price === 'string'
                    ? parseFloat(item.price.replace(/[^\d.]/g, ''))
                    : item.price,
            })),
            distance_km: distanceKm || 0,
            delivery_fee: deliveryFee || 0,
            total_amount: calculateTotal(),
            payment_method: selectedCategory === 'Cash on Delivery' ? 'cod' : (selectedMethod || 'e-wallet'),
        };

        try {
            await validateCartStock({
                branch_id: Number(selectedBranch.id),
                user_id: userId || undefined,
                items: menuItems.map((item) => ({
                    product_id: parseInt(item.id, 10) || 0,
                    name: item.title,
                    quantity: item.quantity,
                    price: typeof item.price === 'string'
                        ? parseFloat(item.price.replace(/[^\d.]/g, ''))
                        : item.price,
                })),
            });

            console.log('[Checkout] Submitting order payload:', JSON.stringify(orderPayload, null, 2));

            // 3. Submit to Laravel backend
            const result = await submitOrder(orderPayload);
            console.log('[Checkout] Order submitted successfully:', result);

            // 4. Create local Order record
            const firstItem = menuItems[0];
            const orderId = `ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

            const itemsList = menuItems.map(item => ({
                title: item.title,
                quantity: item.quantity,
                price: `₱${(typeof item.price === 'string' ? parseFloat(item.price.replace(/[^\d.]/g, '')) : item.price).toFixed(2)}`
            }));

            const newOrder: Order = {
                id: Math.random().toString(36).substring(2, 9),
                orderId: orderId,
                backendOrderId: result.order_id,
                items: menuItems.reduce((acc, item) => acc + item.quantity, 0),
                subtotal: `₱${calculateSubtotal().toFixed(2)}`,
                deliveryFee: `₱${deliveryFee.toFixed(2)}`,
                totalPrice: `₱${calculateTotal().toFixed(2)}`,
                title: menuItems.length > 1 ? `${firstItem.title} + ${menuItems.length - 1} more` : firstItem.title,
                status: 'In Progress',
                status_label: '⏳ Pending',
                raw_status: 'pending',
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                deliveryTime: 'Today, ' + new Date(Date.now() + 45 * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                paymentMethod: selectedCategory === 'Cash on Delivery' ? 'Cash on Delivery' : (selectedMethod || 'E-Wallet'),
                fullAddress: formattedActiveAddress || activeAddress.fullAddress,
                itemsList: itemsList,
                image: firstItem.image,
                _rawDate: Date.now()
            };

            // 5. Save order locally, clear cart, then navigate to tracking
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            addOrder(newOrder);
            cartDispatch({ type: 'CLEAR_CART' });

            router.replace({
                pathname: '/my-orders',
                params: {
                    showReceiptId: String(result.order_id),
                    justOrdered: 'true'
                },
            } as any);

        } catch (error: any) {
            console.error('[Checkout] Order submission failed:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showGlobalAlert(
                "Order Failed",
                error?.message || "Could not place your order. Please check your connection and try again.",
                'generic'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

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
        <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
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
                        menuItems.length > 5 && { height: height * 0.45 }
                    ]}>
                        <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                            {menuItems.map((item) => (
                                <View key={item.id}>
                                    {renderMenuItem({ item })}
                                </View>
                            ))}
                        </ScrollView>
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
                <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.heading }]}>Delivery Address</Text>
                    <TouchableOpacity onPress={() => router.push('/addresses' as any)}>
                        <Text style={[styles.sectionActionText, { color: colors.primary }]}>Manage</Text>
                    </TouchableOpacity>
                </View>
                
                <TouchableOpacity 
                    activeOpacity={0.7} 
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowDeliveryModal(true);
                    }}
                    style={[styles.addressContainer, { backgroundColor: colors.surface, borderColor: colors.primary + '1A' }]}
                >
                    <View style={[styles.addressBox, { borderBottomColor: colors.primary + '1A' }]}>
                        <View style={styles.addressLeft}>
                            <View style={[styles.addressIconCircle, { backgroundColor: colors.primary + '15' }]}>
                                <Ionicons name="location" size={18} color={colors.primary} />
                            </View>
                            <View style={styles.addressContent}>
                                {activeAddress ? (
                                    <>
                                        <Text style={[styles.addressMainText, { color: colors.heading }]} numberOfLines={2}>
                                            {formattedMainAddress || 'Delivery Address'}
                                        </Text>
                                        <Text style={[styles.addressSubText, { color: colors.text }]} numberOfLines={3}>
                                            {formattedActiveAddress || activeAddress.fullAddress}
                                        </Text>
                                    </>
                                ) : (
                                    <Text style={[styles.addressMainText, { color: colors.heading }]}>Choose delivery address</Text>
                                )}
                            </View>
                        </View>
                        <View style={styles.editBtn}>
                            <Feather name="chevron-right" size={20} color={colors.text} />
                        </View>
                    </View>
                </TouchableOpacity>

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

                    {selectedCategory === 'Cash on Delivery' && (
                        <View style={styles.methodList}>
                            <TouchableOpacity
                                onPress={() => {}} // Category selection is enough
                                style={[styles.methodRow, { borderBottomColor: 'transparent' }]}
                                disabled={true}
                            >
                                <View style={[styles.radio, { borderColor: colors.primary }]}>
                                    <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                                </View>
                                <View style={[styles.methodIconBox, { backgroundColor: colors.primary + '15' }]}>
                                    <MaterialCommunityIcons name="hand-coin" size={20} color={colors.primary} />
                                </View>
                                <View style={styles.methodInfo}>
                                    <Text style={[styles.methodName, { color: colors.heading }]}>Pay on Delivery</Text>
                                    <Text style={[styles.methodDesc, { color: colors.text }]} numberOfLines={1}>Pay when your order arrives.</Text>
                                </View>
                            </TouchableOpacity>
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
                        <Text style={[styles.summaryLabel, { color: colors.text }]}>
                            Delivery fee {distanceKm > 0 ? `(${distanceKm.toFixed(1)}km)` : ''}
                        </Text>
                        {checkingFee ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Text style={[styles.summaryValue, { color: colors.heading }]}>₱{deliveryFee.toFixed(2)}</Text>
                        )}
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.primary + '1A' }]} />
                    <View style={[styles.summaryRow, { marginTop: 10, marginBottom: 15 }]}>
                        <Text style={[styles.totalLabel, { color: colors.heading }]}>Total ({menuItems.length} {menuItems.length === 1 ? 'item' : 'items'}):</Text>
                        <Text style={[styles.totalValue, { color: colors.primary }]}>₱{calculateTotal().toFixed(2)}</Text>
                    </View>

                    <TouchableOpacity 
                        style={[
                            styles.processBtn, 
                            { backgroundColor: colors.primary }, 
                            (isSubmitting || checkingFee || !isDeliverable) && styles.processBtnDisabled
                        ]}
                        onPress={handleProcessTransaction}
                        disabled={isSubmitting || checkingFee || !isDeliverable}
                        activeOpacity={0.8}
                    >
                        {isSubmitting ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <ActivityIndicator size="small" color="#FFFFFF" />
                                <Text style={styles.processBtnText}>Placing Order...</Text>
                            </View>
                        ) : checkingFee ? (
                            <Text style={styles.processBtnText}>Checking Delivery Fee...</Text>
                        ) : !isDeliverable ? (
                            <Text style={[styles.processBtnText, { color: '#6B7280' }]}>Out of Range</Text>
                        ) : (
                            <Text style={styles.processBtnText} numberOfLines={1} adjustsFontSizeToFit>Confirm Order • ₱{calculateTotal().toFixed(2)}</Text>
                        )}
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

            <DeliveryDetailsModal
                visible={showDeliveryModal}
                onClose={() => setShowDeliveryModal(false)}
                onAddAddress={() => {
                    setShowDeliveryModal(false);
                    router.push('/addresses' as any);
                }}
            />

            <StockLimitModal
                visible={stockLimitModal.visible}
                onClose={() => setStockLimitModal(prev => ({ ...prev, visible: false }))}
                maxQuantity={stockLimitModal.maxQuantity}
                currentInCart={stockLimitModal.currentInCart}
                itemName={stockLimitModal.itemName}
            />


        </View>
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
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingBottom: 10,
        borderBottomWidth: 1,
    },
    addressLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
        minWidth: 0,
    },
    addressContent: {
        flex: 1,
        minWidth: 0,
        flexShrink: 1,
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
        alignSelf: 'flex-start',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 18,
        marginBottom: 12,
    },
    sectionActionText: {
        fontSize: 12,
        fontWeight: '600',
    },
    addressMainText: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 2,
    },
    addressSubText: {
        fontSize: 12,
        lineHeight: 17,
        flexShrink: 1,
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
        paddingTop: 14,
        paddingBottom: 22,
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
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    processBtnDisabled: {
        backgroundColor: '#E5E7EB',
        opacity: 0.9,
        shadowOpacity: 0,
        elevation: 0,
    },
    processBtnText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.3,
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
