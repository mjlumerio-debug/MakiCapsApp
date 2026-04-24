import { requestJson } from '@/lib/api_client';
import api, { getApiBaseUrl } from '@/lib/api';
import { getUiStoreSnapshot, setSelectedBranch } from '@/lib/ui_store';
import { useSyncExternalStore } from 'react';
import type { ImageSourcePropType } from 'react-native';

export type Category = {
  id: string;
  name: string;
  image_path?: string;
};

export type Food = {
  id: string;
  title: string;
  image: ImageSourcePropType | null;
  calories: string;
  price: string;
  category: string;
  description: string;
  stock?: number;
  max_quantity?: number;
  is_available: boolean;
};

type MenuState = {
  categories: Category[];
  menuItems: Food[];
  dbConnected: boolean;
  lastError: string | null;
};

const initialState: MenuState = {
  categories: [],
  menuItems: [],
  dbConnected: false,
  lastError: null,
};

type AddMenuPayload = {
  title: string;
  category: string;
  price: string;
  calories?: string;
  description?: string;
  image: ImageSourcePropType;
  imageKey?: string;
};

type UpdateMenuPayload = Partial<
  Pick<Food, 'title' | 'category' | 'price' | 'calories' | 'image'>
> & {
  imageKey?: string;
  description?: string;
};

type ApiCategory = {
  id: number;
  name: string;
  image_path?: string | null;
  image_url?: string | null;
};

type ApiMenuItem = {
  id: number;
  title?: string;
  name?: string;
  branch?: { id?: number | string } | null;
  branch_id?: number | string;
  branchId?: number | string;
  price?: number | string;
  selling_price?: number | string;
  calories?: number | null;
  image_url?: string | null;
  image_path?: string | null;
  image?: string | null;
  category_name?: string;
  category?: string;
  category_id?: number | string | null;
  category_id_?: number | string | null;
  ingredients?: string | null;
  description?: string | null;
  stock?: number | string | null;
  available_stock?: number | string | null;
  dynamic_stock?: number | string | null;
  computed_stock?: number | string | null;
  current_stock?: number | string | null;
  stock_quantity?: number | string | null;
  max_quantity?: number | string | null;
  is_available?: boolean | number | string | null;
};

type ImageOption = {
  key: string;
  label: string;
  image: ImageSourcePropType | null;
};

const REQUEST_TIMEOUT_MS = 7000;

const menuImageUrls: Record<string, string> = {
  'menu-tonkotsu-ramen.jpg': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80',
  'menu-shoyu-ramen.jpg': 'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?w=800&q=80',
  'menu-salmon-sushi.jpg': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80',
  'menu-tuna-nigiri.jpg': 'https://images.unsplash.com/photo-1617196034496-64ac796002bb?w=800&q=80',
  'menu-shrimp-tempura.jpg': 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&q=80',
  'menu-vegetable-tempura.jpg': 'https://images.unsplash.com/photo-1548507200-3b8a7f7e1d64?w=800&q=80',
  'menu-chicken-bento.jpg': 'https://images.unsplash.com/photo-1517244492177-33989047721d?w=800&q=80',
  'menu-beef-bento.jpg': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
  'menu-mochi-trio.jpg': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80',
  'menu-matcha-dorayaki.jpg': 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80',
};

export const ingredientImages: Record<string, string> = {
  'tomato': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80',
  'lettuce': 'https://images.unsplash.com/photo-1622206148282-b3d41335bfdb?w=200&q=80',
  'cheese': 'https://images.unsplash.com/photo-1486297678162-ad2a19b05844?w=200&q=80',
  'onion': 'https://images.unsplash.com/photo-1508747703725-7197771375a0?w=200&q=80',
  'meat': 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=200&q=80',
  'salmon': 'https://images.unsplash.com/photo-1599084993091-1cb5c032174c?w=200&q=80',
  'shrimp': 'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=200&q=80',
  'ramen': 'https://images.unsplash.com/photo-1557872228-525a488e390c?w=200&q=80',
};

