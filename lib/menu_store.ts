import api, { getApiBaseUrl } from '@/lib/api';
import { fetchBranchProducts, fetchGlobalCatalog, type DisplayProduct, type BranchRecord } from './product_service';
import { useSyncExternalStore } from 'react';

/**
 * 🍱 RAW-FIRST DATA ARCHITECTURE
 * Rule: Store raw database values. Format ONLY in the UI layer.
 */

export type Category = {
  id: string;
  name: string;
  image_path?: string;
};

export type Food = {
  // RAW DATABASE FIELDS (Strictly preserved)
  id: string;
  branch_id: number;
  name: string;
  selling_price: number;
  image_path: string;
  category_id_: number;
  description: string;
  is_available: boolean;
  ingredients?: any[];
  
  // RUNTIME FIELDS
  category_name: string;
  stock?: number;
  max_quantity?: number;
  availability_status?: 'available' | 'limited' | 'unavailable';
  sources?: BranchRecord[];
};

type MenuState = {
  categories: Category[];
  menuItems: Food[];
  isRefreshing: boolean;
  lastError: string | null;
};

const initialState: MenuState = {
  categories: [],
  menuItems: [],
  isRefreshing: false,
  lastError: null,
};

let state: MenuState = initialState;
const listeners = new Set<() => void>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const setState = (updater: (prev: MenuState) => MenuState): void => {
  state = updater(state);
  emit();
};

/**
 * UI FORMATTING HELPER (To be used in components)
 */
export const formatPeso = (n: number | string): string => {
  const val = typeof n === 'string' ? parseFloat(n) : n;
  return `\u20B1${(val || 0).toFixed(2)}`;
};

/**
 * IMAGE RESOLUTION HELPER (To be used in components)
 */
export const resolveProductImage = (path: string | null): string | null => {
  if (!path) return null;
  
  // 1. If it's already a full URL (contains protocol), return it as is
  if (path.includes('://')) return path;
  
  // 2. Otherwise, construct the URL using the API base as the root
  const serverRoot = getApiBaseUrl().replace(/\/api\/v1\/?$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  
  // 3. Ensure the path goes through /storage/ if it's a local file path
  if (cleanPath.startsWith('storage/') || cleanPath.startsWith('uploads/')) {
    return `${serverRoot}/${cleanPath}`;
  }
  
  return `${serverRoot}/storage/${cleanPath}`;
};

export const refreshMenuStore = async (
  mode: 'branch' | 'global' = 'global',
  branchId?: number | null
): Promise<boolean> => {
  setState(prev => ({ ...prev, isRefreshing: true }));
  
  try {
    let result: { products: DisplayProduct[], categories: any[] };
    let finalMode = mode;
    
    if (mode === 'branch' && branchId) {
      result = await fetchBranchProducts(branchId);
      if (result.products.length === 0) {
        const globalData = await fetchGlobalCatalog();
        result = { products: globalData.displayProducts, categories: globalData.categories };
        finalMode = 'global';
      }
    } else {
      const { displayProducts, categories } = await fetchGlobalCatalog();
      result = { products: displayProducts, categories };
    }

    const catLookup: Record<string, string> = {};
    const finalCategories: Category[] = [{ id: 'all', name: 'All' }];

    result.categories.forEach(c => {
      const cid = String(c.id);
      const cname = c.name || `Category ${cid}`;
      catLookup[cid] = cname;
      
      if (!finalCategories.find(existing => existing.id === cid)) {
        finalCategories.push({ 
          id: cid, 
          name: cname, 
          image_path: resolveProductImage(c.image_path) ?? undefined
        });
      }
    });

    // 🎯 RAW MAPPING (No formatting, no corruption)
    const mappedItems: Food[] = result.products.map(p => {
      const isAvailable = p.is_available ?? true;
      const sources = p.sources || [];
      const stockVal = p.stock ?? 99;
      const catId = String(p.category_id_ || '');

      let status: 'available' | 'limited' | 'unavailable' = isAvailable ? 'available' : 'unavailable';
      if (finalMode === 'global' && sources.length > 0) {
        const anyAvail = sources.some((s: BranchRecord) => s.isAvailable);
        status = anyAvail ? 'available' : 'unavailable';
      }

      return {
        ...p, // PRESERVE ALL RAW API FIELDS (selling_price, image_path, category_id_)
        id: String(p.id),
        category_name: catLookup[catId] || 'Other',
        stock: stockVal,
        max_quantity: stockVal,
        availability_status: status,
      };
    });

    setState(prev => ({
      ...prev,
      menuItems: mappedItems,
      categories: finalCategories,
      isRefreshing: false,
      lastError: null
    }));

    return true;
  } catch (error) {
    console.error('[MenuStore] Refresh failed:', error);
    setState(prev => ({ ...prev, isRefreshing: false, lastError: String(error) }));
    return false;
  }
};

export const subscribeMenuStore = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getMenuStoreSnapshot = (): MenuState => state;

export const useMenuStore = (): MenuState =>
  useSyncExternalStore(subscribeMenuStore, getMenuStoreSnapshot, getMenuStoreSnapshot);
