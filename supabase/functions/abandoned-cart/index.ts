import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, session_id, cart_data } = body;

    if (!session_id || typeof session_id !== "string" || session_id.length > 100) {
      return new Response(JSON.stringify({ error: "Invalid session_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upsert") {
      // Validate cart_data fields
      if (!cart_data || typeof cart_data !== "object") {
        return new Response(JSON.stringify({ error: "Invalid cart_data" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const safeData = {
        session_id,
        customer_name: typeof cart_data.customer_name === "string" ? cart_data.customer_name.slice(0, 200) : null,
        customer_email: typeof cart_data.customer_email === "string" ? cart_data.customer_email.slice(0, 200) : null,
        customer_phone: typeof cart_data.customer_phone === "string" ? cart_data.customer_phone.slice(0, 50) : null,
        shipping_address: cart_data.shipping_address || null,
        items: Array.isArray(cart_data.items) ? cart_data.items : [],
        subtotal: typeof cart_data.subtotal === "number" ? cart_data.subtotal : 0,
        item_count: typeof cart_data.item_count === "number" ? cart_data.item_count : 0,
        status: "abandoned" as const,
      };

      // Upsert: find existing by session_id + status=abandoned
      const { data: existing } = await supabase
        .from("abandoned_carts")
        .select("id")
        .eq("session_id", session_id)
        .eq("status", "abandoned")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("abandoned_carts")
          .update(safeData)
          .eq("id", existing.id);
      } else {
        await supabase
          .from("abandoned_carts")
          .insert(safeData);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "recover") {
      // Mark cart as recovered - only for the specific session
      const { error } = await supabase
        .from("abandoned_carts")
        .update({ status: "recovered", recovered_at: new Date().toISOString() })
        .eq("session_id", session_id)
        .eq("status", "abandoned");

      if (error) {
        console.error("Error marking cart recovered:", error);
        return new Response(JSON.stringify({ error: "Failed to recover" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in abandoned-cart function:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