const resolveImage = (imageUrl: string | null | undefined): ImageSourcePropType | null => {
  if (!imageUrl) {
    return null;
  }

  // Handle local keys or filenames
  const normalized = (imageUrl.split('/').pop() || imageUrl).toLowerCase();

  // Direct match in our curated list
  if (menuImageUrls[normalized]) {
    return { uri: menuImageUrls[normalized] };
  }

  // Handle keys without extensions
  const keyWithExt = `${normalized}.jpg`;
  if (menuImageUrls[keyWithExt]) {
    return { uri: menuImageUrls[keyWithExt] };
  }

  // Resolve paths and attempt to dynamically fix any dead server IPs
  const resolvedPath = resolveImagePath(imageUrl);
  if (resolvedPath) {
    return { uri: resolvedPath };
  }

  // Default fallback
  return null;
};

let state: MenuState = initialState;
const listeners = new Set<() => void>();
let hasLoadedFromDatabase = false;
let isRefreshing = false;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const waitForRefreshToSettle = async (timeoutMs = 3000): Promise<void> => {
  let waited = 0;
  while (isRefreshing && waited < timeoutMs) {
    await wait(120);
    waited += 120;
  }
};

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const setState = (updater: (prev: MenuState) => MenuState): void => {
  state = updater(state);
  emit();
};

const formatPeso = (raw: number | string): string => {
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (Number.isNaN(n) || n <= 0) return '\u20B10.00';
  return `\u20B1${n.toFixed(2)}`;
};

const parseCalories = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0 kcal';
  const n = Number(value);
  if (Number.isNaN(n)) return '0 kcal';
  return `${Math.round(n)} kcal`;
};

const resolveImagePath = (imagePath: string | null | undefined): string | undefined => {
  if (!imagePath) return undefined;
  const serverRoot = getApiBaseUrl().replace(/\/api\/v1\/?$/, '');

  // If it's already a full URL, attempt to fix mismatched local IP addresses stored in the DB
  if (imagePath.startsWith('http')) {
    const storageIndex = imagePath.indexOf('/storage/');
    if (storageIndex !== -1) {
      // Re-map it dynamically to whatever the current EXPO_PUBLIC_API_URL serverRoot is!
      const pathPart = imagePath.substring(storageIndex + 1); // "storage/..."
      return `${serverRoot}/${pathPart}`;
    }
    return imagePath;
  }

  // Handle paths like 'categories/image.png' or '/storage/categories/image.png'
  const cleanPath = imagePath.replace(/^\/+/, '');
  if (cleanPath.startsWith('storage/')) {
    return `${serverRoot}/${cleanPath}`;
  }
  return `${serverRoot}/storage/${cleanPath}`;
};

const normalizeCategories = (categories: ApiCategory[]): Category[] => {
  const mapped = categories.map((item) => ({
    id: String(item.id),
    name: item.name,
    image_path: resolveImagePath(item.image_path),
  }));

  const hasAll = mapped.some((item) => item.name.toLowerCase() === 'all');
  return hasAll ? mapped : [{ id: 'all', name: 'All' }, ...mapped];
};



const getArrayPayload = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.products)) return value.products;
  if (Array.isArray(value?.data?.products)) return value.data.products;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.data)) return value.data.data;
  if (Array.isArray(value?.data?.rows)) return value.data.rows;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  if (Array.isArray(value?.products?.data)) return value.products.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};

const extractResponseBranchId = (value: any): number | null => {
  const branchId =
    value?.selected_branch_id ??
    value?.branch_id ??
    value?.branch?.id ??
    value?.data?.branch?.id ??
    value?.selected_branch?.id ??
    value?.data?.branch_id;
  const numeric = Number(branchId);
  return Number.isFinite(numeric) ? numeric : null;
};

const extractResponseProductsCount = (value: any): number | null => {
  const count =
    value?.products_count ??
    value?.data?.products_count ??
    (Array.isArray(value?.products) ? value.products.length : null) ??
    (Array.isArray(value?.data?.products) ? value.data.products.length : null);
  const numeric = Number(count);
  return Number.isFinite(numeric) ? numeric : null;
};

const extractBranchId = (row: ApiMenuItem): number | null => {
  const direct = row.branch_id ?? row.branchId ?? row.branch?.id;
  const numeric = Number(direct);
  return Number.isFinite(numeric) ? numeric : null;
};

const filterRowsByBranchId = (rows: ApiMenuItem[], branchId: number | null): ApiMenuItem[] => {
  if (!branchId) return rows;
  // Strict mode: only keep rows that explicitly match selected branch id.
  // This prevents mixed products from multiple branches.
  return rows.filter((row) => extractBranchId(row) === branchId);
};

