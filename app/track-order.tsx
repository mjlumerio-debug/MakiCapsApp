import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Easing,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { fetchOrderStatus, type OrderStatusResponse } from '../lib/order_api';
import { useUiStore, updateOrderStatus } from '../lib/ui_store';

const { width, height } = Dimensions.get('window');
const PRIMARY_ORANGE = '#FF5800';

// ─── Status Pipeline ───────────────────────────────────────────
type OrderStep = 'pending' | 'preparing' | 'in_transit' | 'delivered';

const STEPS: { key: OrderStep; label: string; icon: string; iconLib: 'feather' | 'ionicons' | 'mci'; description: string }[] = [
    { key: 'pending', label: 'Pending', icon: 'clock', iconLib: 'feather', description: 'Your order has been received' },
    { key: 'preparing', label: 'Preparing', icon: 'restaurant-outline', iconLib: 'ionicons', description: 'The kitchen is preparing your food' },
    { key: 'in_transit', label: 'In Transit', icon: 'moped', iconLib: 'mci', description: 'Your order is on its way' },
    { key: 'delivered', label: 'Delivered', icon: 'check-circle', iconLib: 'feather', description: 'Your order has been delivered!' },
];

const STATUS_DISPLAY_MAP: Record<string, OrderStep> = {
    pending: 'pending',
    preparing: 'preparing',
    in_transit: 'in_transit',
    delivered: 'delivered',
};

function getStepIndex(status: string): number {
    const step = STATUS_DISPLAY_MAP[status] || 'pending';
    return STEPS.findIndex(s => s.key === step);
}

// ─── Step Icon Renderer ────────────────────────────────────────
function StepIcon({ step, isActive, isCompleted }: { step: typeof STEPS[0]; isActive: boolean; isCompleted: boolean }) {
    const color = isCompleted ? '#FFFFFF' : isActive ? '#FFFFFF' : '#D1D5DB';
    const size = 22;
    if (step.iconLib === 'ionicons') return <Ionicons name={step.icon as any} size={size} color={color} />;
    if (step.iconLib === 'mci') return <MaterialCommunityIcons name={step.icon as any} size={size} color={color} />;
    return <Feather name={step.icon as any} size={size} color={color} />;
}

// ─── Animated Pulse Dot ────────────────────────────────────────
function PulseDot() {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.6, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.6], outputRange: [0.6, 0] }) }]} />
    );
}

// ─── Success Celebration Overlay ───────────────────────────────
function DeliveredCelebration({ onDismiss }: { onDismiss: () => void }) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <Animated.View style={[styles.celebrationOverlay, { opacity: fadeAnim }]}>
            <Animated.View style={[styles.celebrationCard, { transform: [{ scale: scaleAnim }] }]}>
                <View style={styles.celebrationIconCircle}>
                    <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                </View>
                <Text style={styles.celebrationTitle}>Order Delivered! 🎉</Text>
                <Text style={styles.celebrationSubtitle}>Your order has been successfully delivered. Enjoy your meal!</Text>
                <TouchableOpacity style={styles.celebrationBtn} onPress={onDismiss} activeOpacity={0.8}>
                    <Text style={styles.celebrationBtnText}>Back to Home</Text>
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
}

