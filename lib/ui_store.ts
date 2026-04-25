import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AuthUser } from './auth_api';
import { useSyncExternalStore } from 'react';
import { getDistanceKm } from './google_location';

type CartItem = {
  id: string;
  quantity: number;
  checked: boolean;
  title?: string;
  price?: string;
  image?: any;
  description?: string;
};

type CartUpdateResult = {
  ok: boolean;
  quantity: number;
  maxQuantity: number | null;
  message?: string;
};

export type Address = {
  id: string;
  fullAddress: string;
  street: string;
  barangay: string;
  subdivision?: string;
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

export type SelectedBranch = {
  id: number;
  name: string;
  address: string;
  distance_km?: number;
  is_available?: boolean;
  latitude?: number;
  longitude?: number;
  delivery_radius_km?: number;
  status?: 'open' | 'closed';
  status_text?: string;
};

type UiState = {
  userId: number | null;
  favorites: string[];
  cartItems: CartItem[];
  addresses: Address[];
  orders: Order[];
  activeAddressId: string | null;
  isCartCollapsed: boolean;
  selectedBranch: SelectedBranch | null;
  orderMode: 'delivery' | 'pickup';
  isLocationLoading: boolean;
  user: AuthUser | null;
  sessionStatus: 'idle' | 'validating' | 'authorized' | 'expired' | 'unauthorized';
  riderStatus: 'available' | 'busy' | 'offline';
};

const initialState: UiState = {
  userId: null,
  favorites: [],
  cartItems: [],
  addresses: [],
  orders: [],
  activeAddressId: null,
  isCartCollapsed: false,
  selectedBranch: null,
  orderMode: 'delivery',
  isLocationLoading: false,
  user: null,
  sessionStatus: 'idle',
  riderStatus: 'offline',
};

const STORAGE_KEY_FAVORITES = 'maki_favorites';
const STORAGE_KEY_CART = 'maki_cart_items';
const STORAGE_KEY_ADDRESSES = 'maki_addresses';
const STORAGE_KEY_ACTIVE_ADDRESS_ID = 'maki_active_address_id';
const STORAGE_KEY_ORDERS = 'maki_orders';
const STORAGE_KEY_SELECTED_BRANCH = 'maki_selected_branch';
const PLUS_CODE_REGEX = /\b[A-Z0-9]{2,8}\+[A-Z0-9]{2,}\b/i;
const GENERIC_LABEL_REGEX = /\b(current\s*location|unknown|unnamed|pin\s*location)\b/i;

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
    sessionStatus: userId ? 'authorized' : 'unauthorized',
  }));
  if (userId) {
    AsyncStorage.setItem('current_user_id', String(userId)).catch(console.error);
  } else {
    AsyncStorage.removeItem('current_user_id').catch(console.error);
  }
};

export const setUser = (user: AuthUser | null): void => {
  setState((prev) => ({ ...prev, user }));
};

export const hydrateSession = async (): Promise<void> => {
    const token = await SecureStore.getItemAsync('auth_token');
    const cachedProfile = await AsyncStorage.getItem('user_profile');
    
    if (token) {
      if (cachedProfile) {
        setState(prev => ({ 
          ...prev, 
          sessionStatus: 'authorized', 
          user: JSON.parse(cachedProfile) 
        }));
      } else {
        setState((prev) => ({ ...prev, sessionStatus: 'authorized' }));
      }
    } else {
      setState((prev) => ({ ...prev, sessionStatus: 'unauthorized' }));
    }
};

export const setSessionStatus = (status: UiState['sessionStatus']): void => {
  setState((prev) => ({ ...prev, sessionStatus: status }));
};

export const setRiderStatus = (status: UiState['riderStatus']): void => {
  setState((prev) => ({ ...prev, riderStatus: status }));
};

