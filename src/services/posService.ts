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

    // Update product stock
    for (const item of saleData.items) {
      if (item.variation_id) {
        const { data: variation } = await supabase
          .from('product_variations')
          .select('stock')
          .eq('id', item.variation_id)
          .single();

        if (variation) {
          await supabase
            .from('product_variations')
            .update({ stock: Math.max(0, variation.stock - item.quantity) })
            .eq('id', item.variation_id);
        }
      } else {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single();

        if (product) {
          await supabase
            .from('products')
            .update({ stock: Math.max(0, product.stock - item.quantity) })
            .eq('id', item.product_id);
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

  // Product lookup
  async getProductByBarcode(barcode: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*, product_variations(*)')
      .eq('barcode', barcode)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async searchProducts(query: string, limit = 20) {
    const { data, error } = await supabase
      .from('products')
      .select('*, product_variations(*)')
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,barcode.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async getAllActiveProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*, product_variations(*), categories(name)')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },
};
