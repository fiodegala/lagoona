import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deductStockForOrder, restoreStockForOrder } from "../_shared/stockUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const fmt = (n: number) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`;

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

    const body = await req.json();
    const { order_id } = body;

    // Backwards compatible: accept single return_item/new_item or arrays
    const returnItems: any[] = Array.isArray(body.return_items)
      ? body.return_items
      : (body.return_item ? [body.return_item] : []);
    const newItems: any[] = Array.isArray(body.new_items)
      ? body.new_items
      : (body.new_item ? [body.new_item] : []);

    if (!order_id || returnItems.length === 0 || newItems.length === 0) {
      return new Response(JSON.stringify({ error: 'order_id, return_items and new_items are required' }), {
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

    // 1. Restore stock for the returned items
    await restoreStockForOrder(supabase, order_id, returnItems.map((r) => ({
      product_id: r.product_id,
      variation_id: r.variation_id || null,
      quantity: r.quantity || 1,
    })));
    console.log(`Stock restored for ${returnItems.length} returned item(s)`);

    // 2. Deduct stock for the new items
    await deductStockForOrder(supabase, order_id, newItems.map((n) => ({
      product_id: n.product_id,
      variation_id: n.variation_id || null,
      quantity: n.quantity || 1,
    })));
    console.log(`Stock deducted for ${newItems.length} new item(s)`);

    // 3. Update order items
    const currentItems = Array.isArray(order.items) ? order.items : JSON.parse(order.items as string);
    const updatedItems = [...currentItems];
    const newNames = newItems.map((n) => n.product_name).join(', ');

    for (const ret of returnItems) {
      const idx = updatedItems.findIndex((item: any) =>
        item.product_id === ret.product_id &&
        (item.variation_id || null) === (ret.variation_id || null) &&
        !item.exchanged
      );
      if (idx >= 0) {
        updatedItems[idx] = {
          ...updatedItems[idx],
          // allow price correction of the returned item (credit value)
          price: ret.price !== undefined && ret.price !== null ? Number(ret.price) : updatedItems[idx].price,
          exchanged: true,
          exchange_note: `Trocado por: ${newNames}`,
        };
      }
    }

    for (const item of newItems) {
      updatedItems.push({
        product_id: item.product_id,
        variation_id: item.variation_id || null,
        name: item.product_name,
        product_name: item.product_name,
        variation_label: item.variation_label || null,
        price: Number(item.price),
        quantity: item.quantity || 1,
        image_url: item.image_url || null,
        sku: item.sku || null,
        is_exchange: true,
        exchange_note: `Troca do(s) item(ns): ${returnItems.map((r) => r.product_name).join(', ')}`,
      });
    }

    // Calculate new total
    const newTotal = updatedItems
      .filter((i: any) => !i.exchanged)
      .reduce((sum: number, i: any) => sum + (Number(i.price) * (i.quantity || 1)), 0);

    const returnTotal = returnItems.reduce((s, r) => s + Number(r.price ?? 0) * (r.quantity || 1), 0);
    const newItemsTotal = newItems.reduce((s, n) => s + Number(n.price ?? 0) * (n.quantity || 1), 0);
    const diff = newItemsTotal - returnTotal;

    // Build exchange note
    const label = (i: any) => `${i.product_name}${i.variation_label ? ` (${i.variation_label})` : ''} x${i.quantity || 1} - ${fmt(i.price ?? 0)}`;
    const exchangeNote = `[TROCA ${new Date().toLocaleDateString('pt-BR')}] Devolvido: ${returnItems.map(label).join(' | ')} → Novo: ${newItems.map(label).join(' | ')} | Diferença: ${diff >= 0 ? '+' : '-'}${fmt(Math.abs(diff))}`;
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
      JSON.stringify({ success: true, new_total: newTotal, difference: diff }),
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
