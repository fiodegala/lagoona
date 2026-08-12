import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deductStockForOrder } from "../_shared/stockUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TIKTOK_BASE = "https://open-api.tiktokglobalshop.com";
const TIKTOK_AUTH_BASE = "https://auth.tiktok-shops.com";

const APP_KEY = Deno.env.get("TIKTOK_APP_KEY") ?? "";
const APP_SECRET = Deno.env.get("TIKTOK_APP_SECRET") ?? "";
const SHOP_ID = Deno.env.get("TIKTOK_SHOP_ID") ?? "";

// Runtime credentials (DB first, env as fallback) — set by loadCredentials()
let ACCESS_TOKEN = Deno.env.get("TIKTOK_ACCESS_TOKEN") ?? "";
let SHOP_CIPHER = Deno.env.get("TIKTOK_SHOP_CIPHER") ?? "";


function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** TikTok Shop Partner API signature (HMAC-SHA256 hex). */
async function signRequest(path: string, query: Record<string, string>, body: string) {
  const keys = Object.keys(query)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort();
  let base = path;
  for (const k of keys) base += k + query[k];
  base = APP_SECRET + base + (body || "") + APP_SECRET;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function tiktokRequest(
  method: "GET" | "POST" | "PUT",
  path: string,
  opts: { query?: Record<string, string>; body?: unknown; withCipher?: boolean } = {},
) {
  const query: Record<string, string> = {
    app_key: APP_KEY,
    timestamp: String(Math.floor(Date.now() / 1000)),
    ...(opts.withCipher === false ? {} : { shop_cipher: SHOP_CIPHER }),
    ...(opts.query || {}),
  };
  const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : "";
  query.sign = await signRequest(path, query, bodyStr);

  const url = `${TIKTOK_BASE}${path}?${new URLSearchParams(query).toString()}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-tts-access-token": ACCESS_TOKEN,
    },
    body: bodyStr || undefined,
  });

  const text = await res.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!res.ok || (payload.code !== undefined && payload.code !== 0)) {
    throw new Error(payload.message || `TikTok API ${res.status}: ${text.slice(0, 300)}`);
  }
  return payload.data ?? payload;
}

async function logSync(
  supabase: any,
  sync_type: string,
  direction: string,
  status: string,
  items_processed: number,
  items_failed: number,
  message?: string,
  details?: unknown,
) {
  await supabase.from("tiktok_sync_logs").insert({
    sync_type,
    direction,
    status,
    items_processed,
    items_failed,
    message: message ?? null,
    details: details ?? null,
  });
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { ok: false as const, error: "Não autenticado" };

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );
  const { data: userData, error } = await anon.auth.getUser();
  if (error || !userData?.user) return { ok: false as const, error: "Não autenticado" };

  const admin = serviceClient();
  const { data: allowed } = await admin.rpc("is_admin_or_manager", { _user_id: userData.user.id });
  if (!allowed) return { ok: false as const, error: "Sem permissão" };

  return { ok: true as const, userId: userData.user.id };
}

async function getConfig(supabase: any) {
  const { data } = await supabase.from("tiktok_integration").select("*").limit(1).maybeSingle();
  if (data) return data;
  const { data: created } = await supabase
    .from("tiktok_integration")
    .insert({ shop_id: SHOP_ID || null })
    .select()
    .single();
  return created;
}

/* ---------------------- AUTHORIZATION ---------------------- */

async function getAuthRow(supabase: any) {
  const { data } = await supabase
    .from("tiktok_auth")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Loads access token / shop cipher from DB (falls back to env secrets). */
async function loadCredentials(supabase: any) {
  const authRow = await getAuthRow(supabase);
  if (authRow?.access_token) ACCESS_TOKEN = authRow.access_token;

  const config = await getConfig(supabase);
  if (config?.shop_cipher) SHOP_CIPHER = config.shop_cipher;

  // Auto-refresh when the token is about to expire
  if (
    authRow?.refresh_token &&
    authRow.access_token_expires_at &&
    new Date(authRow.access_token_expires_at).getTime() - Date.now() < 10 * 60 * 1000
  ) {
    try {
      await refreshToken(supabase);
    } catch (e) {
      console.error("TikTok token refresh failed:", e);
    }
  }
  return { authRow, config };
}

async function authRequest(path: string, params: Record<string, string>) {
  const url = `${TIKTOK_AUTH_BASE}${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  const text = await res.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!res.ok || (payload.code !== undefined && payload.code !== 0)) {
    throw new Error(payload.message || `TikTok Auth ${res.status}: ${text.slice(0, 300)}`);
  }
  return payload.data ?? payload;
}

async function saveTokens(supabase: any, data: any) {
  const now = Date.now();
  const row = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? null,
    access_token_expires_at: data.access_token_expire_in
      ? new Date(Number(data.access_token_expire_in) * 1000).toISOString()
      : null,
    refresh_token_expires_at: data.refresh_token_expire_in
      ? new Date(Number(data.refresh_token_expire_in) * 1000).toISOString()
      : null,
    seller_name: data.seller_name ?? null,
    open_id: data.open_id ?? null,
    updated_at: new Date(now).toISOString(),
  };
  const existing = await getAuthRow(supabase);
  if (existing) {
    await supabase.from("tiktok_auth").update(row).eq("id", existing.id);
  } else {
    await supabase.from("tiktok_auth").insert(row);
  }
  ACCESS_TOKEN = data.access_token;
  return row;
}

