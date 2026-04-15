import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deductStockForOrder, restoreStockForOrder } from "../_shared/stockUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Check admin/manager
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

    const { order_id, return_item, new_item } = await req.json();

    if (!order_id || !return_item || !new_item) {
      return new Response(JSON.stringify({ error: 'order_id, return_item and new_item are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (fetchError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Restore stock for the returned item
    const returnItems = [{
      product_id: return_item.product_id,
      variation_id: return_item.variation_id || null,
      quantity: return_item.quantity || 1,
    }];
    await restoreStockForOrder(supabase, order_id, returnItems);
    console.log(`Stock restored for returned item: product=${return_item.product_id}`);

    // 2. Deduct stock for the new item
    const newItems = [{
      product_id: new_item.product_id,
      variation_id: new_item.variation_id || null,
      quantity: new_item.quantity || 1,
    }];
    await deductStockForOrder(supabase, order_id, newItems);
    console.log(`Stock deducted for new item: product=${new_item.product_id}`);

    // 3. Update order items - replace the returned item with the new one
    const currentItems = Array.isArray(order.items) ? order.items : JSON.parse(order.items as string);
    
    // Mark returned item
    const updatedItems = currentItems.map((item: any) => {
      const matchesProduct = item.product_id === return_item.product_id;
      const matchesVariation = (item.variation_id || null) === (return_item.variation_id || null);
      if (matchesProduct && matchesVariation && !item.exchanged) {
        return { ...item, exchanged: true, exchange_note: `Trocado por: ${new_item.product_name}` };
      }
      return item;
    });

    // Add new item
    updatedItems.push({
      product_id: new_item.product_id,
      variation_id: new_item.variation_id || null,
      name: new_item.product_name,
      product_name: new_item.product_name,
      variation_label: new_item.variation_label || null,
      price: new_item.price,
      quantity: new_item.quantity || 1,
      image_url: new_item.image_url || null,
      sku: new_item.sku || null,
      is_exchange: true,
      exchange_note: `Troca do item: ${return_item.product_name}`,
    });

    // Calculate new total
    const newTotal = updatedItems
      .filter((i: any) => !i.exchanged)
      .reduce((sum: number, i: any) => sum + (Number(i.price) * (i.quantity || 1)), 0);

    // Build exchange note
    const exchangeNote = `[TROCA ${new Date().toLocaleDateString('pt-BR')}] Devolvido: ${return_item.product_name}${return_item.variation_label ? ` (${return_item.variation_label})` : ''} → Novo: ${new_item.product_name}${new_item.variation_label ? ` (${new_item.variation_label})` : ''}`;
    const existingNotes = order.notes || '';
    const combinedNotes = existingNotes ? `${existingNotes}\n${exchangeNote}` : exchangeNote;

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        items: updatedItems,
        total: newTotal,
        notes: combinedNotes,
      })
      .eq('id', order_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, new_total: newTotal }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error processing exchange:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
