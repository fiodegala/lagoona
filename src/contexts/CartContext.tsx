import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { couponsService, Coupon, CouponValidationResult } from '@/services/coupons';
import { combosService, Combo } from '@/services/combos';

export interface CartItem {
  id: string;
  productId: string;
  variationId?: string;
  name: string;
  variationLabel?: string;
  price: number;
  originalPrice?: number;
  isPromotional?: boolean;
  quantity: number;
  imageUrl?: string;
  stock: number;
}

interface AppliedCoupon {
  coupon: Coupon;
  discount: number;
}

export interface AppliedCombo {
  combo: Combo;
  discount: number;
  freeShipping: boolean;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getTotal: () => number;
  appliedCoupon: AppliedCoupon | null;
  applyCoupon: (code: string, customerEmail?: string) => Promise<CouponValidationResult>;
  removeCoupon: () => void;
  couponLoading: boolean;
  appliedCombos: AppliedCombo[];
  comboDiscount: number;
  comboFreeShipping: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'store-cart';
const COUPON_STORAGE_KEY = 'store-coupon';

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(COUPON_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });

  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCombos, setAppliedCombos] = useState<AppliedCombo[]>([]);
  const [activeCombos, setActiveCombos] = useState<Combo[]>([]);

  // Load active combos on mount
  useEffect(() => {
    combosService.listActiveWithItems()
      .then(setActiveCombos)
      .catch(() => {}); // silent fail
  }, []);

  // Detect combos when cart changes
  useEffect(() => {
    if (activeCombos.length === 0 || items.length === 0) {
      setAppliedCombos([]);
      return;
    }

    const detected: AppliedCombo[] = [];

    for (const combo of activeCombos) {
      if (!combo.items || combo.items.length === 0) continue;

      // Aggregate combo requirements by product+variation key
      const comboRequirements = new Map<string, { product_id: string; variation_id: string | null; totalQty: number }>();
      for (const comboItem of combo.items) {
        const key = `${comboItem.product_id}__${comboItem.variation_id || 'any'}`;
        const existing = comboRequirements.get(key);
        if (existing) {
          existing.totalQty += comboItem.quantity;
        } else {
          comboRequirements.set(key, {
            product_id: comboItem.product_id,
            variation_id: comboItem.variation_id,
            totalQty: comboItem.quantity,
          });
        }
      }

      // Check if all aggregated requirements are met by the cart
      const allMatch = Array.from(comboRequirements.values()).every((req) => {
        // Find matching cart items and sum their quantities
        const matchingQty = items
          .filter((ci) => {
            if (ci.productId !== req.product_id) return false;
            if (req.variation_id) return ci.variationId === req.variation_id;
            return true;
          })
          .reduce((sum, ci) => sum + ci.quantity, 0);
        return matchingQty >= req.totalQty;
      });

      if (allMatch) {
        // Calculate original price of combo items
        let originalPrice = 0;
        combo.items.forEach((comboItem) => {
          const cartItem = items.find((ci) => {
            const productMatch = ci.productId === comboItem.product_id;
            if (!productMatch) return false;
            if (comboItem.variation_id) return ci.variationId === comboItem.variation_id;
            return true;
          });
          if (cartItem) {
            originalPrice += cartItem.price * comboItem.quantity;
          }
        });

        const discount = Math.max(0, originalPrice - combo.combo_price);
        if (discount > 0 || combo.free_shipping) {
          detected.push({
            combo,
            discount,
            freeShipping: combo.free_shipping,
          });
        }
      }
    }

    setAppliedCombos(detected);
  }, [items, activeCombos]);

  const comboDiscount = appliedCombos.reduce((sum, ac) => sum + ac.discount, 0);
  const comboFreeShipping = appliedCombos.some(ac => ac.freeShipping);

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Persist coupon to localStorage
  useEffect(() => {
    if (appliedCoupon) {
      localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
    } else {
      localStorage.removeItem(COUPON_STORAGE_KEY);
    }
  }, [appliedCoupon]);

  // Revalidate coupon when cart changes
  useEffect(() => {
    if (appliedCoupon && items.length > 0) {
      const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
      
      let discount = 0;
      if (appliedCoupon.coupon.discount_type === 'percentage') {
        discount = (subtotal * appliedCoupon.coupon.discount_value) / 100;
        if (appliedCoupon.coupon.maximum_discount && discount > appliedCoupon.coupon.maximum_discount) {
          discount = appliedCoupon.coupon.maximum_discount;
        }
      } else {
        discount = appliedCoupon.coupon.discount_value;
      }

      if (discount > subtotal) discount = subtotal;

      if (appliedCoupon.coupon.minimum_order_value && subtotal < appliedCoupon.coupon.minimum_order_value) {
        setAppliedCoupon(null);
      } else if (discount !== appliedCoupon.discount) {
        setAppliedCoupon({ ...appliedCoupon, discount });
      }
    } else if (appliedCoupon && items.length === 0) {
      setAppliedCoupon(null);
    }
  }, [items]);

  const addItem = (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems(current => {
      const existingIndex = current.findIndex(item => item.id === newItem.id);
      if (existingIndex >= 0) {
        const updated = [...current];
        const newQuantity = updated[existingIndex].quantity + (newItem.quantity || 1);
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.min(newQuantity, updated[existingIndex].stock),
        };
        return updated;
      }
      return [...current, { ...newItem, quantity: newItem.quantity || 1 }];
    });
  };

  const removeItem = (id: string) => {
    setItems(current => current.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) { removeItem(id); return; }
    setItems(current =>
      current.map(item =>
        item.id === id ? { ...item, quantity: Math.min(quantity, item.stock) } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
  };

  const getItemCount = () => items.reduce((total, item) => total + item.quantity, 0);

  const getSubtotal = () => items.reduce((total, item) => total + item.price * item.quantity, 0);

  const getTotal = () => {
    const subtotal = getSubtotal();
    const couponDiscountVal = appliedCoupon?.discount || 0;
    return Math.max(0, subtotal - couponDiscountVal - comboDiscount);
  };

  const applyCoupon = async (code: string, customerEmail?: string): Promise<CouponValidationResult> => {
    setCouponLoading(true);
    try {
      const subtotal = getSubtotal();
      const productIds = items.map(item => item.productId);
      const result = await couponsService.validateCoupon(code, subtotal, customerEmail, productIds);
      if (result.valid && result.coupon && result.discount !== undefined) {
        setAppliedCoupon({ coupon: result.coupon, discount: result.discount });
      }
      return result;
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => setAppliedCoupon(null);

  return (
    <CartContext.Provider
      value={{
        items, addItem, removeItem, updateQuantity, clearCart,
        getItemCount, getSubtotal, getTotal,
        appliedCoupon, applyCoupon, removeCoupon, couponLoading,
        appliedCombos, comboDiscount, comboFreeShipping,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

