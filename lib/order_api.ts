import api from './api';

export const apiRoutes = {
  orders: 'orders',
  products: 'products',
  validateCart: 'cart/validate',
  login: 'login',
  checkFee: 'delivery/check-fee',
} as const;

const getErrorMessage = (error: any, fallback: string): string => {
  const apiMessage = error?.response?.data?.message || error?.response?.data?.error;
  return apiMessage || error?.message || fallback;
};

export type OrderPayload = {
  customer_name: string;
  mobile_number: string;
  address: string;
  latitude: number;
  longitude: number;
  landmark?: string;
  notes?: string;
  branch_id?: number;
  user_id?: number;
  items: {
    product_id: number;
    name?: string;
    quantity: number;
    price: number;
  }[];
  distance_km: number;
  delivery_fee: number;
  total_amount: number;
  payment_method?: string;
};

export type DeliveryFeeResponse = {
  success: boolean;
  is_deliverable: boolean;
  distance_km: number;
  delivery_fee: number;
  max_radius_km: number;
  message: string;
};

export type CartValidationPayload = {
  branch_id: number;
  user_id?: number;
  items: {
    product_id: number;
    name?: string;
    quantity: number;
    price?: number;
  }[];
};

export type OrderStatusResponse = {
  id?: string;
  order_id: number;
  status: 'pending' | 'preparing' | 'in_transit' | 'delivered' | 'cancelled';
  created_at?: string;
  updated_at?: string;
  total_amount?: number;
  subtotal?: number;
  delivery_fee?: number;
  customer_name?: string;
  payment_method?: string;
  address?: string;
  items?: any[];
};

/**
 * Standardized endpoint:
 * POST https://makidesuoperation.site/api/v1/orders
 */
export const submitOrder = async (
  payload: OrderPayload
): Promise<{ order_id: number; status: string }> => {
  try {
    console.log('[OrderAPI] Submitting order with payload:', JSON.stringify(payload, null, 2));
    const response = await api.post(apiRoutes.orders, payload);
    const data = response.data;
    const order = data?.data || data;
    return {
      order_id: Number(order.order_id || order.id),
      status: order.status || 'pending',
    };
  } catch (error: any) {
    const status = error?.response?.status;
    const serverData = error?.response?.data;
    console.error('[OrderAPI] submitOrder CRITICAL FAILURE:', {
      status,
      data: serverData,
      message: error?.message
    });
    
    // Extract a user-friendly message or use the backend's validation error
    let errorMsg = serverData?.message || serverData?.error || 'Could not submit order. Please check your connection.';
    if (status === 422 && serverData?.errors) {
      const firstErr = Object.values(serverData.errors)[0];
      if (Array.isArray(firstErr)) errorMsg = firstErr[0];
    }
    
    throw new Error(errorMsg);
  }
};

/**
 * Standardized endpoint:
 * GET https://makidesuoperation.site/api/v1/orders/{orderId}
 */
export const fetchOrderStatus = async (
  orderId: string | number
): Promise<OrderStatusResponse | null> => {
  try {
    const response = await api.get(`${apiRoutes.orders}/${orderId}`);
    const data = response.data;
    const order = data?.data || data;
    const items = order.items || order.order_items || order.line_items || order.products || [];
    const rawItems = order.items || order.order_items || order.line_items || order.products || [];

    return {
      order_id: Number(order.order_id || order.id),
      status: order.status || 'pending',
      created_at: order.created_at,
      updated_at: order.updated_at,
      total_amount: order.total_amount || order.total || order.grand_total || order.total_price,
      subtotal: order.subtotal || order.items_total || order.total_items_price,
      delivery_fee: order.delivery_fee || order.shipping_fee || order.delivery_charge,
      customer_name: order.customer_name || order.user?.name,
      payment_method: order.payment_method || order.payment_type || order.payment_mode,
      address: order.address || order.delivery_address || order.full_address || order.delivery_location || order.location,
      items: Array.isArray(rawItems) ? rawItems.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        title: item.product_name || item.name || item.title || 'Product',
        image: item.product_image || item.image_url || item.image,
        quantity: item.quantity || item.qty || 1,
        price: item.price || item.unit_price || 0,
      })) : [],
    };
  } catch (error: any) {
    if (error?.response?.status === 401) return null;
    console.log('[OrderAPI] fetchOrderStatus failed:', error?.response?.data || error?.message);
    throw new Error(getErrorMessage(error, 'Could not fetch order status.'));
  }
};

/**
 * Standardized endpoint:
 * GET https://makidesuoperation.site/api/v1/orders
 */
export const fetchMyOrders = async (): Promise<OrderStatusResponse[]> => {
  try {
    const response = await api.get(apiRoutes.orders);
    const data = response.data;
    const orders = Array.isArray(data) ? data : (data?.data || []);

    return orders.map((o: any) => ({
      order_id: Number(o.order_id || o.id),
      order_number: o.order_number || o.order_no || o.order_id || o.id,
      uuid: o.uuid || o.order_uuid || o.id,
      status: o.status || 'pending',
      created_at: o.created_at,
      total_amount: o.total_amount || o.total || o.grand_total,
      subtotal: o.subtotal || o.items_total,
      delivery_fee: o.delivery_fee || o.shipping_fee,
      payment_method: o.payment_method || o.payment_type || o.payment_mode,
      address: o.address || o.delivery_address || o.full_address || o.delivery_location || o.location,
      // Strictly map items from API-driven relationship
      items: (o.items || o.order_items || o.line_items || o.products || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        title: item.product_name || item.name || item.title || 'Product',
        image: item.product_image || item.image_url || item.image,
        quantity: item.quantity || item.qty || 1,
        price: item.price || item.unit_price || 0,
      })),
    }));
  } catch (error: any) {
    if (error?.response?.status === 401) return [];
    console.log('[OrderAPI] fetchMyOrders failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const validateCartStock = async (
  payload: CartValidationPayload
): Promise<{ message: string }> => {
  try {
    console.log('[OrderAPI] Validating stock with payload:', JSON.stringify(payload, null, 2));
    const response = await api.post(apiRoutes.validateCart, payload);
    return {
      message: response?.data?.message || 'Cart valid',
    };
  } catch (error: any) {
    const status = error?.response?.status;
    const serverData = error?.response?.data;

    console.log('[OrderAPI] validateCartStock failed:', {
      status,
      data: serverData,
      message: error?.message
    });

    // 🛑 HARD STOP: Surface the real backend error and prevent submission
    let errorMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Validation failed. Please try again.';

    // If the server says "Server Error" (generic 500), make it clearer
    if (errorMsg === 'Server Error') {
      errorMsg = 'Server Error: The backend crashed during validation. Please check your Laravel logs.';
    }

    throw new Error(errorMsg);
  }
};

/**
 * NEW: Dynamic Delivery Fee Checker
 * POST /api/v1/delivery/check-fee
 */
export const checkDeliveryFee = async (payload: {
  branch_id?: number;
  latitude: number;
  longitude: number;
}): Promise<DeliveryFeeResponse> => {
  try {
    const response = await api.post(apiRoutes.checkFee, payload);
    return response.data;
  } catch (error: any) {
    console.log('[OrderAPI] checkDeliveryFee failed:', error?.response?.data || error?.message);
    throw new Error(getErrorMessage(error, 'Could not check delivery fee.'));
  }
};
