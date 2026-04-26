import { useSyncExternalStore } from 'react';
import api from './api';
import { sendRiderHeartbeat, RiderOperationalStatus } from './rider_api';

export type RiderOrderItem = {
  product_name: string;
  quantity: number;
  price: number;
  subtotal: number;
};

export type RiderOrder = {
  delivery_id: number;
  order_id: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'assigned_to_rider' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  status_label: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  latitude: number | null;
  longitude: number | null;
  maps_url?: string;
  branch_latitude?: number | null;
  branch_longitude?: number | null;
  branch_maps_url?: string;
  proof_of_delivery_url?: string | null;
  distance_km?: number;
  delivery_fee: number;
  total_amount: number;
  branch_name: string;
  branch_address: string;
  items: RiderOrderItem[];
  items_count: number;
  created_at: string;
  updated_at: string;
};

export type RiderStats = {
  total_orders: number;
  completed_orders: number;
  active_orders: number;
  earnings: number;
  rating: number;
};

type RiderState = {
  availableOrders: RiderOrder[]; // Active Orders (Available for Pickup)
  myOrders: RiderOrder[];        // My Orders (Active Deliveries)
  completedOrders: RiderOrder[]; // Completed
  stats: RiderStats;
  earningsToday: string;
  deliveriesToday: number;
  isRefreshing: boolean;
  deliverySuccessModal: { visible: boolean; orderId: number; fee: number } | null;
};

const initialState: RiderState = {
  availableOrders: [],
  myOrders: [],
  completedOrders: [],
  deliverySuccessModal: null,
  stats: {
    total_orders: 0,
    completed_orders: 0,
    active_orders: 0,
    earnings: 0,
    rating: 5.0,
  },
  earningsToday: '0.00',
  deliveriesToday: 0,
  isRefreshing: false,
};

let state: RiderState = initialState;
const listeners = new Set<() => void>();

const emit = (): void => {
  listeners.forEach((l) => l());
};

const setState = (updater: (prev: RiderState) => RiderState): void => {
  state = updater(state);
  emit();
};

export const useRiderStore = () => {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => state
  );
};

export const setDeliverySuccessModal = (data: { visible: boolean; orderId: number; fee: number } | null) => {
  setState(prev => ({ ...prev, deliverySuccessModal: data }));
};

/**
 * 1. Active Orders (Available for Pickup)
 * GET /api/v1/rider/orders
 */
const handleRiderAuthError = () => {
  stopRiderRealtimeSync();
  setState(prev => ({ ...prev, availableOrders: [], myOrders: [], completedOrders: [] }));
};

export const fetchAvailableOrders = async (): Promise<void> => {
  try {
    const response = await api.get('rider/orders');
    const orders: RiderOrder[] = response.data?.data || [];
    setState(prev => ({ ...prev, availableOrders: orders }));
  } catch (error: any) {
    if (error?.response?.status === 401) handleRiderAuthError();
    else console.log('[RiderStore] AvailableOrders failed:', error.message);
  }
};

export const fetchMyOrders = async (): Promise<void> => {
  try {
    const response = await api.get('rider/my-orders');
    const orders: RiderOrder[] = response.data?.data || [];
    setState(prev => ({ ...prev, myOrders: orders }));
  } catch (error: any) {
    if (error?.response?.status === 401) handleRiderAuthError();
    else console.log('[RiderStore] MyOrders failed:', error.message);
  }
};

export const fetchCompletedOrders = async (): Promise<void> => {
  try {
    const response = await api.get('rider/completed-orders');
    const orders: RiderOrder[] = response.data?.data || [];
    setState(prev => ({ ...prev, completedOrders: orders }));
  } catch (error: any) {
    if (error?.response?.status === 401) handleRiderAuthError();
    else console.log('[RiderStore] CompletedOrders failed:', error.message);
  }
};

