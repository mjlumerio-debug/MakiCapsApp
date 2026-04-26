import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRiderStore, refreshAllRiderData } from '@/lib/rider_store';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { RiderOrderCard } from '@/components/RiderOrderCard';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CompletedOrdersTab() {
  const { completedOrders, isRefreshing } = useRiderStore();
  const { colors } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 🏛️ PROFESSIONAL HEADER */}
      <View style={[styles.proHeader, { backgroundColor: colors.surface, paddingTop: insets.top + 10 }]}>
        <Text style={[styles.welcomeText, { color: colors.text }]}>Your past</Text>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.heading }]}>Completed</Text>
          <View style={[styles.statusBadge, { backgroundColor: '#4CAF5020' }]}>
            <Text style={[styles.statusBadgeText, { color: '#4CAF50' }]}>SUCCESSFUL</Text>
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
        {completedOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface }]}>
              <MaterialCommunityIcons name="history" size={48} color={colors.text + '30'} />
            </View>
            <Text style={[styles.emptyText, { color: colors.heading }]}>No History Yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.text }]}>Your completed deliveries will appear here. Start earning now!</Text>
          </View>
        ) : (
          completedOrders.map((order, index) => (
            <RiderOrderCard 
              key={order.delivery_id} 
              order={order} 
              index={index} 
              type="completed" 
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
  proHeader: {
    paddingHorizontal: 20,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    zIndex: 10,
  },
  welcomeText: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
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
  }
});
