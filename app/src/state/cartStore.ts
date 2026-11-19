import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  id: string; // unique item id + size
  itemId: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  selectedSize?: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addToCart: (
    item: { id: string; name: string; price: number; description?: string; image?: string; size?: string },
    quantity?: number,
    size?: string
  ) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalCount: () => number;
  getTotalAmount: () => number;
}

const STORAGE_KEY = '@sat_store_cart';

export const useCartStore = create<CartState>((set, get) => {
  // Load initial cart from storage
  AsyncStorage.getItem(STORAGE_KEY).then((data) => {
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          set({ items: parsed });
        }
      } catch (e) {
        console.warn('Failed to parse cart storage:', e);
      }
    }
  }).catch(() => {});

  const persist = (items: CartItem[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  };

  return {
    items: [],

    addToCart: (item, quantity = 1, size) => {
      const finalSize = size || item.size;
      const qty = quantity > 0 ? quantity : 1;
      const current = get().items;
      const cartItemId = finalSize ? `${item.id}_${finalSize}` : item.id;
      const existingIndex = current.findIndex((i) => i.id === cartItemId);

      let next: CartItem[];
      if (existingIndex > -1) {
        next = current.map((i, idx) =>
          idx === existingIndex ? { ...i, quantity: i.quantity + qty } : i
        );
      } else {
        next = [
          ...current,
          {
            id: cartItemId,
            itemId: item.id,
            name: item.name,
            price: item.price,
            description: item.description,
            image: item.image,
            selectedSize: finalSize,
            quantity: qty,
          },
        ];
      }
      set({ items: next });
      persist(next);
    },

    removeFromCart: (cartItemId) => {
      const next = get().items.filter((i) => i.id !== cartItemId);
      set({ items: next });
      persist(next);
    },

    updateQuantity: (cartItemId, quantity) => {
      if (quantity <= 0) {
        get().removeFromCart(cartItemId);
        return;
      }
      const next = get().items.map((i) =>
        i.id === cartItemId ? { ...i, quantity } : i
      );
      set({ items: next });
      persist(next);
    },

    clearCart: () => {
      set({ items: [] });
      persist([]);
    },

    getTotalCount: () => {
      return get().items.reduce((sum, item) => sum + item.quantity, 0);
    },

    getTotalAmount: () => {
      return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    },
  };
});
