import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const OLIST_API_BASE = "https://partners-api.olist.com/v1";

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

function getOlistToken(): string {
  const token = Deno.env.get("OLIST_API_TOKEN");
  if (!token) throw new Error("OLIST_API_TOKEN not configured");
  return token;
}

async function olistFetch(path: string, options: RequestInit = {}) {
  const token = getOlistToken();
  const url = `${OLIST_API_BASE}${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `JWT ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Olist API error [${response.status}]: ${errorText}`);
  }

  return response.json();
}

async function syncProducts(supabase: ReturnType<typeof getSupabaseClient>) {
  const logId = crypto.randomUUID();
  await supabase.from("olist_sync_logs").insert({
    id: logId,
    sync_type: "products",
    direction: "pull",
    status: "running",
  });

  try {
    // Fetch products from Olist
    const olistProducts = await olistFetch("/seller-products/");
    const results = olistProducts.results || olistProducts;
    
    let processed = 0;
    let failed = 0;

    for (const op of results) {
      try {
        // Check if mapping exists
        const { data: existing } = await supabase
          .from("olist_product_mappings")
          .select("id, local_product_id")
          .eq("olist_product_id", op.code || op.id)
          .single();

        if (existing) {
          // Update existing product
          await supabase
            .from("products")
            .update({
              name: op.name || op.title,
              price: op.price || op.sale_price,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.local_product_id);
          
          await supabase
            .from("olist_product_mappings")
            .update({ last_synced_at: new Date().toISOString(), sync_status: "synced" })
            .eq("id", existing.id);
        }
        // If no mapping, we just track - user can manually map
        processed++;
      } catch (e) {
        failed++;
        console.error("Error processing product:", e);
      }
    }

    await supabase
      .from("olist_sync_logs")
      .update({
        status: "success",
        records_processed: processed,
        records_failed: failed,
        completed_at: new Date().toISOString(),
        details: { total_from_olist: results.length },
      })
      .eq("id", logId);

    return { processed, failed, total: results.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase
      .from("olist_sync_logs")
      .update({ status: "error", error_message: errorMsg, completed_at: new Date().toISOString() })
      .eq("id", logId);
    throw error;
  }
}

async function syncOrders(supabase: ReturnType<typeof getSupabaseClient>) {
  const logId = crypto.randomUUID();
  await supabase.from("olist_sync_logs").insert({
    id: logId,
    sync_type: "orders",
    direction: "pull",
    status: "running",
  });

  try {
    const olistOrders = await olistFetch("/seller-orders/");
    const results = olistOrders.results || olistOrders;
    
    let processed = 0;
    let failed = 0;

    for (const oo of results) {
      try {
        const olistCode = oo.code || oo.id;
        
        // Check if mapping exists
        const { data: existing } = await supabase
          .from("olist_order_mappings")
          .select("id, local_order_id")
          .eq("olist_order_code", olistCode)
          .single();

        if (existing) {
          // Update mapping status
          await supabase
            .from("olist_order_mappings")
            .update({
              olist_status: oo.status,
              last_synced_at: new Date().toISOString(),
              metadata: oo,
            })
            .eq("id", existing.id);
        } else {
          // Create local order and mapping
          const orderItems = (oo.items || []).map((item: any) => ({
            name: item.name || item.title || "Produto Olist",
            quantity: item.quantity || 1,
            price: item.price || item.unit_price || 0,
            sku: item.sku,
          }));

          const total = orderItems.reduce(
            (sum: number, i: any) => sum + i.price * i.quantity,
            0
          );

          const { data: newOrder } = await supabase
            .from("orders")
            .insert({
              customer_email: oo.customer?.email || oo.seller_email || "olist@pedido.com",
              customer_name: oo.customer?.name || "Cliente Olist",
              items: orderItems,
              total: total || oo.total || 0,
              status: mapOlistStatus(oo.status),
              payment_status: oo.payment_status || "pending",
              external_id: olistCode,
              metadata: { source: "olist", olist_data: oo },
            })
            .select("id")
            .single();

          if (newOrder) {
            await supabase.from("olist_order_mappings").insert({
              local_order_id: newOrder.id,
              olist_order_code: olistCode,
              olist_status: oo.status,
              last_synced_at: new Date().toISOString(),
              metadata: oo,
            });
          }
        }
        processed++;
      } catch (e) {
        failed++;
        console.error("Error processing order:", e);
      }
    }

    await supabase
      .from("olist_sync_logs")
      .update({
        status: "success",
        records_processed: processed,
        records_failed: failed,
        completed_at: new Date().toISOString(),
        details: { total_from_olist: results.length },
      })
      .eq("id", logId);

    return { processed, failed, total: results.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase
      .from("olist_sync_logs")
      .update({ status: "error", error_message: errorMsg, completed_at: new Date().toISOString() })
      .eq("id", logId);
    throw error;
  }
}

async function sendInvoice(
  supabase: ReturnType<typeof getSupabaseClient>,
  orderCode: string,
  invoiceData: { key: string; number: string; series?: string; cfop?: string }
) {
  const logId = crypto.randomUUID();
  await supabase.from("olist_sync_logs").insert({
    id: logId,
    sync_type: "invoices",
    direction: "push",
    status: "running",
  });

  try {
    await olistFetch(`/seller-orders/${orderCode}/invoice/`, {
      method: "POST",
      body: JSON.stringify({
        key: invoiceData.key,
        number: invoiceData.number,
        series: invoiceData.series || "1",
        cfop: invoiceData.cfop || "6102",
      }),
    });

    // Update mapping
    await supabase
      .from("olist_order_mappings")
      .update({
        invoice_key: invoiceData.key,
        invoice_number: invoiceData.number,
      })
      .eq("olist_order_code", orderCode);

    await supabase
      .from("olist_sync_logs")
      .update({ status: "success", records_processed: 1, completed_at: new Date().toISOString() })
      .eq("id", logId);

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase
      .from("olist_sync_logs")
      .update({ status: "error", error_message: errorMsg, completed_at: new Date().toISOString() })
      .eq("id", logId);
    throw error;
  }
}

function mapOlistStatus(olistStatus: string): string {
  const statusMap: Record<string, string> = {
    approved: "confirmed",
    pending: "pending",
    canceled: "cancelled",
    shipped: "shipped",
    delivered: "delivered",
    invoiced: "confirmed",
  };
  return statusMap[olistStatus?.toLowerCase()] || "pending";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseClient();

  // Verify auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonSupabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: claimsData, error: claimsError } = await anonSupabase.auth.getClaims(
    authHeader.replace("Bearer ", "")
  );
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    let body: any = {};
    
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    let result;

    switch (action) {
      case "sync-products":
        result = await syncProducts(supabase);
        break;
      case "sync-orders":
        result = await syncOrders(supabase);
        break;
      case "send-invoice":
        if (!body.order_code || !body.key || !body.number) {
          return new Response(
            JSON.stringify({ error: "Missing order_code, key, or number" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = await sendInvoice(supabase, body.order_code, body);
        break;
      case "test-connection":
        try {
          const seller = await olistFetch("/seller/");
          result = { connected: true, seller };
        } catch (e) {
          result = { connected: false, error: e instanceof Error ? e.message : "Connection failed" };
        }
        break;
      case "get-config":
        const { data: config } = await supabase
          .from("olist_integration")
          .select("*")
          .limit(1)
          .single();
        result = config;
        break;
      case "save-config":
        const { data: existingConfig } = await supabase
          .from("olist_integration")
          .select("id")
          .limit(1)
          .single();
        
        if (existingConfig) {
          const { data: updated } = await supabase
            .from("olist_integration")
            .update(body)
            .eq("id", existingConfig.id)
            .select()
            .single();
          result = updated;
        } else {
          const { data: created } = await supabase
            .from("olist_integration")
            .insert(body)
            .select()
            .single();
          result = created;
        }
        break;
      case "get-logs":
        const { data: logs } = await supabase
          .from("olist_sync_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        result = logs;
        break;
      case "get-product-mappings":
        const { data: mappings } = await supabase
          .from("olist_product_mappings")
          .select("*, products:local_product_id(id, name, sku)")
          .order("created_at", { ascending: false });
        result = mappings;
        break;
      case "get-order-mappings":
        const { data: orderMappings } = await supabase
          .from("olist_order_mappings")
          .select("*, orders:local_order_id(id, customer_name, total, status)")
          .order("created_at", { ascending: false });
        result = orderMappings;
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: sync-products, sync-orders, send-invoice, test-connection, get-config, save-config, get-logs" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Olist sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
