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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const userAgent = req.headers.get("user-agent") || "";
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const authResult = await validateHmacAuth(req, "store:read");

  if (!authResult.valid) {
    return errorResponse(authResult.error || "Unauthorized", 401);
  }

  const supabase = getSupabaseClient();

  try {
    if (method === "GET") {
      const { data, error } = await supabase
        .from("categories")
        .select(`
          id,
          name,
          slug,
          description,
          parent_id,
          created_at,
          updated_at
        `)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        await logApiRequest(authResult.apiKey!.id, path, method, 500, clientIp, userAgent, Date.now() - startTime);
        return errorResponse("Failed to fetch categories", 500);
      }

      await logApiRequest(authResult.apiKey!.id, path, method, 200, clientIp, userAgent, Date.now() - startTime);
      return jsonResponse({ data });
    }

    await logApiRequest(authResult.apiKey!.id, path, method, 405, clientIp, userAgent, Date.now() - startTime);
    return errorResponse("Method not allowed", 405);
  } catch (error) {
    console.error("Error:", error);
    return errorResponse("Internal server error", 500);
  }
});
