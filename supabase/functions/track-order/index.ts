import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, orderId } = await req.json();

    if (!email || !orderId || typeof email !== 'string' || typeof orderId !== 'string') {
      return new Response(JSON.stringify({ order: null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sanitizedEmail = email.trim().toLowerCase().slice(0, 255);
    const sanitizedOrderId = orderId.trim().slice(0, 50);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('orders')
      .select('id, status, total, items, created_at, tracking_code, tracking_url, shipping_carrier, shipped_at, customer_name')
      .eq('id', sanitizedOrderId)
      .eq('customer_email', sanitizedEmail)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ order: null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ order: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Track order error:', err);
    return new Response(JSON.stringify({ order: null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
