import { Typography } from '@/constants/theme';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    NativeModules,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMenuStoreSnapshot, refreshMenuStore, resolveProductImage } from '../lib/menu_store';
import { fetchMyOrders, fetchOrderStatus } from '../lib/order_api';
import { getUiStoreSnapshot, setOrders, useUiStore, type OrderItem } from '../lib/ui_store';

const { width } = Dimensions.get('window');
const { StatusBarManager } = NativeModules;
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 20 : (StatusBarManager?.HEIGHT || 0);

// --- Reusable Components ---

const Header = ({ title, onBack, insets, isSearchActive, setIsSearchActive, searchQuery, setSearchQuery, colors }: any) => {
    const topPadding = insets.top > 0 ? insets.top + 8 : (Platform.OS === 'android' ? 32 : 12);

    return (
        <View style={[styles.header, { paddingTop: topPadding, backgroundColor: colors.background }]}>
            <View style={styles.headerLeft}>
                <TouchableOpacity style={[styles.headerBackBtn, { backgroundColor: colors.surface }]} onPress={onBack} activeOpacity={0.7}>
                    <Feather name="chevron-left" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.headerCenter}>
                {isSearchActive ? (
                    <View style={[styles.searchInputWrapper, { backgroundColor: colors.surface }]}>
                        <Feather name="search" size={16} color={colors.text + '80'} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.heading }]}
                            placeholder="Search orders..."
                            placeholderTextColor={colors.text + '80'}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                    </View>
                ) : (
                    <Text style={[styles.headerTitle, { color: colors.heading }]} numberOfLines={1}>{title}</Text>
                )}
            </View>

            <View style={styles.headerRightArea}>
                <TouchableOpacity
                    style={[styles.headerActionBtn, { backgroundColor: colors.surface, borderRadius: 20 }]}
                    activeOpacity={0.7}
                    onPress={() => {
                        setIsSearchActive(!isSearchActive);
                        if (isSearchActive) setSearchQuery('');
                    }}
                >
                    <Feather name={isSearchActive ? "x" : "search"} size={20} color={colors.text} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const Tabs = ({ activeTab, onTabPress, colors }: any) => {
    const tabs = ['Active', 'Completed', 'Cancelled'];
    return (
        <View style={styles.tabsWrapper}>
            {tabs.map((tab) => (
                <TouchableOpacity
                    key={tab}
                    onPress={() => onTabPress(tab)}
                    style={[
                        styles.tabBtn,
                        activeTab === tab ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.primary + '1A', borderWidth: 1 },
                        activeTab === tab ? styles.tabBtnActive : styles.tabBtnInactive,
                    ]}
                    activeOpacity={0.8}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === tab ? { color: '#FFFFFF' } : { color: colors.text },
                        ]}
                    >
                        {tab}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    in_transit: 'Out for Delivery',
    delivered: 'Delivered',
    completed: 'Delivered',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    rejected: 'Cancelled',
    declined: 'Cancelled',
    failed: 'Failed'
};

const ActiveOrderCard = ({ order, colors, openReceipt, onTrack }: any) => {
    // Attempt to extract the raw machine status to match against STATUS_LABELS
    // Sometimes order.status is mapped to 'In Progress', so we rely on status_label or internal mapping if needed.
    // Assuming backend bo.status is carried over, but if not we can use order.status_label
    const displayStatus = STATUS_LABELS[order.raw_status] || order.status_label || order.status;

    return (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardTop}>
                <Image
                    source={order.image || require('../assets/images/sushi-hero.png')}
                    style={styles.cardImage}
                    contentFit="cover"
                />
                <View style={styles.cardInfo}>
                    <View style={styles.cardRow}>
                        <Text style={[styles.productName, { color: colors.heading }]}>{order.title}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: colors.primary + '15' }]}>
                            <Text style={[styles.statusText, { color: colors.primary }]}>{displayStatus}</Text>
                        </View>
                    </View>
                    <Text style={[styles.orderIdText, { color: colors.text }]}>Order #{order.orderId}</Text>
                </View>
            </View>

            <View style={styles.cardDetailsRow}>
                <Text style={[styles.itemCountText, { color: colors.text }]}>
                    {order.items}x Items
                </Text>
                <Text style={[styles.priceValueText, { color: colors.heading }]}>
                    {displayMoney(order.totalPrice || order.price)}
                </Text>
            </View>

            <View style={styles.deliveryInfoRow}>
                <Text style={[styles.deliveryLabel, { color: colors.text }]}>Estimated delivery</Text>
                <Text style={[styles.deliveryTime, { color: colors.heading }]}>{order.deliveryTime || order.delivery}</Text>
            </View>

            <View style={styles.cardFooter}>
                <TouchableOpacity
                    style={[styles.receiptBtn, { borderColor: colors.primary + '33' }]}
                    activeOpacity={0.7}
                    onPress={() => openReceipt(order)}
                >
                    <Text style={[styles.receiptBtnText, { color: colors.primary }]}>View Receipt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.trackBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                    activeOpacity={0.8}
                    onPress={() => onTrack && onTrack(order)}
                >
                    <Text style={styles.trackBtnText}>Track Order</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryActionBtn, { backgroundColor: colors.background }]} activeOpacity={0.7}>
                    <Feather name="phone" size={20} color={colors.heading} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const RecentOrderCard = ({ order, colors, openReceipt }: any) => {
    const isCancelled = order.status === 'Cancelled';
    const displayStatus = isCancelled ? 'Cancelled' : 'Delivered';
    const statusColor = isCancelled ? '#EF4444' : '#10B981';
    const statusBg = isCancelled ? '#FEE2E2' : '#E1F8ED';

    return (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardTop}>
                <Image
                    source={order.image || require('../assets/images/sushi-hero.png')}
                    style={styles.cardImage}
                    contentFit="cover"
                />
                <View style={styles.cardInfo}>
                    <View style={styles.cardRow}>
                        <Text style={[styles.productName, { color: colors.heading }]}>{order.title}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                            <Text style={[styles.statusText, { color: statusColor, fontWeight: '700' }]}>{displayStatus}</Text>
                        </View>
                    </View>
                    <Text style={[styles.orderIdText, { color: colors.text }]}>{order.date} • Order #{order.orderId}</Text>
                </View>
            </View>

            <View style={styles.cardDetailsRow}>
                <Text style={[styles.itemCountText, { color: colors.text }]}>{order.items}x Items</Text>
                <Text style={[styles.priceValueText, { color: colors.heading }]}>{order.totalPrice}</Text>
            </View>

            <View style={styles.deliveryInfoRow}>
                <Text style={[styles.deliveryLabel, { color: colors.text }]}>{isCancelled ? 'Cancelled on' : 'Delivered on'}</Text>
                <Text style={[styles.deliveryTime, { color: colors.heading }]}>{order.date} • {order.deliveryTime}</Text>
            </View>

            <View style={styles.cardFooter}>
                <TouchableOpacity
                    style={[styles.receiptBtn, { borderColor: colors.primary + '33' }]}
                    activeOpacity={0.7}
                    onPress={() => openReceipt(order)}
                >
                    <Text style={[styles.receiptBtnText, { color: colors.primary }]}>Receipt</Text>
                </TouchableOpacity>
                {!isCancelled && (
                    <TouchableOpacity style={[styles.buyAgainBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
                        <Text style={styles.buyAgainBtnText}>Buy Again</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.secondaryActionBtn, { backgroundColor: colors.background }]} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="history" size={24} color={colors.heading} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const EmptyState = ({ title, message, colors }: any) => (
    <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface }]}>
            <Feather name="package" size={48} color={colors.text + '40'} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.heading }]}>{title || "Welcome!"}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.text }]}>{message || "You don't have any orders here yet. Your culinary journey starts with your first order!"}</Text>
    </View>
);