export const logoutUser = async (): Promise<void> => {
  // Attempt to notify backend to destroy token and set offline status
  try {
    const api = (await import('./api')).default;
    await api.post('logout');
  } catch (error) {
    console.debug('[Logout] Could not sync logout to backend', error);
  }

  // Clear all auth-related storage
  await Promise.all([
    SecureStore.deleteItemAsync('auth_token'),
    AsyncStorage.removeItem('current_user_id'),
    AsyncStorage.removeItem('user_profile'),
    AsyncStorage.removeItem('user_role'),
    AsyncStorage.removeItem(STORAGE_KEY_CART),
    AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_ADDRESS_ID),
  ]);

  // Reset state to initial (except maybe non-auth preferences if any)
  setState((prev) => ({
    ...initialState,
    sessionStatus: 'unauthorized',
    riderStatus: 'offline', // Enforce offline upon logout
  }));
};

export const isAddressInServiceArea = (address: Address | null | undefined): boolean => {
  if (!address) return false;
  const prov = (address.province || '').toLowerCase();
  const city = (address.city || '').toLowerCase();
  // Service area is Laguna province
  return prov.includes('laguna') || city.includes('laguna');
};

export const setSelectedBranch = (branch: SelectedBranch | null): void => {
  setState((prev) => ({
    ...prev,
    selectedBranch: branch,
  }));

  if (branch) {
    syncToStorage(STORAGE_KEY_SELECTED_BRANCH, branch);
  } else {
    AsyncStorage.removeItem(STORAGE_KEY_SELECTED_BRANCH).catch(console.error);
  }
};

export const setOrderMode = (mode: 'delivery' | 'pickup'): void => {
  setState((prev) => ({ ...prev, orderMode: mode }));
};

export const setIsLocationLoading = (loading: boolean): void => {
  setState((prev) => ({ ...prev, isLocationLoading: loading }));
};

export const validateCartAgainstMenu = (menuItems: any[]): { removedCount: number } => {
  const currentCart = state.cartItems;
  // Keep items that exist in current menu, are available at the branch, and have stock
  const validItems = currentCart.filter(cartItem => {
    const menuItem = menuItems.find(m => String(m.id) === String(cartItem.id));
    const isStillAvailable = menuItem && menuItem.is_available && (menuItem.stock ?? 0) > 0;
    return !!isStillAvailable;
  });
  
  const removedCount = currentCart.length - validItems.length;
  if (removedCount > 0) {
    setState(prev => ({ ...prev, cartItems: validItems }));
    // Sync using the helper from top of file
    AsyncStorage.setItem('maki_cart_items', JSON.stringify(validItems)).catch(console.error);
  }
  return { removedCount };
};

// Initialize store from storage
const initFromStorage = async () => {
  try {
    const [userId, favorites, cart, addresses, activeAddressId, orders, selectedBranch] = await Promise.all([
      AsyncStorage.getItem('current_user_id'),
      AsyncStorage.getItem(STORAGE_KEY_FAVORITES),
      AsyncStorage.getItem(STORAGE_KEY_CART),
      AsyncStorage.getItem(STORAGE_KEY_ADDRESSES),
      AsyncStorage.getItem(STORAGE_KEY_ACTIVE_ADDRESS_ID),
      AsyncStorage.getItem(STORAGE_KEY_ORDERS),
      AsyncStorage.getItem(STORAGE_KEY_SELECTED_BRANCH),
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
      selectedBranch: selectedBranch ? JSON.parse(selectedBranch) : null,
    }));
  } catch (e) {
    console.error('Failed to load store from storage:', e);
  }
};

initFromStorage();

const syncToStorage = (key: string, value: any) => {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(console.error);
};

const stripPlusCode = (value: string): string =>
  String(value || '')
    .replace(PLUS_CODE_REGEX, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .trim();
const normalizeAddressPart = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .replace(/barangay|brgy|\.?\s+|[^a-z0-9]/gi, '')
    .trim();
const areaContains = (source: string, token: string): boolean => {
  const s = normalizeAddressPart(source);
  const t = normalizeAddressPart(token);
  if (!s || !t) return false;
  if (s === t) return true;
  return t.length >= 5 && s.includes(t);
};
const uniqueAreaParts = (parts: string[]): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();

  parts.forEach((part) => {
    const cleaned = stripPlusCode(part)
      .replace(/\s*,\s*/g, ', ')
      .replace(/,{2,}/g, ',')
      .replace(/^,\s*|\s*,$/g, '')
      .trim();
    if (!cleaned) return;

    const key = normalizeAddressPart(cleaned);
    if (!key || seen.has(key)) return;
    if (result.some((existing) => areaContains(existing, cleaned))) return;

    seen.add(key);
    result.push(cleaned);
  });

  return result;
};

