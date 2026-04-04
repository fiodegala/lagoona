import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deductStockForOrder, restoreStockForOrder } from "../_shared/stockUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Stock utilities imported from _shared/stockUtils.ts

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if user is admin or manager
    const { data: roleCheck } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'manager'])
      .limit(1);

    if (!roleCheck || roleCheck.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { order_id, status } = await req.json();

    if (!order_id || !status) {
      return new Response(JSON.stringify({ error: 'order_id and status are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current order
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, items, payment_status')
      .eq('id', order_id)
      .single();

    if (fetchError || !currentOrder) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const previousStatus = currentOrder.status;

    // Update order status
    const updateData: any = { status };
    if (status === 'cancelled') {
      updateData.payment_status = 'failed';
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order_id);

    if (updateError) {
      throw updateError;
    }

    // Stock management logic
    const wasConfirmed = ['confirmed', 'processing', 'shipped', 'delivered'].includes(previousStatus);
    const isNowCancelled = status === 'cancelled';
    const isNowConfirmed = ['confirmed', 'processing', 'shipped', 'delivered'].includes(status);
    const wasCancelled = previousStatus === 'cancelled';
    const wasPending = previousStatus === 'pending';

    // Restore stock if going from confirmed → cancelled
    if (wasConfirmed && isNowCancelled) {
      await restoreStockForOrder(supabase, order_id, currentOrder.items);
      console.log(`Stock restored for cancelled order ${order_id}`);
    }

    // Deduct stock if going from pending → confirmed (manual confirmation)
    if (wasPending && isNowConfirmed) {
      await deductStockForOrder(supabase, order_id, currentOrder.items);
      console.log(`Stock deducted for confirmed order ${order_id}`);
    }

    return new Response(
      JSON.stringify({ success: true, previous_status: previousStatus, new_status: status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error updating order status:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function restoreStockForOrder(supabase: any, orderId: string, items: any[]) {
  try {
    if (!items || !Array.isArray(items)) {
      console.error(`No items to restore for order ${orderId}`);
      return;
    }

    for (const item of items) {
      const productId = item.product_id;
      const variationId = item.variation_id || null;
      const quantity = item.quantity || 1;

      if (!productId) continue;

      // Restore to the first store that has a stock record for this product/variation
      for (const storeId of STORE_PRIORITY) {
        let query = supabase
          .from('store_stock')
          .select('id, quantity')
          .eq('store_id', storeId)
          .eq('product_id', productId);

        if (variationId) {
          query = query.eq('variation_id', variationId);
        } else {
          query = query.is('variation_id', null);
        }

        const { data: stockRow } = await query.single();

        if (stockRow) {
          const newQty = stockRow.quantity + quantity;
          await supabase
            .from('store_stock')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', stockRow.id);

          console.log(`Stock restored: product=${productId}, variation=${variationId}, store=${storeId}, qty=+${quantity}, new_total=${newQty}`);
          break; // Restore to first available store only
        }
      }
    }

    console.log(`Stock restoration completed for order ${orderId}`);
  } catch (err) {
    console.error(`Error restoring stock for order ${orderId}:`, err);
  }
}

async function deductStockForOrder(supabase: any, orderId: string, items: any[]) {
  try {
    if (!items || !Array.isArray(items)) {
      console.error(`No items to deduct for order ${orderId}`);
      return;
    }

    for (const item of items) {
      const productId = item.product_id;
      const variationId = item.variation_id || null;
      let remainingQty = item.quantity || 1;

      if (!productId) continue;

      for (const storeId of STORE_PRIORITY) {
        if (remainingQty <= 0) break;

        let query = supabase
          .from('store_stock')
          .select('id, quantity')
          .eq('store_id', storeId)
          .eq('product_id', productId);

        if (variationId) {
          query = query.eq('variation_id', variationId);
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
        console.log(`Stock deducted: product=${productId}, variation=${variationId}, store=${storeId}, qty=-${deduct}, remaining=${newQty}`);
      }
    }

    console.log(`Stock deduction completed for order ${orderId}`);
  } catch (err) {
    console.error(`Error deducting stock for order ${orderId}:`, err);
  }
}
