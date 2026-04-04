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

// Stock functions are imported from _shared/stockUtils.ts
