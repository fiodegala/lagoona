import { supabase } from '@/integrations/supabase/client';

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
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
  discount_type: 'percentage' | 'fixed';
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
}

export interface CouponValidationResult {
  valid: boolean;
  coupon?: Coupon;
  error?: string;
  discount?: number;
}

export const couponsService = {
  async getAll(): Promise<Coupon[]> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Coupon[];
  },

  async getById(id: string): Promise<Coupon | null> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Coupon;
  },

  async getByCode(code: string): Promise<Coupon | null> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Coupon | null;
  },

  async create(input: CreateCouponData): Promise<Coupon> {
    const { data, error } = await supabase
      .from('coupons')
      .insert({
        ...input,
        code: input.code.toUpperCase().trim(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as Coupon;
  },

  async update(id: string, input: Partial<CreateCouponData>): Promise<Coupon> {
    const updateData: any = { ...input };
    if (input.code) {
      updateData.code = input.code.toUpperCase().trim();
    }

    const { data, error } = await supabase
      .from('coupons')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Coupon;
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
    categoryIds?: string[]
  ): Promise<CouponValidationResult> {
    try {
      const coupon = await this.getByCode(code);

      if (!coupon) {
        return { valid: false, error: 'Cupom não encontrado' };
      }

      if (!coupon.is_active) {
        return { valid: false, error: 'Cupom inativo' };
      }

      // Check dates
      const now = new Date();
      if (coupon.starts_at && new Date(coupon.starts_at) > now) {
        return { valid: false, error: 'Cupom ainda não está ativo' };
      }

      if (coupon.expires_at && new Date(coupon.expires_at) < now) {
        return { valid: false, error: 'Cupom expirado' };
      }

      // Check usage limits
      if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
        return { valid: false, error: 'Cupom esgotado' };
      }

      // Check per-customer usage
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

      // Check minimum order value
      if (coupon.minimum_order_value && orderTotal < coupon.minimum_order_value) {
        return { 
          valid: false, 
          error: `Valor mínimo do pedido: R$ ${coupon.minimum_order_value.toFixed(2)}` 
        };
      }

      // Check applicable categories
      if (coupon.applicable_categories && coupon.applicable_categories.length > 0 && categoryIds) {
        const hasApplicableCategory = categoryIds.some(
          catId => coupon.applicable_categories.includes(catId)
        );
        if (!hasApplicableCategory) {
          return { valid: false, error: 'Cupom não aplicável aos produtos do carrinho' };
        }
      }

      // Check applicable products
      if (coupon.applicable_products && coupon.applicable_products.length > 0 && productIds) {
        const hasApplicableProduct = productIds.some(
          prodId => coupon.applicable_products.includes(prodId)
        );
        if (!hasApplicableProduct) {
          return { valid: false, error: 'Cupom não aplicável aos produtos do carrinho' };
        }
      }

      // Calculate discount
      let discount = 0;
      if (coupon.discount_type === 'percentage') {
        discount = (orderTotal * coupon.discount_value) / 100;
        if (coupon.maximum_discount && discount > coupon.maximum_discount) {
          discount = coupon.maximum_discount;
        }
      } else {
        discount = coupon.discount_value;
      }

      // Don't let discount exceed order total
      if (discount > orderTotal) {
        discount = orderTotal;
      }

      return { valid: true, coupon, discount };
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
    // Record usage
    const { error: usageError } = await supabase
      .from('coupon_usage')
      .insert({
        coupon_id: couponId,
        customer_email: customerEmail,
        discount_applied: discountApplied,
        order_id: orderId,
      });

    if (usageError) throw usageError;

    // Get current uses_count and increment
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
