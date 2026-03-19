import { supabase } from '@/integrations/supabase/client';

// Priority order for stock deduction: Hyper Modas 44 first, then Bernardo Sayão
const STORE_PRIORITY = [
  '351fbca7-44d9-42eb-8a77-76fa9fc3227c', // Hyper Modas 44
  'ad756bb1-e8ff-43a7-ac5c-c600ba7bd0e3', // Bernardo Sayão
];

interface QuoteItem {
  product_id: string;
  variation_id?: string | null;
  quantity: number;
}

/**
 * Deducts stock from store_stock for each item in a quote,
 * following store priority (Hyper Modas 44 first).
 */
export async function deductStockForQuote(items: QuoteItem[]): Promise<void> {
  for (const item of items) {
    let remainingQty = item.quantity || 1;
    if (!item.product_id) continue;

    for (const storeId of STORE_PRIORITY) {
      if (remainingQty <= 0) break;

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

      const { data: stockRow } = await query.single();
      if (!stockRow || stockRow.quantity <= 0) continue;

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
 * Restores to the first store that has a record for the product/variation.
 */
export async function restoreStockForQuote(items: QuoteItem[]): Promise<void> {
  for (const item of items) {
    const quantity = item.quantity || 1;
    if (!item.product_id) continue;

    for (const storeId of STORE_PRIORITY) {
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

      const { data: stockRow } = await query.single();
      if (stockRow) {
        await supabase
          .from('store_stock')
          .update({ quantity: stockRow.quantity + quantity, updated_at: new Date().toISOString() })
          .eq('id', stockRow.id);
        break;
      }
    }
  }
}