const ReceiptModal = ({ visible, onClose, order, isLoading, colors }: any) => {
    if (!order && !isLoading) return null;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.receiptContainer, { backgroundColor: colors.surface }]}>
                    <View style={styles.receiptHeader}>
                        <Text style={[styles.receiptHeaderTitle, { color: colors.heading }]}>Order Receipt</Text>
                        <TouchableOpacity style={styles.closeModalBtn} onPress={onClose}>
                            <Feather name="x" size={22} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {isLoading ? (
                        <View style={styles.receiptLoadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.text }]}>Fetching details...</Text>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.receiptScroll}>
                            {/* Status Icon */}
                            <View style={styles.receiptTopInfo}>
                                <View style={styles.checkCircle}>
                                    {order.raw_status === 'cancelled' ? (
                                        <Ionicons name="close-circle" size={32} color="#EF4444" />
                                    ) : order.raw_status === 'delivered' ? (
                                        <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                                    ) : (
                                        <Ionicons name="time" size={32} color={colors.primary} />
                                    )}
                                </View>
                                <Text style={[styles.receiptMainTitle, { color: colors.heading }]}>
                                    {order.raw_status === 'cancelled' ? 'Order Cancelled' :
                                        order.raw_status === 'delivered' ? 'Order Delivered' :
                                            (STATUS_LABELS[order.raw_status] || `Order ${order.status_label || 'Processing'}`)}
                                </Text>
                                {order.raw_status === 'delivered' && (
                                    <Text style={[styles.deliveredNote, { color: '#10B981' }]}>
                                        Your order has been successfully delivered. Enjoy your meal!
                                    </Text>
                                )}
                                <Text style={[styles.receiptDate, { color: colors.text }]}>{order.date} • {order.deliveryTime}</Text>
                            </View>

                            {/* Order ID */}
                            <View style={[styles.idBox, { backgroundColor: colors.background }]}>
                                <Text style={[styles.idLabel, { color: colors.text }]}>Order ID</Text>
                                <Text style={[styles.idValue, { color: colors.heading }]}>Order #{order.orderId}</Text>
                            </View>

                            {/* Items List */}
                            <View style={styles.receiptSection}>
                                <Text style={[styles.receiptSectionTitle, { color: colors.primary }]}>Order Details</Text>
                                {order.itemsList?.length ? (
                                    order.itemsList.map((item: any, index: number) => (
                                        <View key={index} style={styles.receiptItemRow}>
                                            <Text style={[styles.receiptItemQty, { color: colors.primary }]}>{item.quantity}x</Text>
                                            <Text style={[styles.receiptItemName, { color: colors.heading }]}>{item.title}</Text>
                                            <Text style={[styles.receiptItemPrice, { color: colors.heading }]}>{displayMoney(item.price)}</Text>
                                        </View>
                                    ))
                                ) : (
                                    <Text style={[styles.summaryLabel, { color: colors.text }]}>No item details available for this order yet.</Text>
                                )}
                            </View>

                            {/* Dash Separator */}
                            <View style={[styles.dashedLine, { borderBottomColor: colors.primary + '1A' }]} />

                            {/* Summary */}
                            <View style={styles.receiptSection}>
                                <View style={styles.summaryRow}>
                                    <Text style={[styles.summaryLabel, { color: colors.text }]}>Subtotal</Text>
                                    <Text style={[styles.summaryValue, { color: colors.heading }]}>{displayMoney(order.subtotal)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={[styles.summaryLabel, { color: colors.text }]}>Delivery Fee</Text>
                                    <Text style={[styles.summaryValue, { color: colors.heading }]}>{displayMoney(order.deliveryFee)}</Text>
                                </View>
                                <View style={[styles.summaryRow, { marginTop: 6 }]}>
                                    <Text style={[styles.grandTotalLabel, { color: colors.heading }]}>Total Amount</Text>
                                    <Text style={[styles.grandTotalValue, { color: colors.primary }]}>{displayMoney(order.totalPrice)}</Text>
                                </View>
                            </View>

                            {/* Payment & Delivery */}
                            <View style={styles.receiptSection}>
                                <Text style={[styles.receiptSectionTitle, { color: colors.primary }]}>Payment & Delivery</Text>

                                <View style={styles.infoRow}>
                                    <View style={[styles.infoIconBox, { backgroundColor: colors.background }]}>
                                        <Feather name="credit-card" size={14} color={colors.text} />
                                    </View>
                                    <View style={styles.infoContent}>
                                        <Text style={[styles.infoLabel, { color: colors.text }]}>Payment Method</Text>
                                        <Text style={[styles.infoValue, { color: colors.heading }]}>{order.paymentMethod}</Text>
                                    </View>
                                </View>

                                <View style={[styles.infoRow, { marginTop: 10 }]}>
                                    <View style={[styles.infoIconBox, { backgroundColor: colors.background }]}>
                                        <Feather name="map-pin" size={14} color={colors.text} />
                                    </View>
                                    <View style={styles.infoContent}>
                                        <Text style={[styles.infoLabel, { color: colors.text }]}>Delivery Address</Text>
                                        <Text style={[styles.infoValue, { color: colors.heading }]} numberOfLines={2}>{order.fullAddress}</Text>
                                    </View>
                                </View>
                            </View>
                        </ScrollView>
                    )}

                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={onClose}>
                            <Text style={styles.doneBtnText}>Close Receipt</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const toNumber = (value: unknown, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toPeso = (value: number): string => `\u20B1${value.toFixed(2)}`;

const displayMoney = (value: unknown): string => {
    const numeric = Number(String(value ?? '').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(numeric)) return String(value ?? '').replace(/â‚±/g, '\u20B1');
    return `\u20B1${numeric.toFixed(2)}`;
};

const normalizePaymentMethod = (value: unknown): string => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'Cash on Delivery';
    if (raw === 'cod' || raw === 'cash' || raw.includes('cash on delivery')) return 'Cash on Delivery';
    if (raw.includes('gcash')) return 'GCash';
    if (raw.includes('maya') || raw.includes('paymaya')) return 'Maya';
    if (raw === 'e-wallet' || raw === 'ewallet') return 'E-Wallet';
    return String(value);
};

