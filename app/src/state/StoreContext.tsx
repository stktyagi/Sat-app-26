// src/state/StoreContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useStore } from '@/hooks/useStore';

interface StoreContextType {
  // State
  storeItems: StoreItem[];
  cart: Cart | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  
  // Actions
  fetchStoreItems: () => Promise<StoreItem[]>;
  fetchCart: () => Promise<Cart | null>;
  fetchAll: () => Promise<{ items: StoreItem[]; cart: Cart | null }>;
  refresh: () => Promise<void>;
  updateCart: (cart: Cart | null) => void;
  updateStoreItems: (items: StoreItem[]) => void;
  
  // Helpers
  getCartItemCount: () => number;
  isItemInCart: (itemId: string, size?: string) => boolean;
  getCartItem: (itemId: string, size?: string) => any;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

interface StoreProviderProps {
  children: ReactNode;
}

/**
 * Store Provider Component
 * Wrap your app with this to provide store and cart state globally
 */
export const StoreProvider: React.FC<StoreProviderProps> = ({ children }) => {
  const storeData = useStore();

  return (
    <StoreContext.Provider value={storeData}>
      {children}
    </StoreContext.Provider>
  );
};

/**
 * Custom hook to use Store Context
 * Use this in your components to access store and cart state
 * 
 * @example
 * const { cart, storeItems, updateCart } = useStoreContext();
 */
export const useStoreContext = (): StoreContextType => {
  const context = useContext(StoreContext);
  
  if (context === undefined) {
    throw new Error('useStoreContext must be used within a StoreProvider');
  }
  
  return context;
};
