import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

type CartItem = {
  id: string;
  quantity: number;
  checked: boolean;
};

type Address = {
  id: string;
  fullAddress: string;
  street: string;
  barangay: string;
  subdivision: string;
  city: string;
  province: string;
  notes: string;
  latitude?: number;
  longitude?: number;
};

export type OrderItem = {
  title: string;
  quantity: number;
  price: string;
};

export type Order = {
  id: string;
  orderId: string;
  backendOrderId?: number; // ID from Laravel backend for status polling
  items: number;
  totalPrice: string;
  subtotal: string;
  deliveryFee: string;
  title: string;
  status: 'In Progress' | 'Delivered' | 'Cancelled';
  date: string;
  deliveryTime: string;
  paymentMethod: string;
  fullAddress: string;
  itemsList: OrderItem[];
  image: any;
};

type UiState = {
  userId: number | null;
  favorites: string[];
  cartItems: CartItem[];
  addresses: Address[];
  orders: Order[];
  activeAddressId: string | null;
  isCartCollapsed: boolean;
};

const initialState: UiState = {
  userId: null,
  favorites: [],
  cartItems: [],
  addresses: [],
  orders: [],
  activeAddressId: null,
  isCartCollapsed: false,
};

const STORAGE_KEY_FAVORITES = 'maki_favorites';
const STORAGE_KEY_CART = 'maki_cart_items';
const STORAGE_KEY_ADDRESSES = 'maki_addresses';
const STORAGE_KEY_ACTIVE_ADDRESS_ID = 'maki_active_address_id';
const STORAGE_KEY_ORDERS = 'maki_orders';

let state: UiState = initialState;
const listeners = new Set<() => void>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const setState = (updater: (prev: UiState) => UiState): void => {
  state = updater(state);
  emit();
};

export const setUserId = (userId: number | null): void => {
  setState((prev) => ({
    ...prev,
    userId,
  }));
  if (userId) {
    AsyncStorage.setItem('current_user_id', String(userId)).catch(console.error);
  } else {
    AsyncStorage.removeItem('current_user_id').catch(console.error);
  }
};

// Initialize store from storage
const initFromStorage = async () => {
  try {
    const [userId, favorites, cart, addresses, activeAddressId, orders] = await Promise.all([
      AsyncStorage.getItem('current_user_id'),
      AsyncStorage.getItem(STORAGE_KEY_FAVORITES),
      AsyncStorage.getItem(STORAGE_KEY_CART),
      AsyncStorage.getItem(STORAGE_KEY_ADDRESSES),
      AsyncStorage.getItem(STORAGE_KEY_ACTIVE_ADDRESS_ID),
      AsyncStorage.getItem(STORAGE_KEY_ORDERS),
    ]);

    let loadedAddresses = addresses ? JSON.parse(addresses) : [];
    let loadedActiveId = activeAddressId ? JSON.parse(activeAddressId) : null;

    // Seed data if empty
    if (loadedAddresses.length === 0) {
      loadedAddresses = [
        {
          id: 'sample-1',
          label: 'Home (Makati)',
          fullName: 'Mark Angelo',
          phoneNumber: '09171234567',
          street: '123 Ayala Avenue',
          city: 'Makati City',
          fullAddress: '123 Ayala Avenue, Makati City, Metro Manila',
          latitude: 14.5548,
          longitude: 121.0244,
          isDefault: true,
        },
        {
          id: 'sample-2',
          label: 'Work (Katipunan)',
          fullName: 'Mark Angelo',
          phoneNumber: '09171234567',
          street: '456 Katipunan Avenue',
          city: 'Quezon City',
          fullAddress: '456 Katipunan Avenue, Quezon City, Metro Manila',
          latitude: 14.6397,
          longitude: 121.0772,
          isDefault: false,
        }
      ];
      loadedActiveId = 'sample-1';
      syncToStorage(STORAGE_KEY_ADDRESSES, loadedAddresses);
      syncToStorage(STORAGE_KEY_ACTIVE_ADDRESS_ID, loadedActiveId);
    }

    setState((prev) => ({
      ...prev,
      userId: userId ? parseInt(userId, 10) : null,
      favorites: favorites ? JSON.parse(favorites) : [],
      cartItems: cart ? JSON.parse(cart) : [],
      addresses: loadedAddresses,
      activeAddressId: loadedActiveId,
      orders: orders ? JSON.parse(orders) : [],
    }));
  } catch (e) {
    console.error('Failed to load store from storage:', e);
  }
};

initFromStorage();

const syncToStorage = (key: string, value: any) => {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(console.error);
};

export const setFavorites = (favorites: string[]): void => {
  setState((prev) => ({
    ...prev,
    favorites,
  }));
  syncToStorage(STORAGE_KEY_FAVORITES, favorites);
};

export const toggleFavorite = (foodId: string): void => {
  setState((prev) => {
    const newFavorites = prev.favorites.includes(foodId)
      ? prev.favorites.filter((id) => id !== foodId)
      : [...prev.favorites, foodId];
    syncToStorage(STORAGE_KEY_FAVORITES, newFavorites);
    return { ...prev, favorites: newFavorites };
  });
};

export const clearFavorites = (): void => {
  setState((prev) => ({ ...prev, favorites: [] }));
  syncToStorage(STORAGE_KEY_FAVORITES, []);
};

