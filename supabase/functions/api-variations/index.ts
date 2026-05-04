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

  const authResult = await validateHmacAuth(req, "variations:read");
  if (!authResult.valid) return errorResponse(authResult.error || "Unauthorized", 401);

  const supabase = getSupabaseClient();

  try {
    if (method !== "GET") {
      await logApiRequest(authResult.apiKey!.id, path, method, 405, clientIp, userAgent, Date.now() - startTime);
      return errorResponse("Method not allowed", 405);
    }

    const productId = url.searchParams.get("product_id");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);

    let query = supabase
      .from("product_variations")
      .select(`
        id,
        product_id,
        sku,
        barcode,
        price,
        wholesale_price,
        exclusive_price,
        promotional_price,
        stock,
        image_url,
        is_active,
        sort_order,
        created_at,
        updated_at,
        product_variation_values ( attribute, value )
      `, { count: "exact" })
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    if (productId) query = query.eq("product_id", productId);

    const { data, error, count } = await query;
    if (error) {
      console.error(error);
      await logApiRequest(authResult.apiKey!.id, path, method, 500, clientIp, userAgent, Date.now() - startTime);
      return errorResponse("Failed to fetch variations", 500);
    }

    await logApiRequest(authResult.apiKey!.id, path, method, 200, clientIp, userAgent, Date.now() - startTime);
    return jsonResponse({
      data,
      pagination: { page, limit, total: count, pages: Math.ceil((count || 0) / limit) },
    });
  } catch (err) {
    console.error(err);
    return errorResponse("Internal server error", 500);
  }
});
