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

  if (method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const authResult = await validateHmacAuth(req, "webhooks");

  if (!authResult.valid) {
    return errorResponse(authResult.error || "Unauthorized", 401);
  }

  const supabase = getSupabaseClient();

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    // Validate required fields
    if (!body.provider || !body.event_type) {
      await logApiRequest(authResult.apiKey!.id, path, method, 400, clientIp, userAgent, Date.now() - startTime);
      return errorResponse("Missing required fields: provider, event_type", 400);
    }

    // Store webhook
    const webhookData = {
      provider: body.provider,
      event_type: body.event_type,
      payload: body.payload || body,
      status: "pending",
    };

    const { data: webhook, error: insertError } = await supabase
      .from("payment_webhooks")
      .insert(webhookData)
      .select()
      .single();

    if (insertError) {
      console.error("Error storing webhook:", insertError);
      await logApiRequest(authResult.apiKey!.id, path, method, 500, clientIp, userAgent, Date.now() - startTime);
      return errorResponse("Failed to store webhook", 500);
    }

    // Process webhook based on event type
    try {
      if (body.event_type === "payment.completed" && body.order_id) {
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            metadata: { ...body.metadata, payment_webhook_id: webhook.id },
          })
          .eq("id", body.order_id);
      } else if (body.event_type === "payment.failed" && body.order_id) {
        await supabase
          .from("orders")
          .update({
            payment_status: "failed",
            metadata: { ...body.metadata, payment_webhook_id: webhook.id },
          })
          .eq("id", body.order_id);
      }

      // Mark webhook as processed
      await supabase
        .from("payment_webhooks")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", webhook.id);

    } catch (processError) {
      console.error("Error processing webhook:", processError);
      await supabase
        .from("payment_webhooks")
        .update({ 
          status: "error", 
          error_message: processError instanceof Error ? processError.message : "Unknown error" 
        })
        .eq("id", webhook.id);
    }

    await logApiRequest(authResult.apiKey!.id, path, method, 200, clientIp, userAgent, Date.now() - startTime);
    return jsonResponse({ success: true, webhook_id: webhook.id });
  } catch (error) {
    console.error("Error:", error);
    return errorResponse("Internal server error", 500);
  }
});
