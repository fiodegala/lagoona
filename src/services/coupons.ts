import { supabase } from '@/integrations/supabase/client';

export type DiscountType = 'percentage' | 'fixed' | 'free_shipping' | 'shipping_fixed' | 'shipping_percentage' | 'progressive';

export interface ProgressiveTier {
  min: number; // min quantity or min order value
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
}

export interface ProgressiveConfig {
  basis: 'quantity' | 'order_value'; // by item count or order total
  tiers: ProgressiveTier[];
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  minimum_order_value: number;
  maximum_discount: number | null;
  max_uses: number | null;
  uses_count: number;
  max_uses_per_customer: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  applicable_categories: string[];
  applicable_products: string[];
  applicable_shipping_zones: string[];
  applicable_to_combos: boolean;
  show_in_wheel: boolean;
  progressive_tiers: ProgressiveConfig | null;
  created_at: string;
  updated_at: string;
}

export interface CouponUsage {
  id: string;
  coupon_id: string;
  order_id: string | null;
  customer_email: string;
  discount_applied: number;
  used_at: string;
}

export interface CreateCouponData {
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  minimum_order_value?: number;
  maximum_discount?: number;
  max_uses?: number;
  max_uses_per_customer?: number;
  starts_at?: string;
  expires_at?: string;
  is_active?: boolean;
  applicable_categories?: string[];
  applicable_products?: string[];
  applicable_shipping_zones?: string[];
  show_in_wheel?: boolean;
  progressive_tiers?: ProgressiveConfig | null;
}

export interface CouponValidationResult {
  valid: boolean;
  coupon?: Coupon;
  error?: string;
  discount?: number;
  shipping_discount?: number; // separate field for shipping discounts
}

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Porcentagem (%)',
  fixed: 'Valor fixo (R$)',
  free_shipping: 'Frete Grátis',
  shipping_fixed: 'Desconto fixo no frete (R$)',
  shipping_percentage: 'Desconto % no frete',
  progressive: 'Desconto Progressivo',
};

