import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate VAPID keys using Web Crypto API
async function generateVapidKeys() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  // Convert to URL-safe base64 for applicationServerKey
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return {
    publicKey: publicKeyBase64,
    publicKeyJwk,
    privateKeyJwk,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();
    
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
    }

    // Check if keys already exist in store_config
    const { data: existing } = await supabaseAdmin
      .from('store_config')
      .select('value')
      .eq('key', 'vapid_public_key')
      .single();

    if (existing) {
      return new Response(JSON.stringify({ 
        publicKey: (existing.value as any).key,
        message: 'Keys already exist' 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const keys = await generateVapidKeys();

    // Store public key in store_config (public)
    await supabaseAdmin.from('store_config').upsert({
      key: 'vapid_public_key',
      value: { key: keys.publicKey },
      is_public: true,
    }, { onConflict: 'key' });

    // Store private key in store_config (private)
    await supabaseAdmin.from('store_config').upsert({
      key: 'vapid_private_key',
      value: keys.privateKeyJwk,
      is_public: false,
    }, { onConflict: 'key' });

    return new Response(JSON.stringify({ 
      publicKey: keys.publicKey,
      message: 'Keys generated successfully' 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