export const fetchRiderStats = async (): Promise<void> => {
  try {
    const response = await api.get('rider/stats');
    const data = response.data?.data;
    if (data) {
      setState(prev => ({ 
        ...prev, 
        stats: data,
        earningsToday: data.today_earnings?.toFixed(2) || data.earnings?.toFixed(2) || '0.00',
        deliveriesToday: data.today_deliveries || data.completed_orders || 0
      }));
    }
  } catch (error: any) {
    if (error?.response?.status === 401) handleRiderAuthError();
    else console.log('[RiderStore] Stats failed:', error.message);
  }
};

/**
 * Accept an Order
 * POST /api/v1/rider/orders/{delivery_id}/accept
 */
export const acceptOrder = async (deliveryId: number): Promise<boolean> => {
  try {
    await api.post(`rider/orders/${deliveryId}/accept`);
    await Promise.all([fetchAvailableOrders(), fetchMyOrders()]);
    return true;
  } catch (error) {
    console.error('[RiderStore] Accept failed:', error);
    return false;
  }
};

import { deliverOrder as apiDeliverOrder } from './rider_api';

export const pickupOrder = async (deliveryId: number): Promise<boolean> => {
  try {
    await api.post(`rider/orders/${deliveryId}/pickup`);
    await fetchMyOrders();
    return true;
  } catch (error) {
    console.error('[RiderStore] Pickup failed:', error);
    return false;
  }
};

export const transitOrder = async (deliveryId: number): Promise<boolean> => {
  try {
    await api.post(`rider/orders/${deliveryId}/transit`);
    await fetchMyOrders();
    return true;
  } catch (error) {
    console.error('[RiderStore] Transit failed:', error);
    return false;
  }
};

export const deliverOrder = async (deliveryId: number, photoUri: string): Promise<boolean> => {
  try {
    await apiDeliverOrder(deliveryId, photoUri);
    await Promise.all([fetchMyOrders(), fetchCompletedOrders(), fetchRiderStats()]);
    return true;
  } catch (error) {
    console.error('[RiderStore] Deliver failed:', error);
    return false;
  }
};

/**
 * Reject an Order (Unassign)
 * POST /api/v1/rider/orders/{delivery_id}/reject
 */
export const rejectOrder = async (deliveryId: number): Promise<boolean> => {
  try {
    await api.post(`rider/orders/${deliveryId}/reject`);
    await Promise.all([fetchAvailableOrders(), fetchMyOrders()]);
    return true;
  } catch (error) {
    console.error('[RiderStore] Reject failed:', error);
    return false;
  }
};

/**
 * Global refresh for all tabs
 */
export const refreshAllRiderData = async () => {
  setState(prev => ({ ...prev, isRefreshing: true }));
  await Promise.all([
    fetchAvailableOrders(),
    fetchMyOrders(),
    fetchCompletedOrders(),
    fetchRiderStats()
  ]);
  setState(prev => ({ ...prev, isRefreshing: false }));
};

/**
 * Realtime Polling & Heartbeat logic
 */
let pollingInterval: any = null;
let heartbeatInterval: any = null;
let locationInterval: any = null;

import * as Location from 'expo-location';
import { sendRiderLocation } from './rider_api';

export const startRiderRealtimeSync = (currentStatus: RiderOperationalStatus) => {
  // Clear existing intervals if any
  stopRiderRealtimeSync();

  // 1. Poll Active/Available Orders every 7 seconds
  pollingInterval = setInterval(() => {
    fetchAvailableOrders();
    fetchMyOrders();
  }, 7000);

  // 2. Heartbeat Ping every 30 seconds
  heartbeatInterval = setInterval(() => {
    sendRiderHeartbeat(currentStatus);
  }, 30000);

  // 3. Location Tracking Ping every 10 seconds (only if active order)
  locationInterval = setInterval(async () => {
    if (state.myOrders.length > 0) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await sendRiderLocation(location.coords.latitude, location.coords.longitude);
        }
      } catch (err) {
        console.debug('[RiderStore] Location tracking error', err);
      }
    }
  }, 10000);

  // Initial fetch
  refreshAllRiderData();
};

export const stopRiderRealtimeSync = () => {
  if (pollingInterval) clearInterval(pollingInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (locationInterval) clearInterval(locationInterval);
  pollingInterval = null;
  heartbeatInterval = null;
  locationInterval = null;
};

