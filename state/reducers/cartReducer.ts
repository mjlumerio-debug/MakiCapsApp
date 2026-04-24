export type CartItem = {
  id: string;
  title: string;
  price: string;
  quantity: number;
  image?: any;
  description?: string;
  checked: boolean;
};

export type CartState = {
  branchId: number | null;
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
};

export type CartAction =
  | { type: 'ADD_ITEM'; payload: { item: CartItem; branchId: number } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'TOGGLE_CHECK'; payload: string }
  | { type: 'TOGGLE_ALL'; payload: boolean }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_BRANCH_ID'; payload: number | null }
  | { type: 'VALIDATE_CART'; payload: any[] }
  | { type: 'SYNC_CART'; payload: CartItem[] };

export const cartInitialState: CartState = {
  branchId: null,
  items: [],
  totalItems: 0,
  totalPrice: 0,
};

const calculateTotals = (items: CartItem[]) => {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => {
    const price = parseFloat(item.price.replace(/[^\d.]/g, '')) || 0;
    return sum + (price * item.quantity);
  }, 0);
  return { totalItems, totalPrice };
};

export const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { item, branchId } = action.payload;
      
      // 🛡️ PRODUCTION GUARD: Clear cart if adding item from a DIFFERENT branch
      if (state.branchId !== null && state.branchId !== branchId && state.items.length > 0) {
        // In a real app, you might want to show a prompt, 
        // but for strict enforcement, we clear it or block it.
        // For this implementation, we clear it to allow the new item.
        const newItems = [item];
        return {
          ...state,
          branchId,
          items: newItems,
          ...calculateTotals(newItems),
        };
      }

      let newItems = [...state.items];
      const existing = newItems.find((i) => i.id === item.id);

      if (existing) {
        existing.quantity += item.quantity;
      } else {
        newItems.push(item);
      }

      return {
        ...state,
        branchId,
        items: newItems,
        ...calculateTotals(newItems),
      };
    }
    case 'REMOVE_ITEM': {
      const newItems = state.items.filter((i) => i.id !== action.payload);
      return {
        ...state,
        items: newItems,
        ...calculateTotals(newItems),
      };
    }
    case 'UPDATE_QUANTITY': {
      const newItems = state.items.map((i) =>
        i.id === action.payload.id ? { ...i, quantity: action.payload.quantity } : i
      );
      return {
        ...state,
        items: newItems,
        ...calculateTotals(newItems),
      };
    }
    case 'TOGGLE_CHECK': {
      const newItems = state.items.map((i) =>
        i.id === action.payload ? { ...i, checked: !i.checked } : i
      );
      return { ...state, items: newItems };
    }
    case 'TOGGLE_ALL': {
      const newItems = state.items.map((i) => ({ ...i, checked: action.payload }));
      return { ...state, items: newItems };
    }
    case 'CLEAR_CART':
      return cartInitialState;
    case 'SET_BRANCH_ID':
      return { ...state, branchId: action.payload };
    case 'VALIDATE_CART': {
      const menuItems = action.payload;
      const validItems = state.items.filter(item => {
        const menuItem = menuItems.find(m => String(m.id) === String(item.id));
        return menuItem && menuItem.is_available && (menuItem.stock ?? 0) > 0;
      });
      if (validItems.length === state.items.length) return state;
      return {
        ...state,
        items: validItems,
        ...calculateTotals(validItems),
      };
    }
    case 'SYNC_CART':
      return {
        ...state,
        items: action.payload,
        ...calculateTotals(action.payload),
      };
    default:
      return state;
  }
};
