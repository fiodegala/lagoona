import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { couponsService, Coupon, CouponValidationResult } from '@/services/coupons';

export interface CartItem {
  id: string;
  productId: string;
  variationId?: string;
  name: string;
  variationLabel?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  stock: number;
}

interface AppliedCoupon {
  coupon: Coupon;
  discount: number;
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
      
      // Recalculate discount
      let discount = 0;
      if (appliedCoupon.coupon.discount_type === 'percentage') {
        discount = (subtotal * appliedCoupon.coupon.discount_value) / 100;
        if (appliedCoupon.coupon.maximum_discount && discount > appliedCoupon.coupon.maximum_discount) {
          discount = appliedCoupon.coupon.maximum_discount;
        }
      } else {
        discount = appliedCoupon.coupon.discount_value;
      }

      if (discount > subtotal) {
        discount = subtotal;
      }

      // Check minimum order value
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
        // Update quantity if item exists
        const updated = [...current];
        const newQuantity = updated[existingIndex].quantity + (newItem.quantity || 1);
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.min(newQuantity, updated[existingIndex].stock),
        };
        return updated;
      }
      
      // Add new item
      return [...current, { ...newItem, quantity: newItem.quantity || 1 }];
    });
  };

  const removeItem = (id: string) => {
    setItems(current => current.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(id);
      return;
    }
    
    setItems(current =>
      current.map(item =>
        item.id === id
          ? { ...item, quantity: Math.min(quantity, item.stock) }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
  };

  const getItemCount = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const getSubtotal = () => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getTotal = () => {
    const subtotal = getSubtotal();
    const discount = appliedCoupon?.discount || 0;
    return Math.max(0, subtotal - discount);
  };

  const applyCoupon = async (code: string, customerEmail?: string): Promise<CouponValidationResult> => {
    setCouponLoading(true);
    
    try {
      const subtotal = getSubtotal();
      const productIds = items.map(item => item.productId);
      
      const result = await couponsService.validateCoupon(code, subtotal, customerEmail, productIds);

      if (result.valid && result.coupon && result.discount !== undefined) {
        setAppliedCoupon({
          coupon: result.coupon,
          discount: result.discount,
        });
      }

      return result;
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getItemCount,
        getSubtotal,
        getTotal,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        couponLoading,
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