export const addToCart = (foodId: string, quantity: number = 1): void => {
  setState((prev) => {
    const existing = prev.cartItems.find((item) => item.id === foodId);
    let newCart;
    if (existing) {
      newCart = prev.cartItems.map((item) =>
        item.id === foodId ? { ...item, quantity: item.quantity + quantity } : item
      );
    } else {
      newCart = [...prev.cartItems, { id: foodId, quantity, checked: true }];
    }

    syncToStorage(STORAGE_KEY_CART, newCart);
    return {
      ...prev,
      cartItems: newCart,
      isCartCollapsed: false,
    };
  });
};

export const clearCart = (): void => {
  setState((prev) => ({
    ...prev,
    cartItems: [],
  }));
  syncToStorage(STORAGE_KEY_CART, []);
};

export const setCartCollapsed = (collapsed: boolean): void => {
  setState((prev) => ({
    ...prev,
    isCartCollapsed: collapsed,
  }));
};

export const removeFromCart = (foodId: string): void => {
  setState((prev) => {
    const newCart = prev.cartItems.filter((item) => item.id !== foodId);
    syncToStorage(STORAGE_KEY_CART, newCart);
    return { ...prev, cartItems: newCart };
  });
};

export const updateCartQuantity = (foodId: string, quantity: number): void => {
  if (quantity <= 0) {
    removeFromCart(foodId);
    return;
  }
  setState((prev) => {
    const newCart = prev.cartItems.map((item) =>
      item.id === foodId ? { ...item, quantity } : item
    );
    syncToStorage(STORAGE_KEY_CART, newCart);
    return { ...prev, cartItems: newCart };
  });
};

export const toggleCartCheck = (foodId: string): void => {
  setState((prev) => {
    const newCart = prev.cartItems.map((item) =>
      item.id === foodId ? { ...item, checked: !item.checked } : item
    );
    syncToStorage(STORAGE_KEY_CART, newCart);
    return { ...prev, cartItems: newCart };
  });
};

export const toggleAllCartCheck = (checked: boolean): void => {
  setState((prev) => {
    const newCart = prev.cartItems.map((item) => ({ ...item, checked }));
    syncToStorage(STORAGE_KEY_CART, newCart);
    return { ...prev, cartItems: newCart };
  });
};

export const removeCheckedFromCart = (): void => {
  setState((prev) => {
    const newCart = prev.cartItems.filter((item) => !item.checked);
    syncToStorage(STORAGE_KEY_CART, newCart);
    return { ...prev, cartItems: newCart };
  });
};

export const addAddress = (address: Omit<Address, 'id'>): void => {
  console.log('[UiStore] Saving new address:', address);
  setState((prev) => {
    const newAddress: Address = {
      ...address,
      id: Math.random().toString(36).substring(2, 9),
    };
    const newAddresses = [...prev.addresses, newAddress];
    // Set as active if it's the first or just auto-set it regardless for better UX
    const newActiveId = newAddress.id;
    
    syncToStorage(STORAGE_KEY_ACTIVE_ADDRESS_ID, newActiveId);
    syncToStorage(STORAGE_KEY_ADDRESSES, newAddresses);
    
    console.log('[UiStore] New address count:', newAddresses.length);
    return { ...prev, addresses: newAddresses, activeAddressId: newActiveId };
  });
};

export const updateAddress = (id: string, updates: Partial<Address>): void => {
  console.log('[UiStore] Updating address:', id, updates);
  setState((prev) => {
    const newAddresses = prev.addresses.map((a) => (a.id === id ? { ...a, ...updates } : a));
    syncToStorage(STORAGE_KEY_ADDRESSES, newAddresses);
    return { ...prev, addresses: newAddresses };
  });
};

export const setActiveAddress = (id: string | null): void => {
  setState((prev) => {
    syncToStorage(STORAGE_KEY_ACTIVE_ADDRESS_ID, id);
    return { ...prev, activeAddressId: id };
  });
};

export const removeAddress = (id: string): void => {
  setState((prev) => {
    const newAddresses = prev.addresses.filter((addr) => addr.id !== id);
    let newActiveId = prev.activeAddressId;
    if (newActiveId === id) {
      newActiveId = newAddresses.length > 0 ? newAddresses[0].id : null;
      syncToStorage(STORAGE_KEY_ACTIVE_ADDRESS_ID, newActiveId);
    }
    syncToStorage(STORAGE_KEY_ADDRESSES, newAddresses);
    return { ...prev, addresses: newAddresses, activeAddressId: newActiveId };
  });
};

export const addOrder = (order: Order): void => {
  setState((prev) => {
    const newOrders = [order, ...prev.orders]; // New orders on top
    syncToStorage(STORAGE_KEY_ORDERS, newOrders);
    return { ...prev, orders: newOrders };
  });
};

export const clearOrders = (): void => {
  setState((prev) => ({ ...prev, orders: [] }));
  syncToStorage(STORAGE_KEY_ORDERS, []);
};

export const updateOrderStatus = (orderId: string, status: Order['status']): void => {
  setState((prev) => {
    const newOrders = prev.orders.map((o) =>
      o.id === orderId ? { ...o, status } : o
    );
    syncToStorage(STORAGE_KEY_ORDERS, newOrders);
    return { ...prev, orders: newOrders };
  });
};

export const setOrders = (orders: Order[]): void => {
  setState((prev) => {
    syncToStorage(STORAGE_KEY_ORDERS, orders);
    return { ...prev, orders };
  });
};

export const subscribeUiStore = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getUiStoreSnapshot = (): UiState => state;

export const useUiStore = (): UiState =>
  useSyncExternalStore(subscribeUiStore, getUiStoreSnapshot, getUiStoreSnapshot);
