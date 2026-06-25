// Meta Conversions API (CAPI) — server-side event forwarder
// Pixel ID: 1707142150464689
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const META_PIXEL_ID = "1707142150464689";
const META_API_VERSION = "v18.0";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashIfPresent(value: unknown): Promise<string | undefined> {
  if (!value || typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (!cleaned) return undefined;
  return await sha256Hex(cleaned);
}

function normalizePhone(phone: string): string {
  // Meta expects digits only, with country code
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  // Add Brazil country code if missing (11 digits = local BR)
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const accessToken = Deno.env.get("META_CAPI_ACCESS_TOKEN");
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: "META_CAPI_ACCESS_TOKEN not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const {
      event_name = "Purchase",
      event_id,
      event_source_url,
      value,
      currency = "BRL",
      content_ids = [],
      num_items,
      order_id,
      user_data = {},
      test_event_code,
    } = body ?? {};

    if (!event_id) {
      return new Response(
        JSON.stringify({ error: "event_id is required for deduplication with browser pixel" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Capture client IP and user agent for better matching
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      undefined;
    const clientUa = req.headers.get("user-agent") || undefined;

    // Hash PII per Meta requirements
    const hashedUserData: Record<string, string | string[]> = {};
    if (user_data.email) hashedUserData.em = await sha256Hex(String(user_data.email));
    if (user_data.phone) {
      const normalized = normalizePhone(String(user_data.phone));
      if (normalized) hashedUserData.ph = await sha256Hex(normalized);
    }
    if (user_data.first_name) {
      const fn = await hashIfPresent(user_data.first_name);
      if (fn) hashedUserData.fn = fn;
    }
    if (user_data.last_name) {
      const ln = await hashIfPresent(user_data.last_name);
      if (ln) hashedUserData.ln = ln;
    }
    if (user_data.city) {
      const ct = await hashIfPresent(user_data.city);
      if (ct) hashedUserData.ct = ct;
    }
    if (user_data.state) {
      const st = await hashIfPresent(user_data.state);
      if (st) hashedUserData.st = st;
    }
    if (user_data.zip_code) {
      const zp = await hashIfPresent(String(user_data.zip_code).replace(/\D/g, ""));
      if (zp) hashedUserData.zp = zp;
    }
    if (user_data.country) {
      const co = await hashIfPresent(user_data.country);
      if (co) hashedUserData.country = co;
    } else {
      hashedUserData.country = await sha256Hex("br");
    }
    if (user_data.external_id) {
      hashedUserData.external_id = await sha256Hex(String(user_data.external_id));
    }

    if (clientIp) hashedUserData.client_ip_address = clientIp;
    if (clientUa) hashedUserData.client_user_agent = clientUa;

    // Pass through fbp / fbc cookies if provided by client
    if (user_data.fbp) hashedUserData.fbp = String(user_data.fbp);
    if (user_data.fbc) hashedUserData.fbc = String(user_data.fbc);

    const customData: Record<string, unknown> = {
      currency,
    };
    if (typeof value === "number") customData.value = value;
    if (Array.isArray(content_ids) && content_ids.length > 0) {
      customData.content_ids = content_ids.map(String);
      customData.content_type = "product";
    }
    if (typeof num_items === "number") customData.num_items = num_items;
    if (order_id) customData.order_id = String(order_id);

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: String(event_id),
          event_source_url: event_source_url ?? undefined,
          action_source: "website",
          user_data: hashedUserData,
          custom_data: customData,
        },
      ],
    };

    if (test_event_code) {
      payload.test_event_code = String(test_event_code);
    }

    const url = `https://graph.facebook.com/${META_API_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(accessToken)}`;

    const metaRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const metaJson = await metaRes.json().catch(() => ({}));

    if (!metaRes.ok) {
      console.error("Meta CAPI error:", metaRes.status, metaJson);
      return new Response(
        JSON.stringify({ error: "Meta CAPI request failed", status: metaRes.status, meta: metaJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Meta CAPI sent:", event_name, event_id, metaJson);

    return new Response(
      JSON.stringify({ success: true, event_id, meta: metaJson }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("meta-capi error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
