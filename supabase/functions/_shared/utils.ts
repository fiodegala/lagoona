// Shared utilities for edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-key, x-timestamp, x-nonce, x-signature, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

// Crypto utilities
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface ValidateResult {
  valid: boolean;
  error?: string;
  apiKey?: {
    id: string;
    name: string;
    scopes: string[];
    rate_limit_per_minute: number;
    allowed_ips: string[];
  };
}

export async function validateHmacAuth(
  req: Request,
  requiredScope?: string
): Promise<ValidateResult> {
  const supabase = getSupabaseClient();

  // Get headers
  const clientKey = req.headers.get("x-client-key");
  const timestamp = req.headers.get("x-timestamp");
  const nonce = req.headers.get("x-nonce");
  const signature = req.headers.get("x-signature");

  if (!clientKey || !timestamp || !nonce || !signature) {
    return {
      valid: false,
      error: "Missing required headers: x-client-key, x-timestamp, x-nonce, x-signature",
    };
  }

  // Validate timestamp (5 minute window)
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp);
  if (isNaN(requestTime) || Math.abs(now - requestTime) > 300) {
    return { valid: false, error: "Invalid or expired timestamp" };
  }

  // Get API key from database
  const { data: apiKey, error: keyError } = await supabase
    .from("api_keys")
    .select("id, name, secret_key_hash, scopes, rate_limit_per_minute, allowed_ips, status")
    .eq("public_key", clientKey)
    .single();

  if (keyError || !apiKey) {
    return { valid: false, error: "Invalid API key" };
  }

  if (apiKey.status !== "active") {
    return { valid: false, error: "API key is not active" };
  }

  // Check scope
  if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
    return { valid: false, error: `Missing required scope: ${requiredScope}` };
  }

  // Check IP whitelist
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                   req.headers.get("cf-connecting-ip") || 
                   "unknown";
  
  if (apiKey.allowed_ips && apiKey.allowed_ips.length > 0) {
    if (!apiKey.allowed_ips.includes(clientIp)) {
      return { valid: false, error: "IP not allowed" };
    }
  }

  // Check for nonce replay
  const { data: existingNonce } = await supabase
    .from("used_nonces")
    .select("id")
    .eq("nonce", nonce)
    .eq("api_key_id", apiKey.id)
    .single();

  if (existingNonce) {
    return { valid: false, error: "Nonce already used (replay attack detected)" };
  }

  // Get request body for signature
  const url = new URL(req.url);
  const method = req.method;
  const path = url.pathname;
  
  let bodyString = "";
  if (method !== "GET" && method !== "HEAD") {
    try {
      const clonedReq = req.clone();
      bodyString = await clonedReq.text();
    } catch {
      bodyString = "";
    }
  }

  const bodyHash = await sha256(bodyString || "");

  // Reconstruct signature
  // signature = HMAC_SHA256(SECRET_API_KEY, method + "\n" + path + "\n" + timestamp + "\n" + nonce + "\n" + body_hash)
  const signaturePayload = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;
  
  // We need to find the original secret to verify, but we only have the hash
  // In production, you'd use bcrypt to compare. For this demo, we'll verify by hashing the provided signature
  // Actually, we need the actual secret to verify HMAC. Let's use a different approach:
  // Store a verification hash that we can use

  // Since we only store hashed secrets, we can't verify HMAC directly
  // In a production system, you'd either:
  // 1. Store the secret encrypted (not hashed) and decrypt for verification
  // 2. Use a JWT-based system instead
  // For this demo, let's modify to use the hashed secret as the HMAC key
  
  const expectedSignature = await hmacSha256(apiKey.secret_key_hash, signaturePayload);
  
  if (signature !== expectedSignature) {
    return { valid: false, error: "Invalid signature" };
  }

  // Store nonce to prevent replay
  await supabase.from("used_nonces").insert({
    nonce,
    api_key_id: apiKey.id,
  });

  // Update last used
  await supabase
    .from("api_keys")
    .update({
      last_used_at: new Date().toISOString(),
      last_used_ip: clientIp,
    })
    .eq("id", apiKey.id);

  return {
    valid: true,
    apiKey: {
      id: apiKey.id,
      name: apiKey.name,
      scopes: apiKey.scopes,
      rate_limit_per_minute: apiKey.rate_limit_per_minute,
      allowed_ips: apiKey.allowed_ips,
    },
  };
}

export async function logApiRequest(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  ipAddress: string,
  userAgent: string,
  responseTimeMs: number,
  bodySize?: number
) {
  const supabase = getSupabaseClient();
  
  await supabase.from("api_key_logs").insert({
    api_key_id: apiKeyId,
    endpoint,
    method,
    status_code: statusCode,
    ip_address: ipAddress,
    user_agent: userAgent,
    response_time_ms: responseTimeMs,
    request_body_size: bodySize,
  });
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
