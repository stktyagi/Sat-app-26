import { create } from 'zustand';

interface WalletUser {
  id: string;
  name: string;
  phone_number?: string;
  role: 'customer' | 'vendor' | 'admin';
  balance?: number;
}

interface WalletState {
  customerToken: string | null;
  customerUser: WalletUser | null;
  
  vendorToken: string | null;
  vendorUser: WalletUser | null;

  setCustomerToken: (token: string) => void;
  setCustomerUser: (user: WalletUser) => void;
  setCustomerBalance: (balance: number) => void;
  logoutCustomer: () => void;

  setVendorToken: (token: string) => void;
  setVendorUser: (user: WalletUser) => void;
  logoutVendor: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  customerToken: null,
  customerUser: null,
  vendorToken: null,
  vendorUser: null,

  setCustomerToken: (token: string) => {
    set({ customerToken: token });
  },
  setCustomerUser: (user: WalletUser) => {
    set({ customerUser: user });
  },
  setCustomerBalance: (balance: number) => {
    set((state) => ({
      customerUser: state.customerUser ? { ...state.customerUser, balance } : null,
    }));
  },
  logoutCustomer: () => {
    set({ customerToken: null, customerUser: null });
  },

  setVendorToken: (token: string) => {
    set({ vendorToken: token });
  },
  setVendorUser: (user: WalletUser) => {
    set({ vendorUser: user });
  },
  logoutVendor: () => {
    set({ vendorToken: null, vendorUser: null });
  },
}));