/** Exchanges the authorization code shown in the TikTok Partner Center for tokens. */
async function authorize(supabase: any, authCode: string) {
  if (!authCode) throw new Error("Informe o código de autorização.");
  const data = await authRequest("/api/v2/token/get", {
    app_key: APP_KEY,
    app_secret: APP_SECRET,
    auth_code: authCode.trim(),
    grant_type: "authorized_code",
  });
  const saved = await saveTokens(supabase, data);

  // Discover shop cipher / id for this seller
  let shops: any[] = [];
  try {
    const shopData = await tiktokRequest("GET", "/authorization/202309/shops", { withCipher: false });
    shops = shopData?.shops || [];
  } catch (e) {
    console.error("Falha ao buscar lojas autorizadas:", e);
  }

  if (shops.length) {
    const shop = shops[0];
    SHOP_CIPHER = shop.cipher || SHOP_CIPHER;
    const config = await getConfig(supabase);
    await supabase
      .from("tiktok_integration")
      .update({ shop_cipher: shop.cipher ?? null, shop_id: shop.id ?? config.shop_id, shop_name: shop.name ?? config.shop_name })
      .eq("id", config.id);
  }

  await logSync(supabase, "authorize", "inbound", "success", shops.length, 0, "Autorização concluída");

  return {
    authorized: true,
    seller_name: saved.seller_name,
    access_token_expires_at: saved.access_token_expires_at,
    shops: shops.map((s) => ({ id: s.id, name: s.name, region: s.region })),
  };
}

async function refreshToken(supabase: any) {
  const existing = await getAuthRow(supabase);
  if (!existing?.refresh_token) throw new Error("Sem refresh token. Refaça a autorização.");
  const data = await authRequest("/api/v2/token/refresh", {
    app_key: APP_KEY,
    app_secret: APP_SECRET,
    refresh_token: existing.refresh_token,
    grant_type: "refresh_token",
  });
  const saved = await saveTokens(supabase, data);
  return { refreshed: true, access_token_expires_at: saved.access_token_expires_at };
}

async function authStatus(supabase: any) {
  const authRow = await getAuthRow(supabase);
  const config = await getConfig(supabase);
  return {
    has_app_credentials: !!(APP_KEY && APP_SECRET),
    has_token: !!(authRow?.access_token || ACCESS_TOKEN),
    seller_name: authRow?.seller_name ?? null,
    access_token_expires_at: authRow?.access_token_expires_at ?? null,
    refresh_token_expires_at: authRow?.refresh_token_expires_at ?? null,
    shop_cipher_configured: !!(config?.shop_cipher || SHOP_CIPHER),
    shop_name: config?.shop_name ?? null,
    shop_id: config?.shop_id ?? null,
  };
}

/* ------------------------- ACTIONS ------------------------- */

