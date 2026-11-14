import React, { createContext, useContext, useState, useMemo } from 'react';
import { 
  BillExtra, 
  CustomerInfo, 
  DiscountType, 
  MenuItem, 
  MenuItemVariant,
  Order, 
  OrderItem, 
  OrderType, 
  PaymentMethod, 
  PaymentStatus 
} from '../types';
import { calculateBill, calculateItemTotal, round2 } from '../utils/calculations';
import { useAuth } from './AuthContext';
import { createOrder, updateOrder } from '../services/orders/orderService';
import confetti from 'canvas-confetti';

interface BillingContextType {
  // Current bill state
  items: OrderItem[];
  extras: BillExtra[];
  customer: CustomerInfo;
  tableId: string | null;
  tableName: string;
  tableNumber: string;
  orderType: OrderType;
  discountType: DiscountType;
  discountValue: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  isSubmitting: boolean;
  selectedCategory: string | null;
  searchQuery: string;
  editingOrderId: string | null;

  // Actions
  addItem: (item: MenuItem, selectedVariant?: MenuItemVariant, customPrice?: number) => void;
  addCustomItem: (name: string, price: number, quantity?: number, gstRate?: number) => void;
  updateItemQuantity: (itemId: string, delta: number) => void;
  setItemQuantity: (itemId: string, quantity: number) => void;
  updateItemPrice: (itemId: string, newPrice: number) => void;
  removeItem: (itemId: string) => void;

  // Extras Actions
  addExtra: (name: string, unitPrice: number, quantity?: number, gstRate?: number) => void;
  updateExtraQuantity: (extraId: string, delta: number) => void;
  removeExtra: (extraId: string) => void;

  // Bill Meta
  setTable: (table: { id?: string | null; name: string }) => void;
  setTableNumber: (table: string) => void;
  setOrderType: (type: OrderType) => void;
  clearBill: () => void;
  setCustomer: React.Dispatch<React.SetStateAction<CustomerInfo>>;
  setDiscountType: (type: DiscountType) => void;
  setDiscountValue: (value: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setPaymentStatus: (status: PaymentStatus) => void;
  setAmountPaid: (amount: number) => void;
  setSelectedCategory: (catId: string | null) => void;
  setSearchQuery: (query: string) => void;
  loadDraftOrder: (order: Order) => void;

  // Calculated totals
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  effectiveGstRate: number;
  grandTotal: number;
  balanceDue: number;

  // Save / Checkout execution
  saveBillAsUnpaid: () => Promise<Order>;
  checkoutBill: (options?: { collectNow?: boolean; amount?: number; method?: PaymentMethod }) => Promise<Order>;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, settings, user } = useAuth();

  const [items, setItems] = useState<OrderItem[]>([]);
  const [extras, setExtras] = useState<BillExtra[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', phone: '' });
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableName, setTableName] = useState<string>('');
  const [tableNumber, setTableNumberState] = useState<string>('');

  const setTable = ({ id, name }: { id?: string | null; name: string }) => {
    setTableId(id || null);
    setTableName(name || '');
    setTableNumberState(name || '');
  };

  const setTableNumber = (name: string) => {
    setTableName(name || '');
    setTableNumberState(name || '');
  };
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(settings.billing?.defaultPaymentMethod || 'CASH');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('UNPAID');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Real-time calculation engine including custom extras
  const calculationSummary = useMemo(() => {
    return calculateBill({
      items,
      extras,
      discountType,
      discountValue,
      gstEnabled: settings.tax.enabled,
      pricingMode: settings.tax.pricingMode,
      defaultGstRate: settings.tax.defaultGstRate,
      isInterState: settings.tax.isInterState,
    });
  }, [items, extras, discountType, discountValue, settings.tax]);

  const balanceDue = useMemo(() => {
    if (paymentStatus === 'PAID') return 0;
    if (paymentStatus === 'UNPAID') return calculationSummary.grandTotal;
    return Math.max(0, round2(calculationSummary.grandTotal - (amountPaid || 0)));
  }, [paymentStatus, calculationSummary.grandTotal, amountPaid]);