// ═══════════════════════════════════════════════════════════════
// ─── MAIN SCREEN ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
export default function TrackOrderScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        backendOrderId?: string;
        orderId?: string;
        totalPrice?: string;
    }>();

    const backendOrderId = params.backendOrderId ? Number(params.backendOrderId) : null;
    const orderId = params.orderId || '—';
    const totalPrice = params.totalPrice || '₱0.00';

    const { orders } = useUiStore();

    // Find the local order record for extra details
    const localOrder = orders.find(o => o.orderId === orderId || o.backendOrderId === backendOrderId);

    const [currentStatus, setCurrentStatus] = useState<OrderStep>('pending');
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [showCelebration, setShowCelebration] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const headerFadeAnim = useRef(new Animated.Value(0)).current;

    // ── Entrance animation ──
    useEffect(() => {
        Animated.timing(headerFadeAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();
    }, []);

    // ── Animate progress bar ──
    const animateProgress = useCallback((stepIdx: number) => {
        const target = stepIdx / (STEPS.length - 1);
        Animated.timing(progressAnim, {
            toValue: target,
            duration: 600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
        }).start();
    }, []);

    // ── Fetch status from backend ──
    const fetchStatus = useCallback(async () => {
        if (!backendOrderId) {
            setIsLoading(false);
            return;
        }

        try {
            const data: OrderStatusResponse = await fetchOrderStatus(backendOrderId);
            const mappedStatus = STATUS_DISPLAY_MAP[data.status] || 'pending';
            const idx = getStepIndex(data.status);

            setCurrentStatus(mappedStatus);
            animateProgress(idx);
            setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
            setErrorMsg(null);

            // Update local order store
            if (localOrder) {
                const uiStatus = mappedStatus === 'delivered' ? 'Delivered' : 'In Progress';
                updateOrderStatus(localOrder.id, uiStatus);
            }

            // Show celebration on delivered
            if (mappedStatus === 'delivered') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setShowCelebration(true);
                // Stop polling
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
            }
        } catch (err: any) {
            console.error('[TrackOrder] fetchStatus error:', err);
            setErrorMsg('Unable to fetch status. Will retry...');
        } finally {
            setIsLoading(false);
        }
    }, [backendOrderId, localOrder]);

    // ── Start polling ──
    useEffect(() => {
        fetchStatus(); // Initial fetch

        if (backendOrderId && currentStatus !== 'delivered') {
            pollingRef.current = setInterval(fetchStatus, 8000);
        }

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [backendOrderId]);

    // Stop polling when delivered
    useEffect(() => {
        if (currentStatus === 'delivered' && pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, [currentStatus]);

    const currentStepIdx = getStepIndex(currentStatus);

    // Estimated delivery time
    const estimatedDelivery = localOrder?.deliveryTime || 'Calculating...';

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* ── Header ── */}
            <Animated.View style={[styles.header, { opacity: headerFadeAnim }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn} activeOpacity={0.7}>
                    <Feather name="chevron-left" size={24} color="#4B5563" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Track Your Order</Text>
                    <Text style={styles.headerSubtitle}>Order #{orderId}</Text>
                </View>
                <TouchableOpacity onPress={fetchStatus} style={styles.headerRefreshBtn} activeOpacity={0.7}>
                    <Feather name="refresh-cw" size={20} color={PRIMARY_ORANGE} />
                </TouchableOpacity>
            </Animated.View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* ── Status Summary Card ── */}
                <View style={styles.statusCard}>
                    <View style={styles.statusCardHeader}>
                        <View style={styles.statusIndicator}>
                            <View style={[styles.statusDot, { backgroundColor: currentStatus === 'delivered' ? '#10B981' : PRIMARY_ORANGE }]} />
                            {currentStatus !== 'delivered' && <PulseDot />}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.statusMainText}>
                                {currentStatus === 'pending' && '⏳ Order Received'}
                                {currentStatus === 'preparing' && '👨‍🍳 Being Prepared'}
                                {currentStatus === 'in_transit' && '🛵 On the Way'}
                                {currentStatus === 'delivered' && '✅ Delivered'}
                            </Text>
                            <Text style={styles.statusSubText}>
                                {STEPS[currentStepIdx]?.description}
                            </Text>
                        </View>
                    </View>

                    {/* Horizontal progress bar */}
                    <View style={styles.progressBarTrack}>
                        <Animated.View
                            style={[
                                styles.progressBarFill,
                                {
                                    width: progressAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%'],
                                    }),
                                    backgroundColor: currentStatus === 'delivered' ? '#10B981' : PRIMARY_ORANGE,
                                },
                            ]}
                        />
                    </View>

                    {/* Loading / Last Updated */}
                    <View style={styles.statusMetaRow}>
                        {isLoading ? (
                            <View style={styles.loadingRow}>
                                <ActivityIndicator size="small" color={PRIMARY_ORANGE} />
                                <Text style={styles.loadingText}>Fetching status...</Text>
                            </View>
                        ) : errorMsg ? (
                            <Text style={styles.errorText}>{errorMsg}</Text>
                        ) : (
                            <Text style={styles.lastUpdatedText}>Last updated: {lastUpdated}</Text>
                        )}
                    </View>
                </View>

                {/* ── Step Timeline ── */}
                <View style={styles.timelineContainer}>
                    <Text style={styles.sectionTitle}>Order Progress</Text>
                    {STEPS.map((step, idx) => {
                        const isCompleted = idx < currentStepIdx;
                        const isActive = idx === currentStepIdx;
                        const isUpcoming = idx > currentStepIdx;

                        return (
                            <View key={step.key} style={styles.timelineRow}>
                                {/* Connector line above */}
                                {idx > 0 && (
                                    <View style={styles.connectorContainer}>
                                        <View
                                            style={[
                                                styles.connectorLine,
                                                {
                                                    backgroundColor: isCompleted || isActive ? PRIMARY_ORANGE : '#E5E7EB',
                                                },
                                            ]}
                                        />
                                    </View>
                                )}

                                <View style={styles.timelineContent}>
                                    {/* Circle icon */}
                                    <View
                                        style={[
                                            styles.timelineCircle,
                                            isCompleted && styles.timelineCircleCompleted,
                                            isActive && styles.timelineCircleActive,
                                            isUpcoming && styles.timelineCircleUpcoming,
                                        ]}
                                    >
                                        {isCompleted ? (
                                            <Feather name="check" size={18} color="#FFFFFF" />
                                        ) : (
                                            <StepIcon step={step} isActive={isActive} isCompleted={isCompleted} />
                                        )}
                                        {isActive && <PulseDot />}
                                    </View>

                                    {/* Label & description */}
                                    <View style={styles.timelineLabelContainer}>
                                        <Text
                                            style={[
                                                styles.timelineLabel,
                                                isActive && styles.timelineLabelActive,
                                                isCompleted && styles.timelineLabelCompleted,
                                                isUpcoming && styles.timelineLabelUpcoming,
                                            ]}
                                        >
                                            {step.label}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.timelineDesc,
                                                isUpcoming && { color: '#C7C7CC' },
                                            ]}
                                        >
                                            {step.description}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* ── Estimated Delivery ── */}
                <View style={styles.infoCard}>
                    <View style={styles.infoIconCircle}>
                        <Feather name="clock" size={20} color={PRIMARY_ORANGE} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.infoLabel}>Estimated Delivery</Text>
                        <Text style={styles.infoValue}>{estimatedDelivery}</Text>
                    </View>
                </View>

                {/* ── Order Summary ── */}
                {localOrder && (
                    <View style={styles.summaryCard}>
                        <Text style={styles.sectionTitle}>Order Summary</Text>

                        {localOrder.itemsList?.map((item, idx) => (
                            <View key={idx} style={styles.summaryItemRow}>
                                <Text style={styles.summaryItemQty}>{item.quantity}×</Text>
                                <Text style={styles.summaryItemName}>{item.title}</Text>
                                <Text style={styles.summaryItemPrice}>{item.price}</Text>
                            </View>
                        ))}

                        <View style={styles.summaryDivider} />

                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Subtotal</Text>
                            <Text style={styles.summaryValue}>{localOrder.subtotal}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Delivery Fee</Text>
                            <Text style={styles.summaryValue}>{localOrder.deliveryFee}</Text>
                        </View>
                        <View style={[styles.summaryRow, { marginTop: 8 }]}>
                            <Text style={styles.summaryTotalLabel}>Total</Text>
                            <Text style={styles.summaryTotalValue}>{localOrder.totalPrice}</Text>
                        </View>

                        {/* Address & Payment */}
                        <View style={styles.summaryDivider} />
                        <View style={styles.detailRow}>
                            <Feather name="map-pin" size={14} color="#9CA3AF" />
                            <Text style={styles.detailText} numberOfLines={2}>{localOrder.fullAddress}</Text>
                        </View>
                        <View style={[styles.detailRow, { marginTop: 8 }]}>
                            <Feather name="credit-card" size={14} color="#9CA3AF" />
                            <Text style={styles.detailText}>{localOrder.paymentMethod}</Text>
                        </View>
                    </View>
                )}

                {/* ── Back to Home Button ── */}
                <TouchableOpacity
                    style={styles.homeBtn}
                    onPress={() => router.replace('/home_dashboard' as any)}
                    activeOpacity={0.8}
                >
                    <Feather name="home" size={18} color="#FFFFFF" />
                    <Text style={styles.homeBtnText}>Back to Home</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ── Delivered Celebration Overlay ── */}
            {showCelebration && (
                <DeliveredCelebration
                    onDismiss={() => {
                        setShowCelebration(false);
                        router.replace('/home_dashboard' as any);
                    }}
                />
            )}
        </SafeAreaView>
    );
}

