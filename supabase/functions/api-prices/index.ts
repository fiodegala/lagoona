import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  getSupabaseClient,
  validateHmacAuth,
  logApiRequest,
  jsonResponse,
  errorResponse,
} from "../_shared/utils.ts";

/**
 * Returns the 4 pricing tiers per product/variation:
 *  - retail (price)
 *  - wholesale (wholesale_price)
 *  - exclusive (exclusive_price)
 *  - promotional (promotional_price)
 *
 * If a tier is null/0, falls back to retail price.
 *
 * NOTE: products table has no `sku` column — we expose `barcode` as the
 * product-level identifier. product_variations DO have `sku`.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const userAgent = req.headers.get("user-agent") || "";
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const authResult = await validateHmacAuth(req, "prices:read");
  if (!authResult.valid) return errorResponse(authResult.error || "Unauthorized", 401);

  const supabase = getSupabaseClient();

  try {
    if (method !== "GET") {
      await logApiRequest(authResult.apiKey!.id, path, method, 405, clientIp, userAgent, Date.now() - startTime);
      return errorResponse("Method not allowed", 405);
    }

    const productId = url.searchParams.get("product_id");
    const variationId = url.searchParams.get("variation_id");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    const buildTiers = (
      retail: number | null,
      wholesale: number | null,
      exclusive: number | null,
      promotional: number | null,
    ) => {
      const r = Number(retail ?? 0);
      return {
        retail: r,
        wholesale: wholesale && Number(wholesale) > 0 ? Number(wholesale) : r,
        exclusive: exclusive && Number(exclusive) > 0 ? Number(exclusive) : r,
        promotional: promotional && Number(promotional) > 0 ? Number(promotional) : r,
      };
    };

    if (variationId) {
      const { data, error } = await supabase
        .from("product_variations")
        .select("id, product_id, sku, price, wholesale_price, exclusive_price, promotional_price")
        .eq("id", variationId)
        .single();
      if (error || !data) {
        await logApiRequest(authResult.apiKey!.id, path, method, 404, clientIp, userAgent, Date.now() - startTime);
        return errorResponse("Variation not found", 404);
      }
      await logApiRequest(authResult.apiKey!.id, path, method, 200, clientIp, userAgent, Date.now() - startTime);
      return jsonResponse({
        data: {
          product_id: data.product_id,
          variation_id: data.id,
          sku: data.sku,
          tiers: buildTiers(data.price, data.wholesale_price, data.exclusive_price, data.promotional_price),
        },
      });
    }

    if (productId) {
      const [{ data: product, error: pErr }, { data: variations, error: vErr }] = await Promise.all([
        supabase
          .from("products")
          .select("id, barcode, external_id, price, wholesale_price, exclusive_price, promotional_price")
          .eq("id", productId)
          .single(),
        supabase
          .from("product_variations")
          .select("id, sku, price, wholesale_price, exclusive_price, promotional_price")
          .eq("product_id", productId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (pErr || !product) {
        await logApiRequest(authResult.apiKey!.id, path, method, 404, clientIp, userAgent, Date.now() - startTime);
        return errorResponse("Product not found", 404);
      }
      if (vErr) console.error(vErr);

      await logApiRequest(authResult.apiKey!.id, path, method, 200, clientIp, userAgent, Date.now() - startTime);
      return jsonResponse({
        data: {
          product_id: product.id,
          sku: product.barcode ?? product.external_id ?? null,
          barcode: product.barcode,
          external_id: product.external_id,
          tiers: buildTiers(product.price, product.wholesale_price, product.exclusive_price, product.promotional_price),
          variations: (variations || []).map((v) => ({
            variation_id: v.id,
            sku: v.sku,
            tiers: buildTiers(v.price, v.wholesale_price, v.exclusive_price, v.promotional_price),
          })),
        },
      });
    }

    // Bulk listing — products only
    const { data, error, count } = await supabase
      .from("products")
      .select("id, barcode, external_id, price, wholesale_price, exclusive_price, promotional_price", { count: "exact" })
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error(error);
      await logApiRequest(authResult.apiKey!.id, path, method, 500, clientIp, userAgent, Date.now() - startTime);
      return errorResponse("Failed to fetch prices", 500);
    }

    const result = (data || []).map((p) => ({
      product_id: p.id,
      sku: p.barcode ?? p.external_id ?? null,
      barcode: p.barcode,
      external_id: p.external_id,
      tiers: buildTiers(p.price, p.wholesale_price, p.exclusive_price, p.promotional_price),
    }));

    await logApiRequest(authResult.apiKey!.id, path, method, 200, clientIp, userAgent, Date.now() - startTime);
    return jsonResponse({
      data: result,
      pagination: { page, limit, total: count, pages: Math.ceil((count || 0) / limit) },
    });
  } catch (err) {
    console.error(err);
    return errorResponse("Internal server error", 500);
  }
});
