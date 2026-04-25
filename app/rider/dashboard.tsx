import { fetchRiderOrders, fetchRiderStats, useRiderStore } from '@/lib/rider_store';
import { logoutUser, setRiderStatus, useUiStore } from '@/lib/ui_store';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Colors, Typography } from '@/constants/theme';
import {
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// 🛡️ Safety Formatter to prevent "toFixed of undefined" crashes
const formatNumber = (value: any, precision = 2) => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return (0).toFixed(precision);
  }
  return Number(value).toFixed(precision);
};

export default function RiderDashboard() {
  const { colors, isDark } = useAppTheme();
  const { riderStatus, userId, user } = useUiStore();
  const { activeOrders, stats, isRefreshing, pendingOrder } = useRiderStore();
  const router = useRouter();
  const [isStatusLoading, setIsStatusLoading] = useState(false);

  const isOnline = riderStatus === 'available' || riderStatus === 'busy';

  // Animation for "Online" pulse
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (isOnline) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = 1;
    }
  }, [isOnline]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: isOnline ? 1 : 0.5,
  }));

  // Polling for new orders when online
  useEffect(() => {
    let interval: any;
    if (isOnline) {
      // Initial fetch
      fetchRiderOrders();
      fetchRiderStats();
      
      // Setup interval
      interval = setInterval(() => {
        fetchRiderOrders();
      }, 10000); // Check every 10 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnline]);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchRiderOrders();
    fetchRiderStats();
  }, []);

  const handleToggleStatus = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const nextStatus = isOnline ? 'offline' : 'available';
    setRiderStatus(nextStatus);
  };

  const handleAcceptOrder = async () => {
    if (!pendingOrder) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const success = await import('@/lib/rider_store').then(m => m.acceptOrder(pendingOrder.id));
    if (success) {
      setRiderStatus('busy');
      Alert.alert("Success", "Order accepted! Navigate to pickup.");
    }
  };

  const handleRejectOrder = async () => {
    if (!pendingOrder) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await import('@/lib/rider_store').then(m => m.rejectOrder(pendingOrder.id));
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to go offline and logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await logoutUser();
            router.replace('/login');
          }
        }
      ]
    );
  };

  const renderStatCard = (label: string, value: string, icon: any, color: string) => (
    <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
      <View style={[styles.statIconCircle, { backgroundColor: color + '20' }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.heading }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.text }]}>{label}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        {/* New Order Assignment Modal */}
        {pendingOrder && (
          <View style={styles.modalOverlay}>
            <Animated.View entering={FadeInUp} style={[styles.assignmentModal, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <View style={styles.alertCircle}>
                  <MaterialCommunityIcons name="bell-ring" size={32} color="#FFF" />
                </View>
                <Text style={[styles.modalTitle, { color: colors.heading }]}>New Delivery Assigned!</Text>
                <Text style={[styles.modalSubtitle, { color: colors.text }]}>You have a new delivery request</Text>
              </View>

              <View style={styles.modalDetails}>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.text }]}>Payout</Text>
                  <Text style={[styles.detailValue, { color: colors.primary, fontSize: 24 }]}>₱{formatNumber(pendingOrder.payout)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.text }]}>Distance</Text>
                  <Text style={[styles.detailValue, { color: colors.heading }]}>{formatNumber(pendingOrder.distanceKm, 1)} km</Text>
                </View>
              </View>

              <View style={styles.addressBox}>
                <View style={styles.addressRow}>
                  <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={[styles.addressText, { color: colors.heading }]} numberOfLines={1}>{pendingOrder.pickupAddress}</Text>
                </View>
                <View style={[styles.addressRow, { marginTop: 10 }]}>
                  <View style={[styles.dot, { backgroundColor: '#F44336' }]} />
                  <Text style={[styles.addressText, { color: colors.heading }]} numberOfLines={1}>{pendingOrder.deliveryAddress}</Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.rejectBtn, { borderColor: colors.border, borderWidth: 1 }]}
                  onPress={handleRejectOrder}
                >
                  <Text style={[styles.rejectBtnText, { color: colors.text }]}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.acceptLargeBtn, { backgroundColor: colors.primary }]}
                  onPress={handleAcceptOrder}
                >
                  <Text style={styles.acceptLargeBtnText}>Accept Job</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.text }]}>Welcome back,</Text>
            <View style={styles.riderNameRow}>
              <Text style={[styles.riderName, { color: colors.heading }]}>{user?.firstName || 'Rider Partner'}</Text>
              {!!user?.branchName && (
                <View style={[styles.branchBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                  <MaterialCommunityIcons name="storefront-outline" size={12} color={colors.primary} />
                  <Text style={[styles.branchText, { color: colors.primary }]}>{user.branchName}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/rider/profile')}
            style={[styles.profileButton, { backgroundColor: colors.surface }]}
          >
            <Feather name="user" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Status Toggle Card */}
          <Animated.View entering={FadeInDown.delay(100)} style={[styles.statusCard, { backgroundColor: colors.surface }]}>
            <View style={styles.statusInfo}>
              <Animated.View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#4CAF50' : colors.text }, pulseStyle]} />
              <View>
                <Text style={[styles.statusTitle, { color: colors.heading }]}>
                  {isOnline ? 'You are Online' : 'You are Offline'}
                </Text>
                <Text style={[styles.statusSubtitle, { color: colors.text }]}>
                  {isOnline ? 'Accepting delivery requests' : 'Go online to start earning'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleToggleStatus}
              style={[
                styles.toggleBtn,
                { backgroundColor: isOnline ? colors.primary + '20' : colors.primary }
              ]}
            >
              <Text style={[styles.toggleBtnText, { color: isOnline ? colors.primary : '#FFF' }]}>
                {isOnline ? 'Go Offline' : 'Go Online'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {renderStatCard('Earnings', `₱${formatNumber(stats?.dailyEarnings)}`, 'wallet-outline', '#FF9800')}
            {renderStatCard('Orders', `${stats?.completedOrders || 0}`, 'package-variant-closed', '#2196F3')}
            {renderStatCard('Rating', `${stats?.rating || 0}`, 'star-outline', '#FFC107')}
          </View>

          {/* Active Orders Section */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.heading }]}>Active Orders</Text>
            <TouchableOpacity onPress={onRefresh}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {activeOrders.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.text + '40'} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No active orders at the moment.</Text>
              <Text style={[styles.emptySubText, { color: colors.text + '80' }]}>New requests will appear here when you are online.</Text>
            </View>
          ) : (
            activeOrders.map((order, index) => (
              <Animated.View
                key={order.id}
                entering={FadeInUp.delay(index * 100)}
                style={[styles.orderCard, { backgroundColor: colors.surface }]}
              >
                <View style={styles.orderHeader}>
                  <View style={[styles.orderBadge, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.orderBadgeText, { color: colors.primary }]}>NEW ORDER</Text>
                  </View>
                  <Text style={[styles.orderPrice, { color: colors.primary }]}>+₱{formatNumber(order.payout)}</Text>
                </View>

                <View style={styles.orderAddresses}>
                  <View style={styles.addressRow}>
                    <View style={styles.addressLine} />
                    <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
                    <View style={styles.addressInfo}>
                      <Text style={[styles.addressLabel, { color: colors.text }]}>PICKUP</Text>
                      <Text style={[styles.addressText, { color: colors.heading }]} numberOfLines={1}>{order.pickupAddress}</Text>
                    </View>
                  </View>

                  <View style={[styles.addressRow, { marginTop: 15 }]}>
                    <View style={[styles.dot, { backgroundColor: '#F44336' }]} />
                    <View style={styles.addressInfo}>
                      <Text style={[styles.addressLabel, { color: colors.text }]}>DELIVERY</Text>
                      <Text style={[styles.addressText, { color: colors.heading }]} numberOfLines={1}>{order.deliveryAddress}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.orderFooter}>
                  <View style={styles.orderMeta}>
                    <Feather name="box" size={14} color={colors.text} />
                    <Text style={[styles.orderMetaText, { color: colors.text }]}>{order.itemsCount} Items</Text>
                    <View style={styles.metaDivider} />
                    <Feather name="map-pin" size={14} color={colors.text} />
                    <Text style={[styles.orderMetaText, { color: colors.text }]}>{formatNumber(order.distanceKm, 1)} km</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                    onPress={() => router.push({ pathname: '/rider/order/[id]', params: { id: order.id } } as any)}
                  >
                    <Text style={styles.acceptBtnText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))
          )}

          {/* Quick Actions */}
          <Text style={[styles.sectionTitle, { color: colors.heading, marginTop: 20, marginBottom: 15 }]}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface }]}>
              <MaterialCommunityIcons name="history" size={24} color={colors.primary} />
              <Text style={[styles.actionLabel, { color: colors.heading }]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface }]}>
              <MaterialCommunityIcons name="chart-line" size={24} color={colors.primary} />
              <Text style={[styles.actionLabel, { color: colors.heading }]}>Payouts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface }]}>
              <MaterialCommunityIcons name="headphones" size={24} color={colors.primary} />
              <Text style={[styles.actionLabel, { color: colors.heading }]}>Support</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surface }]}
              onPress={handleLogout}
            >
              <MaterialCommunityIcons name="logout" size={24} color="#F44336" />
              <Text style={[styles.actionLabel, { color: colors.heading }]}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  greeting: {
    fontSize: 14,
    opacity: 0.7,
  },
  riderName: {
    fontSize: 24,
    fontFamily: Typography.h2,
  },
  riderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  branchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  branchText: {
    fontSize: 12,
    fontFamily: Typography.button,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  statusCard: {
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusSubtitle: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  toggleBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  statCard: {
    width: (width - 60) / 3,
    padding: 15,
    borderRadius: 18,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
  },
  emptySubText: {
    fontSize: 13,
    marginTop: 5,
    textAlign: 'center',
  },
  orderCard: {
    padding: 18,
    borderRadius: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  orderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  orderAddresses: {
    marginBottom: 20,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressLine: {
    position: 'absolute',
    left: 4,
    top: 15,
    bottom: -20,
    width: 1,
    backgroundColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginTop: 5,
    marginRight: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 15,
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderMetaText: {
    fontSize: 12,
    marginLeft: 5,
  },
  metaDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#BDBDBD',
    marginHorizontal: 8,
  },
  acceptBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
  },
  acceptBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionBtn: {
    width: (width - 52) / 2,
    padding: 15,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  assignmentModal: {
    width: '100%',
    borderRadius: 30,
    padding: 25,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 25,
  },
  alertCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    elevation: 10,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 5,
    opacity: 0.7,
  },
  modalDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 25,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  addressBox: {
    width: '100%',
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 15,
    marginBottom: 30,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 15,
  },
  rejectBtn: {
    flex: 1,
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtnText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  acceptLargeBtn: {
    flex: 2,
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  acceptLargeBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
  }
});
