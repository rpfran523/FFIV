import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, ProductVariant, Product } from '../types';


interface CartStore {
  items: CartItem[];
  currentUserId: string;
  addItem: (variant: ProductVariant, product: Product, quantity?: number) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  clearCartForUser: (userId: string) => void;
  setCurrentUser: (userId: string) => void;
  getSubtotal: () => number;
  getTotalItems: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      currentUserId: 'anonymous',

      setCurrentUser: (userId: string) => {
        const state = get();
        if (state.currentUserId === userId) {
          set({ currentUserId: userId });
          return;
        }
        const switchingBetweenRealUsers = state.currentUserId !== 'anonymous' && userId !== 'anonymous' && state.currentUserId !== userId;
        if (switchingBetweenRealUsers) {
          set({ currentUserId: userId, items: [] });
        } else {
          // Do not clear when moving to or from anonymous during refresh
          set({ currentUserId: userId });
        }
      },

      addItem: (variant, product, quantity = 1) => {
        set((state) => {
          const existingItemIndex = state.items.findIndex((item) => item.variantId === variant.id);
          if (existingItemIndex !== -1) {
            const newItems = [...state.items];
            newItems[existingItemIndex].quantity += quantity;
            return { items: newItems };
          }
          return {
            items: [
              ...state.items,
              { variantId: variant.id, variant, product, quantity },
            ],
          };
        });
      },

      removeItem: (variantId) => {
        set((state) => ({ items: state.items.filter((item) => item.variantId !== variantId) }));
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }
        set((state) => {
          const newItems = state.items.map((item) => (item.variantId === variantId ? { ...item, quantity } : item));
          return { items: newItems };
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      clearCartForUser: (userId: string) => {
        const state = get();
        if (state.currentUserId === userId) set({ items: [] });
      },

      getSubtotal: () => {
        const { items } = get();
        return items.reduce((total, item) => total + item.variant.price * item.quantity, 0);
      },

      getTotalItems: () => {
        const { items } = get();
        return items.reduce((total, item) => total + item.quantity, 0);
      },
    }),
    { name: 'flower-fairies-cart' }
  )
);