async function testConnection(supabase: any) {
  const data = await tiktokRequest("GET", "/authorization/202309/shops", { withCipher: false });
  const shops = data?.shops || [];
  if (shops.length) {
    const shop = shops[0];
    SHOP_CIPHER = shop.cipher || SHOP_CIPHER;
    const config = await getConfig(supabase);
    await supabase
      .from("tiktok_integration")
      .update({ shop_cipher: shop.cipher ?? config.shop_cipher, shop_id: shop.id ?? config.shop_id, shop_name: shop.name ?? config.shop_name })
      .eq("id", config.id);
  }
  return { connected: true, shops };
}


async function getWarehouseId(): Promise<string | null> {
  try {
    const data = await tiktokRequest("GET", "/logistics/202309/warehouses");
    const list = data?.warehouses || [];
    const sales = list.find((w: any) => w.type === "SALES_WAREHOUSE") || list[0];
    return sales?.id ?? null;
  } catch (_e) {
    return null;
  }
}

/** Pull the TikTok catalog and map it against local products by SKU/barcode. */
async function pullProducts(supabase: any) {
  let pageToken = "";
  let processed = 0;
  let matched = 0;
  const unmatched: { tiktok_product_id: string; title: string; seller_sku: string | null }[] = [];

  do {
    const query: Record<string, string> = { page_size: "50" };
    if (pageToken) query.page_token = pageToken;

    const data = await tiktokRequest("POST", "/product/202309/products/search", {
      query,
      body: { status: "ALL" },
    });

    const products = data?.products || [];
    for (const p of products) {
      const skus = p.skus?.length ? p.skus : [{ id: null, seller_sku: null, price: null }];
      for (const sku of skus) {
        processed++;
        const sellerSku = (sku.seller_sku || "").trim() || null;

        let productId: string | null = null;
        let variationId: string | null = null;

        if (sellerSku) {
          const { data: variation } = await supabase
            .from("product_variations")
            .select("id, product_id")
            .or(`sku.ilike.${sellerSku},barcode.ilike.${sellerSku}`)
            .limit(1)
            .maybeSingle();

          if (variation) {
            variationId = variation.id;
            productId = variation.product_id;
          } else {
            const { data: prod } = await supabase
              .from("products")
              .select("id")
              .or(`sku.ilike.${sellerSku},barcode.ilike.${sellerSku}`)
              .limit(1)
              .maybeSingle();
            if (prod) productId = prod.id;
          }
        }

        if (productId) matched++;
        else unmatched.push({ tiktok_product_id: String(p.id), title: p.title, seller_sku: sellerSku });

        await supabase
          .from("tiktok_product_mappings")
          .upsert(
            {
              tiktok_product_id: String(p.id),
              tiktok_sku_id: sku.id ? String(sku.id) : null,
              seller_sku: sellerSku,
              product_id: productId,
              variation_id: variationId,
              sync_status: productId ? "linked" : "unmatched",
              sync_error: null,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: "tiktok_product_id,tiktok_sku_id", ignoreDuplicates: false },
          );
      }
    }

    pageToken = data?.next_page_token || "";
  } while (pageToken);

  await supabase
    .from("tiktok_integration")
    .update({ last_sync_at: new Date().toISOString() })
    .not("id", "is", null);

  await logSync(supabase, "products", "inbound", "success", processed, unmatched.length,
    `${matched} SKUs vinculados, ${unmatched.length} sem correspondência`, { unmatched: unmatched.slice(0, 100) });

  return { processed, matched, unmatched: unmatched.length, unmatchedSample: unmatched.slice(0, 50) };
}

