// src/hooks/useStore.ts
import { useState, useEffect, useCallback } from 'react';
/**
 * Custom hook for managing store items and cart state
 * Provides centralized state management for store-related data
 */
export const useStore = () => {
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [cart, setCart] = useState<any | null>(null);
  
  const updateCart = useCallback((newCart: any) => setCart(newCart), []);
  const updateStoreItems = useCallback((newItems: any[]) => setStoreItems(newItems), []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch store items from Firebase
   */
  const fetchStoreItems = useCallback(async () => {
    try {
      /* Removed API call: getStoreItems */
      setStoreItems([]);
      setError(null);
      return [];
    } catch (err) {
      const errorMessage = 'Failed to fetch store items';
      setError(errorMessage);
      console.error('Error fetching store items:', err);
      return [];
    }
  }, []);

  /**
   * Fetch cart from Firebase
   */
  const fetchCart = useCallback(async () => {
    try {
      /* Removed API call: getCart */
      const emptyCart = { items: [], total: 0 };
      setCart(emptyCart);
      setError(null);
      return emptyCart;
    } catch (err) {
      const errorMessage = 'Failed to fetch cart';
      setError(errorMessage);
      console.error('Error fetching cart:', err);
      return null;
    }
  }, []);

  /**
   * Fetch both store items and cart
   */
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [items, cartData] = await Promise.all([
        fetchStoreItems(),
        fetchCart()
      ]);

      return { items, cart: cartData };
    } catch (err) {
      console.error('Error fetching store data:', err);
      setError('Failed to fetch store data');
      return { items: [], cart: null };
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchStoreItems, fetchCart]);

  /**
   * Refresh all data (for pull-to-refresh)
   */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
  }, [fetchAll]);

  /* Removed API call: Cart */

  /* Removed API call: StoreItem */

  /**
   * Get cart item count
   */
  const getCartItemCount = useCallback(() => {
    if (!cart || !cart.items) return 0;
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  /**
   * Check if an item is in the cart
   */
  const isItemInCart = useCallback((itemId: string, size?: string) => {
    if (!cart || !cart.items) return false;
    
    if (size) {
      return cart.items.some(
        item => item.itemId === itemId && item.selectedSize === size
      );
    }
    
    return cart.items.some(item => item.itemId === itemId);
  }, [cart]);

  /**
   * Get cart item by itemId and size
   */
  const getCartItem = useCallback((itemId: string, size?: string) => {
    if (!cart || !cart.items) return null;
    
    if (size) {
      return cart.items.find(
        item => item.itemId === itemId && item.selectedSize === size
      ) || null;
    }
    
    return cart.items.find(item => item.itemId === itemId) || null;
  }, [cart]);

  // Initial load
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    // State
    storeItems,
    cart,
    loading,
    refreshing,
    error,
    
    // Actions
    fetchStoreItems,
    fetchCart,
    fetchAll,
    refresh,
    updateCart,
    updateStoreItems,
    
    // Helpers
    getCartItemCount,
    isItemInCart,
    getCartItem,
  };
};
