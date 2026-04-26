import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { cartInitialState, cartReducer, CartState, CartAction } from '../reducers/cartReducer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CartContext = createContext<{
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
} | undefined>(undefined);

const STORAGE_KEY_CART = 'maki_cart_items';

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(cartReducer, cartInitialState);

  // Persistence
  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY_CART);
      if (saved) {
        dispatch({ type: 'SYNC_CART', payload: JSON.parse(saved) });
      }
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_CART, JSON.stringify(state.items));
  }, [state.items]);

  return (
    <CartContext.Provider value={{ state, dispatch }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
