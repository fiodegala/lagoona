import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Z-API Webhook received:", JSON.stringify(body));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Store all webhook events
    await supabase.from("zapi_webhook_logs").insert({
      event_type: body.event || body.type || "unknown",
      payload: body,
    });

    // Handle message status updates (delivery/read receipts)
    if (body.status) {
      console.log(`Message status: ${body.status} for ${body.phone}`);
    }

    // Handle incoming messages
    if (body.text?.message || body.image || body.audio || body.video || body.document) {
      console.log(`Incoming message from ${body.phone}: ${body.text?.message || "[media]"}`);
    }

    // Handle connection status
    if (body.connected !== undefined) {
      console.log(`Z-API connection status: ${body.connected ? "connected" : "disconnected"}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 200, // Z-API expects 200 to not retry
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
