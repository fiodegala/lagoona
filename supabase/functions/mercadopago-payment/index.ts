import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MP_API = 'https://api.mercadopago.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN is not configured');
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'create_payment') {
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

async function createPayment(body: any, accessToken: string) {
  const {
    payment_method_id,
    transaction_amount,
    description,
    installments,
    token,
    issuer_id,
    payer,
    order_id,
    additional_info,
  } = body;

  // Build payment body based on method
  const paymentBody: any = {
    transaction_amount: Number(transaction_amount),
    description: description || 'Compra na Loja',
    payment_method_id,
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
    throw new Error(data.message || `Mercado Pago API error [${response.status}]: ${JSON.stringify(data)}`);
  }

  // Build response based on payment method
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

  // Date of expiration
  if (data.date_of_expiration) {
    result.date_of_expiration = data.date_of_expiration;
  }

  return new Response(
    JSON.stringify(result),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getPayment(paymentId: string, accessToken: string) {
  const response = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
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
