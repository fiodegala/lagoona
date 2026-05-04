import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const generateKey = (prefix: string, length: number) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(array[i] % chars.length);
  }
  return result;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Use service role for DB operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check user is admin or manager
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "manager"]);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { name, description, scopes, allowed_ips, rate_limit_per_minute, expires_at } = body;

      if (!name || typeof name !== "string" || name.length > 200) {
        return new Response(JSON.stringify({ error: "Invalid name" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!Array.isArray(scopes)) {
        return new Response(JSON.stringify({ error: "Invalid scopes" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate keys server-side with crypto-secure randomness
      const publicKey = generateKey("pk_", 32);
      const secretKey = generateKey("sk_", 48);
      const accessToken = generateKey("at_", 64);
      const webhookSecret = generateKey("whsec_", 32);

      // Hash with bcrypt (cost factor 12)
      const secretKeyHash = await bcrypt.hash(secretKey, await bcrypt.genSalt(12));

      const { data, error } = await supabase
        .from("api_keys")
        .insert({
          name,
          description: description || null,
          public_key: publicKey,
          secret_key_hash: secretKeyHash,
          scopes,
          allowed_ips: allowed_ips || [],
          rate_limit_per_minute: rate_limit_per_minute || 60,
          expires_at: expires_at || null,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({
        apiKey: data,
        secretKey,
        accessToken,
        webhookSecret,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "rotate") {
      const { id } = body;

      if (!id || typeof id !== "string") {
        return new Response(JSON.stringify({ error: "Invalid id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const publicKey = generateKey("pk_", 32);
      const secretKey = generateKey("sk_", 48);
      const accessToken = generateKey("at_", 64);
      const webhookSecret = generateKey("whsec_", 32);

      const secretKeyHash = await bcrypt.hash(secretKey, await bcrypt.genSalt(12));

      const { error } = await supabase
        .from("api_keys")
        .update({
          public_key: publicKey,
          secret_key_hash: secretKeyHash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      return new Response(JSON.stringify({
        publicKey,
        secretKey,
        accessToken,
        webhookSecret,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in manage-api-key:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
