import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deductStockForOrder, restoreStockForOrder } from "../_shared/stockUtils.ts";
import { recordCouponUsageForOrder } from "../_shared/couponUsage.ts";
import { validateInstallmentsForPromo } from "../_shared/valentinesPromo.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MP_API = 'https://api.mercadopago.com';

// In-memory rate limiting per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests/minute for payment creation

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN is not configured');
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'create_payment') {
      // Rate limit payment creation
      if (!checkRateLimit(ip)) {
        return new Response(
          JSON.stringify({ error: 'Too many requests. Try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate order exists before processing payment
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      if (body.order_id) {
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('id, total, status')
          .eq('id', body.order_id)
          .single();

        // Only allow payment for pending orders
        if (order && order.status !== 'pending') {
          return new Response(
            JSON.stringify({ error: 'Order is not in a payable state' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (orderError || !order) {
          return new Response(
            JSON.stringify({ error: 'Invalid order' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate amount matches order total (tolerance for rounding + PIX discount)
        const roundedAmount = Math.round(Number(body.transaction_amount) * 100) / 100;
        const orderTotal = Math.round(Number(order.total) * 100) / 100;
        const amountDiff = Math.abs(roundedAmount - orderTotal);
        // Allow up to 10% difference to accommodate PIX discounts
        const maxAllowedDiff = orderTotal * 0.10;
        if (amountDiff > maxAllowedDiff) {
          return new Response(
            JSON.stringify({ error: 'Amount mismatch' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'order_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return await createPayment(body, accessToken);
    } else if (action === 'get_payment') {
      return await getPayment(body.payment_id, accessToken);
    } else if (action === 'get_public_key') {
      const publicKey = Deno.env.get('MERCADOPAGO_PUBLIC_KEY');
      if (!publicKey) throw new Error('MERCADOPAGO_PUBLIC_KEY is not configured');
      return new Response(
        JSON.stringify({ public_key: publicKey }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    console.error('Mercado Pago error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function createCardToken(cardDetails: any, accessToken: string) {
  const number = String(cardDetails.card_number || '').replace(/\D/g, '');
  let month = String(cardDetails.expiration_month || '').replace(/\D/g, '');
  let year = String(cardDetails.expiration_year || '').replace(/\D/g, '');
  if (year.length === 2) year = `20${year}`;
  const cvv = String(cardDetails.security_code || '').replace(/\D/g, '');
  const name = String(cardDetails.cardholder_name || '').trim();

  if (number.length < 13 || number.length > 19) throw new Error('Número do cartão inválido');
  if (!month || Number(month) < 1 || Number(month) > 12) throw new Error('Mês de validade inválido');
  if (year.length !== 4) throw new Error('Ano de validade inválido');
  if (cvv.length < 3 || cvv.length > 4) throw new Error('CVV inválido');
  if (!name) throw new Error('Nome do titular obrigatório');

  const payload: any = {
    card_number: number,
    expiration_month: Number(month),
    expiration_year: Number(year),
    security_code: cvv,
    cardholder: {
      name,
      identification: cardDetails.identification || undefined,
    },
  };

  const res = await fetch(`${MP_API}/v1/card_tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data?.id) {
    console.error('MP card_tokens error:', JSON.stringify(data));
    throw new Error(data?.message || 'Não foi possível validar os dados do cartão');
  }
  return data;
}

async function detectPaymentMethodId(bin: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${MP_API}/v1/payment_methods/search?bin=${bin}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const data = await res.json();
    return data?.results?.[0]?.id || null;
  } catch (_e) {
    return null;
  }
}

async function createPayment(body: any, accessToken: string) {
  const {
    transaction_amount,
    description,
    installments,
    issuer_id,
    payer,
    order_id,
    additional_info,
    card_details,
  } = body;

  let { payment_method_id, token } = body;

  // Server-side tokenization when raw card data is sent (no front-end mock/SDK)
  if (!token && card_details) {
    const cardToken = await createCardToken(
      { ...card_details, identification: card_details.identification || payer?.identification },
      accessToken,
    );
    token = cardToken.id;
    if (!payment_method_id) {
      const bin = cardToken.first_six_digits || String(card_details.card_number || '').replace(/\D/g, '').slice(0, 6);
      payment_method_id = await detectPaymentMethodId(bin, accessToken);
    }
  }

  // Input validation
  if (!payment_method_id || !transaction_amount || !payer?.email) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: payment_method_id, transaction_amount, payer.email' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const amount = Math.round(Number(transaction_amount) * 100) / 100;
  if (isNaN(amount) || amount <= 0 || amount > 100000) {
    return new Response(
      JSON.stringify({ error: 'Invalid transaction amount' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }


  // Server-side enforcement of Valentine's promo rules:
  // - credit card installments capped at 2x
  // - no PIX 5% discount during promo (handled by amount tolerance already)
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: cfgRow } = await supabaseAdmin
      .from('store_config')
      .select('value')
      .eq('key', 'valentines_promo')
      .maybeSingle();
    const cfg = (cfgRow?.value as any) || {};
    const promoError = validateInstallmentsForPromo({
      cfg,
      isCard: !!token,
      installments: Number(installments || 1),
    });
    if (promoError) {
      return new Response(
        JSON.stringify({ error: promoError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (e) {
    console.error('Valentines promo check failed:', e);
  }

  // Build notification URL for MercadoPago webhooks
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

  const paymentBody: any = {
    transaction_amount: amount,
    description: typeof description === 'string' ? description.slice(0, 200) : 'Compra na Loja',
    payment_method_id,
    notification_url: notificationUrl,
    payer: {
      email: payer.email,
      first_name: payer.first_name || undefined,
      last_name: payer.last_name || undefined,
      identification: payer.identification || undefined,
    },
    external_reference: order_id || undefined,
    additional_info: additional_info || undefined,
  };

  // Credit card specific fields
  if (token) {
    paymentBody.token = token;
    paymentBody.installments = installments || 1;
    paymentBody.issuer_id = issuer_id || undefined;
  }

  const idempotencyKey = crypto.randomUUID();

  const response = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(paymentBody),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('MP API error:', JSON.stringify(data));
    throw new Error(data.message || `Mercado Pago API error [${response.status}]`);
  }

  const result: any = {
    id: data.id,
    status: data.status,
    status_detail: data.status_detail,
    payment_method_id: data.payment_method_id,
    payment_type_id: data.payment_type_id,
    installments: data.installments || 1,
    transaction_amount: data.transaction_amount,
    external_reference: data.external_reference,
  };

  // Update order status server-side immediately (for instant approvals like credit card)
  if (order_id) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let orderStatus = 'pending';
    let paymentStatus = 'pending';

    if (data.status === 'approved') {
      orderStatus = 'confirmed';
      paymentStatus = 'paid';
    }
    // For rejected/cancelled: keep order as 'pending' so user can retry with another card
    // The webhook will handle definitive status updates later

    // Preserve existing metadata (customer_document, customer_phone, abandoned_cart_session_id, affiliate_code, etc.)
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('metadata')
      .eq('id', order_id)
      .single();

    await supabase
      .from('orders')
      .update({
        status: orderStatus,
        payment_status: paymentStatus,
        payment_method: data.payment_method_id,
        metadata: {
          ...(existingOrder?.metadata || {}),
          mercadopago_payment_id: data.id,
          payment_status: data.status,
          payment_status_detail: data.status_detail,
          payment_type_id: data.payment_type_id,
          installments: data.installments || 1,
          transaction_amount: data.transaction_amount,
        },
      })
      .eq('id', order_id);

    // Deduct stock and recover abandoned cart when payment is approved
    if (data.status === 'approved') {
      await deductStockForOrder(supabase, order_id);
      await recoverAbandonedCart(supabase, order_id);
      await recordCouponUsageForOrder(supabase, order_id);
    }
  }

  // PIX: return QR code data
  if (data.point_of_interaction?.transaction_data) {
    result.pix_qr_code = data.point_of_interaction.transaction_data.qr_code;
    result.pix_qr_code_base64 = data.point_of_interaction.transaction_data.qr_code_base64;
    result.ticket_url = data.point_of_interaction.transaction_data.ticket_url;
  }

  // Boleto: return ticket URL
  if (data.transaction_details?.external_resource_url) {
    result.boleto_url = data.transaction_details.external_resource_url;
    result.barcode = data.barcode?.content;
  }

  if (data.date_of_expiration) {
    result.date_of_expiration = data.date_of_expiration;
  }

  return new Response(
    JSON.stringify(result),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getPayment(paymentId: string | number, accessToken: string) {
  const id = String(paymentId);
  if (!id || !/^\d{1,20}$/.test(id)) {
    return new Response(
      JSON.stringify({ error: 'Invalid payment_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const response = await fetch(`${MP_API}/v1/payments/${id}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to get payment [${response.status}]`);
  }

  return new Response(
    JSON.stringify({
      id: data.id,
      status: data.status,
      status_detail: data.status_detail,
      payment_method_id: data.payment_method_id,
      payment_type_id: data.payment_type_id,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}


async function recoverAbandonedCart(supabase: any, orderId: string) {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('metadata, customer_email, customer_phone')
      .eq('id', orderId)
      .single();

    if (!order) return;

    const sessionId = order.metadata?.abandoned_cart_session_id;

    if (sessionId) {
      const { error } = await supabase
        .from('abandoned_carts')
        .update({ status: 'recovered', recovered_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('status', 'abandoned');

      if (!error) {
        console.log(`Abandoned cart recovered for session ${sessionId} (order ${orderId})`);
        return;
      }
    }

    // Fallback: match by email
    if (order.customer_email) {
      await supabase
        .from('abandoned_carts')
        .update({ status: 'recovered', recovered_at: new Date().toISOString() })
        .eq('customer_email', order.customer_email)
        .eq('status', 'abandoned');
    }

    console.log(`Abandoned cart recovery attempted for order ${orderId}`);
  } catch (err) {
    console.error(`Error recovering abandoned cart for order ${orderId}:`, err);
  }
}
