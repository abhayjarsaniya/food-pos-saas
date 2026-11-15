import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Order } from '../types';
import { useAuth } from './AuthContext';
import { 
  subscribeToOrders, 
  getOrders, 
  isEligiblePendingPayment 
} from '../services/orders/orderService';

interface OrdersContextType {
  orders: Order[];
  loading: boolean;
  pendingPaymentOrders: Order[];
  pendingPaymentCount: number;
  refreshOrders: () => Promise<void>;
  addOrUpdateOrder: (order: Order) => void;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export const OrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const addOrUpdateOrder = useCallback((incoming: Order) => {
    setOrders((prev) => {
      const targetId = incoming.id || incoming.orderId;
      const idx = prev.findIndex(
        (o) => o.id === targetId || o.orderId === targetId || (incoming.orderId && o.id === incoming.orderId)
      );

      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...incoming };
        return updated;
      }
      return [incoming, ...prev];
    });
  }, []);

  // Listen to immediate in-memory order events (instant 0ms update across UI)
  useEffect(() => {
    const handleOrderEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Order>;
      if (customEvent.detail) {
        addOrUpdateOrder(customEvent.detail);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('food_pos_order_saved', handleOrderEvent);
      return () => {
        window.removeEventListener('food_pos_order_saved', handleOrderEvent);
      };
    }
  }, [addOrUpdateOrder]);

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
    return orders.filter((o) => isEligiblePendingPayment(o));
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
        addOrUpdateOrder,
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
