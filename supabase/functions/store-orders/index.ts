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

  const supabase = getSupabaseClient();

  try {
    const pathParts = path.split("/").filter(Boolean);
    const orderId = pathParts[1];

    if (method === "GET" && orderId) {
      // GET /store-orders/:id - requires orders:read scope
      const authResult = await validateHmacAuth(req, "orders:read");
      if (!authResult.valid) {
        return errorResponse(authResult.error || "Unauthorized", 401);
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (error) {
        await logApiRequest(authResult.apiKey!.id, path, method, 404, clientIp, userAgent, Date.now() - startTime);
        return errorResponse("Order not found", 404);
      }

      await logApiRequest(authResult.apiKey!.id, path, method, 200, clientIp, userAgent, Date.now() - startTime);
      return jsonResponse({ data });
    }

    if (method === "POST" && !orderId) {
      // POST /store-orders - create new order, requires orders:write scope
      const authResult = await validateHmacAuth(req, "orders:write");
      if (!authResult.valid) {
        return errorResponse(authResult.error || "Unauthorized", 401);
      }

      let body;
      try {
        body = await req.json();
      } catch {
        return errorResponse("Invalid JSON body", 400);
      }

      // Validate required fields
      if (!body.customer_email || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
        await logApiRequest(authResult.apiKey!.id, path, method, 400, clientIp, userAgent, Date.now() - startTime);
        return errorResponse("Missing required fields: customer_email, items", 400);
      }

      // Calculate total from items
      const total = body.items.reduce((sum: number, item: { price: number; quantity: number }) => {
        return sum + (item.price * item.quantity);
      }, 0);

      const orderData = {
        external_id: body.external_id || null,
        customer_email: body.customer_email,
        customer_name: body.customer_name || null,
        items: body.items,
        total,
        shipping_address: body.shipping_address || null,
        payment_method: body.payment_method || null,
        notes: body.notes || null,
        metadata: body.metadata || {},
      };

      const { data, error } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single();

      if (error) {
        console.error("Error creating order:", error);
        await logApiRequest(authResult.apiKey!.id, path, method, 500, clientIp, userAgent, Date.now() - startTime);
        return errorResponse("Failed to create order", 500);
      }

      await logApiRequest(authResult.apiKey!.id, path, method, 201, clientIp, userAgent, Date.now() - startTime);
      return jsonResponse({ data }, 201);
    }

    return errorResponse("Method not allowed", 405);
  } catch (error) {
    console.error("Error:", error);
    return errorResponse("Internal server error", 500);
  }
});
