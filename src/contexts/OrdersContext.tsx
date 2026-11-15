import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Order } from '../types';
import { useAuth } from './AuthContext';
import { 
  subscribeToOrders, 
  getOrders, 
  normalizePaymentStatus, 
  normalizeOrderStatus 
} from '../services/orders/orderService';

interface OrdersContextType {
  orders: Order[];
  loading: boolean;
  pendingPaymentOrders: Order[];
  pendingPaymentCount: number;
  refreshOrders: () => Promise<void>;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export const OrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Subscribe to real-time Firestore order stream for the current business
  useEffect(() => {
    if (!profile?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToOrders(
      profile.id,
      (data) => {
        setOrders(data);
        setLoading(false);
      },
      (err) => {
        console.warn('Real-time orders error in OrdersProvider:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile?.id]);

  const refreshOrders = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const data = await getOrders(profile.id);
      setOrders(data);
    } catch (err) {
      console.warn('Manual refreshOrders error:', err);
    }
  }, [profile?.id]);

  // Actual pending payment orders (Unpaid & Partially Paid with active balance, excluding Cancelled/Voided)
  const pendingPaymentOrders = useMemo(() => {
    return orders.filter((o) => {
      const ordStatus = normalizeOrderStatus(o.orderStatus || o.status);
      if (ordStatus === 'CANCELLED' || ordStatus === 'DRAFT') return false;

      const payStatus = normalizePaymentStatus(o.paymentStatus);
      const balance = o.balanceDue !== undefined 
        ? o.balanceDue 
        : Math.max(0, (o.grandTotal || 0) - (o.amountPaid || 0));

      return (payStatus === 'UNPAID' || payStatus === 'PARTIAL') && balance > 0;
    });
  }, [orders]);

  const pendingPaymentCount = pendingPaymentOrders.length;

  return (
    <OrdersContext.Provider
      value={{
        orders,
        loading,
        pendingPaymentOrders,
        pendingPaymentCount,
        refreshOrders,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) throw new Error('useOrders must be used within an OrdersProvider');
  return context;
};
