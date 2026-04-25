import { useSyncExternalStore } from 'react';
import api from './api';

export type RiderOrder = {
  id: string;
  orderNumber: string;
  status: 'assigned' | 'picked_up' | 'delivered';
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  payout: number;
  itemsCount: number;
  createdAt: string;
  distanceKm: number;
};

export type RiderStats = {
  dailyEarnings: number;
  weeklyEarnings: number;
  completedOrders: number;
  rating: number;
  onlineHours: number;
};

type RiderState = {
  activeOrders: RiderOrder[];
  completedOrders: RiderOrder[];
  pendingOrder: RiderOrder | null; // The order waiting for acceptance
  stats: RiderStats;
  isRefreshing: boolean;
};

const initialState: RiderState = {
  activeOrders: [],
  completedOrders: [],
  pendingOrder: null,
  stats: {
    dailyEarnings: 0,
    weeklyEarnings: 0,
    completedOrders: 0,
    rating: 4.8,
    onlineHours: 0,
  },
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

/**
 * Fetch active orders for the rider from the backend
 */
export const fetchRiderOrders = async (): Promise<void> => {
  setState(prev => ({ ...prev, isRefreshing: true }));
  try {
    const response = await api.get('rider/orders');
    const orders: RiderOrder[] = response.data?.data || [];
    
    const pending = orders.find(o => o.status === 'assigned');
    const active = orders.filter(o => ['preparing', 'ready', 'picked_up', 'in_transit'].includes(o.status));
    const completed = orders.filter(o => o.status === 'delivered');

    setState(prev => ({ 
      ...prev, 
      pendingOrder: pending || null,
      activeOrders: active,
      completedOrders: completed,
      isRefreshing: false 
    }));
  } catch (error: any) {
    console.error('[RiderStore] Failed to fetch orders:', error.response?.data || error.message);
    setState(prev => ({ ...prev, isRefreshing: false }));
  }
};

/**
 * Fetch rider performance stats
 */
export const fetchRiderStats = async (): Promise<void> => {
  try {
    const response = await api.get('rider/stats');
    const data = response.data?.data;
    if (data) {
      setState(prev => ({ 
        ...prev, 
        stats: {
          dailyEarnings: data.earnings || data.dailyEarnings || 0,
          weeklyEarnings: data.weekly_earnings || data.earnings || 0,
          completedOrders: data.completed_orders || data.total_orders || 0,
          rating: data.rating || 4.8,
          onlineHours: data.online_hours || 0,
        }
      }));
    }
  } catch (error: any) {
    console.error('[RiderStore] Failed to fetch stats:', error.response?.data || error.message);
  }
};

/**
 * Accept a pending order
 */
export const acceptOrder = async (orderId: string): Promise<boolean> => {
  try {
    await api.post(`rider/orders/${orderId}/accept`);
    setState(prev => ({ ...prev, pendingOrder: null }));
    await fetchRiderOrders();
    return true;
  } catch (error) {
    console.error('[RiderStore] Failed to accept order:', error);
    return false;
  }
};

/**
 * Reject a pending order
 */
export const rejectOrder = async (orderId: string): Promise<boolean> => {
  try {
    await api.post(`rider/orders/${orderId}/reject`);
    setState(prev => ({ ...prev, pendingOrder: null }));
    return true;
  } catch (error) {
    console.error('[RiderStore] Failed to reject order:', error);
    return false;
  }
};

/**
 * Update order status (Assigned -> Picked Up -> Delivered)
 */
export const updateOrderStatus = async (orderId: string, status: RiderOrder['status']): Promise<boolean> => {
  try {
    await api.post(`rider/orders/${orderId}/status`, { status });
    await fetchRiderOrders();
    await fetchRiderStats();
    return true;
  } catch (error) {
    console.error('[RiderStore] Failed to update order status:', error);
    return false;
  }
};
