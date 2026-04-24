import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    Dimensions,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Modal,
    RefreshControl,
    StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUiStore, setOrders, type Order, type OrderItem } from '../lib/ui_store';
import { fetchMyOrders } from '../lib/order_api';

const { width } = Dimensions.get('window');
const PRIMARY_ORANGE = '#FF5800'; // Vibrant Orange theme
const BG_COLOR = '#F9FBFA'; // Soft, modern background

// --- Reusable Components ---

const Header = ({ title, onBack, insets, isSearchActive, setIsSearchActive, searchQuery, setSearchQuery }: any) => {
    const topPadding = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) + 12 : insets.top + 6;
    
    return (
        <View style={[styles.header, { paddingTop: topPadding }]}>
            <View style={styles.headerLeft}>
                <TouchableOpacity style={styles.headerBackBtn} onPress={onBack} activeOpacity={0.7}>
                    <Feather name="chevron-left" size={26} color={PRIMARY_ORANGE} />
                </TouchableOpacity>
            </View>
            
            <View style={styles.headerCenter}>
                {isSearchActive ? (
                    <View style={styles.searchInputWrapper}>
                        <Feather name="search" size={18} color="#9CA3AF" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search orders..."
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                    </View>
                ) : (
                    <Text style={styles.headerTitle}>{title}</Text>
                )}
            </View>
            
            <View style={styles.headerRightArea}>
                <TouchableOpacity 
                    style={styles.headerActionBtn} 
                    activeOpacity={0.7}
                    onPress={() => {
                        setIsSearchActive(!isSearchActive);
                        if (isSearchActive) setSearchQuery('');
                    }}
                >
                    <Feather name={isSearchActive ? "x" : "search"} size={22} color="#4B5563" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const Tabs = ({ activeTab, onTabPress }: any) => {
    const tabs = ['Active', 'Completed', 'Cancelled'];
    return (
        <View style={styles.tabsWrapper}>
            {tabs.map((tab) => (
                <TouchableOpacity
                    key={tab}
                    onPress={() => onTabPress(tab)}
                    style={[
                        styles.tabBtn,
                        activeTab === tab ? { backgroundColor: PRIMARY_ORANGE } : { backgroundColor: '#FFFFFF', borderColor: '#F3F4F6', borderWidth: 1 },
                        activeTab === tab ? styles.tabBtnActive : styles.tabBtnInactive,
                    ]}
                    activeOpacity={0.8}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === tab ? { color: '#FFFFFF' } : { color: '#6B7280' },
                        ]}
                    >
                        {tab}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const ActiveOrderCard = ({ order, theme, openReceipt, onTrack }: any) => (
    <View style={styles.card}>
        <View style={styles.cardTop}>
            <Image
                source={order.image || require('../assets/images/sushi-hero.png')}
                style={styles.cardImage}
                contentFit="cover"
            />
            <View style={styles.cardInfo}>
                <View style={styles.cardRow}>
                    <Text style={styles.productName}>{order.title}</Text>
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{order.status}</Text>
                    </View>
                </View>
                <Text style={styles.orderIdText}>Order #{order.orderId}</Text>
            </View>
        </View>

        <View style={styles.cardDetailsRow}>
            <Text style={styles.itemCountText}>{order.items} items</Text>
            <Text style={styles.priceValueText}>{displayMoney(order.totalPrice || order.price)}</Text>
        </View>

        <View style={styles.deliveryInfoRow}>
            <Text style={styles.deliveryLabel}>Estimated delivery</Text>
            <Text style={styles.deliveryTime}>{order.deliveryTime || order.delivery}</Text>
        </View>

        <View style={styles.cardFooter}>
            <TouchableOpacity 
                style={styles.receiptBtn} 
                activeOpacity={0.7}
                onPress={() => openReceipt(order)}
            >
                <Text style={styles.receiptBtnText}>View Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.trackBtn, { backgroundColor: PRIMARY_ORANGE, shadowColor: PRIMARY_ORANGE }]}
                activeOpacity={0.8}
                onPress={() => onTrack && onTrack(order)}
            >
                <Text style={styles.trackBtnText}>Track Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionBtn} activeOpacity={0.7}>
                <Feather name="phone" size={20} color="#374151" />
            </TouchableOpacity>
        </View>
    </View>
);

const RecentOrderCard = ({ order, theme, openReceipt }: any) => (
    <View style={styles.card}>
        <View style={styles.cardTop}>
            <Image
                source={order.image || require('../assets/images/sushi-hero.png')}
                style={styles.cardImage}
                contentFit="cover"
            />
            <View style={styles.cardInfo}>
                <View style={styles.cardRow}>
                    <Text style={styles.productName}>{order.title}</Text>
                    <View style={[styles.statusBadge, styles.deliveredBadge]}>
                        <Text style={styles.deliveredBadgeText}>Delivered</Text>
                    </View>
                </View>
                <Text style={styles.orderIdText}>{order.date} • Order #{order.orderId}</Text>
            </View>
        </View>

        <View style={styles.cardDetailsRow}>
            <Text style={styles.itemCountText}>{order.items} items</Text>
            <Text style={styles.priceValueText}>{displayMoney(order.totalPrice)}</Text>
        </View>

        <View style={styles.deliveryInfoRow}>
            <Text style={styles.deliveryLabel}>Already delivered</Text>
            <Text style={styles.deliveryTime}>{order.deliveryTime}</Text>
        </View>

        <View style={styles.cardFooter}>
            <TouchableOpacity 
                style={styles.receiptBtn} 
                activeOpacity={0.7}
                onPress={() => openReceipt(order)}
            >
                <Text style={styles.receiptBtnText}>Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buyAgainBtn} activeOpacity={0.8}>
                <Text style={styles.buyAgainBtnText}>Buy Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionBtn} activeOpacity={0.7}>
                <MaterialCommunityIcons name="history" size={24} color="#374151" />
            </TouchableOpacity>
        </View>
    </View>
);

