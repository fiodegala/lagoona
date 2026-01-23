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
        .from("store_config")
        .select("key, value")
        .eq("is_public", true);

      if (error) {
        await logApiRequest(authResult.apiKey!.id, path, method, 500, clientIp, userAgent, Date.now() - startTime);
        return errorResponse("Failed to fetch config", 500);
      }

      // Convert to key-value object
      const config = (data || []).reduce((acc: Record<string, unknown>, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {});

      await logApiRequest(authResult.apiKey!.id, path, method, 200, clientIp, userAgent, Date.now() - startTime);
      return jsonResponse({ data: config });
    }

    await logApiRequest(authResult.apiKey!.id, path, method, 405, clientIp, userAgent, Date.now() - startTime);
    return errorResponse("Method not allowed", 405);
  } catch (error) {
    console.error("Error:", error);
    return errorResponse("Internal server error", 500);
  }
});
