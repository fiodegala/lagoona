import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Olist/Tiny ERP API v2
const OLIST_API_BASE = "https://api.tiny.com.br/api2";

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

// Olist API v2 uses POST with form-encoded token + formato=JSON
async function olistPost(endpoint: string, extraParams: Record<string, string> = {}) {
  const token = getOlistToken();
  const url = `${OLIST_API_BASE}/${endpoint}`;
  const params = new URLSearchParams({ token, formato: "JSON", ...extraParams });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Olist API error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();

  // API v2 returns { retorno: { status: "OK"|"Erro", ... } }
  if (data.retorno?.status === "Erro") {
    throw new Error(`Olist: ${data.retorno.erros?.[0]?.erro || JSON.stringify(data.retorno)}`);
  }

  return data.retorno;
}

// ── Push local products to Olist ERP ──
async function pushProducts(supabase: ReturnType<typeof getSupabaseClient>) {
  const logId = crypto.randomUUID();
  await supabase.from("olist_sync_logs").insert({
    id: logId, sync_type: "products", direction: "push", status: "running",
  });

  try {
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("*, product_variations(*)")
      .eq("is_active", true);

    if (prodErr) throw new Error(`DB error: ${prodErr.message}`);
    if (!products || products.length === 0) {
      await supabase.from("olist_sync_logs").update({
        status: "success", records_processed: 0, completed_at: new Date().toISOString(),
        details: { message: "Nenhum produto ativo encontrado" },
      }).eq("id", logId);
      return { processed: 0, failed: 0, total: 0, created: 0, updated: 0 };
    }

    let processed = 0, failed = 0, created = 0, updated = 0;

    for (const product of products) {
      try {
        const { data: existing } = await supabase
          .from("olist_product_mappings")
          .select("id, olist_product_id")
          .eq("local_product_id", product.id)
          .maybeSingle();

        // Build produto XML-like JSON for API v2
        const produto: Record<string, any> = {
          sequencia: 1,
          codigo: product.sku || product.id,
          nome: product.name,
          unidade: "UN",
          preco: product.price || 0,
          preco_custo: product.cost_price || 0,
          preco_promocional: product.promotional_price || 0,
          peso_bruto: product.weight || 0,
          peso_liquido: product.weight || 0,
          classe_produto: "P",
          situacao: "A", // Ativo
          descricao_complementar: product.description || "",
        };

        if (product.width) produto.largura = product.width;
        if (product.height) produto.altura = product.height;
        if (product.length) produto.comprimento = product.length;

        // Add images
        if (product.images && Array.isArray(product.images)) {
          produto.imagens_externas = product.images.map((url: string) => ({ url }));
        }

        // Add variations
        const variations = product.product_variations || [];
        if (variations.length > 0) {
          produto.variacoes = variations.map((v: any) => {
            const variacao: Record<string, any> = {
              codigo: v.sku || `${product.sku || product.id}-${v.id?.slice(0, 6)}`,
              preco: v.retail_price || v.price || product.price || 0,
              grade: {},
            };
            if (v.color) variacao.grade.Cor = v.color;
            if (v.size) variacao.grade.Tamanho = v.size;
            return { variacao };
          });
        }

        const produtoJson = JSON.stringify({ produtos: [{ produto }] });

        if (existing?.olist_product_id) {
          // Update: use alterar endpoint
          await olistPost("produto.alterar.php", {
            produto: JSON.stringify({
              ...produto,
              id: existing.olist_product_id,
            }),
          });

          await supabase.from("olist_product_mappings").update({
            last_synced_at: new Date().toISOString(),
            sync_status: "synced",
          }).eq("id", existing.id);
          updated++;
        } else {
          // Create: use incluir endpoint
          const result = await olistPost("produto.incluir.php", {
            produto: JSON.stringify(produto),
          });

          const olistId = String(result.registros?.registro?.id || result.id || "");

          await supabase.from("olist_product_mappings").insert({
            local_product_id: product.id,
            olist_product_id: olistId,
            olist_sku: produto.codigo,
            sync_status: "synced",
            last_synced_at: new Date().toISOString(),
            metadata: result,
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
      status: "success", records_processed: processed, records_failed: failed,
      completed_at: new Date().toISOString(),
      details: { total: products.length, created, updated },
    }).eq("id", logId);

    return { processed, failed, total: products.length, created, updated };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("olist_sync_logs").update({
      status: "error", error_message: errorMsg, completed_at: new Date().toISOString(),
    }).eq("id", logId);
    throw error;
  }
}

// ── Pull products from Olist ──
async function syncProducts(supabase: ReturnType<typeof getSupabaseClient>) {
  const logId = crypto.randomUUID();
  await supabase.from("olist_sync_logs").insert({
    id: logId, sync_type: "products", direction: "pull", status: "running",
  });

  try {
    const result = await olistPost("produtos.pesquisa.php");
    const items = result.produtos || [];

    let processed = 0, failed = 0;

    for (const item of items) {
      const op = item.produto;
      try {
        const olistId = String(op.id);
        const { data: existing } = await supabase
          .from("olist_product_mappings")
          .select("id, local_product_id")
          .eq("olist_product_id", olistId)
          .maybeSingle();

        if (existing) {
          await supabase.from("products").update({
            name: op.nome,
            price: op.preco,
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
      status: "success", records_processed: processed, records_failed: failed,
      completed_at: new Date().toISOString(),
      details: { total_from_olist: items.length },
    }).eq("id", logId);

    return { processed, failed, total: items.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("olist_sync_logs").update({
      status: "error", error_message: errorMsg, completed_at: new Date().toISOString(),
    }).eq("id", logId);
    throw error;
  }
}

// ── Pull orders from Olist ──
async function syncOrders(supabase: ReturnType<typeof getSupabaseClient>) {
  const logId = crypto.randomUUID();
  await supabase.from("olist_sync_logs").insert({
    id: logId, sync_type: "orders", direction: "pull", status: "running",
  });

  try {
    const result = await olistPost("pedidos.pesquisa.php");
    const items = result.pedidos || [];

    let processed = 0, failed = 0;

    for (const item of items) {
      const oo = item.pedido;
      try {
        const olistCode = String(oo.id || oo.numero);
        const { data: existing } = await supabase
          .from("olist_order_mappings")
          .select("id, local_order_id")
          .eq("olist_order_code", olistCode)
          .maybeSingle();

        if (existing) {
          await supabase.from("olist_order_mappings").update({
            olist_status: oo.situacao,
            last_synced_at: new Date().toISOString(),
            metadata: oo,
          }).eq("id", existing.id);
        } else {
          // Fetch full order details
          let orderDetail = oo;
          try {
            const detail = await olistPost("pedido.obter.php", { id: String(oo.id) });
            orderDetail = detail.pedido || oo;
          } catch { /* use summary data */ }

          const orderItems = (orderDetail.itens || []).map((i: any) => {
            const it = i.item || i;
            return {
              name: it.descricao || "Produto Olist",
              quantity: it.quantidade || 1,
              price: it.valor_unitario || 0,
              sku: it.codigo,
            };
          });

          const total = orderItems.reduce(
            (sum: number, i: any) => sum + i.price * i.quantity, 0
          );

          const { data: newOrder } = await supabase.from("orders").insert({
            customer_email: orderDetail.cliente?.email || "olist@pedido.com",
            customer_name: orderDetail.cliente?.nome || "Cliente Olist",
            items: orderItems,
            total: total || orderDetail.totalProdutos || 0,
            status: mapOlistStatus(oo.situacao),
            payment_status: "pending",
            external_id: olistCode,
            metadata: { source: "olist", olist_data: orderDetail },
          }).select("id").single();

          if (newOrder) {
            await supabase.from("olist_order_mappings").insert({
              local_order_id: newOrder.id,
              olist_order_code: olistCode,
              olist_status: oo.situacao,
              last_synced_at: new Date().toISOString(),
              metadata: orderDetail,
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
      status: "success", records_processed: processed, records_failed: failed,
      completed_at: new Date().toISOString(),
      details: { total_from_olist: items.length },
    }).eq("id", logId);

    return { processed, failed, total: items.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("olist_sync_logs").update({
      status: "error", error_message: errorMsg, completed_at: new Date().toISOString(),
    }).eq("id", logId);
    throw error;
  }
}

// ── Send invoice to Olist ──
async function sendInvoice(
  supabase: ReturnType<typeof getSupabaseClient>,
  orderCode: string,
  invoiceData: { key: string; number: string; series?: string }
) {
  const logId = crypto.randomUUID();
  await supabase.from("olist_sync_logs").insert({
    id: logId, sync_type: "invoices", direction: "push", status: "running",
  });

  try {
    // First get the nota fiscal id from the order
    await olistPost("nota.fiscal.incluir.php", {
      nota: JSON.stringify({
        tipo: "S",
        numero: invoiceData.number,
        serie: invoiceData.series || "1",
        chave_acesso: invoiceData.key,
        id_pedido: orderCode,
      }),
    });

    await supabase.from("olist_order_mappings").update({
      invoice_key: invoiceData.key,
      invoice_number: invoiceData.number,
    }).eq("olist_order_code", orderCode);

    await supabase.from("olist_sync_logs").update({
      status: "success", records_processed: 1, completed_at: new Date().toISOString(),
    }).eq("id", logId);

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("olist_sync_logs").update({
      status: "error", error_message: errorMsg, completed_at: new Date().toISOString(),
    }).eq("id", logId);
    throw error;
  }
}

function mapOlistStatus(situacao: string): string {
  const statusMap: Record<string, string> = {
    "aberto": "pending",
    "aprovado": "confirmed",
    "preparando_envio": "confirmed",
    "faturado": "confirmed",
    "pronto_envio": "confirmed",
    "enviado": "shipped",
    "entregue": "delivered",
    "cancelado": "cancelled",
    "devolvido": "cancelled",
  };
  return statusMap[situacao?.toLowerCase()] || "pending";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseClient();

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
          const info = await olistPost("info.php");
          result = { connected: true, seller: info };
        } catch (e) {
          result = { connected: false, error: e instanceof Error ? e.message : "Connection failed" };
        }
        break;
      case "get-config": {
        const { data: config } = await supabase.from("olist_integration").select("*").limit(1).maybeSingle();
        result = config;
        break;
      }
      case "save-config": {
        const { data: existingConfig } = await supabase.from("olist_integration").select("id").limit(1).maybeSingle();
        if (existingConfig) {
          const { data: updated } = await supabase.from("olist_integration").update(body).eq("id", existingConfig.id).select().single();
          result = updated;
        } else {
          const { data: created } = await supabase.from("olist_integration").insert(body).select().single();
          result = created;
        }
        break;
      }
      case "get-logs": {
        const { data: logs } = await supabase.from("olist_sync_logs").select("*").order("created_at", { ascending: false }).limit(50);
        result = logs;
        break;
      }
      case "get-product-mappings": {
        const { data: mappings } = await supabase.from("olist_product_mappings").select("*, products:local_product_id(id, name, sku)").order("created_at", { ascending: false });
        result = mappings;
        break;
      }
      case "get-order-mappings": {
        const { data: orderMappings } = await supabase.from("olist_order_mappings").select("*, orders:local_order_id(id, customer_name, total, status)").order("created_at", { ascending: false });
        result = orderMappings;
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida. Use: push-products, sync-products, sync-orders, send-invoice, test-connection" }),
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