const mapApiMenuItems = (
  rows: ApiMenuItem[],
  categories: ApiCategory[]
): Food[] => {
  const categoryNameById = new Map<string, string>();
  categories.forEach((cat) => {
    categoryNameById.set(String(cat.id), cat.name);
  });

  return rows.map((row) => {
    const descriptionText = row.description || row.ingredients || '';
    const categoryId = row.category_id ?? row.category_id_;
    const categoryFromId = categoryId !== null && categoryId !== undefined
      ? categoryNameById.get(String(categoryId))
      : undefined;
    const maxQuantityCandidate =
      row.max_quantity ??
      row.available_stock ??
      row.dynamic_stock ??
      row.computed_stock ??
      row.current_stock ??
      row.stock_quantity ??
      row.stock;
    const parsedMaxQuantity = Number(maxQuantityCandidate);
    const hasNumericMaxQuantity = Number.isFinite(parsedMaxQuantity);
    const availabilityText = String(row.is_available ?? '').toLowerCase();
    const inferredAvailability =
      row.is_available === true ||
      row.is_available === 1 ||
      row.is_available === '1' ||
      availabilityText === 'true' ||
      availabilityText === 'available' ||
      availabilityText === 'in_stock';
    const normalizedMaxQuantity = hasNumericMaxQuantity
      ? Math.max(0, parsedMaxQuantity)
      : (inferredAvailability ? 1 : 0);

    return {
      id: String(row.id),
      title: row.name || row.title || 'Product',
      image: resolveImage(row.image_path || row.image || row.image_url),
      calories: parseCalories(row.calories),
      price: formatPeso(row.selling_price !== undefined ? row.selling_price : (row.price || 0)),
      category: row.category || row.category_name || categoryFromId || 'All',
      description: descriptionText,
      stock: normalizedMaxQuantity,
      max_quantity: normalizedMaxQuantity,
      is_available: inferredAvailability,
    };
  });
};

const getImageKeyFromSource = (image: ImageSourcePropType): string => {
  const keys = Object.keys(menuImageUrls);
  for (const key of keys) {
    if (menuImageUrls[key] === (image as { uri: string }).uri) {
      return key;
    }
  }
  return 'menu-tonkotsu-ramen.jpg';
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> =>
  requestJson<T>(path, init, {
    timeoutMs: REQUEST_TIMEOUT_MS,
    retryOnHttp5xx: true,
  });



export const refreshMenuStore = async (): Promise<boolean> => {
  if (isRefreshing) return state.dbConnected;
  isRefreshing = true;
  try {
    const uiState = getUiStoreSnapshot();
    const activeAddress = uiState.addresses.find(a => a.id === uiState.activeAddressId);
    const selectedBranch = uiState.selectedBranch;
    const selectedBranchId = selectedBranch?.id ?? null;

    // Get coordinates from active address first, then selected branch as fallback.
    const lat = activeAddress?.latitude ?? selectedBranch?.latitude;
    const lng = activeAddress?.longitude ?? selectedBranch?.longitude;

    // Master catalog mode: Allow fetching even without coordinates if backend supports it
    // or if we want to show a "Soft Menu" preview.
    const hasCoordinates = lat !== undefined && lng !== undefined;

    // Fetch categories from the Laravel API
    let fetchedCategories: ApiCategory[] = [];
    try {
      const catResponse = await api.get('/categories', {
        params: selectedBranchId ? { branch_id: selectedBranchId } : (lat && lng ? { lat, lng } : undefined),
      });
      const catData = catResponse.data;
      const catArray = Array.isArray(catData) ? catData : (catData.data || catData.categories || []);
      if (Array.isArray(catArray) && catArray.length > 0) {
        fetchedCategories = catArray.map((c: any) => ({
          id: c.id,
          name: c.name,
          image_path: c.image_url || c.image_path || null,
        }));
      }
    } catch (catError) {
      if (__DEV__) {
        console.log('Failed to fetch categories from API:', catError);
      }
    }

    // Fetch products from the Laravel API using location-based detection
    let fetchedMenuItems: ApiMenuItem[] = [];
    let apiBranchInfo: any = null;

    try {
      const params: any = {};
      if (hasCoordinates) {
        params.lat = lat;
        params.lng = lng;
      }

      if (selectedBranchId) {
        params.branch_id = selectedBranchId;
      }

      if (__DEV__) {
        console.log('[MenuStore] Fetching products via params:', params);
      }

      const response = await api.get('/customer/products', { params });
      const payload = response.data;
      
      // Use API response products directly (No manual filtering)
      const rows = getArrayPayload(payload) as ApiMenuItem[];
      
      apiBranchInfo = payload.branch || payload.data?.branch || null;

      // If backend returned a branch, update ui_store
      if (apiBranchInfo && apiBranchInfo.id) {
        setSelectedBranch({
          id: Number(apiBranchInfo.id),
          name: apiBranchInfo.name,
          address: apiBranchInfo.address,
          latitude: apiBranchInfo.latitude ? Number(apiBranchInfo.latitude) : undefined,
          longitude: apiBranchInfo.longitude ? Number(apiBranchInfo.longitude) : undefined,
          delivery_radius_km: apiBranchInfo.delivery_radius_km ? Number(apiBranchInfo.delivery_radius_km) : undefined,
        });
      }

      // No more local filtering - use exactly what the backend sends
      fetchedMenuItems = rows;

      if (__DEV__) {
        console.log('[MenuStore] Products loaded from API:', fetchedMenuItems.length);
      }
    } catch (error) {
      if (__DEV__) {
        console.log('[MenuStore] API Request FAILED:', error);
      }
    }

    setState((prev) => ({
      ...prev,
      categories: normalizeCategories(fetchedCategories),
      menuItems: mapApiMenuItems(fetchedMenuItems, fetchedCategories),
      dbConnected: true,
      lastError: null,
    }));
    hasLoadedFromDatabase = true;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setState((prev) => ({
      ...prev,
      dbConnected: false,
      lastError: message,
    }));
    return false;
  } finally {
    isRefreshing = false;
  }
};

export const reconnectMenuStore = async (): Promise<boolean> => {
  await waitForRefreshToSettle();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ok = await refreshMenuStore();
    if (ok) return true;
    if (attempt < 2) {
      await wait(350);
    }
  }

  return false;
};

