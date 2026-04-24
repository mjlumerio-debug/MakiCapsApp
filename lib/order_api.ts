import api from './api';

export const apiRoutes = {
  orders: '/orders',
  products: '/products',
  validateCart: '/cart/validate',
  login: '/login',
} as const;

const getErrorMessage = (error: any, fallback: string): string => {
  const apiMessage = error?.response?.data?.message || error?.response?.data?.error;
  return apiMessage || error?.message || fallback;
};

export type OrderPayload = {
  customer_name: string;
  mobile_number: string;
  address: string;
  branch_id?: number;
  user_id?: number;
  items: {
    product_id: number;
    name?: string;
    quantity: number;
    price: number;
  }[];
  total_amount: number;
  payment_method?: string;
};

export type CartValidationPayload = {
  branch_id: number;
  items: {
    product_id: number;
    quantity: number;
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
    const response = await api.post(apiRoutes.orders, payload);
    const data = response.data;
    const order = data?.data || data;
    return {
      order_id: Number(order.order_id || order.id),
      status: order.status || 'pending',
    };
  } catch (error: any) {
    console.log('[OrderAPI] submitOrder failed:', error?.response?.data || error?.message);
    throw new Error(getErrorMessage(error, 'Could not submit order.'));
  }
};

/**
 * Standardized endpoint:
 * GET https://makidesuoperation.site/api/v1/orders/{orderId}
 */
export const fetchOrderStatus = async (orderId: number): Promise<OrderStatusResponse> => {
  try {
    const response = await api.get(`${apiRoutes.orders}/${orderId}`);
    const data = response.data;
    const order = data?.data || data;
    return {
      order_id: Number(order.order_id || order.id),
      status: order.status || 'pending',
      created_at: order.created_at,
      updated_at: order.updated_at,
      total_amount: order.total_amount,
      customer_name: order.customer_name,
      items: order.items,
    };
  } catch (error: any) {
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
      status: o.status || 'pending',
      created_at: o.created_at,
      total_amount: o.total_amount || o.total || o.grand_total,
      subtotal: o.subtotal || o.items_total,
      delivery_fee: o.delivery_fee || o.shipping_fee,
      payment_method: o.payment_method,
      address: o.address || o.delivery_address,
      items:
        o.items ||
        o.order_items ||
        o.line_items ||
        o.products ||
        [],
    }));
  } catch (error: any) {
    console.log('[OrderAPI] fetchMyOrders failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const validateCartStock = async (
  payload: CartValidationPayload
): Promise<{ message: string }> => {
  try {
    const response = await api.post(apiRoutes.validateCart, payload);
    return {
      message: response?.data?.message || 'Cart valid',
    };
  } catch (error: any) {
    console.log('[OrderAPI] validateCartStock failed:', error?.response?.data || error?.message);
    throw new Error('Maximum available quantity reached');
  }
};
