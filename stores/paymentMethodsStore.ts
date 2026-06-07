// Payment methods store. Holds the current list; refresh() pulls from the DB.
import { create } from 'zustand';
import { PaymentMethod } from '@/types';
import { listPaymentMethods } from '@/db/paymentMethods';

interface PaymentMethodsState {
  methods: PaymentMethod[];
  loaded: boolean;
  refresh: () => Promise<void>;
}

export const usePaymentMethodsStore = create<PaymentMethodsState>((set) => ({
  methods: [],
  loaded: false,
  refresh: async () => {
    const methods = await listPaymentMethods();
    set({ methods, loaded: true });
  },
}));
