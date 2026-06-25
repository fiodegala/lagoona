// Meta Conversions API (CAPI) — server-side event forwarder
// Pixel ID: 1707142150464689
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const META_PIXEL_ID = "1707142150464689";
const META_API_VERSION = "v19.0";

// SHA-256 already produces a 64-char hex string
const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashIfNeeded(value: unknown): Promise<string | undefined> {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (SHA256_HEX_RE.test(trimmed)) return trimmed.toLowerCase();
  return await sha256Hex(trimmed);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const accessToken = Deno.env.get("META_CAPI_TOKEN");
  if (!accessToken) {
    return new Response(
      JSON.stringify({ success: false, error: "META_CAPI_TOKEN not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      event_name = "Purchase",
      event_time,
      event_id,
      event_source_url,
      action_source = "website",
      user_data = {},
      custom_data = {},
      test_event_code,
    } = body ?? {};

    // Hash PII fields (skip if already hashed)
    const hashedUserData: Record<string, unknown> = { ...user_data };
    for (const field of ["em", "ph", "fn", "ln"] as const) {
      const hashed = await hashIfNeeded(user_data?.[field]);
      if (hashed) hashedUserData[field] = hashed;
      else delete hashedUserData[field];
    }

    // Auto-fill IP/UA if not provided
    if (!hashedUserData.client_ip_address) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("cf-connecting-ip");
      if (ip) hashedUserData.client_ip_address = ip;
    }
    if (!hashedUserData.client_user_agent) {
      const ua = req.headers.get("user-agent");
      if (ua) hashedUserData.client_user_agent = ua;
    }

    const event: Record<string, unknown> = {
      event_name,
      event_time: typeof event_time === "number" ? event_time : Math.floor(Date.now() / 1000),
      action_source,
      user_data: hashedUserData,
      custom_data: { currency: "BRL", ...custom_data },
    };
    if (event_id) event.event_id = String(event_id);
    if (event_source_url) event.event_source_url = String(event_source_url);

    const payload: Record<string, unknown> = {
      data: [event],
      access_token: accessToken,
    };
    if (test_event_code) payload.test_event_code = String(test_event_code);

    const metaRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${META_PIXEL_ID}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const metaJson = await metaRes.json().catch(() => ({}));

    if (!metaRes.ok) {
      console.error("Meta CAPI error:", metaRes.status, metaJson);
      return new Response(
        JSON.stringify({ success: false, error: metaJson?.error ?? metaJson, status: metaRes.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Meta CAPI ok:", event_name, event_id, metaJson);
    return new Response(
      JSON.stringify({ success: true, meta: metaJson }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("meta-capi error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
