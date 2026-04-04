import { supabase } from '@/integrations/supabase/client';

interface QuoteItem {
  product_id: string;
  variation_id?: string | null;
  quantity: number;
}

/**
 * Gets physical stores sorted by stock quantity DESC for a product/variation.
 * Deducts from the store with the HIGHEST quantity first.
 */
async function getStoresSortedByStock(productId: string, variationId: string | null) {
  let query = supabase
    .from('store_stock')
    .select('id, store_id, quantity')
    .eq('product_id', productId)
    .order('quantity', { ascending: false });

  if (variationId) {
    query = query.eq('variation_id', variationId);
  } else {
    query = query.is('variation_id', null);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching stock rows:', error);
    return [];
  }

  return data || [];
}

/**
 * Deducts stock from store_stock for each item in a quote,
 * starting from the store with the highest quantity.
 */
export async function deductStockForQuote(items: QuoteItem[]): Promise<void> {
  for (const item of items) {
    let remainingQty = item.quantity || 1;
    if (!item.product_id) continue;

    const stockRows = await getStoresSortedByStock(item.product_id, item.variation_id || null);

    for (const stockRow of stockRows) {
      if (remainingQty <= 0) break;
      if (stockRow.quantity <= 0) continue;

      const deduct = Math.min(remainingQty, stockRow.quantity);
      const newQty = stockRow.quantity - deduct;

      await supabase
        .from('store_stock')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', stockRow.id);

      remainingQty -= deduct;
    }
  }
}

/**
 * Restores stock to store_stock for each item in a quote.
 * Restores to the store with the highest quantity (first record).
 */
export async function restoreStockForQuote(items: QuoteItem[]): Promise<void> {
  for (const item of items) {
    const quantity = item.quantity || 1;
    if (!item.product_id) continue;

    const stockRows = await getStoresSortedByStock(item.product_id, item.variation_id || null);

    if (stockRows.length > 0) {
      const stockRow = stockRows[0]; // Highest quantity store
      await supabase
        .from('store_stock')
        .update({ quantity: stockRow.quantity + quantity, updated_at: new Date().toISOString() })
        .eq('id', stockRow.id);
    }
  }
}