const extractRawOrderItems = (backendOrder: any): any[] => {
    if (Array.isArray(backendOrder?.items)) return backendOrder.items;
    if (Array.isArray(backendOrder?.order_items)) return backendOrder.order_items;
    if (Array.isArray(backendOrder?.line_items)) return backendOrder.line_items;
    if (Array.isArray(backendOrder?.products)) return backendOrder.products;
    if (Array.isArray(backendOrder?.data?.items)) return backendOrder.data.items;
    return [];
};

const normalizeItemsList = (rawItems: any[]): { itemsList: OrderItem[]; itemCount: number; computedSubtotal: number } => {
    const itemsList: OrderItem[] = rawItems.map((raw) => {
        const quantity = toNumber(raw?.quantity ?? raw?.qty ?? raw?.pivot?.quantity, 1);

        // Handle both raw numeric price and already-formatted string price
        let unitPrice = 0;
        if (typeof raw?.price === 'string' && raw.price.includes('\u20B1')) {
            unitPrice = toNumber(raw.price.replace(/[^\d.]/g, ''), 0);
        } else {
            unitPrice = toNumber(raw?.price ?? raw?.unit_price ?? raw?.pivot?.price, 0);
        }

        const lineTotal = toNumber(raw?.total ?? raw?.line_total, unitPrice * quantity);
        return {
            title: raw?.product_name || raw?.name || raw?.title || 'Product',
            quantity,
            price: typeof raw?.price === 'string' && raw.price.includes('\u20B1') ? raw.price : toPeso(lineTotal),
            product_id: raw?.product_id, // EXPLICITLY use product_id, NOT order item id
            image: raw?.product_image || raw?.image_url || raw?.image,
        };
    });

    const itemCount = itemsList.reduce((sum, item) => sum + toNumber(item.quantity, 0), 0);
    const computedSubtotal = itemsList.reduce((sum, item) => {
        const parsed = Number(String(item.price).replace(/[^\d.]/g, ''));
        return sum + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);

    return { itemsList, itemCount, computedSubtotal };
};

// --- Main Screen ---

export default function MyOrdersScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useAppTheme();
    const { orders, addresses, activeAddressId } = useUiStore();

    const [activeTab, setActiveTab] = useState('Active');
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [isReceiptVisible, setIsReceiptVisible] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isReceiptLoading, setIsReceiptLoading] = useState(false);

    // 🔄 Sync selectedOrder with global orders store if it updates in background
    React.useEffect(() => {
        if (selectedOrder && isReceiptVisible) {
            const updated = orders.find(o => o.id === selectedOrder.id || o.orderId === selectedOrder.orderId);
            // If the store version has more details (items) than our local copy, sync up
            if (updated &&
                (updated.itemsList?.length || 0) > (selectedOrder.itemsList?.length || 0)) {
                setSelectedOrder(updated);
            }
        }
    }, [orders, isReceiptVisible, selectedOrder?.id, selectedOrder?.orderId, selectedOrder?.itemsList?.length]);

    const activeAddress = addresses.find((a) => a.id === activeAddressId) || addresses[0];
    const fallbackAddress = activeAddress?.fullAddress || 'No delivery address selected';

    const loadOrders = React.useCallback(async () => {
        setIsRefreshing(true);
        try {
            if (getMenuStoreSnapshot().menuItems.length === 0) {
                await refreshMenuStore('global');
            }
            const baseBackendOrders = await fetchMyOrders();
            const currentOrders = getUiStoreSnapshot().orders;

            const backendOrders = await Promise.all(baseBackendOrders.map(async (bo: any) => {
                const idToFetch = bo.order_id || bo.id;
                const rawStatus = String(bo.status || '').toLowerCase();
                const existing = currentOrders.find(o =>
                    (o.backendOrderId && idToFetch && Number(o.backendOrderId) === Number(idToFetch)) ||
                    (o.orderId && String(o.orderId).includes(String(idToFetch)))
                );

                // IMPORTANT: If we have an existing local match with detailed items, keep it as base!
                // This prevents "summarized" backend data from overwriting high-quality local details.
                const hasExistingItems = existing && existing.itemsList && existing.itemsList.length > 0;
                const isActive = !['delivered', 'completed', 'cancelled', 'failed'].includes(rawStatus);

                // ALWAYS fetch full status if items are missing, or if it's an active order
                if (!hasExistingItems || isActive) {
                    try {
                        const fullOrder = await fetchOrderStatus(idToFetch);
                        const safeFullOrder = fullOrder || {};
                        // Merge: bo (summary) < fullOrder (detailed) < existing (local)
                        return {
                            ...bo,
                            ...safeFullOrder,
                            items: (safeFullOrder as any).items && (safeFullOrder as any).items.length > 0 ? (safeFullOrder as any).items : (existing?.itemsList || bo.items || [])
                        };
                    } catch (err) {
                        console.log(`[MyOrders] Failed fetch #${idToFetch}`, err);
                    }
                }

                // If skipping fetch, prioritize existing local items list
                return {
                    ...bo,
                    items: existing?.itemsList || bo.items || [],
                    // Preserve extra local fields
                    payment_method: bo.payment_method || existing?.paymentMethod,
                    address: bo.address || existing?.fullAddress
                };
            }));
            const mappedOrdersNormalized = backendOrders.map((bo: any) => {
                const backendOrderId = toNumber(bo.order_id || bo.id, 0);
                const backendOrderNo = String(bo.order_number || bo.order_no || '');
                const backendUuid = String(bo.uuid || '');

                const localMatch = currentOrders.find((o) =>
                    (o.backendOrderId && backendOrderId && Number(o.backendOrderId) === Number(backendOrderId)) ||
                    (o.orderId && backendOrderNo && String(o.orderId).includes(backendOrderNo)) ||
                    (backendOrderNo && String(o.orderId).includes(backendOrderNo)) ||
                    (o.id && backendUuid && String(o.id) === backendUuid)
                );
                const rawItems = extractRawOrderItems(bo);
                const { itemsList: currentItems, itemCount, computedSubtotal } = normalizeItemsList(rawItems);
                const localDeliveryFee = localMatch ? toNumber(String(localMatch.deliveryFee).replace(/[^\d.]/g, ''), 0) : 38;
                const localTotal = localMatch ? toNumber(String(localMatch.totalPrice).replace(/[^\d.]/g, ''), 0) : 0;
                const deliveryFeeNum = toNumber(bo.delivery_fee || bo.shipping_fee || bo.delivery_charge, localDeliveryFee || 38);
                let totalAmountNum = toNumber(bo.total_amount || bo.total || bo.grand_total || bo.total_price, 0);
                if (totalAmountNum <= 0) totalAmountNum = (computedSubtotal + deliveryFeeNum) || localTotal;
                const subtotalNum = toNumber(bo.subtotal || bo.items_total || bo.total_items_price, computedSubtotal || Math.max(0, totalAmountNum - deliveryFeeNum));
                const normalizedItemsList = currentItems.length > 0 ? currentItems : (localMatch?.itemsList || []);
                const normalizedItemCount = Math.max(itemCount, normalizedItemsList.length, toNumber(bo.items_count, 0));
                const firstItem = normalizedItemsList[0] || {};
                const firstTitle = firstItem.title || bo.title || localMatch?.title || 'Order';
                const rawStatus = String(bo.status || 'pending');
                const statusLabel = STATUS_LABELS[rawStatus] || rawStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                let formattedDate = localMatch?.date || 'N/A';
                let formattedTime = localMatch?.deliveryTime || 'Calculating ETA...';
                if (bo.created_at) {
                    const createdDate = new Date(bo.created_at);
                    formattedDate = createdDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                    const etaDate = new Date(createdDate.getTime() + 45 * 60000);
                    formattedTime = `ETA: ${etaDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
                    
                    if (['delivered', 'cancelled', 'completed', 'failed'].includes(rawStatus)) {
                        const statusDate = bo.updated_at ? new Date(bo.updated_at) : createdDate;
                        formattedDate = statusDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                        formattedTime = statusDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    }
                }
                let itemImage = localMatch?.image || require('../assets/images/sushi-hero.png');
                if (firstItem.image) {
                    itemImage = typeof firstItem.image === 'string'
                        ? { uri: resolveProductImage(firstItem.image) }
                        : firstItem.image;
                }
                // 1. Calculate base subtotal (from items list or backend)
                let finalSubtotalNum = toNumber(subtotalNum, 0);
                if (normalizedItemsList.length > 0 && finalSubtotalNum <= 0) {
                    finalSubtotalNum = normalizedItemsList.reduce((sum, i) => sum + (toNumber(String(i.price).replace(/[^\d.]/g, ''), 0)), 0);
                }

                // 2. Check local match if still zero
                if (finalSubtotalNum <= 0 && localMatch?.subtotal && localMatch.subtotal !== '₱0.00') {
                    finalSubtotalNum = toNumber(localMatch.subtotal.replace(/[^\d.]/g, ''), 0);
                }

                const finalDeliveryFeeNum = toNumber(deliveryFeeNum, 38);
                const finalTotalNum = finalSubtotalNum + finalDeliveryFeeNum;

                return {
                    id: localMatch?.id || String(backendOrderId),
                    orderId: localMatch?.orderId || `ORD-${backendOrderId}`,
                    backendOrderId: backendOrderId || localMatch?.backendOrderId,
                    items: normalizedItemCount,
                    totalPrice: toPeso(finalTotalNum),
                    subtotal: toPeso(finalSubtotalNum),
                    deliveryFee: toPeso(finalDeliveryFeeNum),
                    title: normalizedItemCount > 1 ? `${firstTitle} + ${normalizedItemCount - 1} more` : firstTitle,
                    status: (['delivered', 'completed'].includes(rawStatus) ? 'Delivered' : ['cancelled', 'canceled', 'rejected', 'declined', 'failed'].includes(rawStatus) ? 'Cancelled' : 'In Progress') as any,
                    status_label: statusLabel,
                    date: formattedDate,
                    deliveryTime: formattedTime,
                    paymentMethod: normalizePaymentMethod(bo.payment_method || bo.payment_type || localMatch?.paymentMethod),
                    fullAddress: bo.address || bo.delivery_address || bo.full_address || localMatch?.fullAddress || fallbackAddress,
                    itemsList: normalizedItemsList,
                    image: itemImage,
                    _rawDate: bo.created_at ? new Date(bo.created_at).getTime() : 0,
                    raw_status: rawStatus,
                };
            }).filter(Boolean);
            const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
            const freshOrders = mappedOrdersNormalized
                .filter((o: any) => {
                    const isFinished = o.status === 'Delivered' || o.status === 'Cancelled';
                    const isMissingData = (toNumber(o.items, 0) === 0 || o.totalPrice === '₱0.00');
                    const isBrandNew = (o._rawDate && (Date.now() - o._rawDate) < 5 * 60000);

                    if (isFinished) {
                        if (isMissingData) return false;
                        if (o._rawDate && o._rawDate > 0) return o._rawDate > twentyFourHoursAgo;
                        return false;
                    }
                    if (isMissingData && !isBrandNew) return false;
                    return true;
                })
                .sort((a: any, b: any) => (toNumber(b._rawDate, 0)) - (toNumber(a._rawDate, 0)));

            setOrders(freshOrders as any);
        } catch (e) {
            console.error('Refresh orders failed', e);
        } finally {
            setIsRefreshing(false);
        }
    }, [fallbackAddress]);

    const openReceipt = React.useCallback(async (order: any) => {
        setSelectedOrder(order);
        setIsReceiptVisible(true);
        const hasDetailedItems = order.itemsList && order.itemsList.length > 0;
        if (order.backendOrderId) {
            if (!hasDetailedItems) setIsReceiptLoading(true);
            try {
                const fullOrder = await fetchOrderStatus(order.backendOrderId);
                const rawItems = extractRawOrderItems(fullOrder);
                const { itemsList, computedSubtotal } = normalizeItemsList(rawItems);
                if (itemsList && itemsList.length > 0) {
                    const fo = fullOrder as any;
                    // Support exhaustive list of backend field names for receipt details
                    const subtotalNum = toNumber(fo.subtotal ?? fo.items_total ?? fo.total_items_price ?? fo.products_total, computedSubtotal || 0);
                    const deliveryFeeNum = toNumber(fo.delivery_fee ?? fo.shipping_fee ?? fo.delivery_charge ?? fo.delivery_total, 
                        toNumber(String(order.deliveryFee).replace(/[^\d.]/g, ''), 38));
                    
                    // CRITICAL: Always derive Total from Subtotal + Delivery to ensure accuracy
                    const totalAmountNum = subtotalNum + deliveryFeeNum;

                    setSelectedOrder((prev: any) => ({
                        ...prev,
                        itemsList,
                        subtotal: toPeso(subtotalNum),
                        deliveryFee: toPeso(deliveryFeeNum),
                        totalPrice: toPeso(totalAmountNum),
                        paymentMethod: normalizePaymentMethod(fo.payment_method || fo.payment_type || fo.payment_mode || prev?.paymentMethod),
                        fullAddress: fo.address || fo.delivery_address || fo.full_address || fo.location || prev?.fullAddress
                    }));
                }
            } catch (err) {
                console.debug("Failed to lazily load order receipt items", err);
            } finally {
                setIsReceiptLoading(false);
            }
        }
    }, []);

    React.useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    // 🎯 AUTO-OPEN RECEIPT AFTER CHECKOUT
    React.useEffect(() => {
        if (params.showReceiptId && orders.length > 0 && !selectedOrder) {
            const targetId = String(params.showReceiptId);
            const found = orders.find(o =>
                (o.backendOrderId && String(o.backendOrderId) === targetId) ||
                (o.id && String(o.id) === targetId)
            );
            if (found) {
                // Short delay to let the screen render properly
                setTimeout(() => openReceipt(found), 500);
            }
        }
    }, [params.showReceiptId, orders.length, selectedOrder]);

    const filterBySearch = (list: any[]) => {
        if (!searchQuery) return list;
        return list.filter(order =>
            order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.orderId.toLowerCase().includes(searchQuery.toLowerCase())
        );
    };

    const activeOrders = filterBySearch(orders.filter(o => o.status === 'In Progress'));
    const completedOrders = filterBySearch(orders.filter(o => o.status === 'Delivered'));
    const cancelledOrders = filterBySearch(orders.filter(o => o.status === 'Cancelled'));
    const currentDisplayOrders = activeTab === 'Active' ? activeOrders : activeTab === 'Completed' ? completedOrders : cancelledOrders;
    const hasAnyOrder = currentDisplayOrders.length > 0;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} translucent />
            <Header
                title="My Order"
                onBack={() => router.back()}
                insets={insets}
                isSearchActive={isSearchActive}
                setIsSearchActive={setIsSearchActive}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                colors={colors}
            />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={loadOrders} colors={[colors.primary]} />
                }
            >
                <Tabs
                    activeTab={activeTab}
                    onTabPress={setActiveTab}
                    colors={colors}
                />
                {!hasAnyOrder ? (
                    <View style={styles.section}>
                        <EmptyState
                            title={searchQuery ? "No Results" : "Welcome!"}
                            message={searchQuery ? `No orders found matching "${searchQuery}"` :
                                activeTab === 'Active' ? "You don't have any active orders. Hungry? Order something delicious!" :
                                    activeTab === 'Completed' ? "You haven't completed any orders yet." :
                                        "You haven't cancelled any orders yet."}
                            colors={colors}
                        />
                    </View>
                ) : (
                    <View style={styles.section}>
                        {activeTab === 'Completed' && <Text style={[styles.sectionTitle, { color: colors.heading }]}>Order History</Text>}
                        <View style={styles.list}>
                            {currentDisplayOrders.map((order) => (
                                activeTab === 'Active' ? (
                                    <ActiveOrderCard
                                        key={order.id}
                                        order={order}
                                        colors={colors}
                                        openReceipt={openReceipt}
                                        onTrack={(o: any) => {
                                            router.push({
                                                pathname: '/track-order',
                                                params: {
                                                    backendOrderId: o.backendOrderId ? String(o.backendOrderId) : '',
                                                    orderId: o.orderId || '',
                                                    totalPrice: o.totalPrice || '',
                                                },
                                            } as any);
                                        }}
                                    />
                                ) : (
                                    <RecentOrderCard key={order.id} order={order} colors={colors} openReceipt={openReceipt} />
                                )
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
            <ReceiptModal
                visible={isReceiptVisible}
                onClose={() => setIsReceiptVisible(false)}
                order={selectedOrder}
                isLoading={isReceiptLoading}
                colors={colors}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        zIndex: 10,
    },
    headerLeft: {
        flex: 1,
        alignItems: 'flex-start',
    },
    headerCenter: {
        flex: 3,
        alignItems: 'center',
    },
    headerRightArea: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    headerBackBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: Typography.h1,
        letterSpacing: -0.2,
        textAlign: 'center',
    },
    headerActionBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        width: '100%',
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        fontFamily: Typography.body,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    tabsWrapper: {
        flexDirection: 'row',
        gap: 12,
        marginVertical: 20,
    },
    tabBtn: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabBtnActive: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    tabBtnInactive: {
        // backgroundColor handled inline
    },
    tabText: {
        fontSize: 15,
        fontFamily: Typography.button,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: Typography.h1,
        marginBottom: 16,
    },
    card: {
        borderRadius: 24,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 15,
        elevation: 2,
    },
    cardTop: {
        flexDirection: 'row',
        gap: 15,
    },
    cardImage: {
        width: 70,
        height: 70,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
    },
    cardInfo: {
        flex: 1,
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    productName: {
        fontSize: 17,
        fontFamily: Typography.h1,
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontFamily: Typography.button,
    },
    orderIdText: {
        fontSize: 12,
        fontFamily: Typography.body,
        marginTop: 4,
    },
    cardDetailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    itemCountText: {
        fontSize: 14,
        fontFamily: Typography.body,
    },
    priceValueText: {
        fontSize: 16,
        fontFamily: Typography.h1,
    },
    deliveryInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    deliveryLabel: {
        fontSize: 13,
        fontFamily: Typography.body,
    },
    deliveryTime: {
        fontSize: 13,
        fontFamily: Typography.button,
    },
    cardFooter: {
        flexDirection: 'row',
        gap: 10,
    },
    receiptBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    receiptBtnText: {
        fontSize: 14,
        fontFamily: Typography.button,
    },
    list: {
        gap: 0,
    },
    trackBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    trackBtnText: {
        fontSize: 14,
        fontFamily: Typography.button,
        color: '#FFFFFF',
    },
    secondaryActionBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buyAgainBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buyAgainBtnText: {
        fontSize: 14,
        fontFamily: Typography.button,
        color: '#FFFFFF',
    },
    deliveredBadge: {
        backgroundColor: '#E1F8ED',
    },
    deliveredBadgeText: {
        fontSize: 12,
        fontFamily: Typography.button,
        color: '#10B981',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: Typography.h1,
        marginBottom: 10,
    },
    emptySubtitle: {
        fontSize: 15,
        fontFamily: Typography.body,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    receiptContainer: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '90%',
    },
    receiptHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    receiptHeaderTitle: {
        fontSize: 20,
        fontFamily: Typography.h1,
    },
    closeModalBtn: {
        padding: 4,
    },
    receiptScroll: {
        paddingHorizontal: 24,
    },
    receiptTopInfo: {
        alignItems: 'center',
        marginBottom: 24,
    },
    checkCircle: {
        marginBottom: 12,
    },
    receiptMainTitle: {
        fontSize: 22,
        fontFamily: Typography.h1,
        marginBottom: 4,
    },
    receiptDate: {
        fontSize: 14,
        fontFamily: Typography.body,
    },
    deliveredNote: {
        fontSize: 13,
        fontFamily: Typography.body,
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 8,
        paddingHorizontal: 20,
    },
    idBox: {
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    idLabel: {
        fontSize: 13,
        fontFamily: Typography.body,
    },
    idValue: {
        fontSize: 15,
        fontFamily: Typography.h1,
    },
    receiptSection: {
        marginBottom: 24,
    },
    receiptSectionTitle: {
        fontSize: 15,
        fontFamily: Typography.h1,
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    receiptItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    receiptItemQty: {
        fontSize: 14,
        fontFamily: Typography.button,
        width: 30,
    },
    receiptItemName: {
        fontSize: 14,
        fontFamily: Typography.body,
        flex: 1,
        marginRight: 10,
    },
    receiptItemPrice: {
        fontSize: 14,
        fontFamily: Typography.h1,
    },
    dashedLine: {
        borderBottomWidth: 1,
        borderStyle: 'dashed',
        marginBottom: 24,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    summaryLabel: {
        fontSize: 14,
        fontFamily: Typography.body,
    },
    summaryValue: {
        fontSize: 14,
        fontFamily: Typography.h1,
    },
    grandTotalLabel: {
        fontSize: 18,
        fontFamily: Typography.h1,
    },
    grandTotalValue: {
        fontSize: 22,
        fontFamily: Typography.brand,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    infoIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        fontFamily: Typography.body,
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 14,
        fontFamily: Typography.h1,
        lineHeight: 20,
    },
    modalFooter: {
        paddingHorizontal: 24,
        marginTop: 10,
    },
    doneBtn: {
        height: 54,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    doneBtnText: {
        fontSize: 16,
        fontFamily: Typography.button,
        color: '#FFFFFF',
    },
    receiptLoadingContainer: {
        padding: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        fontFamily: Typography.body,
    },
});
