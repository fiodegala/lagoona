import { supabase } from '@/integrations/supabase/client';

export interface POSSession {
  id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;
  status: 'open' | 'closed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface POSTransaction {
  id: string;
  session_id: string;
  type: 'sale' | 'withdrawal' | 'deposit' | 'opening' | 'closing';
  amount: number;
  payment_method: string | null;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

export interface POSSaleItem {
  product_id: string;
  variation_id?: string;
  name: string;
  sku?: string;
  image_url?: string | null;
  quantity: number;
  unit_price: number;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  discount_amount: number;
  total: number;
}

export interface POSSale {
  id: string;
  local_id: string;
  session_id: string | null;
  user_id: string;
  customer_name: string | null;
  customer_document: string | null;
  items: POSSaleItem[];
  subtotal: number;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number;
  discount_amount: number;
  total: number;
  payment_method: 'cash' | 'card' | 'pix' | 'mixed';
  payment_details: Record<string, number>;
  amount_received: number | null;
  change_amount: number;
  coupon_id: string | null;
  coupon_code: string | null;
  notes: string | null;
  synced: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSaleData {
  local_id: string;
  session_id?: string;
  store_id?: string;
  customer_id?: string;
  customer_name?: string;
  customer_document?: string;
  items: POSSaleItem[];
  subtotal: number;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  discount_amount?: number;
  total: number;
  payment_method: 'cash' | 'card' | 'pix' | 'mixed';
  payment_details?: Record<string, number>;
  amount_received?: number;
  change_amount?: number;
  coupon_id?: string;
  coupon_code?: string;
  notes?: string;
  sale_date?: string; // ISO date string for backdating sales
}

export const posService = {
  // Session Management
  async getOpenSession(): Promise<POSSession | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('pos_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as POSSession | null;
  },

  async openSession(openingBalance: number, notes?: string, storeId?: string): Promise<POSSession> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Check if there's already an open session
    const existingSession = await this.getOpenSession();
    if (existingSession) {
      throw new Error('Já existe uma sessão de caixa aberta');
    }

    const { data, error } = await supabase
      .from('pos_sessions')
      .insert({
        user_id: user.id,
        opening_balance: openingBalance,
        notes,
        status: 'open',
        store_id: storeId || null,
      } as never)
      .select()
      .single();

    if (error) throw error;

    // Create opening transaction
    await supabase.from('pos_transactions').insert({
      session_id: data.id,
      type: 'opening',
      amount: openingBalance,
      description: 'Abertura de caixa',
      created_by: user.id,
    });

    return data as POSSession;
  },

  async closeSession(
    sessionId: string,
    closingBalance: number,
    notes?: string
  ): Promise<POSSession> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Calculate expected balance
    const { data: transactions } = await supabase
      .from('pos_transactions')
      .select('type, amount, payment_method')
      .eq('session_id', sessionId);

    let expectedBalance = 0;
    transactions?.forEach((t) => {
      if (t.type === 'opening' || t.type === 'deposit') {
        expectedBalance += Number(t.amount);
      } else if (t.type === 'withdrawal') {
        expectedBalance -= Number(t.amount);
      } else if (t.type === 'sale' && t.payment_method === 'cash') {
        expectedBalance += Number(t.amount);
      }
    });

    const difference = closingBalance - expectedBalance;