const isInvalidLabel = (label: string): boolean => {
  const clean = stripPlusCode(label);
  return (
    !clean ||
    clean.length < 6 ||
    PLUS_CODE_REGEX.test(String(label || '')) ||
    GENERIC_LABEL_REGEX.test(clean)
  );
};

const getAddressLabel = (address: Address): string =>
  stripPlusCode(
    address.fullAddress ||
      address.subdivision ||
      address.street ||
      address.barangay ||
      address.city ||
      ''
  );

const hasLandmarkFallback = (address: Address): boolean => {
  const notes = String(address.notes || '').toLowerCase();
  if (notes.includes('landmark-fallback')) return true;
  const landmarkCandidate = stripPlusCode(address.subdivision || address.street || '');
  return !!landmarkCandidate && !isInvalidLabel(landmarkCandidate);
};

const pickLandmarkName = (address: Address): string => {
  const candidates = [
    address.subdivision,
    address.street,
    address.fullAddress,
  ]
    .map((value) => stripPlusCode(String(value || '').split('\n')[0] || ''))
    .filter(Boolean);

  const valid = candidates.find((value) => !isInvalidLabel(value));
  return valid || '';
};

export const formatAddressForDisplay = (address: Address): string => {
  const landmark = pickLandmarkName(address);
  const area = uniqueAreaParts([
    stripPlusCode(address.barangay || ''),
    stripPlusCode(address.city || ''),
    stripPlusCode(address.province || ''),
  ]).join(', ');

  if (landmark && area && !areaContains(landmark, area)) {
    return `${landmark}, ${area}`;
  }
  if (landmark) return landmark;

  const full = stripPlusCode(address.fullAddress || '');
  if (full && !isInvalidLabel(full)) return full;

  return area || 'Unnamed Location';
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

export const addToCart = (
  foodId: string,
  quantity: number = 1,
  maxQuantity?: number | null,
  productDetails?: Partial<Omit<CartItem, 'id' | 'quantity' | 'checked'>>
): CartUpdateResult => {
  const increment = Math.max(1, Math.floor(quantity));
  let result: CartUpdateResult = {
    ok: true,
    quantity: increment,
    maxQuantity: maxQuantity ?? null,
  };

  setState((prev) => {
    const existing = prev.cartItems.find((item) => item.id === foodId);
    const existingQty = existing?.quantity ?? 0;
    const proposedQty = existingQty + increment;
    const hasMax = maxQuantity != null && Number.isFinite(Number(maxQuantity)) && Number(maxQuantity) > 0;
    const max = hasMax ? Math.floor(Number(maxQuantity)) : null;
    const finalQty = max !== null ? Math.min(proposedQty, max) : proposedQty;

    if (max !== null && proposedQty > max) {
      result = {
        ok: false,
        quantity: finalQty,
        maxQuantity: max,
        message: 'Maximum available quantity reached',
      };
    } else {
      result = {
        ok: true,
        quantity: finalQty,
        maxQuantity: max,
      };
    }

    let newCart;
    if (existing) {
      newCart = prev.cartItems.map((item) =>
        item.id === foodId ? { ...item, quantity: finalQty, ...productDetails } : item
      );
    } else {
      if (finalQty <= 0) {
        return prev;
      }
      newCart = [
        ...prev.cartItems,
        {
          id: foodId,
          quantity: finalQty,
          checked: true,
          ...productDetails
        }
      ];
    }

    syncToStorage(STORAGE_KEY_CART, newCart);
    return {
      ...prev,
      cartItems: newCart,
      isCartCollapsed: false,
    };
  });

  return result;
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

export const updateCartQuantity = (
  foodId: string,
  quantity: number,
  maxQuantity?: number | null,
  productDetails?: Partial<Omit<CartItem, 'id' | 'quantity' | 'checked'>>
): CartUpdateResult => {
  if (quantity <= 0) {
    removeFromCart(foodId);
    return {
      ok: true,
      quantity: 0,
      maxQuantity: maxQuantity ?? null,
    };
  }
  const normalizedTarget = Math.max(1, Math.floor(quantity));
  const hasMax = maxQuantity != null && Number.isFinite(Number(maxQuantity)) && Number(maxQuantity) > 0;
  const max = hasMax ? Math.floor(Number(maxQuantity)) : null;
  const finalQty = max !== null ? Math.min(normalizedTarget, max) : normalizedTarget;
  const hitMax = max !== null && normalizedTarget > max;

  if (finalQty <= 0) {
    removeFromCart(foodId);
    return {
      ok: false,
      quantity: 0,
      maxQuantity: max,
      message: 'Maximum available quantity reached',
    };
  }

  setState((prev) => {
    const newCart = prev.cartItems.map((item) =>
      item.id === foodId ? { ...item, quantity: finalQty, ...productDetails } : item
    );
    syncToStorage(STORAGE_KEY_CART, newCart);
    return { ...prev, cartItems: newCart };
  });

  return {
    ok: !hitMax,
    quantity: finalQty,
    maxQuantity: max,
    message: hitMax ? 'Maximum available quantity reached' : undefined,
  };
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

export const getActiveAddress = (): Address | null => {
  const { addresses, activeAddressId } = state;
  return addresses.find((a) => a.id === activeAddressId) || null;
};

type ResolveActiveInput = {
  latitude: number;
  longitude: number;
};

export const resolveAndSetBestActiveAddress = (
  currentLocation: ResolveActiveInput
): string | null => {
  const { addresses, activeAddressId } = state;
  if (!addresses.length) {
    setActiveAddress(null);
    return null;
  }

  const currentActive = addresses.find((addr) => addr.id === activeAddressId) || null;
  const keepCurrentManual =
    !!currentActive &&
    currentActive.id !== AUTO_DETECTED_ADDRESS_ID &&
    !isInvalidLabel(getAddressLabel(currentActive));
  if (keepCurrentManual) {
    return currentActive.id;
  }

  const withCoords = addresses.filter(
    (addr) =>
      Number.isFinite(Number(addr.latitude)) && Number.isFinite(Number(addr.longitude))
  );

  const ranked = withCoords
    .map((addr) => {
      const label = getAddressLabel(addr);
      return {
        addr,
        distanceKm: getDistanceKm(
          currentLocation.latitude,
          currentLocation.longitude,
          Number(addr.latitude),
          Number(addr.longitude)
        ),
        isValid: !isInvalidLabel(label),
        isFallback: hasLandmarkFallback(addr),
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearestValid = ranked.find(
    (item) => item.isValid && item.addr.id !== AUTO_DETECTED_ADDRESS_ID
  );
  const nearestAutoValid = ranked.find(
    (item) => item.isValid && item.addr.id === AUTO_DETECTED_ADDRESS_ID
  );
  const nearestFallback = ranked.find((item) => item.isFallback);
  const best = nearestValid || nearestAutoValid || nearestFallback || ranked[0];

  if (best?.addr?.id) {
    setActiveAddress(best.addr.id);
    return best.addr.id;
  }

  const nonPlusCode = addresses.find((addr) => !isInvalidLabel(getAddressLabel(addr)));
  if (nonPlusCode?.id) {
    setActiveAddress(nonPlusCode.id);
    return nonPlusCode.id;
  }

  const fallbackId = addresses[0]?.id || null;
  setActiveAddress(fallbackId);
  return fallbackId;
};

type AutoDetectedAddressPayload = {
  latitude: number;
  longitude: number;
  street: string;
  barangay?: string;
  subdivision?: string;
  city: string;
  province: string;
  fullAddress: string;
};

const AUTO_DETECTED_ADDRESS_ID = 'gps-auto-address';

export const upsertAutoDetectedAddress = (
  payload: AutoDetectedAddressPayload
): void => {
  setState((prev) => {
    const fullAddressRaw = stripPlusCode(payload.fullAddress || '');
    const streetRaw = stripPlusCode(payload.street || '');
    const subdivision = stripPlusCode(payload.subdivision || '');
    const barangay = stripPlusCode(payload.barangay || '');
    const city = stripPlusCode(payload.city || '');
    const province = stripPlusCode(payload.province || '');
    const area = [barangay, city, province].filter(Boolean).join(', ');
    const landmark = !isInvalidLabel(subdivision) ? subdivision : '';
    const street = !isInvalidLabel(streetRaw) ? streetRaw : (landmark || streetRaw || 'Current Location');
    const composedFromLandmark = [landmark, area].filter(Boolean).join('\n');
    const fullAddress = !isInvalidLabel(fullAddressRaw)
      ? fullAddressRaw
      : (composedFromLandmark || [street, area].filter(Boolean).join(', ') || 'Current Location');
    const usedLandmarkFallback =
      !!landmark && (isInvalidLabel(streetRaw) || isInvalidLabel(fullAddressRaw));

    const normalizedAddress: Address = {
      id: AUTO_DETECTED_ADDRESS_ID,
      street: street || 'Current Location',
      barangay,
      subdivision,
      city,
      province,
      notes: usedLandmarkFallback ? 'landmark-fallback' : 'Auto-detected from GPS',
      latitude: payload.latitude,
      longitude: payload.longitude,
      fullAddress,
    };

    const hasExisting = prev.addresses.some((address) => address.id === AUTO_DETECTED_ADDRESS_ID);
    const nextAddresses = hasExisting
      ? prev.addresses.map((address) =>
          address.id === AUTO_DETECTED_ADDRESS_ID ? normalizedAddress : address
        )
      : [normalizedAddress, ...prev.addresses];

    syncToStorage(STORAGE_KEY_ADDRESSES, nextAddresses);
    // Do not force active here; login flow resolves best active using fresh GPS.

    return {
      ...prev,
      addresses: nextAddresses,
      activeAddressId: prev.activeAddressId,
    };
  });
};

export const setAddressFromPlace = async (place: any): Promise<string | null> => {
  const lat = place.geometry.location.lat;
  const lng = place.geometry.location.lng;
  const fullAddress = place.formatted_address;
  
  // Extract components
  const components = place.address_components || [];
  const getComp = (types: string[]) => components.find((c: any) => types.some(t => c.types.includes(t)))?.long_name || '';
  
  const street = getComp(['route', 'street_number']) || getComp(['establishment', 'point_of_interest']) || 'Selected Location';
  const barangay = getComp(['sublocality_level_1', 'sublocality', 'neighborhood']);
  const city = getComp(['locality', 'postal_town', 'administrative_area_level_3']);
  const province = getComp(['administrative_area_level_2', 'administrative_area_level_1']);
  
  const id = `place-${place.place_id}`;
  
  const newAddress: Address = {
    id,
    fullAddress,
    street,
    barangay: barangay || '',
    city: city || '',
    province: province || '',
    notes: 'Selected via search',
    latitude: lat,
    longitude: lng,
  };
  
  setState((prev) => {
    const hasExisting = prev.addresses.some(a => a.id === id);
    const nextAddresses = hasExisting 
      ? prev.addresses.map(a => a.id === id ? newAddress : a)
      : [newAddress, ...prev.addresses];
      
    syncToStorage(STORAGE_KEY_ADDRESSES, nextAddresses);
    syncToStorage(STORAGE_KEY_ACTIVE_ADDRESS_ID, id);
    
    return { ...prev, addresses: nextAddresses, activeAddressId: id };
  });
  
  return id;
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