const EmptyState = ({ title, message }: any) => (
    <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
            <Feather name="package" size={48} color="#D1D5DB" />
        </View>
        <Text style={styles.emptyTitle}>{title || "Welcome!"}</Text>
        <Text style={styles.emptySubtitle}>{message || "You don't have any orders here yet. Your culinary journey starts with your first order!"}</Text>
    </View>
);

const ReceiptModal = ({ visible, onClose, order }: any) => {
    if (!order) return null;
    
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.receiptContainer}>
                    <View style={styles.receiptHeader}>
                        <Text style={styles.receiptHeaderTitle}>Order Receipt</Text>
                        <TouchableOpacity style={styles.closeModalBtn} onPress={onClose}>
                            <Feather name="x" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.receiptScroll}>
                        {/* Status Icon (Smaller) */}
                        <View style={styles.receiptTopInfo}>
                            <View style={styles.checkCircle}>
                                <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                            </View>
                            <Text style={styles.receiptMainTitle}>Order Successful</Text>
                            <Text style={styles.receiptDate}>{order.date} • {order.deliveryTime}</Text>
                        </View>

                        {/* Order ID (Compact) */}
                        <View style={styles.idBox}>
                            <Text style={styles.idLabel}>Order ID</Text>
                            <Text style={styles.idValue}>Order #{order.orderId}</Text>
                        </View>

                        {/* Items List (Tighter) */}
                        <View style={styles.receiptSection}>
                            <Text style={styles.receiptSectionTitle}>Order Details</Text>
                            {order.itemsList?.length ? (
                                order.itemsList.map((item: any, index: number) => (
                                    <View key={index} style={styles.receiptItemRow}>
                                        <Text style={styles.receiptItemQty}>{item.quantity}x</Text>
                                        <Text style={styles.receiptItemName}>{item.title}</Text>
                                    <Text style={styles.receiptItemPrice}>{displayMoney(item.price)}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.summaryLabel}>No item details available for this order yet.</Text>
                            )}
                        </View>

                        {/* Dash Separator */}
                        <View style={styles.dashedLine} />

                        {/* Summary (Full Details - Condensed) */}
                        <View style={styles.receiptSection}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Subtotal</Text>
                                <Text style={styles.summaryValue}>{displayMoney(order.subtotal)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                                <Text style={styles.summaryValue}>{displayMoney(order.deliveryFee)}</Text>
                            </View>
                            <View style={[styles.summaryRow, { marginTop: 6 }]}>
                                <Text style={styles.grandTotalLabel}>Total Amount</Text>
                                <Text style={styles.grandTotalValue}>{displayMoney(order.totalPrice)}</Text>
                            </View>
                        </View>

                        {/* Payment & Delivery (Full Details - Condensed) */}
                        <View style={styles.receiptSection}>
                            <Text style={styles.receiptSectionTitle}>Payment & Delivery</Text>
                            
                            <View style={styles.infoRow}>
                                <View style={styles.infoIconBox}>
                                    <Feather name="credit-card" size={14} color="#4B5563" />
                                </View>
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>Payment Method</Text>
                                    <Text style={styles.infoValue}>{order.paymentMethod}</Text>
                                </View>
                            </View>

                            <View style={[styles.infoRow, { marginTop: 10 }]}>
                                <View style={styles.infoIconBox}>
                                    <Feather name="map-pin" size={14} color="#4B5563" />
                                </View>
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>Delivery Address</Text>
                                    <Text style={styles.infoValue} numberOfLines={2}>{order.fullAddress}</Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                            <Text style={styles.doneBtnText}>Close Receipt</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// --- Dummy Data (For Live Verification) ---

const DUMMY_ORDER_DATA = {
    id: 'sample-2025',
    orderId: 'ORD-SAMPLE-2025',
    title: 'Fresh Vegetable Sushi + 1 more',
    items: 2,
    subtotal: '₱450.00',
    deliveryFee: '₱38.00',
    totalPrice: '₱488.00',
    status: 'In Progress',
    date: 'Apr 06, 2026',
    deliveryTime: 'Today, 4:30 PM',
    paymentMethod: 'Cash on Delivery',
    fullAddress: '123 Sample Avenue, Ayala Center, Makati City',
    itemsList: [
        { title: 'Fresh Vegetable Sushi', quantity: 1, price: '₱250.00' },
        { title: 'Salmon Maki', quantity: 1, price: '₱200.00' },
    ],
    image: require('../assets/images/sushi-hero.png'),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DUMMY_RECENT: any[] = [
    {
        ...DUMMY_ORDER_DATA,
        id: 'sample-001',
        orderId: 'ORD-8923-J',
        title: 'Fresh Vegetable Sushi + 1 more',
        date: 'Apr 06, 2026',
        items: 2,
        status: 'Delivered',
        image: require('../assets/images/sushi-hero.png'),
    },
    {
        ...DUMMY_ORDER_DATA,
        id: 'sample-002',
        orderId: 'ORD-1254-K',
        title: 'Salmon Nigiri Selection',
        date: 'Apr 04, 2026',
        items: 1,
        totalPrice: '₱350.00',
        subtotal: '₱312.00',
        deliveryFee: '₱38.00',
        paymentMethod: 'GCash',
        status: 'Delivered',
        image: require('../assets/images/sushi-hero.png'),
        itemsList: [{ title: 'Salmon Nigiri Selection', quantity: 1, price: '₱312.00' }],
    },
    {
        ...DUMMY_ORDER_DATA,
        id: 'sample-003',
        orderId: 'ORD-5542-M',
        title: 'Dragon Roll Extra Spicy',
        date: 'Mar 30, 2026',
        items: 1,
        totalPrice: '₱420.00',
        subtotal: '₱382.00',
        deliveryFee: '₱38.00',
        paymentMethod: 'Maya',
        status: 'Delivered',
        image: require('../assets/images/sushi-hero.png'),
        itemsList: [{ title: 'Dragon Roll Extra Spicy', quantity: 1, price: '₱382.00' }],
    }
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DUMMY_ACTIVE = null;

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
        const unitPrice = toNumber(raw?.price ?? raw?.unit_price ?? raw?.pivot?.price, 0);
        const lineTotal = toNumber(raw?.total ?? raw?.line_total, unitPrice * quantity);
        return {
            title: raw?.name || raw?.title || raw?.product_name || 'Product',
            quantity,
            price: toPeso(lineTotal),
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
    const insets = useSafeAreaInsets();
    const { orders, addresses, activeAddressId } = useUiStore();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    
    const [activeTab, setActiveTab] = useState('Active');
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [isReceiptVisible, setIsReceiptVisible] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const activeAddress = addresses.find((a) => a.id === activeAddressId) || addresses[0];
    const fallbackAddress = activeAddress?.fullAddress || 'No delivery address selected';

    const loadOrders = async () => {
        setIsRefreshing(true);
        try {
            const backendOrders = await fetchMyOrders();
            
            // Map backend structure to local UI structure
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _mappedOrdersLegacy: Order[] = backendOrders.map(bo => ({
                id: String(bo.order_id),
                orderId: `ORD-${bo.order_id}`,
                backendOrderId: bo.order_id,
                items: bo.items?.length || 0,
                totalPrice: `₱${parseFloat(String(bo.total_amount || 0)).toFixed(2)}`,
                subtotal: `₱${parseFloat(String(bo.total_amount || 0)).toFixed(2)}`, // Simplified
                deliveryFee: '₱38.00',
                title: bo.items?.[0]?.name || 'MakiCaps Order',
                status: bo.status === 'delivered' ? 'Delivered' : 
                        bo.status === 'cancelled' ? 'Cancelled' : 'In Progress',
                date: bo.created_at ? new Date(bo.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'N/A',
                deliveryTime: 'Today, 4:30 PM', // Fallback or mocked
                paymentMethod: 'Paid Online', // Default for fetched orders
                fullAddress: 'Stored Address',
                itemsList: (bo.items || []).map((i: any) => ({
                    title: i.name || 'Product',
                    quantity: i.quantity || 1,
                    price: `₱${parseFloat(String(i.price || 0)).toFixed(2)}`
                })),
                image: require('../assets/images/sushi-hero.png'),
            }));

            const mappedOrdersNormalized: Order[] = backendOrders.map((bo: any) => {
                const rawItems = extractRawOrderItems(bo);
                const { itemsList, itemCount, computedSubtotal } = normalizeItemsList(rawItems);

                const backendOrderId = toNumber(bo.order_id ?? bo.id, 0);
                const localMatch = orders.find((o) =>
                    (o.backendOrderId && backendOrderId && o.backendOrderId === backendOrderId) ||
                    o.orderId === `ORD-${backendOrderId}`
                );

                const localDeliveryFee = localMatch ? Number(String(localMatch.deliveryFee).replace(/[^\d.]/g, '')) : 38;
                const localTotal = localMatch ? Number(String(localMatch.totalPrice).replace(/[^\d.]/g, '')) : 0;

                const deliveryFeeNum = toNumber(bo.delivery_fee ?? bo.shipping_fee, localDeliveryFee || 38);
                const totalAmountNum = toNumber(bo.total_amount ?? bo.total ?? bo.grand_total, localTotal || (computedSubtotal + deliveryFeeNum));
                const subtotalNum = toNumber(bo.subtotal ?? bo.items_total, computedSubtotal || Math.max(0, totalAmountNum - deliveryFeeNum));

                const normalizedItemsList = itemsList.length > 0 ? itemsList : (localMatch?.itemsList || []);
                const normalizedItemCount = itemCount > 0
                    ? itemCount
                    : (localMatch?.items || normalizedItemsList.reduce((sum, i) => sum + toNumber(i.quantity, 0), 0));
                const firstTitle = normalizedItemsList[0]?.title || bo.title || localMatch?.title || 'MakiCaps Order';

                return {
                    id: localMatch?.id || String(backendOrderId),
                    orderId: localMatch?.orderId || `ORD-${backendOrderId}`,
                    backendOrderId: backendOrderId || localMatch?.backendOrderId,
                    items: normalizedItemCount,
                    totalPrice: toPeso(totalAmountNum),
                    subtotal: toPeso(subtotalNum),
                    deliveryFee: toPeso(deliveryFeeNum),
                    title: normalizedItemCount > 1 ? `${firstTitle} + ${normalizedItemCount - 1} more` : firstTitle,
                    status: bo.status === 'delivered' ? 'Delivered' :
                        bo.status === 'cancelled' ? 'Cancelled' : 'In Progress',
                    date: bo.created_at
                        ? new Date(bo.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                        : (localMatch?.date || 'N/A'),
                    deliveryTime: localMatch?.deliveryTime || 'Today, 4:30 PM',
                    paymentMethod: normalizePaymentMethod(bo.payment_method || localMatch?.paymentMethod),
                    fullAddress: bo.address || bo.delivery_address || localMatch?.fullAddress || fallbackAddress,
                    itemsList: normalizedItemsList,
                    image: localMatch?.image || require('../assets/images/sushi-hero.png'),
                };
            });

            if (mappedOrdersNormalized.length > 0) {
                setOrders(mappedOrdersNormalized);
            }
        } catch (e) {
            console.error('Refresh orders failed', e);
        } finally {
            setIsRefreshing(false);
        }
    };

    React.useEffect(() => {
        loadOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openReceipt = (order: any) => {
        setSelectedOrder(order);
        setIsReceiptVisible(true);
    };

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

    const currentDisplayOrders = activeTab === 'Active' ? activeOrders :
                                 activeTab === 'Completed' ? completedOrders :
                                 cancelledOrders;

    const hasAnyOrder = currentDisplayOrders.length > 0;

    return (
        <View style={styles.container}>
            <StatusBar style="dark" translucent />
            
            <Header 
                title="My Order" 
                onBack={() => router.back()} 
                insets={insets}
                isSearchActive={isSearchActive}
                setIsSearchActive={setIsSearchActive}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
            />

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={loadOrders} colors={[PRIMARY_ORANGE]} />
                }
            >
                <Tabs 
                    activeTab={activeTab} 
                    onTabPress={setActiveTab} 
                />

                {!hasAnyOrder ? (
                    <View style={styles.section}>
                        <EmptyState 
                            title={searchQuery ? "No Results" : "Welcome!"}
                            message={searchQuery ? `No orders found matching "${searchQuery}"` : 
                                     activeTab === 'Active' ? "You don't have any active orders. Hungry? Order something delicious!" :
                                     activeTab === 'Completed' ? "You haven't completed any orders yet." :
                                     "You haven't cancelled any orders yet."} 
                        />
                    </View>
                ) : (
                    <View style={styles.section}>
                        {activeTab === 'Completed' && <Text style={styles.sectionTitle}>Order History</Text>}
                        <View style={styles.list}>
                            {currentDisplayOrders.map((order) => (
                                activeTab === 'Active' ? (
                                    <ActiveOrderCard
                                        key={order.id}
                                        order={order}
                                        theme={theme}
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
                                    <RecentOrderCard key={order.id} order={order} theme={theme} openReceipt={openReceipt} />
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
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG_COLOR,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        backgroundColor: BG_COLOR,
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
        backgroundColor: '#FFFFFF',
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
        fontFamily: 'Outfit-Bold',
        letterSpacing: -0.2,
        color: '#111827',
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
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        width: '100%',
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        fontFamily: 'Outfit-Regular',
        color: '#111827',
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
        shadowColor: PRIMARY_ORANGE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    tabBtnInactive: {
        backgroundColor: '#FFFFFF',
    },
    tabText: {
        fontSize: 15,
        fontFamily: 'Outfit-Bold',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Outfit-Bold',
        color: '#111827',
        marginBottom: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
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
        fontFamily: 'Outfit-Bold',
        color: '#111827',
        flex: 1,
    },
    statusBadge: {
        backgroundColor: '#FFF7ED',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontFamily: 'Outfit-Bold',
        color: '#F97316',
    },
    orderIdText: {
        fontSize: 13,
        fontFamily: 'Outfit-Regular',
        color: '#6B7280',
        marginTop: 4,
    },
    cardDetailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 15,
    },
    itemCountText: {
        fontSize: 15,
        fontFamily: 'Outfit-Regular',
        color: '#374151',
    },
    priceValueText: {
        fontSize: 16,
        fontFamily: 'Outfit-Bold',
        color: '#111827',
    },
    deliveryInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
    },
    deliveryLabel: {
        fontSize: 14,
        fontFamily: 'Outfit-Regular',
        color: '#6B7280',
    },
    deliveryTime: {
        fontSize: 14,
        fontFamily: 'Outfit-Bold',
        color: '#374151',
    },
    cardFooter: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    receiptBtn: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#FED7AA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    receiptBtnText: {
        color: '#EA580C',
        fontSize: 14,
        fontFamily: 'Outfit-Bold',
    },
    trackBtn: {
        flex: 1.2,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    trackBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: 'Outfit-Bold',
    },
    buyAgainBtn: {
        flex: 1.2,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buyAgainBtnText: {
        color: PRIMARY_ORANGE,
        fontSize: 16,
        fontFamily: 'Outfit-Bold',
    },
    secondaryActionBtn: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        gap: 4,
    },
    deliveredBadge: {
        backgroundColor: '#F0FDF4',
    },
    deliveredBadgeText: {
        fontSize: 12,
        fontFamily: 'Outfit-Bold',
        color: '#10B981',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: 'Outfit-Bold',
        color: '#111827',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 15,
        fontFamily: 'Outfit-Regular',
        color: '#6B7280',
        textAlign: 'center',
        paddingHorizontal: 40,
        lineHeight: 22,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    receiptContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        width: width * 0.9,
        maxWidth: 400,
        maxHeight: '80%',
        paddingBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 20,
    },
    receiptHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        position: 'relative',
    },
    receiptHeaderTitle: {
        fontSize: 15,
        fontFamily: 'Outfit-Bold',
        color: '#111827',
    },
    closeModalBtn: {
        position: 'absolute',
        right: 15,
        padding: 5,
    },
    receiptScroll: {
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 15,
    },
    receiptTopInfo: {
        alignItems: 'center',
        marginBottom: 15,
    },
    checkCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    receiptMainTitle: {
        fontSize: 18,
        fontFamily: 'Outfit-Bold',
        color: '#111827',
    },
    receiptDate: {
        fontSize: 13,
        fontFamily: 'Outfit-Regular',
        color: '#6B7280',
        marginTop: 2,
    },
    idBox: {
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    idLabel: {
        fontSize: 13,
        fontFamily: 'Outfit-Regular',
        color: '#6B7280',
    },
    idValue: {
        fontSize: 14,
        fontFamily: 'Outfit-Bold',
        color: '#111827',
    },
    receiptSection: {
        marginBottom: 15,
    },
    receiptSectionTitle: {
        fontSize: 14,
        fontFamily: 'Outfit-Bold',
        color: '#111827',
        marginBottom: 10,
    },
    receiptItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    receiptItemQty: {
        fontSize: 13,
        fontFamily: 'Outfit-Bold',
        color: '#FF5800',
        width: 25,
    },
    receiptItemName: {
        fontSize: 14,
        fontFamily: 'Outfit-Regular',
        color: '#374151',
        flex: 1,
    },
    receiptItemPrice: {
        fontSize: 14,
        fontFamily: 'Outfit-Bold',
        color: '#374151',
    },
    dashedLine: {
        height: 1,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        marginBottom: 15,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    summaryLabel: {
        fontSize: 14,
        fontFamily: 'Outfit-Regular',
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 14,
        fontFamily: 'Outfit-Bold',
        color: '#374151',
    },
    grandTotalLabel: {
        fontSize: 16,
        fontFamily: 'Outfit-Bold',
        color: '#111827',
    },
    grandTotalValue: {
        fontSize: 18,
        fontFamily: 'Outfit-Bold',
        color: '#FF5800',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    infoIconBox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 11,
        fontFamily: 'Outfit-Regular',
        color: '#9CA3AF',
        textTransform: 'uppercase',
    },
    infoValue: {
        fontSize: 15,
        fontFamily: 'Outfit-Bold',
        color: '#111827',
        marginTop: 2,
    },
    modalFooter: {
        paddingHorizontal: 20,
        paddingBottom: 15,
        paddingTop: 5,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    doneBtn: {
        backgroundColor: PRIMARY_ORANGE,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: PRIMARY_ORANGE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    doneBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: 'Outfit-Bold',
    },
});