  const addItem = (menuItem: MenuItem, selectedVariant?: MenuItemVariant, customPrice?: number) => {
    // If item is inactive or unavailable, reject adding
    if (!menuItem.isActive || menuItem.isAvailable === false) {
      alert('This item is currently disabled and cannot be added to bills.');
      return;
    }
    if (menuItem.isPromotional && menuItem.confirmationStatus === 'Needs Owner Confirmation' && !menuItem.isActive) {
      alert('This promotional combo item requires owner confirmation before live billing.');
      return;
    }

    // Determine unit price
    let effectivePrice = menuItem.price;
    let displayName = menuItem.name;
    const variantId = selectedVariant?.variantId;
    const variantName = selectedVariant?.name;

    if (selectedVariant) {
      // Handle paise conversion if stored as integer paise (e.g. 15000 -> 150)
      const rawPrice = selectedVariant.price;
      effectivePrice = rawPrice > 1000 ? rawPrice / 100 : rawPrice;
      displayName = `${menuItem.name} (${selectedVariant.name})`;
    } else if (customPrice !== undefined) {
      effectivePrice = customPrice;
    } else if (menuItem.price > 1000) {
      // In case stored in paise
      effectivePrice = menuItem.price / 100;
    }

    const uniqueLineId = selectedVariant ? `${menuItem.id}_${selectedVariant.variantId}` : menuItem.id;

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.itemId === uniqueLineId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const current = updated[existingIndex];
        const newQty = current.quantity + 1;
        updated[existingIndex] = {
          ...current,
          quantity: newQty,
          lineTotal: calculateItemTotal(current.unitPrice, newQty),
        };
        return updated;
      } else {
        const gstRate = menuItem.gstRate ?? settings.tax.defaultGstRate;
        const newItem: OrderItem = {
          itemId: uniqueLineId,
          name: displayName,
          quantity: 1,
          unitPrice: effectivePrice,
          originalPrice: effectivePrice,
          gstRate: gstRate,
          lineTotal: calculateItemTotal(effectivePrice, 1),
          isVeg: menuItem.isVeg,
          isCustom: false,
          variantId,
          variantName,
        };
        return [...prev, newItem];
      }
    });
  };

  const addCustomItem = (name: string, price: number, quantity = 1, gstRate?: number) => {
    const customId = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const effectiveGstRate = gstRate ?? settings.tax.defaultGstRate;
    const newItem: OrderItem = {
      itemId: customId,
      name: name.trim() || 'Custom Item',
      quantity: Math.max(1, quantity),
      unitPrice: Math.max(0, price),
      originalPrice: price,
      gstRate: effectiveGstRate,
      lineTotal: calculateItemTotal(price, quantity),
      isCustom: true,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const updateItemQuantity = (itemId: string, delta: number) => {
    setItems((prev) => {
      return prev
        .map((item) => {
          if (item.itemId === itemId) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            return {
              ...item,
              quantity: nextQty,
              lineTotal: calculateItemTotal(item.unitPrice, nextQty),
            };
          }
          return item;
        })
        .filter(Boolean) as OrderItem[];
    });
  };

  const setItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) => {
      return prev.map((item) => {
        if (item.itemId === itemId) {
          return {
            ...item,
            quantity,
            lineTotal: calculateItemTotal(item.unitPrice, quantity),
          };
        }
        return item;
      });
    });
  };

  const updateItemPrice = (itemId: string, newPrice: number) => {
    setItems((prev) => {
      return prev.map((item) => {
        if (item.itemId === itemId) {
          const price = Math.max(0, newPrice);
          return {
            ...item,
            unitPrice: price,
            lineTotal: calculateItemTotal(price, item.quantity),
          };
        }
        return item;
      });
    });
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.itemId !== itemId));
  };

  // Extras Actions
  const addExtra = (name: string, unitPrice: number, quantity = 1, gstRate?: number) => {
    const extraId = `ext_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const cleanQty = Math.max(1, quantity);
    const cleanPrice = Math.max(0, unitPrice);
    const newExtra: BillExtra = {
      id: extraId,
      name: name.trim() || 'Custom Extra',
      quantity: cleanQty,
      unitPrice: cleanPrice,
      lineTotal: calculateItemTotal(cleanPrice, cleanQty),
      gstRate: gstRate ?? settings.tax.defaultGstRate,
    };
    setExtras((prev) => [...prev, newExtra]);
  };

  const updateExtraQuantity = (extraId: string, delta: number) => {
    setExtras((prev) =>
      prev
        .map((ext) => {
          if (ext.id === extraId) {
            const nQty = ext.quantity + delta;
            if (nQty <= 0) return null;
            return {
              ...ext,
              quantity: nQty,
              lineTotal: calculateItemTotal(ext.unitPrice, nQty),
            };
          }
          return ext;
        })
        .filter(Boolean) as BillExtra[]
    );
  };

  const removeExtra = (extraId: string) => {
    setExtras((prev) => prev.filter((e) => e.id !== extraId));
  };

  const clearBill = () => {
    setItems([]);
    setExtras([]);
    setCustomer({ name: '', phone: '' });
    setTableId(null);
    setTableName('');
    setTableNumberState('');
    setOrderType('DINE_IN');
    setDiscountValue(0);
    setAmountPaid(0);
    setPaymentStatus('UNPAID');
    setEditingOrderId(null);
  };

  const loadDraftOrder = (order: Order) => {
    setItems([...order.items]);
    setExtras([...(order.extras || [])]);
    setCustomer(order.customer || { name: '', phone: '' });
    setTableId(order.tableId || null);
    setTableName(order.tableName || '');
    setTableNumberState(order.tableName || order.tableNumber || '');
    setOrderType(order.orderType || 'DINE_IN');
    setDiscountType(order.discountType || 'fixed');
    setDiscountValue(order.discountValue || 0);
    setPaymentMethod(order.paymentMethod || 'CASH');
    setPaymentStatus(order.paymentStatus || 'UNPAID');
    setAmountPaid(order.amountPaid || 0);
    setEditingOrderId(order.id);
  };

  /**
   * Save Bill as OPEN & UNPAID (Standard Indian Food Flow: order first, pay later)
   */
  const saveBillAsUnpaid = async (): Promise<Order> => {
    return checkoutBill({ collectNow: false });
  };

  /**
   * Checkout Bill execution (handles both Unpaid Draft saving and Instant Payment Collection)
   */
  const checkoutBill = async (options?: {
    collectNow?: boolean;
    amount?: number;
    method?: PaymentMethod;
  }): Promise<Order> => {
    if (items.length === 0 && extras.length === 0) {
      throw new Error('Cannot checkout an empty bill. Please add items or extras.');
    }
    if (!profile) {
      throw new Error('Business profile missing. Please complete setup.');
    }
    if (profile.status === 'SUSPENDED') {
      throw new Error('This shop account is currently SUSPENDED. New bill creation is restricted. Please contact Super Admin.');
    }
    if (isSubmitting) {
      throw new Error('Checkout is already processing. Please wait.');
    }

    setIsSubmitting(true);

    try {
      const collectNow = options?.collectNow ?? false;
      const targetMethod = options?.method || paymentMethod;
      const targetAmount = collectNow 
        ? (options?.amount ?? calculationSummary.grandTotal) 
        : 0;

      const finalStatus: PaymentStatus = collectNow
        ? targetAmount >= calculationSummary.grandTotal
          ? 'PAID'
          : targetAmount > 0
          ? 'PARTIAL'
          : 'UNPAID'
        : 'UNPAID';

      const finalBalanceDue = Math.max(0, round2(calculationSummary.grandTotal - targetAmount));
      const finalOrderStatus = finalStatus === 'PAID' ? 'COMPLETED' : 'OPEN';

      let resultingOrder: Order;

      if (editingOrderId) {
        // Update existing open draft
        resultingOrder = await updateOrder(profile.id, editingOrderId, {
          customer: customer.phone || customer.name ? customer : undefined,
          tableId: tableId || null,
          tableName: tableName || null,
          tableNumber: tableName || (orderType === 'TAKEAWAY' ? 'Takeaway' : orderType === 'PARCEL' ? 'Parcel' : null),
          orderType,
          items: [...items],
          extras: [...extras],
          subtotal: calculationSummary.subtotal,
          discountType,
          discountValue,
          discountAmount: calculationSummary.discountAmount,
          taxableAmount: calculationSummary.taxableAmount,
          gstAmount: calculationSummary.gstAmount,
          cgstAmount: calculationSummary.cgstAmount,
          sgstAmount: calculationSummary.sgstAmount,
          igstAmount: calculationSummary.igstAmount,
          grandTotal: calculationSummary.grandTotal,
          paymentMethod: targetMethod,
          paymentStatus: finalStatus,
          amountPaid: targetAmount,
          balanceDue: finalBalanceDue,
          status: finalOrderStatus,
        });
      } else {
        // Create new bill (default OPEN & UNPAID)
        resultingOrder = await createOrder(profile.id, {
          customer: customer.phone || customer.name ? customer : undefined,
          tableId: tableId || null,
          tableName: tableName || null,
          tableNumber: tableName || (orderType === 'TAKEAWAY' ? 'Takeaway' : orderType === 'PARCEL' ? 'Parcel' : null),
          orderType,
          items: [...items],
          extras: [...extras],
          subtotal: calculationSummary.subtotal,
          discountType,
          discountValue,
          discountAmount: calculationSummary.discountAmount,
          taxableAmount: calculationSummary.taxableAmount,
          gstAmount: calculationSummary.gstAmount,
          cgstAmount: calculationSummary.cgstAmount,
          sgstAmount: calculationSummary.sgstAmount,
          igstAmount: calculationSummary.igstAmount,
          grandTotal: calculationSummary.grandTotal,
          paymentMethod: targetMethod,
          paymentStatus: finalStatus,
          amountPaid: targetAmount,
          balanceDue: finalBalanceDue,
          status: finalOrderStatus,
          createdBy: user?.uid || 'cashier',
          createdByName: user?.displayName || user?.email || 'Counter Cashier',
          taxConfigSnapshot: {
            enabled: settings.tax.enabled,
            gstin: settings.tax.gstin,
            pricingMode: settings.tax.pricingMode,
            defaultGstRate: settings.tax.defaultGstRate,
            isInterState: settings.tax.isInterState,
          },
        });
      }

      if (finalStatus === 'PAID') {
        try {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.8 },
            colors: ['#22c55e', '#16a34a', '#09090b'],
          });
        } catch {}
      }

      clearBill();
      return resultingOrder;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BillingContext.Provider
      value={{
        items,
        extras,
        customer,
        tableId,
        tableName,
        tableNumber,
        orderType,
        discountType,
        discountValue,
        paymentMethod,
        paymentStatus,
        amountPaid,
        isSubmitting,
        selectedCategory,
        searchQuery,
        editingOrderId,
        addItem,
        addCustomItem,
        updateItemQuantity,
        setItemQuantity,
        updateItemPrice,
        removeItem,
        addExtra,
        updateExtraQuantity,
        removeExtra,
        setTable,
        setTableNumber,
        setOrderType,
        clearBill,
        setCustomer,
        setDiscountType,
        setDiscountValue,
        setPaymentMethod,
        setPaymentStatus,
        setAmountPaid,
        setSelectedCategory,
        setSearchQuery,
        loadDraftOrder,
        subtotal: calculationSummary.subtotal,
        discountAmount: calculationSummary.discountAmount,
        taxableAmount: calculationSummary.taxableAmount,
        gstAmount: calculationSummary.gstAmount,
        cgstAmount: calculationSummary.cgstAmount,
        sgstAmount: calculationSummary.sgstAmount,
        igstAmount: calculationSummary.igstAmount,
        effectiveGstRate: calculationSummary.effectiveGstRate,
        grandTotal: calculationSummary.grandTotal,
        balanceDue,
        saveBillAsUnpaid,
        checkoutBill,
      }}
    >
      {children}
    </BillingContext.Provider>
  );
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (!context) throw new Error('useBilling must be used within a BillingProvider');
  return context;
};
