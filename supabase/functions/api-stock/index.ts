import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  getSupabaseClient,
  validateHmacAuth,
  logApiRequest,
  jsonResponse,
  errorResponse,
} from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const userAgent = req.headers.get("user-agent") || "";
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const authResult = await validateHmacAuth(req, "stock:read");
  if (!authResult.valid) return errorResponse(authResult.error || "Unauthorized", 401);

  const supabase = getSupabaseClient();

  try {
    if (method !== "GET") {
      await logApiRequest(authResult.apiKey!.id, path, method, 405, clientIp, userAgent, Date.now() - startTime);
      return errorResponse("Method not allowed", 405);
    }

    const productId = url.searchParams.get("product_id");
    const variationId = url.searchParams.get("variation_id");
    const storeId = url.searchParams.get("store_id");
    const aggregate = url.searchParams.get("aggregate") === "true";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "200"), 1000);

    let query = supabase
      .from("store_stock")
      .select(`
        id,
        store_id,
        product_id,
        variation_id,
        quantity,
        updated_at,
        stores ( id, name, type )
      `, { count: "exact" })
      .order("updated_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (productId) query = query.eq("product_id", productId);
    if (variationId) query = query.eq("variation_id", variationId);
    if (storeId) query = query.eq("store_id", storeId);

    const { data, error, count } = await query;
    if (error) {
      console.error(error);
      await logApiRequest(authResult.apiKey!.id, path, method, 500, clientIp, userAgent, Date.now() - startTime);
      return errorResponse("Failed to fetch stock", 500);
    }

    let responseData: unknown = data;
    if (aggregate && data) {
      const map = new Map<string, { product_id: string; variation_id: string | null; total: number }>();
      for (const row of data) {
        const key = `${row.product_id}::${row.variation_id || ""}`;
        const cur = map.get(key);
        if (cur) cur.total += row.quantity;
        else map.set(key, { product_id: row.product_id, variation_id: row.variation_id, total: row.quantity });
      }
      responseData = Array.from(map.values());
    }

    await logApiRequest(authResult.apiKey!.id, path, method, 200, clientIp, userAgent, Date.now() - startTime);
    return jsonResponse({
      data: responseData,
      pagination: aggregate ? undefined : { page, limit, total: count, pages: Math.ceil((count || 0) / limit) },
    });
  } catch (err) {
    console.error(err);
    return errorResponse("Internal server error", 500);
  }
});
