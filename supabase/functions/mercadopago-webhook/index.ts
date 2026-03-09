import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // MercadoPago sends notifications via POST with JSON body
    // and also via query params for IPN
    let topic: string | null = null;
    let resourceId: string | null = null;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        console.log('MP Webhook received:', JSON.stringify(body));

        // Webhook v2 format: { action: "payment.updated", data: { id: "123" }, type: "payment" }
        if (body.type === 'payment' && body.data?.id) {
          topic = 'payment';
          resourceId = String(body.data.id);
        }
        // IPN format: { topic: "payment", id: "123" }
        else if (body.topic === 'payment' && body.id) {
          topic = 'payment';
          resourceId = String(body.id);
        }
        // Also handle the resource URL format
        else if (body.resource) {
          const match = body.resource.match(/payments\/(\d+)/);
          if (match) {
            topic = 'payment';
            resourceId = match[1];
          }
        }
      } catch {
        // If body parse fails, try query params
      }
    }

    // Also check query parameters (MercadoPago IPN sends topic & id as query params)
    if (!topic) {
      topic = url.searchParams.get('topic') || url.searchParams.get('type');
      resourceId = url.searchParams.get('data.id') || url.searchParams.get('id');
    }

    if (topic !== 'payment' || !resourceId) {
      console.log(`Ignoring non-payment notification: topic=${topic}, id=${resourceId}`);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      console.error('MERCADOPAGO_ACCESS_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'Not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch payment details from MercadoPago API
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const paymentData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error(`Failed to fetch payment ${resourceId}:`, JSON.stringify(paymentData));
      return new Response(JSON.stringify({ error: 'Failed to fetch payment' }), {
        status: 200, // Return 200 to prevent MercadoPago from retrying
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Payment ${resourceId}: status=${paymentData.status}, external_ref=${paymentData.external_reference}`);

    const orderId = paymentData.external_reference;
    if (!orderId) {
      console.log('No external_reference (order_id) found in payment');
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Map MercadoPago status to order status
    let orderStatus: string;
    let paymentStatus: string;

    switch (paymentData.status) {
      case 'approved':
        orderStatus = 'confirmed';
        paymentStatus = 'paid';
        break;
      case 'pending':
      case 'in_process':
      case 'authorized':
        orderStatus = 'pending';
        paymentStatus = 'pending';
        break;
      case 'rejected':
        // Keep order pending so user can retry with another card/method
        orderStatus = 'pending';
        paymentStatus = 'pending';
        break;
      case 'cancelled':
        orderStatus = 'cancelled';
        paymentStatus = 'failed';
        break;
      case 'refunded':
      case 'charged_back':
        orderStatus = 'cancelled';
        paymentStatus = 'refunded';
        break;
      default:
        orderStatus = 'pending';
        paymentStatus = 'pending';
    }

    // Check current order status before updating (avoid double stock deduction)
    const { data: currentOrder } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    const wasAlreadyConfirmed = currentOrder?.status === 'confirmed';

    // Update the order
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: orderStatus,
        payment_status: paymentStatus,
        payment_method: paymentData.payment_method_id || null,
        metadata: {
          mercadopago_payment_id: paymentData.id,
          payment_status: paymentData.status,
          payment_status_detail: paymentData.status_detail,
          payment_type_id: paymentData.payment_type_id,
          installments: paymentData.installments || 1,
          transaction_amount: paymentData.transaction_amount,
          webhook_updated_at: new Date().toISOString(),
        },
      })
      .eq('id', orderId);

    if (updateError) {
      console.error(`Error updating order ${orderId}:`, updateError);
    } else {
      console.log(`Order ${orderId} updated: status=${orderStatus}, payment=${paymentStatus}`);
    }

    // Deduct stock only if newly confirmed (not already confirmed by mercadopago-payment)
    if (orderStatus === 'confirmed' && !wasAlreadyConfirmed && !updateError) {
      await deductStockForOrder(supabase, orderId);
      // Mark abandoned cart as recovered
      await recoverAbandonedCart(supabase, orderId);
    }

    // Restore stock if order was confirmed but now cancelled/refunded
    if (wasAlreadyConfirmed && ['cancelled'].includes(orderStatus) && !updateError) {
      await restoreStockForOrder(supabase, orderId);
    }

    // Log the webhook
    await supabase.from('payment_webhooks').insert({
      provider: 'mercadopago',
      event_type: `payment.${paymentData.status}`,
      payload: paymentData,
      status: updateError ? 'error' : 'processed',
      processed_at: updateError ? null : new Date().toISOString(),
      error_message: updateError ? updateError.message : null,
    });

    return new Response(JSON.stringify({ received: true, order_updated: !updateError }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 200, // Return 200 to prevent endless retries
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Priority order for stock deduction: Hyper Modas 44 first, then Bernardo Sayão
const STORE_PRIORITY = [
  '351fbca7-44d9-42eb-8a77-76fa9fc3227c', // Hyper Modas 44
  'ad756bb1-e8ff-43a7-ac5c-c600ba7bd0e3', // Bernardo Sayão
];

async function deductStockForOrder(supabase: any, orderId: string) {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('items')
      .eq('id', orderId)
      .single();

    if (!order?.items || !Array.isArray(order.items)) {
      console.error(`No items found for order ${orderId}`);
      return;
    }

    for (const item of order.items) {
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

      if (remainingQty > 0) {
        console.warn(`Insufficient stock for product ${productId}, variation ${variationId}: ${remainingQty} units not deducted`);
      }
    }

    console.log(`Stock deduction completed for order ${orderId}`);
  } catch (err) {
    console.error(`Error deducting stock for order ${orderId}:`, err);
  }
}

async function restoreStockForOrder(supabase: any, orderId: string) {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('items')
      .eq('id', orderId)
      .single();

    if (!order?.items || !Array.isArray(order.items)) {
      console.error(`No items to restore for order ${orderId}`);
      return;
    }

    for (const item of order.items) {
      const productId = item.product_id;
      const variationId = item.variation_id || null;
      const quantity = item.quantity || 1;

      if (!productId) continue;

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
          break;
        }
      }
    }

    console.log(`Stock restoration completed for order ${orderId}`);
  } catch (err) {
    console.error(`Error restoring stock for order ${orderId}:`, err);
  }
}
