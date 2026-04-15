import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

/**
 * Order API functions for communicating with the Laravel backend.
 *
 * IMPORTANT: The order endpoints live at /api/orders (not /api/v1/orders),
 * so we derive a separate base URL by stripping the /v1 suffix from the
 * main API URL used for menus/auth.
 */

// Derive the orders base URL: /api (without /v1)
const mainApiUrl = process.env.EXPO_PUBLIC_API_URL || '';
const ordersBaseUrl = mainApiUrl.replace(/\/v1\/?$/, '');

const orderApi = axios.create({
  baseURL: ordersBaseUrl,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 seconds — orders may take longer
});

// Add a request interceptor to attach the auth token to orderApi
orderApi.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('[OrderAPI Interceptor] Failed to get auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export type OrderPayload = {
  customer_name: string;
  mobile_number: string;
  address: string;
  items: {
    product_id: number;
    name?: string;
    quantity: number;
    price: number;
  }[];
  total_amount: number;
  payment_method?: string;
};

export type OrderStatusResponse = {
  id?: string; // Local UI ID
  order_id: number;
  status: 'pending' | 'preparing' | 'in_transit' | 'delivered' | 'cancelled';
  created_at?: string;
  updated_at?: string;
  total_amount?: number;
  customer_name?: string;
  items?: any[];
};

/**
 * Submit a new order to the Laravel backend.
 * POST /api/orders
 */
export const submitOrder = async (payload: OrderPayload): Promise<{ order_id: number; status: string }> => {
  try {
    console.log('[OrderAPI] Submitting to:', `${ordersBaseUrl}/orders`);
    const response = await orderApi.post('/orders', payload);
    const data = response.data;
    const order = data?.data || data;
    return {
      order_id: order.order_id || order.id,
      status: order.status || 'pending',
    };
  } catch (error: any) {
    console.error('[OrderAPI] submitOrder failed:', error?.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetch the current status of an order.
 * GET /api/orders/{orderId}
 */
export const fetchOrderStatus = async (orderId: number): Promise<OrderStatusResponse> => {
  try {
    const response = await orderApi.get(`/orders/${orderId}`);
    const data = response.data;
    const order = data?.data || data;
    return {
      order_id: order.order_id || order.id,
      status: order.status || 'pending',
      created_at: order.created_at,
      updated_at: order.updated_at,
      total_amount: order.total_amount,
      customer_name: order.customer_name,
      items: order.items,
    };
  } catch (error: any) {
    console.error('[OrderAPI] fetchOrderStatus failed:', error?.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetch all orders for the currently authenticated user.
 * GET /api/orders
 */
export const fetchMyOrders = async (): Promise<OrderStatusResponse[]> => {
  try {
    const response = await orderApi.get('/orders');
    const data = response.data;
    // Laravel usually returns a collection in 'data' key or as a flat array
    const orders = Array.isArray(data) ? data : (data?.data || []);
    
    return orders.map((o: any) => ({
      order_id: o.order_id || o.id,
      status: o.status || 'pending',
      created_at: o.created_at,
      total_amount: o.total_amount || o.total,
      items: o.items || [],
    }));
  } catch (error: any) {
    console.error('[OrderAPI] fetchMyOrders failed:', error?.response?.data || error.message);
    return [];
  }
};
