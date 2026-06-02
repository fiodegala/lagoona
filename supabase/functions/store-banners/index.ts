// Edge function que serve banners ativos com cache server-side (memória + CDN)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// TTL do cache em memória (60s) — banners mudam raramente
const MEMORY_TTL_MS = 60_000;
// TTL do cache do browser/CDN (5min, com stale-while-revalidate de 1h)
const HTTP_CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=3600";

type CacheEntry = { data: unknown; expiresAt: number };
const memoryCache = new Map<string, CacheEntry>();

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function fetchBanners(type: string | null) {
  const cacheKey = type ?? "__all__";
  const now = Date.now();
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return { data: cached.data, hit: true };
  }

  let q = supabase
    .from("banners")
    .select(
      "id,type,title,subtitle,image_url,image_url_mobile,video_url,video_url_mobile,media_type,link_url,sort_order,is_active,overlay_enabled,created_at,updated_at",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (type) q = q.eq("type", type);

  const { data, error } = await q;
  if (error) throw error;

  memoryCache.set(cacheKey, { data: data ?? [], expiresAt: now + MEMORY_TTL_MS });
  return { data: data ?? [], hit: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");

    // Invalidação manual: POST /store-banners/invalidate
    if (req.method === "POST" && url.pathname.endsWith("/invalidate")) {
      memoryCache.clear();
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, hit } = await fetchBanners(type);

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": HTTP_CACHE_CONTROL,
        "X-Cache": hit ? "HIT" : "MISS",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
