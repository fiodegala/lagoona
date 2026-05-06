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

  const authResult = await validateHmacAuth(req, "products:read");
  if (!authResult.valid) return errorResponse(authResult.error || "Unauthorized", 401);

  const supabase = getSupabaseClient();

  try {
    if (method !== "GET") {
      await logApiRequest(authResult.apiKey!.id, path, method, 405, clientIp, userAgent, Date.now() - startTime);
      return errorResponse("Method not allowed", 405);
    }

    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "500"), 1000);
    const categoryId = url.searchParams.get("category_id");
    const search = url.searchParams.get("search");
    const activeParam = url.searchParams.get("active"); // "true" | "false" | "all" (default: all)

    let query = supabase
      .from("products")
      .select(`
        id,
        name,
        description,
        sku,
        barcode,
        price,
        wholesale_price,
        exclusive_price,
        promotional_price,
        stock,
        weight,
        category_id,
        image_url,
        images,
        is_active,
        metadata,
        created_at,
        updated_at,
        categories ( id, name, slug )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (activeParam === "true") query = query.eq("is_active", true);
    else if (activeParam === "false") query = query.eq("is_active", false);
    // "all" or omitted => no filter (returns ALL products like /api-variations and /api-stock)

    if (categoryId) query = query.eq("category_id", categoryId);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data, error, count } = await query;
    if (error) {
      console.error(error);
      await logApiRequest(authResult.apiKey!.id, path, method, 500, clientIp, userAgent, Date.now() - startTime);
      return errorResponse("Failed to fetch products", 500);
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
