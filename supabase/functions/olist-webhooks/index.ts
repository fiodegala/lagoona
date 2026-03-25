import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    console.log("Olist webhook received:", JSON.stringify(body));

    const eventType = body.event || body.type || "unknown";
    const resource = body.resource || body.data || {};

    // Log webhook
    await supabase.from("olist_sync_logs").insert({
      sync_type: "webhook",
      direction: "pull",
      status: "success",
      records_processed: 1,
      details: { event_type: eventType, payload: body },
      completed_at: new Date().toISOString(),
    });

    // Process based on event type
    if (eventType.includes("order")) {
      const orderCode = resource.code || resource.order_code;
      if (orderCode) {
        const { data: mapping } = await supabase
          .from("olist_order_mappings")
          .select("id, local_order_id")
          .eq("olist_order_code", orderCode)
          .single();

        if (mapping?.local_order_id) {
          const newStatus = resource.status;
          if (newStatus) {
            const statusMap: Record<string, string> = {
              approved: "confirmed",
              canceled: "cancelled",
              shipped: "shipped",
              delivered: "delivered",
            };

            await supabase
              .from("orders")
              .update({
                status: statusMap[newStatus.toLowerCase()] || newStatus,
                metadata: { olist_webhook: body },
              })
              .eq("id", mapping.local_order_id);

            await supabase
              .from("olist_order_mappings")
              .update({
                olist_status: newStatus,
                last_synced_at: new Date().toISOString(),
                metadata: resource,
              })
              .eq("id", mapping.id);
          }
        }
      }
    }

    if (eventType.includes("product") || eventType.includes("stock")) {
      const productId = resource.product_id || resource.code;
      if (productId) {
        const { data: mapping } = await supabase
          .from("olist_product_mappings")
          .select("id, local_product_id")
          .eq("olist_product_id", String(productId))
          .single();

        if (mapping?.local_product_id && resource.stock !== undefined) {
          // Update stock via product_variations if applicable
          await supabase
            .from("olist_product_mappings")
            .update({
              last_synced_at: new Date().toISOString(),
              metadata: resource,
            })
            .eq("id", mapping.id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Olist webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
