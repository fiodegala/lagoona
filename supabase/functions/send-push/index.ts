import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Web Push implementation using Web Crypto
async function sendWebPush(subscription: any, payload: string, privateKeyJwk: any, publicKey: string) {
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys.p256dh;
  const auth = subscription.keys.auth;

  // For simplicity, send a basic push without encryption (works for most browsers)
  // Full encryption requires ECDH + HKDF which is complex in Deno
  // Instead, we use the fetch API with VAPID auth

  const audience = new URL(endpoint).origin;
  const subject = 'mailto:contato@fiodegala.com.br';

  // Create JWT for VAPID
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    exp: now + 86400,
    sub: subject,
  };

  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const claimsB64 = btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsignedToken = `${headerB64}.${claimsB64}`;

  // Import private key
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Sign
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format expected by Web Push
  const sigArray = new Uint8Array(signature);
  const sigB64 = btoa(String.fromCharCode(...sigArray))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwt = `${unsignedToken}.${sigB64}`;

  const vapidHeader = `vapid t=${jwt}, k=${publicKey}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': vapidHeader,
        'TTL': '86400',
        'Content-Type': 'application/json',
        'Content-Length': '0',
      },
    });

    return { success: response.ok, status: response.status, endpoint };
  } catch (err) {
    return { success: false, error: err.message, endpoint };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, message, type, entityId } = await req.json();

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get VAPID keys
    const { data: pubKeyData } = await supabaseAdmin
      .from('store_config')
      .select('value')
      .eq('key', 'vapid_public_key')
      .single();

    const { data: privKeyData } = await supabaseAdmin
      .from('store_config')
      .select('value')
      .eq('key', 'vapid_private_key')
      .single();

    if (!pubKeyData || !privKeyData) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const publicKey = (pubKeyData.value as any).key;
    const privateKeyJwk = privKeyData.value;

    // Get all push subscriptions for admin users
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'No subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payload = JSON.stringify({ title, message, type, entityId });
    const results = [];
    const expired: string[] = [];

    for (const sub of subscriptions) {
      const result = await sendWebPush(sub.subscription, payload, privateKeyJwk, publicKey);
      results.push(result);

      // Mark gone subscriptions as inactive
      if (result.status === 410 || result.status === 404) {
        expired.push(sub.id);
      }
    }

    // Cleanup expired
    if (expired.length > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('id', expired);
    }

    return new Response(JSON.stringify({ sent: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Push error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