export const ensureMenuStoreLoaded = async (): Promise<void> => {
  if (hasLoadedFromDatabase) return;
  await refreshMenuStore();
};

export const addCategory = async (name: string): Promise<void> => {
  const clean = name.trim();
  if (!clean) return;

  try {
    await request<ApiCategory>('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: clean }),
    });
    await refreshMenuStore();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setState((prev) => ({
      ...prev,
      dbConnected: false,
      lastError: message,
    }));
    if (__DEV__) {
      console.log('addCategory failed:', error);
    }
    throw error;
  }
};

export const addMenuItem = async (payload: AddMenuPayload): Promise<void> => {
  const title = payload.title.trim();
  const category = payload.category.trim();
  if (!title || !category) return;

  const imageKey = payload.imageKey || getImageKeyFromSource(payload.image);

  try {
    await request<ApiMenuItem>('/api/menu-items', {
      method: 'POST',
      body: JSON.stringify({
        title,
        category_name: category,
        price: payload.price,
        calories: payload.calories || null,
        image_url: imageKey,
        ingredients: payload.description || null,
      }),
    });
    await refreshMenuStore();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setState((prev) => ({
      ...prev,
      dbConnected: false,
      lastError: message,
    }));
    if (__DEV__) {
      console.log('addMenuItem failed:', error);
    }
    throw error;
  }
};

export const updateMenuItem = async (
  id: string,
  updates: UpdateMenuPayload
): Promise<void> => {
  try {
    await request<ApiMenuItem>(`/api/menu-items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: updates.title,
        category_name: updates.category,
        price: updates.price,
        calories: updates.calories,
        image_url: updates.imageKey || (updates.image ? getImageKeyFromSource(updates.image) : undefined),
        ingredients: updates.description,
      }),
    });
    await refreshMenuStore();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setState((prev) => ({
      ...prev,
      dbConnected: false,
      lastError: message,
    }));
    if (__DEV__) {
      console.log('updateMenuItem failed:', error);
    }
    throw error;
  }
};

export const localMenuImageOptions: ImageOption[] = Object.keys(menuImageUrls).map((key) => ({
  key,
  label: key
    .replace('menu-', '')
    .replace('.jpg', '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' '),
  image: resolveImage(key),
}));

export const subscribeMenuStore = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getMenuStoreSnapshot = (): MenuState => state;

export const useMenuStore = (): MenuState =>
  useSyncExternalStore(subscribeMenuStore, getMenuStoreSnapshot, getMenuStoreSnapshot);

export { getApiBaseUrl };
