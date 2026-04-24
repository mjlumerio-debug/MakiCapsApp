import api from './api';

export type BranchRecord = {
    branch_id: number;
    branch_name: string;
    isAvailable: boolean;
    stock: number;
};

export type DisplayProduct = {
    id: string;
    branch_id: number;
    name: string;
    selling_price: number;
    image_path: string;
    category_id_: number;
    description: string;
    is_available: boolean;
    category_name: string;
    sources: BranchRecord[]; 
    stock?: number;
    ingredients?: any[];
};

// ─── Direct Database Mapper (NO Formatting) ─────────────────────────
const mapProduct = (p: any): DisplayProduct => ({
    id: String(p.id),
    branch_id: Number(p.branch_id || 0),
    name: p.name || 'Unnamed Product',
    selling_price: Number(p.selling_price || 0),
    image_path: p.image_path || '',
    category_id_: Number(p.category_id_ || p.category_id || 0),
    description: p.description || '',
    is_available: p.is_available !== false && p.is_available !== 0,
    category_name: p.category_name || p.category?.name || '',
    sources: [],
    stock: p.stock,
    ingredients: p.ingredients || []
});

// ─── Extraction Helpers ──────────────────────────────────────────────
const extractProducts = (data: any): any[] => {
    if (!data) return [];
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.products)) return data.products;
    if (Array.isArray(data)) return data;
    return [];
};

const extractCategories = (data: any): any[] => {
    if (!data) return [];
    const list = Array.isArray(data.data) ? data.data : 
                 (Array.isArray(data.categories) ? data.categories : 
                 (Array.isArray(data) ? data : []));
    
    return list.map((c: any) => ({
        id: String(c.id || ''),
        name: c.name || 'Category',
        image_path: c.image_path || c.image || c.icon || ''
    })).filter((c: any) => c.id);
};

// ─── Production Fetch Logic ──────────────────────────────────────────

export const fetchGlobalCatalog = async () => {
    try {
        const [prodRes, catRes] = await Promise.all([
            api.get(`products?t=${Date.now()}`),
            api.get(`categories?t=${Date.now()}`).catch(() => ({ data: [] }))
        ]);

        const rawProducts = extractProducts(prodRes.data);
        const categories = extractCategories(catRes.data);
        const products = rawProducts.map(mapProduct);

        // 🧠 UI Grouping (Keep ONE per name, preserve raw data)
        const groupedMap = new Map<string, DisplayProduct>();
        
        products.forEach(p => {
            const key = p.name.trim().toLowerCase();
            if (!groupedMap.has(key)) {
                groupedMap.set(key, { ...p });
            }
            const existing = groupedMap.get(key)!;
            existing.sources.push({
                branch_id: p.branch_id,
                branch_name: 'Store',
                isAvailable: p.is_available,
                stock: p.stock || 99
            });
        });

        return {
            displayProducts: Array.from(groupedMap.values()),
            categories
        };
    } catch (err) {
        console.error('[ProductService] Global fetch failed:', err);
        throw err;
    }
};

export const fetchBranchProducts = async (branchId: number) => {
    try {
        const [prodRes, catRes] = await Promise.all([
            api.get(`products`, { params: { branch_id: branchId, t: Date.now() } }),
            api.get(`categories?t=${Date.now()}`).catch(() => ({ data: [] }))
        ]);

        const rawProducts = extractProducts(prodRes.data);
        const categories = extractCategories(catRes.data);
        
        const branchProducts = rawProducts.map(mapProduct);

        return {
            products: branchProducts,
            categories
        };
    } catch (err) {
        console.error('[ProductService] Branch fetch failed:', err);
        throw err;
    }
};