// ═══════════════════════════════════════════════════════════════
// ─── STYLES ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F9FBFA',
    },

    // ── Header ──
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 12,
        paddingBottom: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerBackBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    headerRefreshBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Scroll ──
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },

    // ── Status Card ──
    statusCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 3,
        marginBottom: 20,
    },
    statusCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusIndicator: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    statusDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    pulseDot: {
        position: 'absolute',
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: PRIMARY_ORANGE,
    },
    statusMainText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 2,
    },
    statusSubText: {
        fontSize: 13,
        color: '#6B7280',
    },
    progressBarTrack: {
        height: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    statusMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    loadingText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    errorText: {
        fontSize: 12,
        color: '#EF4444',
    },
    lastUpdatedText: {
        fontSize: 12,
        color: '#9CA3AF',
    },

    // ── Timeline ──
    timelineContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 3,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 20,
    },
    timelineRow: {
        position: 'relative',
    },
    connectorContainer: {
        position: 'absolute',
        left: 23,
        top: -20,
        bottom: undefined,
        width: 2,
        height: 20,
    },
    connectorLine: {
        width: 2,
        height: '100%',
        borderRadius: 1,
    },
    timelineContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    timelineCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        overflow: 'visible',
    },
    timelineCircleCompleted: {
        backgroundColor: '#10B981',
    },
    timelineCircleActive: {
        backgroundColor: PRIMARY_ORANGE,
        shadowColor: PRIMARY_ORANGE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    timelineCircleUpcoming: {
        backgroundColor: '#F3F4F6',
    },
    timelineLabelContainer: {
        flex: 1,
    },
    timelineLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#6B7280',
        marginBottom: 2,
    },
    timelineLabelActive: {
        color: PRIMARY_ORANGE,
        fontWeight: '800',
    },
    timelineLabelCompleted: {
        color: '#10B981',
    },
    timelineLabelUpcoming: {
        color: '#D1D5DB',
    },
    timelineDesc: {
        fontSize: 12,
        color: '#9CA3AF',
    },

    // ── Info Card ──
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 20,
    },
    infoIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    infoLabel: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },

    // ── Order Summary Card ──
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 3,
        marginBottom: 24,
    },
    summaryItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    summaryItemQty: {
        fontSize: 13,
        fontWeight: '700',
        color: PRIMARY_ORANGE,
        width: 32,
    },
    summaryItemName: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
    },
    summaryItemPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 14,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    summaryLabel: {
        fontSize: 13,
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    summaryTotalLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    summaryTotalValue: {
        fontSize: 16,
        fontWeight: '800',
        color: PRIMARY_ORANGE,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    detailText: {
        flex: 1,
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
    },

    // ── Home Button ──
    homeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: PRIMARY_ORANGE,
        height: 56,
        borderRadius: 18,
        gap: 8,
        shadowColor: PRIMARY_ORANGE,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    homeBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // ── Celebration Overlay ──
    celebrationOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    celebrationCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        padding: 36,
        alignItems: 'center',
        width: width * 0.85,
        maxWidth: 380,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 20,
    },
    celebrationIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F0FDF4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    celebrationTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 8,
    },
    celebrationSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
    },
    celebrationBtn: {
        backgroundColor: '#10B981',
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    celebrationBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
