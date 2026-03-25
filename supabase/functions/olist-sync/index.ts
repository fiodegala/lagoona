import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Olist ERP API v3
const OLIST_API_BASE = "https://api.tiny.com.br/public-api/v3";

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
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Olist API error [${response.status}]: ${errorText}`);
  }

  return response.json();
}

// ── Push local products to Olist ERP ──
async function pushProducts(supabase: ReturnType<typeof getSupabaseClient>) {
  const logId = crypto.randomUUID();
  await supabase.from("olist_sync_logs").insert({
    id: logId,
    sync_type: "products",
    direction: "push",
    status: "running",
  });

  try {
    // Fetch all local products with variations
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("*, product_variations(*)")
      .eq("is_active", true);

    if (prodErr) throw new Error(`DB error: ${prodErr.message}`);
    if (!products || products.length === 0) {
      await supabase.from("olist_sync_logs").update({
        status: "success",
        records_processed: 0,
        completed_at: new Date().toISOString(),
        details: { message: "Nenhum produto ativo encontrado" },
      }).eq("id", logId);
      return { processed: 0, failed: 0, total: 0, created: 0, updated: 0 };
    }

    let processed = 0;
    let failed = 0;
    let created = 0;
    let updated = 0;

    for (const product of products) {
      try {
        // Check if mapping already exists
        const { data: existing } = await supabase
          .from("olist_product_mappings")
          .select("id, olist_product_id")
          .eq("local_product_id", product.id)
          .single();

        // Build variations array for Olist
        const variacoes = (product.product_variations || []).map((v: any) => ({
          sku: v.sku || `${product.sku || product.id}-${v.id?.slice(0, 6)}`,
          gtin: v.barcode || "",
          precos: {
            preco: v.retail_price || v.price || product.price || 0,
            precoPromocional: v.promotional_price || product.promotional_price || 0,
          },
          estoque: {
            inicial: 0, // Stock managed separately
          },
          grade: [
            ...(v.color ? [{ chave: "Cor", valor: v.color }] : []),
            ...(v.size ? [{ chave: "Tamanho", valor: v.size }] : []),
          ],
        }));

        const olistPayload: Record<string, any> = {
          sku: product.sku || product.id,
          descricao: product.name,
          tipo: "P", // Produto simples
          descricaoComplementar: product.description || "",
          unidade: "UN",
          precos: {
            preco: product.price || 0,
            precoPromocional: product.promotional_price || 0,
            precoCusto: product.cost_price || 0,
          },
          dimensoes: {
            largura: product.width || 0,
            altura: product.height || 0,
            comprimento: product.length || 0,
            pesoLiquido: product.weight || 0,
            pesoBruto: product.weight || 0,
          },
          estoque: {
            controlar: true,
            inicial: 0,
          },
        };

        // Add images as anexos
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
          olistPayload.anexos = product.images.map((url: string) => ({
            url,
            externo: true,
          }));
        }

        // Add variations if they exist
        if (variacoes.length > 0) {
          olistPayload.variacoes = variacoes;
          olistPayload.tipo = "V"; // Produto com variações
        }

        if (existing?.olist_product_id) {
          // Update existing product on Olist
          // Olist ERP v3 uses PUT /produtos/{id}
          await olistFetch(`/produtos/${existing.olist_product_id}`, {
            method: "PUT",
            body: JSON.stringify(olistPayload),
          });

          await supabase.from("olist_product_mappings").update({
            last_synced_at: new Date().toISOString(),
            sync_status: "synced",
          }).eq("id", existing.id);

          updated++;
        } else {
          // Create new product on Olist
          const olistResult = await olistFetch("/produtos", {
            method: "POST",
            body: JSON.stringify(olistPayload),
          });

          // Create mapping
          await supabase.from("olist_product_mappings").insert({
            local_product_id: product.id,
            olist_product_id: String(olistResult.id || olistResult.codigo || ""),
            olist_sku: olistPayload.sku,
            sync_status: "synced",
            last_synced_at: new Date().toISOString(),
            metadata: olistResult,
          });

          created++;
        }
        processed++;
      } catch (e) {
        failed++;
        console.error(`Error pushing product ${product.name}:`, e);
      }
    }

    await supabase.from("olist_sync_logs").update({
      status: "success",
      records_processed: processed,
      records_failed: failed,
      completed_at: new Date().toISOString(),
      details: { total: products.length, created, updated },
    }).eq("id", logId);

    return { processed, failed, total: products.length, created, updated };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("olist_sync_logs").update({
      status: "error",
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
    }).eq("id", logId);
    throw error;
  }
}

// ── Pull products from Olist ──
async function syncProducts(supabase: ReturnType<typeof getSupabaseClient>) {
  const logId = crypto.randomUUID();
  await supabase.from("olist_sync_logs").insert({
    id: logId,
    sync_type: "products",
    direction: "pull",
    status: "running",
  });

  try {
    const olistProducts = await olistFetch("/produtos");
    const results = olistProducts.itens || olistProducts.results || olistProducts;

    let processed = 0;
    let failed = 0;

    for (const op of results) {
      try {
        const olistId = String(op.id || op.codigo || op.code);
        const { data: existing } = await supabase
          .from("olist_product_mappings")
          .select("id, local_product_id")
          .eq("olist_product_id", olistId)
          .single();

        if (existing) {
          await supabase.from("products").update({
            name: op.descricao || op.name || op.title,
            price: op.precos?.preco || op.price || op.sale_price,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.local_product_id);

          await supabase.from("olist_product_mappings").update({
            last_synced_at: new Date().toISOString(),
            sync_status: "synced",
          }).eq("id", existing.id);
        }
        processed++;
      } catch (e) {
        failed++;
        console.error("Error processing product:", e);
      }
    }

    await supabase.from("olist_sync_logs").update({
      status: "success",
      records_processed: processed,
      records_failed: failed,
      completed_at: new Date().toISOString(),
      details: { total_from_olist: results.length },
    }).eq("id", logId);

    return { processed, failed, total: results.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("olist_sync_logs").update({
      status: "error",
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
    }).eq("id", logId);
    throw error;
  }
}

// ── Pull orders from Olist ──
async function syncOrders(supabase: ReturnType<typeof getSupabaseClient>) {
  const logId = crypto.randomUUID();
  await supabase.from("olist_sync_logs").insert({
    id: logId,
    sync_type: "orders",
    direction: "pull",
    status: "running",
  });

  try {
    const olistOrders = await olistFetch("/pedidos");
    const results = olistOrders.itens || olistOrders.results || olistOrders;

    let processed = 0;
    let failed = 0;

    for (const oo of results) {
      try {
        const olistCode = String(oo.id || oo.codigo || oo.code);
        const { data: existing } = await supabase
          .from("olist_order_mappings")
          .select("id, local_order_id")
          .eq("olist_order_code", olistCode)
          .single();

        if (existing) {
          await supabase.from("olist_order_mappings").update({
            olist_status: oo.situacao || oo.status,
            last_synced_at: new Date().toISOString(),
            metadata: oo,
          }).eq("id", existing.id);
        } else {
          const orderItems = (oo.itens || oo.items || []).map((item: any) => ({
            name: item.descricao || item.name || "Produto Olist",
            quantity: item.quantidade || item.quantity || 1,
            price: item.valorUnitario || item.price || 0,
            sku: item.codigo || item.sku,
          }));

          const total = orderItems.reduce(
            (sum: number, i: any) => sum + i.price * i.quantity, 0
          );

          const { data: newOrder } = await supabase.from("orders").insert({
            customer_email: oo.contato?.email || oo.customer?.email || "olist@pedido.com",
            customer_name: oo.contato?.nome || oo.customer?.name || "Cliente Olist",
            items: orderItems,
            total: total || oo.totalProdutos || oo.total || 0,
            status: mapOlistStatus(oo.situacao || oo.status),
            payment_status: "pending",
            external_id: olistCode,
            metadata: { source: "olist", olist_data: oo },
          }).select("id").single();

          if (newOrder) {
            await supabase.from("olist_order_mappings").insert({
              local_order_id: newOrder.id,
              olist_order_code: olistCode,
              olist_status: oo.situacao || oo.status,
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

    await supabase.from("olist_sync_logs").update({
      status: "success",
      records_processed: processed,
      records_failed: failed,
      completed_at: new Date().toISOString(),
      details: { total_from_olist: results.length },
    }).eq("id", logId);

    return { processed, failed, total: results.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("olist_sync_logs").update({
      status: "error",
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
    }).eq("id", logId);
    throw error;
  }
}

// ── Send invoice to Olist ──
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
    await olistFetch(`/pedidos/${orderCode}/nota-fiscal`, {
      method: "POST",
      body: JSON.stringify({
        chaveAcesso: invoiceData.key,
        numero: invoiceData.number,
        serie: invoiceData.series || "1",
      }),
    });

    await supabase.from("olist_order_mappings").update({
      invoice_key: invoiceData.key,
      invoice_number: invoiceData.number,
    }).eq("olist_order_code", orderCode);

    await supabase.from("olist_sync_logs").update({
      status: "success",
      records_processed: 1,
      completed_at: new Date().toISOString(),
    }).eq("id", logId);

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("olist_sync_logs").update({
      status: "error",
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
    }).eq("id", logId);
    throw error;
  }
}

function mapOlistStatus(olistStatus: string): string {
  const statusMap: Record<string, string> = {
    aprovado: "confirmed",
    aberto: "pending",
    cancelado: "cancelled",
    enviado: "shipped",
    entregue: "delivered",
    faturado: "confirmed",
    approved: "confirmed",
    pending: "pending",
    canceled: "cancelled",
    shipped: "shipped",
    delivered: "delivered",
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

  const { data: { user }, error: authError } = await anonSupabase.auth.getUser();
  if (authError || !user) {
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
      try { body = await req.json(); } catch { body = {}; }
    }

    let result;

    switch (action) {
      case "push-products":
        result = await pushProducts(supabase);
        break;
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
          const info = await olistFetch("/info");
          result = { connected: true, seller: info };
        } catch (e) {
          result = { connected: false, error: e instanceof Error ? e.message : "Connection failed" };
        }
        break;
      case "get-config":
        const { data: config } = await supabase.from("olist_integration").select("*").limit(1).single();
        result = config;
        break;
      case "save-config":
        const { data: existingConfig } = await supabase.from("olist_integration").select("id").limit(1).single();
        if (existingConfig) {
          const { data: updated } = await supabase.from("olist_integration").update(body).eq("id", existingConfig.id).select().single();
          result = updated;
        } else {
          const { data: created } = await supabase.from("olist_integration").insert(body).select().single();
          result = created;
        }
        break;
      case "get-logs":
        const { data: logs } = await supabase.from("olist_sync_logs").select("*").order("created_at", { ascending: false }).limit(50);
        result = logs;
        break;
      case "get-product-mappings":
        const { data: mappings } = await supabase.from("olist_product_mappings").select("*, products:local_product_id(id, name, sku)").order("created_at", { ascending: false });
        result = mappings;
        break;
      case "get-order-mappings":
        const { data: orderMappings } = await supabase.from("olist_order_mappings").select("*, orders:local_order_id(id, customer_name, total, status)").order("created_at", { ascending: false });
        result = orderMappings;
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: push-products, sync-products, sync-orders, send-invoice, test-connection, get-config, save-config, get-logs" }),
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
