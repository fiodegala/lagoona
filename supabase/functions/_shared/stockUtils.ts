/**
 * Shared stock utilities for edge functions.
 * Deducts from the store with the HIGHEST quantity first (dynamic, not hardcoded).
 * Restores to the store with the highest quantity that has a record.
 */

/**
 * Get physical stores sorted by stock quantity DESC for a given product/variation.
 */
async function getStoresSortedByStock(
  supabase: any,
  productId: string,
  variationId: string | null
) {
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

  // Filter out online/website store types
  const physicalRows = [];
  for (const row of (data || [])) {
    // Check if this is a physical store (not online/website)
    const { data: store } = await supabase
      .from('stores')
      .select('type')
      .eq('id', row.store_id)
      .single();

    if (store && !['online', 'website'].includes(store.type)) {
      physicalRows.push(row);
    }
  }

  return physicalRows;
}

/**
 * Deducts stock for order items, starting from the store with highest quantity.
 */
export async function deductStockForOrder(supabase: any, orderId: string, items?: any[]) {
  try {
    let orderItems = items;
    if (!orderItems) {
      const { data: order } = await supabase
        .from('orders')
        .select('items')
        .eq('id', orderId)
        .single();

      if (!order?.items || !Array.isArray(order.items)) {
        console.error(`No items found for order ${orderId}`);
        return;
      }
      orderItems = order.items;
    }

    for (const item of orderItems) {
      const productId = item.product_id;
      const variationId = item.variation_id || null;
      let remainingQty = item.quantity || 1;

      if (!productId) continue;

      // Get stores sorted by quantity DESC (highest first)
      const stockRows = await getStoresSortedByStock(supabase, productId, variationId);

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
        console.log(`Stock deducted: product=${productId}, variation=${variationId}, store=${stockRow.store_id}, qty=-${deduct}, remaining=${newQty}`);
      }

      if (remainingQty > 0) {
        console.warn(`Insufficient stock for product ${productId}, variation ${variationId}: ${remainingQty} units not deducted`);
      }
    }

    console.log(`Stock deduction completed for order ${orderId}`);
  } catch (err) {
    console.error(`Error deducting stock for order ${orderId}:`, err);
  }
}

/**
 * Restores stock for order items, adding to the store with the highest quantity (first available record).
 */
export async function restoreStockForOrder(supabase: any, orderId: string, items?: any[]) {
  try {
    let orderItems = items;
    if (!orderItems) {
      const { data: order } = await supabase
        .from('orders')
        .select('items')
        .eq('id', orderId)
        .single();

      if (!order?.items || !Array.isArray(order.items)) {
        console.error(`No items to restore for order ${orderId}`);
        return;
      }
      orderItems = order.items;
    }

    for (const item of orderItems) {
      const productId = item.product_id;
      const variationId = item.variation_id || null;
      const quantity = item.quantity || 1;

      if (!productId) continue;

      // Get stores sorted by quantity DESC — restore to the one with highest stock
      const stockRows = await getStoresSortedByStock(supabase, productId, variationId);

      if (stockRows.length > 0) {
        const stockRow = stockRows[0]; // Highest quantity store
        const newQty = stockRow.quantity + quantity;
        await supabase
          .from('store_stock')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', stockRow.id);

        console.log(`Stock restored: product=${productId}, variation=${variationId}, store=${stockRow.store_id}, qty=+${quantity}, new_total=${newQty}`);
      } else {
        console.warn(`No stock record found to restore: product=${productId}, variation=${variationId}`);
      }
    }

    console.log(`Stock restoration completed for order ${orderId}`);
  } catch (err) {
    console.error(`Error restoring stock for order ${orderId}:`, err);
  }
}
