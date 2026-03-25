import { supabase } from '@/integrations/supabase/client';

const normalizeSearchValue = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

const getVariationMatchScore = (
  query: string,
  variation: { sku?: string | null; barcode?: string | null }
) => {
  const normalizedQuery = normalizeSearchValue(query);
  const candidates = [variation.sku, variation.barcode]
    .map(normalizeSearchValue)
    .filter(Boolean);

  if (candidates.some((candidate) => candidate === normalizedQuery)) return 0;
  if (candidates.some((candidate) => candidate.startsWith(normalizedQuery))) return 1;
  if (candidates.some((candidate) => candidate.includes(normalizedQuery))) return 2;
  return 3;
};

const escapeIlike = (value: string) => value.replace(/[%,]/g, '').trim();

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
  is_lagoona?: boolean;
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
  sale_type?: 'varejo' | 'atacado' | 'exclusivo' | 'troca' | 'brinde' | 'colaborador';
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

    // Generate dedup hash to prevent duplicate sales
    const dedupHash = `${saleData.local_id}_${user.id}_${saleData.total}_${Date.now()}`;

    // Check for existing sale with the same local_id (duplicate prevention)
    const { data: existingSale } = await supabase
      .from('pos_sales')
      .select('id')
      .eq('local_id', saleData.local_id)
      .maybeSingle();

    if (existingSale) {
      // Return the existing sale instead of creating a duplicate
      const { data: fullSale } = await supabase
        .from('pos_sales')
        .select('*')
        .eq('id', existingSale.id)
        .single();
      return fullSale as unknown as POSSale;
    }

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
      sale_type: saleData.sale_type || 'varejo',
      dedup_hash: dedupHash,
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
      // Check if this is an online/website store sale (needs priority deduction from physical stores)
      const { data: storeData } = await supabase.from('stores').select('type').eq('id', storeId).single();
      const isOnlineSale = storeData?.type === 'online' || storeData?.type === 'website';

      if (isOnlineSale) {
        // Priority deduction: Hyper Modas 44 first, then other physical stores
        const { data: physicalStores } = await supabase
          .from('stores')
          .select('id, name')
          .eq('type', 'physical')
          .eq('is_active', true)
          .order('name');

        // Sort: "Hyper" stores first (priority), then others
        const sortedStores = (physicalStores || []).sort((a, b) => {
          const aIsHyper = a.name.toLowerCase().includes('hyper');
          const bIsHyper = b.name.toLowerCase().includes('hyper');
          if (aIsHyper && !bIsHyper) return -1;
          if (!aIsHyper && bIsHyper) return 1;
          return 0;
        });

        for (const item of saleData.items) {
          let remaining = item.quantity;
          for (const store of sortedStores) {
            if (remaining <= 0) break;

            let query = supabase
              .from('store_stock')
              .select('id, quantity')
              .eq('store_id', store.id)
              .eq('product_id', item.product_id);

            if (item.variation_id) {
              query = query.eq('variation_id', item.variation_id);
            } else {
              query = query.is('variation_id', null);
            }

            const { data: stock } = await query.maybeSingle();
            if (stock && stock.quantity > 0) {
              const deduct = Math.min(remaining, stock.quantity);
              await supabase
                .from('store_stock')
                .update({ quantity: stock.quantity - deduct })
                .eq('id', stock.id);
              remaining -= deduct;
            }
          }
        }
      } else {
        // Regular physical store deduction
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

  // Helper: enrich products with variation attribute labels and store_stock
  async _enrichWithLabels(products: any[]): Promise<any[]> {
    const allVariationIds = products.flatMap((p: any) =>
      (p.product_variations || []).map((v: any) => v.id)
    );
    const allProductIds = products.map((p: any) => p.id);
    if (allVariationIds.length === 0 && allProductIds.length === 0) return products;

    // Fetch labels and store_stock in parallel
    const [vvRes, stockRes] = await Promise.all([
      allVariationIds.length > 0
        ? supabase
            .from('product_variation_values')
            .select('variation_id, attribute_value_id, product_attribute_values(value, product_attributes(name))')
            .in('variation_id', allVariationIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('store_stock')
        .select('product_id, variation_id, quantity')
        .in('product_id', allProductIds),
    ]);

    const labels = new Map<string, string>();
    for (const vv of vvRes.data || []) {
      const attrValue = (vv as any).product_attribute_values as any;
      if (attrValue) {
        const attrName = attrValue.product_attributes?.name || '';
        const val = attrValue.value || '';
        const existing = labels.get((vv as any).variation_id);
        labels.set((vv as any).variation_id, existing ? `${existing} / ${val}` : `${attrName}: ${val}`);
      }
    }

    // Build stock maps from store_stock
    const stockByVariation = new Map<string, number>();
    const stockByProduct = new Map<string, number>();
    for (const s of (stockRes.data || []) as any[]) {
      if (s.variation_id) {
        stockByVariation.set(s.variation_id, (stockByVariation.get(s.variation_id) || 0) + s.quantity);
      } else {
        stockByProduct.set(s.product_id, (stockByProduct.get(s.product_id) || 0) + s.quantity);
      }
    }

    return products.map((p: any) => {
      const variations = (p.product_variations || []).map((v: any) => ({
        ...v,
        stock: stockByVariation.get(v.id) ?? v.stock ?? 0,
        label: labels.get(v.id) || v.sku || v.id.slice(0, 8),
      }));

      const totalStock = variations.length > 0
        ? variations.reduce((sum: number, v: any) => sum + v.stock, 0)
        : (stockByProduct.get(p.id) ?? p.stock ?? 0);

      return {
        ...p,
        stock: totalStock,
        product_variations: variations,
      };
    });
  },

  // Product lookup - returns product and optionally the matched variation ID
  async getProductByBarcode(barcode: string): Promise<{ product: any; matchedVariationId?: string } | null> {
    const normalizedBarcode = barcode.trim();

    // First try product-level barcode
    const { data: productByBarcode, error: err1 } = await supabase
      .from('products')
      .select('*, product_variations(*)')
      .eq('barcode', normalizedBarcode)
      .maybeSingle();

    if (err1) throw err1;
    if (productByBarcode) {
      const [enriched] = await this._enrichWithLabels([productByBarcode]);
      return { product: enriched };
    }

    // Then try variation-level barcode or SKU
    const { data: variationMatch, error: err2 } = await supabase
      .from('product_variations')
      .select('id, product_id, sku, barcode')
      .or(`barcode.eq.${normalizedBarcode},sku.eq.${normalizedBarcode}`)
      .limit(10);

    if (err2) throw err2;
    const bestVariationMatch = (variationMatch || [])
      .sort((a, b) => getVariationMatchScore(normalizedBarcode, a) - getVariationMatchScore(normalizedBarcode, b))[0];

    if (bestVariationMatch) {
      const { data: product, error: err3 } = await supabase
        .from('products')
        .select('*, product_variations(*)')
        .eq('id', bestVariationMatch.product_id)
        .maybeSingle();
      if (err3) throw err3;
      if (product) {
        const [enriched] = await this._enrichWithLabels([product]);
        return { product: enriched, matchedVariationId: bestVariationMatch.id };
      }
    }

    return null;
  },

  async searchProducts(query: string, limit = 20): Promise<{ products: any[]; matchedVariationMap: Record<string, string> }> {
    const trimmedQuery = query.trim();
    const sanitizedQuery = escapeIlike(trimmedQuery);
    const normalizedQuery = trimmedQuery.toLowerCase();

    if (!sanitizedQuery) {
      return {
        products: [],
        matchedVariationMap: {},
      };
    }

    // Search products by name or barcode
    const { data: directMatches, error: err1 } = await supabase
      .from('products')
      .select('*, product_variations(*)')
      .or(`name.ilike.%${sanitizedQuery}%,barcode.ilike.%${sanitizedQuery}%`)
      .limit(limit);

    if (err1) throw err1;

    // Also search by variation barcode or SKU
    // Use exact match for short queries (likely size codes like G, GG, M) to avoid
    // "G" matching "GG". For longer queries use partial match.
    const exactVariationMatchesPromise = supabase
      .from('product_variations')
      .select('id, product_id, sku, barcode')
      .or(`barcode.eq.${trimmedQuery},sku.eq.${trimmedQuery}`)
      .limit(limit);

    const partialVariationMatchesPromise = supabase
      .from('product_variations')
      .select('id, product_id, sku, barcode')
      .or(`barcode.ilike.%${sanitizedQuery}%,sku.ilike.%${sanitizedQuery}%`)
      .limit(limit);

    const [exactVariationMatchesRes, partialVariationMatchesRes] = await Promise.all([
      exactVariationMatchesPromise,
      partialVariationMatchesPromise,
    ]);

    if (exactVariationMatchesRes.error) throw exactVariationMatchesRes.error;
    if (partialVariationMatchesRes.error) throw partialVariationMatchesRes.error;

    const variationById = new Map<string, any>();
    [...(exactVariationMatchesRes.data || []), ...(partialVariationMatchesRes.data || [])].forEach((variation) => {
      variationById.set(variation.id, variation);
    });

    const variationMatches = [...variationById.values()]
      .filter((variation) => getVariationMatchScore(trimmedQuery, variation) < 3)
      .sort((a, b) => {
        const scoreDiff = getVariationMatchScore(trimmedQuery, a) - getVariationMatchScore(trimmedQuery, b);
        if (scoreDiff !== 0) return scoreDiff;

        const aExactBarcode = normalizeSearchValue(a.barcode) === normalizedQuery ? 0 : 1;
        const bExactBarcode = normalizeSearchValue(b.barcode) === normalizedQuery ? 0 : 1;
        if (aExactBarcode !== bExactBarcode) return aExactBarcode - bExactBarcode;

        return normalizeSearchValue(a.sku).localeCompare(normalizeSearchValue(b.sku));
      });

    // Build a map: product_id → matched variation_id
    const matchedVariationMap: Record<string, string> = {};
    const sortedVariationMatches = variationMatches;

    for (const v of sortedVariationMatches) {
      if (!matchedVariationMap[v.product_id]) {
        matchedVariationMap[v.product_id] = v.id;
      }
    }

    const directIds = new Set((directMatches || []).map((p: any) => p.id));
    const extraIds = sortedVariationMatches
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

    const allProducts = [...(directMatches || []), ...extraProducts].slice(0, limit);
    const enriched = await this._enrichWithLabels(allProducts);

    return {
      products: enriched,
      matchedVariationMap,
    };
  },

  async getAllActiveProducts() {
    const [productsRes, stockRes, variationValuesRes] = await Promise.all([
      supabase
        .from('products')
        .select('*, product_variations(*), categories(name)')
        .eq('visible_in_pos', true)
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
