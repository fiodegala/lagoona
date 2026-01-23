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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const userAgent = req.headers.get("user-agent") || "";
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Validate HMAC authentication
  const authResult = await validateHmacAuth(req, "products:read");

  if (!authResult.valid) {
    return errorResponse(authResult.error || "Unauthorized", 401);
  }

  const supabase = getSupabaseClient();

  try {
    // Parse path: /store-products or /store-products/:id
    const pathParts = path.split("/").filter(Boolean);
    const productId = pathParts[1]; // If present

    if (method === "GET") {
      if (productId) {
        // Get single product
        const { data, error } = await supabase
          .from("products")
          .select(`
            id,
            name,
            description,
            price,
            stock,
            category_id,
            image_url,
            metadata,
            created_at,
            updated_at,
            categories (
              id,
              name,
              slug
            )
          `)
          .eq("id", productId)
          .eq("is_active", true)
          .single();

        if (error) {
          await logApiRequest(authResult.apiKey!.id, path, method, 404, clientIp, userAgent, Date.now() - startTime);
          return errorResponse("Product not found", 404);
        }

        await logApiRequest(authResult.apiKey!.id, path, method, 200, clientIp, userAgent, Date.now() - startTime);
        return jsonResponse({ data });
      } else {
        // Get all products
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
        const categoryId = url.searchParams.get("category_id");
        const search = url.searchParams.get("search");

        let query = supabase
          .from("products")
          .select(`
            id,
            name,
            description,
            price,
            stock,
            category_id,
            image_url,
            metadata,
            created_at,
            updated_at,
            categories (
              id,
              name,
              slug
            )
          `, { count: "exact" })
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (categoryId) {
          query = query.eq("category_id", categoryId);
        }

        if (search) {
          query = query.ilike("name", `%${search}%`);
        }

        const { data, error, count } = await query;

        if (error) {
          await logApiRequest(authResult.apiKey!.id, path, method, 500, clientIp, userAgent, Date.now() - startTime);
          return errorResponse("Failed to fetch products", 500);
        }

        await logApiRequest(authResult.apiKey!.id, path, method, 200, clientIp, userAgent, Date.now() - startTime);
        return jsonResponse({
          data,
          pagination: {
            page,
            limit,
            total: count,
            pages: Math.ceil((count || 0) / limit),
          },
        });
      }
    }

    await logApiRequest(authResult.apiKey!.id, path, method, 405, clientIp, userAgent, Date.now() - startTime);
    return errorResponse("Method not allowed", 405);
  } catch (error) {
    console.error("Error:", error);
    return errorResponse("Internal server error", 500);
  }
});
