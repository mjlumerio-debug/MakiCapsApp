import { Colors, Typography } from '@/constants/theme';
import { useAppTheme } from '@/state/contexts/ThemeContext';
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
    NativeModules
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUiStore, setOrders, type Order, type OrderItem } from '../lib/ui_store';
import { fetchMyOrders } from '../lib/order_api';

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

const ActiveOrderCard = ({ order, colors, openReceipt, onTrack }: any) => (
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
                        <Text style={[styles.statusText, { color: colors.primary }]}>{order.status}</Text>
                    </View>
                </View>
                <Text style={[styles.orderIdText, { color: colors.text }]}>Order #{order.orderId}</Text>
            </View>
        </View>

        <View style={styles.cardDetailsRow}>
            <Text style={[styles.itemCountText, { color: colors.text }]}>{order.items} items</Text>
            <Text style={[styles.priceValueText, { color: colors.heading }]}>{displayMoney(order.totalPrice || order.price)}</Text>
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

const RecentOrderCard = ({ order, colors, openReceipt }: any) => (
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
                    <View style={[styles.statusBadge, styles.deliveredBadge, { backgroundColor: '#E1F8ED' }]}>
                        <Text style={[styles.deliveredBadgeText, { color: '#10B981' }]}>Delivered</Text>
                    </View>
                </View>
                <Text style={[styles.orderIdText, { color: colors.text }]}>{order.date} • Order #{order.orderId}</Text>
            </View>
        </View>

        <View style={styles.cardDetailsRow}>
            <Text style={[styles.itemCountText, { color: colors.text }]}>{order.items} items</Text>
            <Text style={[styles.priceValueText, { color: colors.heading }]}>{displayMoney(order.totalPrice)}</Text>
        </View>

        <View style={styles.deliveryInfoRow}>
            <Text style={[styles.deliveryLabel, { color: colors.text }]}>Already delivered</Text>
            <Text style={[styles.deliveryTime, { color: colors.heading }]}>{order.deliveryTime}</Text>
        </View>

        <View style={styles.cardFooter}>
            <TouchableOpacity 
                style={[styles.receiptBtn, { borderColor: colors.primary + '33' }]} 
                activeOpacity={0.7}
                onPress={() => openReceipt(order)}
            >
                <Text style={[styles.receiptBtnText, { color: colors.primary }]}>Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.buyAgainBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
                <Text style={styles.buyAgainBtnText}>Buy Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryActionBtn, { backgroundColor: colors.background }]} activeOpacity={0.7}>
                <MaterialCommunityIcons name="history" size={24} color={colors.heading} />
            </TouchableOpacity>
        </View>
    </View>
);

const EmptyState = ({ title, message, colors }: any) => (
    <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface }]}>
            <Feather name="package" size={48} color={colors.text + '40'} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.heading }]}>{title || "Welcome!"}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.text }]}>{message || "You don't have any orders here yet. Your culinary journey starts with your first order!"}</Text>
    </View>
);

const ReceiptModal = ({ visible, onClose, order, colors }: any) => {
    if (!order) return null;
    
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

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.receiptScroll}>
                        {/* Status Icon */}
                        <View style={styles.receiptTopInfo}>
                            <View style={styles.checkCircle}>
                                <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                            </View>
                            <Text style={[styles.receiptMainTitle, { color: colors.heading }]}>Order Successful</Text>
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
    const { colors, isDark } = useAppTheme();
    const { orders, addresses, activeAddressId } = useUiStore();
    
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
});
