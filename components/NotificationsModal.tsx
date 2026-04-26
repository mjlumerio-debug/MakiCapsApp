import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useUiStore, markAsRead } from '../lib/ui_store';

export default function NotificationsModal({ visible, onClose, colors }: any) {
  const { orders, readNotificationIds } = useUiStore();

  // Generate notifications based on recent orders
  const notifications: any[] = [];
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  orders.forEach((order) => {
    if (order._rawDate && (now - order._rawDate) < twentyFourHours) {
      
      const placedId = `${order.orderId}-placed`;
      notifications.push({
        id: placedId,
        title: 'Order Successfully Placed! 🍱',
        message: `Your order #${order.orderId} is confirmed and will be prepared shortly.`,
        time: new Date(order._rawDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        timestamp: order._rawDate,
        icon: 'check-circle',
        color: '#10B981',
        isRead: readNotificationIds.includes(placedId),
      });

      const transitId = `${order.orderId}-transit`;
      if (order.raw_status === 'in_transit') {
        notifications.push({
          id: transitId,
          title: 'Order is on the way! 🛵',
          message: `Your order #${order.orderId} has been picked up and is now heading to your location. Get ready!`,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          timestamp: Date.now(),
          icon: 'truck',
          color: '#3B82F6',
          isRead: readNotificationIds.includes(transitId),
        });
      }

      const deliveredId = `${order.orderId}-delivered`;
      if (order.status === 'Delivered') {
        notifications.push({
          id: deliveredId,
          title: 'Order Delivered! 🎉',
          message: `Great news! Your order #${order.orderId} has been successfully delivered. We hope you enjoy your meal and thank you for choosing MakiCaps!`,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          timestamp: Date.now(),
          icon: 'package',
          color: colors.primary,
          isRead: readNotificationIds.includes(deliveredId),
        });
      }
    }
  });

  const markAllAsRead = () => {
    notifications.filter(n => !n.isRead).forEach(n => markAsRead(n.id));
  };

  // Sort newest first
  notifications.sort((a, b) => b.timestamp - a.timestamp);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.heading }]}>Notifications</Text>
            <View style={styles.headerActions}>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={markAllAsRead} style={styles.clearBtn}>
                  <Text style={[styles.clearBtnText, { color: colors.primary }]}>Mark all as read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="bell-off" size={48} color={colors.text} opacity={0.3} />
                <Text style={[styles.emptyText, { color: colors.text }]}>No new notifications</Text>
              </View>
            ) : (
              notifications.map((notif) => (
                <View 
                  key={notif.id} 
                  style={[
                    styles.notificationCard, 
                    { backgroundColor: colors.background },
                    notif.isRead && { opacity: 0.6 }
                  ]}
                >
                  {/* Unread Dot Indicator */}
                  {!notif.isRead && (
                    <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                  )}

                  <View style={[styles.iconContainer, { backgroundColor: notif.color + '15' }]}>
                    <Feather name={notif.icon as any} size={20} color={notif.color} />
                  </View>
                  <View style={styles.content}>
                    <View style={styles.notifHeader}>
                      <Text style={[styles.notifTitle, { color: colors.heading, fontWeight: notif.isRead ? '600' : '800' }]}>
                        {notif.title}
                      </Text>
                      {notif.isRead ? (
                        <View style={styles.markedAsReadBadge}>
                          <Feather name="check-circle" size={12} color={colors.text + '80'} />
                          <Text style={[styles.markAsReadText, { color: colors.text + '80' }]}>Marked as read</Text>
                        </View>
                      ) : (
                        <TouchableOpacity 
                          onPress={() => markAsRead(notif.id)}
                          style={[styles.markAsReadBtn, { borderColor: colors.primary + '30' }]}
                        >
                          <Text style={[styles.markAsReadText, { color: colors.primary }]}>Mark as Read</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={[styles.notifMessage, { color: colors.text }]} numberOfLines={2}>
                      {notif.message}
                    </Text>
                    <Text style={[styles.notifTime, { color: colors.text, opacity: 0.5 }]}>
                      {notif.time}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '70%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  clearBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
  },
  markedAsReadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    opacity: 0.8,
  },
  markAsReadBtn: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  markAsReadText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  notifMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  notifTime: {
    fontSize: 12,
    opacity: 0.6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
  }
});