export const couponsService = {
  async getAll(): Promise<Coupon[]> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(d => ({
      ...d,
      progressive_tiers: d.progressive_tiers as unknown as ProgressiveConfig | null,
    })) as Coupon[];
  },

  async getById(id: string): Promise<Coupon | null> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return { ...data, progressive_tiers: data.progressive_tiers as unknown as ProgressiveConfig | null } as Coupon;
  },

  async getByCode(code: string): Promise<Coupon | null> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return { ...data, progressive_tiers: data.progressive_tiers as unknown as ProgressiveConfig | null } as Coupon;
  },

  async create(input: CreateCouponData): Promise<Coupon> {
    const { data, error } = await supabase
      .from('coupons')
      .insert({
        ...input,
        code: input.code.toUpperCase().trim(),
        progressive_tiers: input.progressive_tiers as any,
      })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Coupon;
  },

  async update(id: string, input: Partial<CreateCouponData>): Promise<Coupon> {
    const updateData: any = { ...input };
    if (input.code) {
      updateData.code = input.code.toUpperCase().trim();
    }
    if (input.progressive_tiers !== undefined) {
      updateData.progressive_tiers = input.progressive_tiers as any;
    }

    const { data, error } = await supabase
      .from('coupons')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Coupon;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('coupons')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
  },

  async validateCoupon(
    code: string, 
    orderTotal: number, 
    customerEmail?: string,
    productIds?: string[],
    categoryIds?: string[],
    itemCount?: number,
    shippingCost?: number,
    shippingZoneId?: string
  ): Promise<CouponValidationResult> {
    try {
      const coupon = await this.getByCode(code);

      if (!coupon) {
        return { valid: false, error: 'Cupom não encontrado' };
      }

      if (!coupon.is_active) {
        return { valid: false, error: 'Cupom inativo' };
      }

      const now = new Date();
      if (coupon.starts_at && new Date(coupon.starts_at) > now) {
        return { valid: false, error: 'Cupom ainda não está ativo' };
      }

      if (coupon.expires_at && new Date(coupon.expires_at) < now) {
        return { valid: false, error: 'Cupom expirado' };
      }

      if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
        return { valid: false, error: 'Cupom esgotado' };
      }

      if (customerEmail && coupon.max_uses_per_customer) {
        const { count } = await supabase
          .from('coupon_usage')
          .select('*', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id)
          .eq('customer_email', customerEmail);

        if (count !== null && count >= coupon.max_uses_per_customer) {
          return { valid: false, error: 'Você já usou este cupom o número máximo de vezes' };
        }
      }

      if (coupon.minimum_order_value && orderTotal < coupon.minimum_order_value) {
        return { 
          valid: false, 
          error: `Valor mínimo do pedido: R$ ${coupon.minimum_order_value.toFixed(2)}` 
        };
      }

      if (coupon.applicable_categories && coupon.applicable_categories.length > 0 && categoryIds) {
        const hasApplicableCategory = categoryIds.some(
          catId => coupon.applicable_categories.includes(catId)
        );
        if (!hasApplicableCategory) {
          return { valid: false, error: 'Cupom não aplicável aos produtos do carrinho' };
        }
      }

      if (coupon.applicable_products && coupon.applicable_products.length > 0 && productIds) {
        const hasApplicableProduct = productIds.some(
          prodId => coupon.applicable_products.includes(prodId)
        );
        if (!hasApplicableProduct) {
          return { valid: false, error: 'Cupom não aplicável aos produtos do carrinho' };
        }
      }

      // Check applicable shipping zones for shipping-type coupons
      const isShippingCoupon = ['free_shipping', 'shipping_fixed', 'shipping_percentage'].includes(coupon.discount_type);
      if (isShippingCoupon && coupon.applicable_shipping_zones && coupon.applicable_shipping_zones.length > 0) {
        if (!shippingZoneId || !coupon.applicable_shipping_zones.includes(shippingZoneId)) {
          return { valid: false, error: 'Cupom não aplicável para esta região de entrega' };
        }
      }

      // Calculate discount based on type
      let discount = 0;
      let shipping_discount = 0;

      switch (coupon.discount_type) {
        case 'percentage':
          discount = (orderTotal * coupon.discount_value) / 100;
          if (coupon.maximum_discount && discount > coupon.maximum_discount) {
            discount = coupon.maximum_discount;
          }
          break;

        case 'fixed':
          discount = coupon.discount_value;
          break;

        case 'free_shipping':
          shipping_discount = shippingCost || 0;
          break;

        case 'shipping_fixed':
          shipping_discount = Math.min(coupon.discount_value, shippingCost || 0);
          break;

        case 'shipping_percentage':
          shipping_discount = ((shippingCost || 0) * coupon.discount_value) / 100;
          break;

        case 'progressive': {
          if (coupon.progressive_tiers) {
            const config = coupon.progressive_tiers;
            const checkValue = config.basis === 'quantity' ? (itemCount || 0) : orderTotal;
            
            // Sort tiers descending to find the best matching tier
            const sortedTiers = [...config.tiers].sort((a, b) => b.min - a.min);
            const matchedTier = sortedTiers.find(t => checkValue >= t.min);

            if (matchedTier) {
              if (matchedTier.discount_type === 'percentage') {
                discount = (orderTotal * matchedTier.discount_value) / 100;
              } else {
                discount = matchedTier.discount_value;
              }
              if (coupon.maximum_discount && discount > coupon.maximum_discount) {
                discount = coupon.maximum_discount;
              }
            }
          }
          break;
        }
      }

      // Don't let discount exceed order total
      if (discount > orderTotal) {
        discount = orderTotal;
      }

      return { valid: true, coupon, discount, shipping_discount };
    } catch (error) {
      console.error('Error validating coupon:', error);
      return { valid: false, error: 'Erro ao validar cupom' };
    }
  },

  async recordUsage(
    couponId: string, 
    customerEmail: string, 
    discountApplied: number,
    orderId?: string
  ): Promise<void> {
    const { error: usageError } = await supabase
      .from('coupon_usage')
      .insert({
        coupon_id: couponId,
        customer_email: customerEmail,
        discount_applied: discountApplied,
        order_id: orderId,
      });

    if (usageError) throw usageError;

    const { data: coupon } = await supabase
      .from('coupons')
      .select('uses_count')
      .eq('id', couponId)
      .single();

    if (coupon) {
      await supabase
        .from('coupons')
        .update({ uses_count: (coupon.uses_count || 0) + 1 })
        .eq('id', couponId);
    }
  },

  async getUsage(couponId: string): Promise<CouponUsage[]> {
    const { data, error } = await supabase
      .from('coupon_usage')
      .select('*')
      .eq('coupon_id', couponId)
      .order('used_at', { ascending: false });

    if (error) throw error;
    return (data || []) as CouponUsage[];
  },
};