    const { data, error } = await supabase
      .from('pos_sessions')
      .update({
        closed_at: new Date().toISOString(),
        closing_balance: closingBalance,
        expected_balance: expectedBalance,
        difference,
        status: 'closed',
        notes: notes || null,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;

    // Create closing transaction
    await supabase.from('pos_transactions').insert({
      session_id: sessionId,
      type: 'closing',
      amount: closingBalance,
      description: 'Fechamento de caixa',
      created_by: user.id,
    });

    return data as POSSession;
  },

  async getSessions(limit = 50): Promise<POSSession[]> {
    const { data, error } = await supabase
      .from('pos_sessions')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as POSSession[];
  },

  async getSessionById(id: string): Promise<POSSession | null> {
    const { data, error } = await supabase
      .from('pos_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as POSSession | null;
  },

  // Transaction Management
  async addTransaction(
    sessionId: string,
    type: 'withdrawal' | 'deposit',
    amount: number,
    description?: string
  ): Promise<POSTransaction> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('pos_transactions')
      .insert({
        session_id: sessionId,
        type,
        amount,
        description,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data as POSTransaction;
  },

  async getTransactionsBySession(sessionId: string): Promise<POSTransaction[]> {
    const { data, error } = await supabase
      .from('pos_transactions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as POSTransaction[];
  },

  // Sales Management
  async createSale(saleData: CreateSaleData): Promise<POSSale> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const insertData = {
      local_id: saleData.local_id,
      session_id: saleData.session_id || null,
      store_id: saleData.store_id || null,
      user_id: user.id,
      customer_id: saleData.customer_id || null,
      customer_name: saleData.customer_name || null,
      customer_document: saleData.customer_document || null,
      items: saleData.items as unknown as Record<string, unknown>[],
      subtotal: saleData.subtotal,
      discount_type: saleData.discount_type || null,
      discount_value: saleData.discount_value || 0,
      discount_amount: saleData.discount_amount || 0,
      total: saleData.total,
      payment_method: saleData.payment_method,
      payment_details: saleData.payment_details || {},
      amount_received: saleData.amount_received || null,
      change_amount: saleData.change_amount || 0,
      coupon_id: saleData.coupon_id || null,
      coupon_code: saleData.coupon_code || null,
      notes: saleData.notes || null,
      synced: true,
      ...(saleData.sale_date ? { created_at: saleData.sale_date } : {}),
    };

    const { data, error } = await supabase
      .from('pos_sales')
      .insert(insertData as never)
      .select()
      .single();

    if (error) throw error;

    // Create sale transaction for cash flow
    if (saleData.session_id) {
      if (saleData.payment_method === 'mixed' && saleData.payment_details) {
        // Create separate transactions for each payment method
        for (const [method, amount] of Object.entries(saleData.payment_details)) {
          if (amount > 0) {
            await supabase.from('pos_transactions').insert({
              session_id: saleData.session_id,
              type: 'sale',
              amount,
              payment_method: method,
              description: `Venda #${data.id.slice(0, 8)}`,
              created_by: user.id,
            });
          }
        }
      } else {
        await supabase.from('pos_transactions').insert({
          session_id: saleData.session_id,
          type: 'sale',
          amount: saleData.total,
          payment_method: saleData.payment_method,
          description: `Venda #${data.id.slice(0, 8)}`,
          created_by: user.id,
        });
      }
    }

    // Update store_stock for the seller's store
    const storeId = saleData.store_id;
    if (storeId) {
      for (const item of saleData.items) {
        let query = supabase
          .from('store_stock')
          .select('id, quantity')
          .eq('store_id', storeId)
          .eq('product_id', item.product_id);

        if (item.variation_id) {
          query = query.eq('variation_id', item.variation_id);
        } else {
          query = query.is('variation_id', null);
        }

        const { data: stock } = await query.maybeSingle();

        if (stock) {
          await supabase
            .from('store_stock')
            .update({ quantity: Math.max(0, stock.quantity - item.quantity) })
            .eq('id', stock.id);
        }
      }
    }

    return data as unknown as POSSale;
  },

  async getSalesBySession(sessionId: string): Promise<POSSale[]> {
    const { data, error } = await supabase
      .from('pos_sales')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as POSSale[];
  },

  async getSales(limit = 100): Promise<POSSale[]> {
    const { data, error } = await supabase
      .from('pos_sales')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as unknown as POSSale[];
  },

  async syncPendingSale(saleData: CreateSaleData): Promise<POSSale | null> {
    // Check if already synced by local_id
    const { data: existing } = await supabase
      .from('pos_sales')
      .select('id')
      .eq('local_id', saleData.local_id)
      .maybeSingle();

    if (existing) {
      return null; // Already synced
    }

    return this.createSale(saleData);
  },

  // Product lookup - returns product and optionally the matched variation ID
  async getProductByBarcode(barcode: string): Promise<{ product: any; matchedVariationId?: string } | null> {
    // First try product-level barcode
    const { data: productByBarcode, error: err1 } = await supabase
      .from('products')
      .select('*, product_variations(*)')
      .eq('barcode', barcode)
      .maybeSingle();

    if (err1) throw err1;
    if (productByBarcode) return { product: productByBarcode };

    // Then try variation-level barcode or SKU
    const { data: variationMatch, error: err2 } = await supabase
      .from('product_variations')
      .select('id, product_id')
      .or(`barcode.eq.${barcode},sku.eq.${barcode}`)
      .limit(1)
      .maybeSingle();

    if (err2) throw err2;
    if (variationMatch) {
      const { data: product, error: err3 } = await supabase
        .from('products')
        .select('*, product_variations(*)')
        .eq('id', variationMatch.product_id)
        .maybeSingle();
      if (err3) throw err3;
      if (product) return { product, matchedVariationId: variationMatch.id };
    }

    return null;
  },

  async searchProducts(query: string, limit = 20) {
    // Search products by name or barcode
    const { data: directMatches, error: err1 } = await supabase
      .from('products')
      .select('*, product_variations(*)')
      .or(`name.ilike.%${query}%,barcode.ilike.%${query}%`)
      .limit(limit);

    if (err1) throw err1;

    // Also search by variation barcode or SKU
    const { data: variationMatches, error: err2 } = await supabase
      .from('product_variations')
      .select('product_id')
      .or(`barcode.ilike.%${query}%,sku.ilike.%${query}%`)
      .limit(limit);

    if (err2) throw err2;

    const directIds = new Set((directMatches || []).map((p: any) => p.id));
    const extraIds = (variationMatches || [])
      .map((v: any) => v.product_id)
      .filter((id: string) => !directIds.has(id));

    let extraProducts: any[] = [];
    if (extraIds.length > 0) {
      const uniqueIds = [...new Set(extraIds)];
      const { data, error: err3 } = await supabase
        .from('products')
        .select('*, product_variations(*)')
        .in('id', uniqueIds)
        .limit(limit);
      if (err3) throw err3;
      extraProducts = data || [];
    }

    return [...(directMatches || []), ...extraProducts].slice(0, limit);
  },

  async getAllActiveProducts() {
    const [productsRes, stockRes, variationValuesRes] = await Promise.all([
      supabase
        .from('products')
        .select('*, product_variations(*), categories(name)')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('store_stock')
        .select('product_id, variation_id, quantity'),
      supabase
        .from('product_variation_values')
        .select('variation_id, attribute_value_id, product_attribute_values(value, product_attributes(name))'),
    ]);

    if (productsRes.error) throw productsRes.error;

    // Build variation attribute labels lookup
    const variationLabels = new Map<string, string>();
    for (const vv of variationValuesRes.data || []) {
      const attrValue = vv.product_attribute_values as any;
      if (attrValue) {
        const attrName = attrValue.product_attributes?.name || '';
        const val = attrValue.value || '';
        const existing = variationLabels.get(vv.variation_id);
        variationLabels.set(vv.variation_id, existing ? `${existing} / ${val}` : `${attrName}: ${val}`);
      }
    }

    // Build stock lookup from store_stock
    const stockByProduct = new Map<string, number>();
    const stockByVariation = new Map<string, number>();

    for (const s of stockRes.data || []) {
      if (s.variation_id) {
        stockByVariation.set(s.variation_id, (stockByVariation.get(s.variation_id) || 0) + s.quantity);
      } else {
        stockByProduct.set(s.product_id, (stockByProduct.get(s.product_id) || 0) + s.quantity);
      }
    }

    // Enrich products with aggregated stock
    const products = (productsRes.data || []).map((p: any) => {
      const variations = (p.product_variations || []).map((v: any) => ({
        ...v,
        stock: stockByVariation.get(v.id) || 0,
        label: variationLabels.get(v.id) || v.sku || v.id.slice(0, 8),
      }));

      // Product stock: if has variations, sum variation stocks; otherwise use store_stock
      const totalStock = variations.length > 0
        ? variations.reduce((sum: number, v: any) => sum + v.stock, 0)
        : (stockByProduct.get(p.id) || 0);

      return {
        ...p,
        stock: totalStock,
        product_variations: variations,
      };
    });

    return products;
  },
};
