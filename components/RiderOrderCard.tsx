import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { Typography } from '@/constants/theme';
import { RiderOrder, acceptOrder, pickupOrder, transitOrder, deliverOrder, setDeliverySuccessModal } from '@/lib/rider_store';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';

import * as Haptics from 'expo-haptics';

interface RiderOrderCardProps {
  order: RiderOrder;
  index: number;
  type: 'available' | 'my-orders' | 'completed';
}

const STATUS_LABELS: Record<string, string> = {
  'pending':           '🕐 Pending',
  'preparing':         '👨‍🍳 Preparing',
  'ready_for_pickup':  '📦 Ready for Pickup',
  'assigned_to_rider': '🏍️ Rider Assigned',
  'picked_up':         '✅ Picked Up',
  'in_transit':        '🚴 In Transit',
  'delivered':         '🎉 Delivered',
  'cancelled':         '❌ Cancelled',
};

export function RiderOrderCard({ order, index, type }: RiderOrderCardProps) {
  const { colors } = useAppTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleNavigate = () => {
    const isHeadingToBranch = ['assigned_to_rider', 'ready_for_pickup'].includes(order.status);
    const targetUrl = isHeadingToBranch ? order.branch_maps_url : order.maps_url;
    if (targetUrl) WebBrowser.openBrowserAsync(targetUrl);
  };

  const handleAccept = () => acceptOrder(order.delivery_id);
  const handlePickup = () => pickupOrder(order.delivery_id);
  const handleTransit = () => transitOrder(order.delivery_id);
  
  const handleDeliver = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      const success = await deliverOrder(order.delivery_id, result.assets[0].uri);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setDeliverySuccessModal({ visible: true, orderId: order.delivery_id, fee: order.delivery_fee });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Delivery Failed', 'There was a problem confirming the delivery. Please try again or check your connection.');
      }
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100)}
      style={[styles.card, { backgroundColor: colors.surface }]}
    >
      {/* 🏷️ STATUS & PRICE BAR */}
      <View style={styles.header}>
        <View style={[styles.statusTag, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.statusTagText, { color: colors.primary }]}>
            {STATUS_LABELS[order.status] || order.status}
          </Text>
        </View>
        <Text style={[styles.totalPrice, { color: colors.heading }]}>₱{order.total_amount.toFixed(2)}</Text>
      </View>

      {/* 👤 CUSTOMER MINI-INFO */}
      <View style={styles.clientBar}>
        <View style={styles.clientMain}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{order.customer_name[0]}</Text>
          </View>
          <View>
            <Text style={[styles.clientName, { color: colors.heading }]}>{order.customer_name}</Text>
            <Text style={[styles.orderId, { color: colors.text }]}>#{order.delivery_id}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.callBtn, { backgroundColor: colors.primary }]}
          onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
        >
          <Feather name="phone" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* 📍 ROUTE TIMELINE */}
      <View style={styles.routeBox}>
        <View style={styles.timelineLine}>
          <View style={[styles.timelineDot, { backgroundColor: '#4CAF50' }]} />
          <View style={[styles.timelineConnector, { backgroundColor: colors.border + '40' }]} />
          <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
        </View>
        <View style={styles.routeDetails}>
          <View style={styles.routePoint}>
            <Text style={[styles.pointLabel, { color: colors.text }]}>PICKUP</Text>
            <Text style={[styles.pointText, { color: colors.heading }]} numberOfLines={1}>{order.branch_name}</Text>
          </View>
          <View style={styles.routePoint}>
            <Text style={[styles.pointLabel, { color: colors.text }]}>DROP OFF</Text>
            <Text style={[styles.pointText, { color: colors.heading }]} numberOfLines={2}>{order.customer_address}</Text>
          </View>
        </View>
      </View>

      {/* 🍱 ORDER SUMMARY */}
      <TouchableOpacity 
        style={[styles.itemsBox, { backgroundColor: colors.background }]}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.itemsHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <Feather name="shopping-bag" size={14} color={colors.text} opacity={0.6} />
            <Text style={[styles.itemsCount, { color: colors.text }]}>{order.items_count} Items</Text>
          </View>
          {order.items.length > 1 && (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <Text style={{fontSize: 10, color: colors.primary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5}}>
                {isExpanded ? 'Hide' : 'View all'}
              </Text>
              <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
            </View>
          )}
        </View>
        
        {isExpanded ? (
          <View style={{ marginTop: 8, gap: 4 }}>
            {order.items.map((item, idx) => (
              <Text key={idx} style={[styles.itemsPreview, { color: colors.heading }]}>
                {item.quantity}x  {item.product_name}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={[styles.itemsPreview, { color: colors.heading }]} numberOfLines={1}>
            {order.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')}
          </Text>
        )}
      </TouchableOpacity>

      {/* ⚡ ACTIONS */}
      <View style={styles.actionRow}>
        <View style={styles.feeBox}>
          <Text style={[styles.feeLabel, { color: colors.text }]}>Commission</Text>
          <Text style={[styles.feeValue, { color: '#4CAF50' }]}>+₱{order.delivery_fee.toFixed(2)}</Text>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity style={[styles.mapBtn, { borderColor: colors.primary }]} onPress={handleNavigate}>
            <Feather name="map" size={20} color={colors.primary} />
          </TouchableOpacity>

          {type === 'available' && (
            <TouchableOpacity style={[styles.mainBtn, { backgroundColor: colors.primary }]} onPress={handleAccept}>
              <Text style={styles.mainBtnText}>Accept</Text>
            </TouchableOpacity>
          )}

          {type === 'my-orders' && (
            <>
              {order.status === 'assigned_to_rider' && (
                <TouchableOpacity style={[styles.mainBtn, { backgroundColor: '#FF9800' }]} onPress={handlePickup}>
                  <Text style={styles.mainBtnText}>Pickup</Text>
                </TouchableOpacity>
              )}
              {order.status === 'picked_up' && (
                <TouchableOpacity style={[styles.mainBtn, { backgroundColor: '#2196F3' }]} onPress={handleTransit}>
                  <Text style={styles.mainBtnText}>Start</Text>
                </TouchableOpacity>
              )}
              {order.status === 'in_transit' && (
                <TouchableOpacity style={[styles.mainBtn, { backgroundColor: '#4CAF50' }]} onPress={handleDeliver}>
                  <Text style={styles.mainBtnText}>Deliver</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: '900',
  },
  clientBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clientMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
  },
  orderId: {
    fontSize: 11,
    opacity: 0.5,
    fontWeight: '600',
  },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeBox: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  timelineLine: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  routeDetails: {
    flex: 1,
    gap: 15,
  },
  routePoint: {
    gap: 2,
  },
  pointLabel: {
    fontSize: 9,
    fontWeight: '900',
    opacity: 0.5,
  },
  pointText: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemsBox: {
    padding: 15,
    borderRadius: 16,
    marginBottom: 20,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemsCount: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.7,
  },
  itemsPreview: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.9,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeBox: {
    flex: 1,
  },
  feeLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.5,
  },
  feeValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  mapBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainBtn: {
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  mainBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  }
});
