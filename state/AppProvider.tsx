import React, { ReactNode } from 'react';
import { LocationProvider } from './contexts/LocationContext';
import { BranchProvider } from './contexts/BranchContext';
import { CartProvider } from './contexts/CartContext';

export const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <LocationProvider>
      <BranchProvider>
        <CartProvider>
          {children}
        </CartProvider>
      </BranchProvider>
    </LocationProvider>
  );
};
