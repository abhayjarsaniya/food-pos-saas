import React, { useState, useEffect, useMemo } from 'react';
import { MenuItem, MenuItemVariant, OrderItem } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { X, Plus, Minus, Check, Trash2, ShoppingBag } from 'lucide-react';

interface MultiVariantModalProps {
  isOpen: boolean;
  item: MenuItem | null;
  currentBillItems: OrderItem[];
  onClose: () => void;
  onApply: (
    item: MenuItem,
    variantQuantities: { variant: MenuItemVariant; quantity: number }[]
  ) => void;
}

export const MultiVariantModal: React.FC<MultiVariantModalProps> = ({
  isOpen,
  item,
  currentBillItems,
  onClose,
  onApply,
}) => {
  // Extract all available variants for this product
  const availableVariants = useMemo(() => {
    if (!item || !item.variants) return [];
    return item.variants.filter((v) => v.isAvailable);
  }, [item]);

  // Current quantities already in the bill for each variant of THIS SPECIFIC item
  const inCartQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    if (!item) return map;

    currentBillItems.forEach((orderItem) => {
      // STRICT CHECK: The order item MUST belong to THIS exact product!
      // Never match by variantId alone without confirming product ownership,
      // as multiple menu products share generic variant names/IDs (e.g. 'var_oil', 'var_butter').
      const isThisProduct =
        orderItem.productId === item.id ||
        orderItem.itemId.startsWith(`${item.id}_`) ||
        orderItem.itemId === item.id;

      if (isThisProduct && orderItem.variantId) {
        map[orderItem.variantId] = (map[orderItem.variantId] || 0) + orderItem.quantity;
      }
    });

    return map;
  }, [item, currentBillItems]);

  // Local state tracking selected quantity for each variant - completely isolated to this product
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Reset and strictly initialize quantities when modal opens for an item
  useEffect(() => {
    if (item && isOpen) {
      const initial: Record<string, number> = {};
      availableVariants.forEach((v) => {
        // Pre-fill only with existing cart quantity if already present for THIS product, or default to 0
        initial[v.variantId] = inCartQuantities[v.variantId] || 0;
      });
      setQuantities(initial);
    } else {
      setQuantities({});
    }
  }, [item, isOpen, inCartQuantities, availableVariants]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const totalQuantity = Object.values(quantities).reduce((acc, q) => acc + (q || 0), 0);
  const initialTotalQuantity = Object.values(inCartQuantities).reduce((acc, q) => acc + (q || 0), 0);
  const isEditingExisting = initialTotalQuantity > 0;

  // Calculate live subtotal
  const subtotal = availableVariants.reduce((sum, v) => {
    const qty = quantities[v.variantId] || 0;
    const unitPrice = v.price > 1000 ? v.price / 100 : v.price;
    return sum + qty * unitPrice;
  }, 0);

  const handleIncrement = (variantId: string) => {
    setQuantities((prev) => ({
      ...prev,
      [variantId]: (prev[variantId] || 0) + 1,
    }));
  };

  const handleDecrement = (variantId: string) => {
    setQuantities((prev) => ({
      ...prev,
      [variantId]: Math.max(0, (prev[variantId] || 0) - 1),
    }));
  };

  const handleApply = () => {
    const payload = availableVariants.map((v) => ({
      variant: v,
      quantity: quantities[v.variantId] || 0,
    }));
    onApply(item, payload);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom duration-200 border border-[#E5EAE6]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5EAE6] flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <span
              className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <div className="min-w-0">
              <h3 className="font-extrabold text-base sm:text-lg text-[#202923] truncate leading-tight">
                {item.name}
              </h3>
              <p className="text-xs text-[#68736D] truncate mt-0.5">
                {isEditingExisting ? (
                  <span className="text-[#145C43] font-semibold">
                    Editing existing items in bill ({initialTotalQuantity} currently in cart)
                  </span>
                ) : (
                  <span>Select quantities for each variant</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#929B95] hover:text-[#202923] hover:bg-[#F7F9F7] active:scale-95 transition-all shrink-0"
            title="Close popup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Variant Rows */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-[#FFFFFF]">
          {availableVariants.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#929B95]">
              No active variants available for this item.
            </div>
          ) : (
            availableVariants.map((variant) => {
              const qty = quantities[variant.variantId] || 0;
              const unitPrice = variant.price > 1000 ? variant.price / 100 : variant.price;
              const inCartQty = inCartQuantities[variant.variantId] || 0;
              const lineTotal = qty * unitPrice;
              const isSelected = qty > 0;

              return (
                <div
                  key={variant.variantId}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'border-[#145C43] bg-[#EAF5EF]/40 shadow-xs ring-1 ring-[#145C43]/20'
                      : 'border-[#E5EAE6] bg-white hover:border-[#CFE5D8]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Variant Name & Price */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-[#202923]">
                          {variant.name}
                        </span>
                        {inCartQty > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF5EF] text-[#145C43] border border-[#CFE5D8]">
                            In Bill: {inCartQty}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm sm:text-base font-black font-mono text-[#145C43]">
                          {formatCurrency(unitPrice)}
                        </span>
                        <span className="text-xs text-[#68736D]">per item</span>
                      </div>
                    </div>

                    {/* Quantity Stepper (Minimum 48px touch controls) */}
                    <div className="flex items-center gap-1.5 shrink-0 bg-white p-1 rounded-2xl border border-[#E5EAE6] shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleDecrement(variant.variantId)}
                        disabled={qty === 0}
                        className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center text-[#202923] bg-[#F7F9F7] hover:bg-[#E5EAE6] active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none"
                        title={`Decrease ${variant.name}`}
                      >
                        <Minus className="w-5 h-5" />
                      </button>

                      <span className="min-w-[36px] text-center font-black text-base sm:text-lg font-mono text-[#202923]">
                        {qty}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleIncrement(variant.variantId)}
                        className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center text-white bg-[#145C43] hover:bg-[#0F4935] active:scale-90 transition-all shadow-2xs"
                        title={`Increase ${variant.name}`}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Line Total preview when quantity > 0 */}
                  {qty > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[#CFE5D8]/60 flex items-center justify-between text-xs font-mono">
                      <span className="text-[#68736D]">
                        {qty} × {formatCurrency(unitPrice)}
                      </span>
                      <span className="font-bold text-[#145C43]">
                        = {formatCurrency(lineTotal)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Bottom Actions & Live Calculation */}
        <div className="p-4 sm:p-5 border-t border-[#E5EAE6] bg-white space-y-3 shrink-0 safe-bottom">
          {/* Live Summary Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#145C43]" />
              <span className="text-xs sm:text-sm font-bold text-[#202923]">
                Total: <span className="font-mono text-[#145C43]">{totalQuantity}</span> Items
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#68736D] block">Subtotal</span>
              <span className="text-xl sm:text-2xl font-black font-mono text-[#145C43] leading-tight">
                {formatCurrency(subtotal)}
              </span>
            </div>
          </div>

          {/* Single Action Button */}
          {isEditingExisting && totalQuantity === 0 ? (
            <button
              type="button"
              onClick={handleApply}
              className="w-full min-h-[52px] bg-rose-600 hover:bg-rose-700 text-white text-sm sm:text-base font-bold rounded-2xl shadow-sm transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-5 h-5" />
              <span>Remove {item.name} from Bill</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              disabled={totalQuantity === 0}
              className="w-full min-h-[52px] bg-[#145C43] hover:bg-[#0F4935] text-white text-sm sm:text-base font-bold rounded-2xl shadow-sm transition-all active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-5 h-5" />
              <span>
                {isEditingExisting
                  ? `Update Bill – ${totalQuantity} Item${totalQuantity > 1 ? 's' : ''} (${formatCurrency(subtotal)})`
                  : totalQuantity > 0
                  ? `Add ${totalQuantity} Item${totalQuantity > 1 ? 's' : ''} to Bill – ${formatCurrency(subtotal)}`
                  : 'Select Items to Add'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
