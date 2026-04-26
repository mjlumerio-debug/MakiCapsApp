import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, Alert } from 'react-native';
import { useRiderStore, refreshAllRiderData } from '@/lib/rider_store';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { useUiStore } from '@/lib/ui_store';
import { updateRiderStatus } from '@/lib/rider_api';
import { RiderOrderCard } from '@/components/RiderOrderCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CommandCenterTab() {
  const { availableOrders, myOrders, isRefreshing, earningsToday, deliveriesToday, deliverySuccessModal } = useRiderStore();
  const { riderStatus, user } = useUiStore();
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [hasDismissedPrompt, setHasDismissedPrompt] = useState(false);
  const [showOfflineBlockModal, setShowOfflineBlockModal] = useState(false);

  const toggleStatus = async () => {
    const nextStatus = riderStatus === 'offline' ? 'available' : 'offline';
    
    // Prevent going offline if there are active tasks
    if (nextStatus === 'offline' && myOrders.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setShowOfflineBlockModal(true);
      return;
    }

    await updateRiderStatus(nextStatus);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const goOnlineFromModal = async () => {
    await updateRiderStatus('available');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHasDismissedPrompt(true);
  };

  const closeSuccessModal = () => {
    import('@/lib/rider_store').then(({ setDeliverySuccessModal }) => {
      setDeliverySuccessModal(null);
    });
  };

  const riderName = user?.firstName || user?.name?.split(' ')[0] || 'Rider';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* 🎉 GLOBAL SUCCESS MODAL */}
      <Modal
        visible={!!deliverySuccessModal?.visible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.promptCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.promptIconBox, { backgroundColor: '#4CAF5015', width: 90, height: 90, borderRadius: 45 }]}>
              <Feather name="check-circle" size={48} color="#4CAF50" />
            </View>
            <Text style={[styles.promptTitle, { color: colors.heading, fontSize: 24 }]}>Delivery Successful!</Text>
            
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <Text style={[styles.promptMessage, { marginBottom: 12 }]}>
                Great job! You have successfully delivered Order #{deliverySuccessModal?.orderId}.
              </Text>
              <Text style={[{ color: colors.text, fontSize: 13, opacity: 0.8 }]}>Commission Earned</Text>
              <Text style={{ color: '#4CAF50', fontSize: 28, fontWeight: '900', marginTop: 4 }}>
                +₱{deliverySuccessModal?.fee.toFixed(2)}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.promptMainBtn, { backgroundColor: '#4CAF50' }]}
              onPress={closeSuccessModal}
            >
              <Text style={styles.promptMainBtnText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🚀 GO ONLINE PROMPT MODAL */}
      <Modal
        visible={riderStatus === 'offline' && !hasDismissedPrompt}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.promptCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.promptIconBox, { backgroundColor: colors.primary + '15' }]}>
              <MaterialCommunityIcons name="moped" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.promptTitle, { color: colors.heading }]}>Ready to earn?</Text>
            <Text style={[styles.promptMessage, { color: colors.text }]}>
              You are currently offline. Go online now to start receiving delivery requests in your area!
            </Text>
            
            <TouchableOpacity 
              style={[styles.promptMainBtn, { backgroundColor: colors.primary }]}
              onPress={goOnlineFromModal}
            >
              <Text style={styles.promptMainBtnText}>Go Online Now</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.promptSecondaryBtn}
              onPress={() => setHasDismissedPrompt(true)}
            >
              <Text style={[styles.promptSecondaryBtnText, { color: colors.text }]}>Stay Offline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🛑 CANNOT GO OFFLINE MODAL */}
      <Modal
        visible={showOfflineBlockModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.promptCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.promptIconBox, { backgroundColor: '#FF3B3015', width: 80, height: 80, borderRadius: 40 }]}>
              <MaterialCommunityIcons name="shield-alert-outline" size={40} color="#FF3B30" />
            </View>
            <Text style={[styles.promptTitle, { color: colors.heading }]}>Delivery in Progress</Text>
            <Text style={[styles.promptMessage, { color: colors.text }]}>
              You are currently handling an active order. Please complete all assigned tasks before changing your status to offline.
            </Text>
            
            <TouchableOpacity 
              style={[styles.promptMainBtn, { backgroundColor: '#FF3B30' }]}
              onPress={() => setShowOfflineBlockModal(false)}
            >
              <Text style={styles.promptMainBtnText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🎩 PROFESSIONAL HEADER */}
      <View style={[styles.topHeader, { backgroundColor: colors.surface, paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.welcomeText, { color: colors.text }]} numberOfLines={1}>Good day,</Text>
            <Text 
              style={[styles.nameText, { color: colors.heading }]} 
              numberOfLines={1} 
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              <Text style={{ color: colors.primary }}>{riderName}</Text>, Rider Partner!
            </Text>
          </View>
          <TouchableOpacity 
            onPress={toggleStatus}
            style={[
              styles.statusToggle, 
              { backgroundColor: riderStatus === 'offline' ? '#666' : '#4CAF50' }
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: '#FFF' }]} />
            <Text style={styles.statusLabel}>{riderStatus === 'available' ? 'ONLINE' : 'OFFLINE'}</Text>
          </TouchableOpacity>
        </View>

        {/* 📊 QUICK SUMMARY CARDS */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.primary + '10' }]}>
            <Feather name="trending-up" size={16} color={colors.primary} />
            <View>
              <Text style={[styles.summaryVal, { color: colors.heading }]}>₱{earningsToday || '0.00'}</Text>
              <Text style={[styles.summaryLabel, { color: colors.text }]}>Earnings Today</Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#4CAF5010' }]}>
            <Feather name="check-circle" size={16} color="#4CAF50" />
            <View>
              <Text style={[styles.summaryVal, { color: colors.heading }]}>{deliveriesToday || '0'}</Text>
              <Text style={[styles.summaryLabel, { color: colors.text }]}>Deliveries</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={refreshAllRiderData} 
            tintColor={colors.primary} 
          />
        }
      >
        {/* 🚀 ACTIVE TASKS SECTION (Unified) */}
        {myOrders.length > 0 && (
          <View style={styles.unifiedSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.heading }]}>Active Task</Text>
              <View style={[styles.statusBadge, { backgroundColor: '#FF980020' }]}>
                <Text style={[styles.statusBadgeText, { color: '#FF9800' }]}>IN PROGRESS</Text>
              </View>
            </View>
            {myOrders.map((order, index) => (
              <RiderOrderCard 
                key={order.delivery_id} 
                order={order} 
                index={index} 
                type="my-orders" 
              />
            ))}
            <View style={[styles.divider, { backgroundColor: colors.border + '20' }]} />
          </View>
        )}

        {/* 📍 AVAILABLE ORDERS SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.heading }]}>Available for Pickup</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.countText}>{availableOrders.length}</Text>
          </View>
        </View>

        {availableOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface }]}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={48} color={colors.text + '30'} />
            </View>
            <Text style={[styles.emptyText, { color: colors.heading }]}>Searching for Orders...</Text>
            <Text style={[styles.emptySubtext, { color: colors.text }]}>Stay online to receive the latest delivery requests in your area.</Text>
          </View>
        ) : (
          availableOrders.map((order, index) => (
            <RiderOrderCard 
              key={order.delivery_id} 
              order={order} 
              index={index} 
              type="available" 
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 14,
    opacity: 0.7,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 18,
    gap: 12,
  },
  summaryVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 10,
    opacity: 0.6,
    fontWeight: '600',
    marginTop: -2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  unifiedSection: {
    marginBottom: 10,
  },
  divider: {
    height: 1,
    marginVertical: 20,
    borderRadius: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  promptCard: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  promptIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  promptTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  promptMessage: {
    fontSize: 15,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 30,
    lineHeight: 22,
  },
  promptMainBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  promptMainBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  promptSecondaryBtn: {
    width: '100%',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptSecondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.8,
  }
});