/** Push local stock quantities to the mapped TikTok SKUs. */
async function pushStock(supabase: any) {
  const warehouseId = await getWarehouseId();

  const { data: mappings } = await supabase
    .from("tiktok_product_mappings")
    .select("id, tiktok_product_id, tiktok_sku_id, product_id, variation_id")
    .not("product_id", "is", null)
    .not("tiktok_sku_id", "is", null);

  const rows = mappings || [];
  if (rows.length === 0) {
    return { processed: 0, failed: 0, message: "Nenhum SKU vinculado. Rode a importação de produtos primeiro." };
  }

  // Aggregate available stock per product/variation
  const grouped = new Map<string, { skus: any[]; }>();
  let failed = 0;
  let processed = 0;

  for (const m of rows) {
    let q = supabase
      .from("store_stock")
      .select("quantity")
      .eq("product_id", m.product_id);
    q = m.variation_id ? q.eq("variation_id", m.variation_id) : q.is("variation_id", null);
    const { data: stockRows } = await q;
    const quantity = (stockRows || []).reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);

    const entry = grouped.get(m.tiktok_product_id) || { skus: [] };
    entry.skus.push({
      id: String(m.tiktok_sku_id),
      inventory: [warehouseId ? { warehouse_id: warehouseId, quantity } : { quantity }],
    });
    grouped.set(m.tiktok_product_id, entry);
  }

  for (const [tiktokProductId, entry] of grouped.entries()) {
    try {
      await tiktokRequest("POST", `/product/202309/products/${tiktokProductId}/inventory/update`, {
        body: { skus: entry.skus },
      });
      processed += entry.skus.length;
      await supabase
        .from("tiktok_product_mappings")
        .update({ sync_status: "synced", sync_error: null, last_synced_at: new Date().toISOString() })
        .eq("tiktok_product_id", tiktokProductId);
    } catch (err) {
      failed += entry.skus.length;
      await supabase
        .from("tiktok_product_mappings")
        .update({ sync_status: "error", sync_error: String(err) })
        .eq("tiktok_product_id", tiktokProductId);
    }
  }

  await logSync(supabase, "stock", "outbound", failed > 0 ? "partial" : "success", processed, failed);
  return { processed, failed };
}

const STATUS_MAP: Record<string, string> = {
  UNPAID: "pending",
  ON_HOLD: "pending",
  AWAITING_SHIPMENT: "confirmed",
  PARTIALLY_SHIPPING: "confirmed",
  AWAITING_COLLECTION: "confirmed",
  IN_TRANSIT: "shipped",
  DELIVERED: "delivered",
  COMPLETED: "delivered",
  CANCELLED: "cancelled",
};

/** Pull TikTok orders and create matching local orders (deducting stock once). */
async function pullOrders(supabase: any, sinceHours = 72) {
  const config = await getConfig(supabase);
  const createTimeGe = Math.floor(Date.now() / 1000) - sinceHours * 3600;

  let pageToken = "";
  let created = 0;
  let updated = 0;
  let failed = 0;
  let processed = 0;

  do {
    const query: Record<string, string> = { page_size: "50", sort_field: "create_time" };
    if (pageToken) query.page_token = pageToken;

    const data = await tiktokRequest("POST", "/order/202309/orders/search", {
      query,
      body: { create_time_ge: createTimeGe },
    });

    const orders = data?.orders || [];
    for (const o of orders) {
      processed++;
      try {
        const tiktokOrderId = String(o.id);
        const localStatus = STATUS_MAP[o.status] || "pending";

        const items = (o.line_items || []).map((li: any) => ({
          tiktok_sku_id: li.sku_id ? String(li.sku_id) : null,
          seller_sku: li.seller_sku || null,
          name: li.product_name,
          quantity: 1,
          price: Number(li.sale_price ?? li.original_price ?? 0),
          product_id: null as string | null,
          variation_id: null as string | null,
        }));

        // Resolve local products through mappings
        for (const item of items) {
          if (!item.tiktok_sku_id) continue;
          const { data: map } = await supabase
            .from("tiktok_product_mappings")
            .select("product_id, variation_id")
            .eq("tiktok_sku_id", item.tiktok_sku_id)
            .maybeSingle();
          if (map) {
            item.product_id = map.product_id;
            item.variation_id = map.variation_id;
          }
        }

        const total = Number(o.payment?.total_amount ?? 0) ||
          items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);

        const { data: existing } = await supabase
          .from("tiktok_order_mappings")
          .select("id, order_id, local_status, stock_deducted")
          .eq("tiktok_order_id", tiktokOrderId)
          .maybeSingle();

        if (existing?.order_id) {
          if (existing.local_status !== localStatus) {
            await supabase.from("orders").update({ status: localStatus }).eq("id", existing.order_id);
            await supabase
              .from("tiktok_order_mappings")
              .update({ tiktok_status: o.status, local_status: localStatus, raw_payload: o })
              .eq("id", existing.id);
            updated++;
          }
          continue;
        }

        const { data: newOrder, error: orderErr } = await supabase
          .from("orders")
          .insert({
            external_id: `tiktok:${tiktokOrderId}`,
            customer_email: o.buyer_email || `tiktok-${tiktokOrderId}@pedido.local`,
            customer_name: o.recipient_address?.name || "Cliente TikTok Shop",
            items,
            total,
            status: localStatus,
            payment_status: o.status === "UNPAID" ? "pending" : "paid",
            payment_method: "TikTok Shop",
            store_id: config?.store_id || null,
            shipping_address: o.recipient_address || null,
            tracking_code: o.tracking_number || null,
            notes: "Pedido importado do TikTok Shop",
            metadata: { source: "tiktok_shop", tiktok_order_id: tiktokOrderId },
          })
          .select("id")
          .single();

        if (orderErr) throw orderErr;

        let stockDeducted = false;
        if (["confirmed", "shipped", "delivered"].includes(localStatus)) {
          await deductStockForOrder(supabase, newOrder.id, items.filter((i: any) => i.product_id));
          stockDeducted = true;
        }

        await supabase.from("tiktok_order_mappings").insert({
          tiktok_order_id: tiktokOrderId,
          order_id: newOrder.id,
          tiktok_status: o.status,
          local_status: localStatus,
          total,
          stock_deducted: stockDeducted,
          raw_payload: o,
        });

        created++;
      } catch (err) {
        failed++;
        console.error("TikTok order import error:", err);
      }
    }

    pageToken = data?.next_page_token || "";
  } while (pageToken);

  await supabase
    .from("tiktok_integration")
    .update({ last_order_sync_at: new Date().toISOString() })
    .not("id", "is", null);

  await logSync(supabase, "orders", "inbound", failed > 0 ? "partial" : "success", processed, failed,
    `${created} novos, ${updated} atualizados`);

  return { processed, created, updated, failed };
}

