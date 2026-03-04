import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/services/products';

const PAGE_SIZE = 1000;

/**
 * Fetches all rows from store_stock for given product IDs,
 * paginating to avoid the 1000-row Supabase limit.
 */
async function fetchAllStockForProducts(productIds: string[]) {
  const allRows: { product_id: string; quantity: number }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('store_stock')
      .select('product_id, quantity')
      .in('product_id', productIds)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error loading store_stock:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

/**
 * Loads real stock from store_stock table and enriches products.
 * The products.stock column is legacy; real stock is in store_stock.
 */
export async function enrichProductsWithStock(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products;

  const productIds = products.map(p => p.id);
  const stockData = await fetchAllStockForProducts(productIds);

  // Sum quantities per product across all stores
  const stockMap: Record<string, number> = {};
  stockData.forEach((row) => {
    stockMap[row.product_id] = (stockMap[row.product_id] || 0) + row.quantity;
  });

  return products.map(p => ({
    ...p,
    stock: stockMap[p.id] ?? p.stock,
  }));
}

/**
 * Loads real stock for a single product from store_stock.
 */
export async function getProductRealStock(productId: string): Promise<number> {
  const { data, error } = await supabase
    .from('store_stock')
    .select('quantity')
    .eq('product_id', productId);

  if (error) {
    console.error('Error loading stock:', error);
    return 0;
  }

  return (data || []).reduce((sum, row) => sum + row.quantity, 0);
}