/* ------------------------- HANDLER ------------------------- */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";

  const auth = await requireAdmin(req);
  if (!auth.ok) return json({ error: auth.error }, 401);

  if (!APP_KEY || !APP_SECRET || !ACCESS_TOKEN) {
    return json({ error: "Credenciais do TikTok Shop não configuradas." }, 400);
  }

  const supabase = serviceClient();

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    switch (action) {
      case "test-connection":
        return json(await testConnection());

      case "get-config":
        return json(await getConfig(supabase));

      case "save-config": {
        const current = await getConfig(supabase);
        const { data, error } = await supabase
          .from("tiktok_integration")
          .update({
            store_id: body.store_id ?? current.store_id,
            is_active: body.is_active ?? current.is_active,
            auto_sync_stock: body.auto_sync_stock ?? current.auto_sync_stock,
            auto_sync_price: body.auto_sync_price ?? current.auto_sync_price,
            auto_import_orders: body.auto_import_orders ?? current.auto_import_orders,
            shop_name: body.shop_name ?? current.shop_name,
            shop_id: body.shop_id ?? current.shop_id ?? SHOP_ID,
          })
          .eq("id", current.id)
          .select()
          .single();
        if (error) throw error;
        return json(data);
      }

      case "pull-products":
        return json(await pullProducts(supabase));

      case "push-stock":
        return json(await pushStock(supabase));

      case "pull-orders":
        return json(await pullOrders(supabase, Number(body.sinceHours) || 72));

      case "get-logs": {
        const { data } = await supabase
          .from("tiktok_sync_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        return json(data || []);
      }

      case "get-product-mappings": {
        const { data } = await supabase
          .from("tiktok_product_mappings")
          .select("*, products(name), product_variations(sku)")
          .order("updated_at", { ascending: false })
          .limit(500);
        return json(data || []);
      }

      case "get-order-mappings": {
        const { data } = await supabase
          .from("tiktok_order_mappings")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        return json(data || []);
      }

      default:
        return json({ error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (err) {
    console.error("tiktok-sync error:", err);
    await logSync(supabase, action || "unknown", "n/a", "error", 0, 0, String(err));
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
