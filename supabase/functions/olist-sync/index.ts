import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const OLIST_API_BASE = "https://api.tiny.com.br/api2";
const OLIST_REQUEST_DELAY_MS = 800;
const OLIST_RATE_LIMIT_MAX_RETRIES = 5;
const OLIST_RATE_LIMIT_BASE_DELAY_MS = 4000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOlistRateLimitMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("api bloqueada") || normalized.includes("excedido o número de acessos") || normalized.includes("excedido o numero de acessos");
}

function toPositiveNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function toNonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractGalleryImages(metadata: Record<string, any> | null | undefined): string[] {
  const gallery = metadata?.gallery_images;
  if (!Array.isArray(gallery)) return [];
  return gallery.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function collectProductImages(product: Record<string, any>, variations: Record<string, any>[]) {
  const images: string[] = [];
  if (product.image_url) images.push(product.image_url);
  images.push(...extractGalleryImages(product.metadata));
  for (const v of variations) {
    if (v.image_url && !images.includes(v.image_url)) images.push(v.image_url);
  }
  return images.slice(0, 6);
}

function extractOlistProductId(payload: any): string | null {
  if (!payload) return null;
  
  const candidates = [
    payload?.id,
    payload?.produto?.id,
    payload?.registro?.id,
    payload?.registros?.registro?.id,
    Array.isArray(payload?.registros) && payload.registros.length > 0 
      ? (payload.registros[0]?.registro?.id || payload.registros[0]?.id) 
      : undefined,
  ];

  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }

  return null;
}

function extractProductCode(product: Record<string, any>, variations: Record<string, any>[]) {
  return (
    normalizeText(product.barcode) ||
    normalizeText(variations.find((v) => normalizeText(v.sku))?.sku) ||
    normalizeText(variations.find((v) => normalizeText(v.barcode))?.barcode) ||
    product.id
  );
}

function buildProductPayload(
  product: Record<string, any>,
  variations: Record<string, any>[],
  mode: "minimal" | "full" = "full"
) {
  const payload: Record<string, any> = {
    codigo: extractProductCode(product, variations),
    nome: product.name,
    unidade: "UN",
    preco: toNonNegativeNumber(product.promotional_price ?? product.price),
    estoque_atual: toNonNegativeNumber(product.stock),
    situacao: "A",
  };

  if (mode === "minimal") {
    return payload;
  }

  const images = collectProductImages(product, variations);
  const description = normalizeText(product.description);
  if (description) payload.descricao_complementar = description;

  const promotionalPrice = toPositiveNumber(product.promotional_price);
  if (promotionalPrice !== undefined) payload.preco_promocional = promotionalPrice;

  const weight = toPositiveNumber(product.weight_kg);
  if (weight !== undefined) {
    payload.peso_bruto = weight;
    payload.peso_liquido = weight;
  }

  const width = toPositiveNumber(product.width_cm);
  if (width !== undefined) payload.largura = width;
  const height = toPositiveNumber(product.height_cm);
  if (height !== undefined) payload.altura = height;
  const depth = toPositiveNumber(product.depth_cm);
  if (depth !== undefined) payload.comprimento = depth;

  if (images.length > 0) {
    payload.imagens_externas = images.map((url) => ({ url }));
  }

  return payload;
}

async function findOlistProductId(product: Record<string, any>, variations: Record<string, any>[]) {
  const code = extractProductCode(product, variations);
  const byCode = await findOlistProductIdByCode(code);
  if (byCode) return byCode;

  const name = normalizeText(product.name);
  if (!name) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await olistPost("produtos.pesquisa.php", { pesquisa: name });
      const products = Array.isArray(result?.produtos) ? result.produtos : [];
      const match = products.find((item: any) => {
        const candidate = item?.produto || item;
        return String(candidate?.nome ?? "").trim().toLowerCase() === name.toLowerCase();
      });

      const matchedId = extractOlistProductId(match?.produto || match);
      if (matchedId) return matchedId;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("a consulta não retornou registros") && !message.toLowerCase().includes("a consulta nao retornou registros")) {
        throw error;
      }
    }

    await sleep(3000 * (attempt + 1));
  }

  return null;
}

async function findOlistProductIdByCode(code: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let result: any;
    try {
      result = await olistPost("produtos.pesquisa.php", { pesquisa: code });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("a consulta não retornou registros") || message.toLowerCase().includes("a consulta nao retornou registros")) {
        if (attempt < 2) {
          await sleep(3000 * (attempt + 1));
          continue;
        }
        return null;
      }
      throw error;
    }

    const products = Array.isArray(result?.produtos) ? result.produtos : [];
    const match = products.find((item: any) => {
      const product = item?.produto || item;
      const candidateCode = String(product?.codigo ?? product?.codigo_sku ?? "").trim();
      return candidateCode === code;
    });

    const matchedId = extractOlistProductId(match?.produto || match);
    if (matchedId) return matchedId;

    if (attempt < 2) {
      await sleep(3000 * (attempt + 1));
    }
  }
  return null;
}

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

async function olistPost(endpoint: string, extraParams: Record<string, string> = {}) {
  const token = getOlistToken();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= OLIST_RATE_LIMIT_MAX_RETRIES; attempt++) {
    const url = `${OLIST_API_BASE}/${endpoint}`;
    const params = new URLSearchParams({ token, formato: "JSON", ...extraParams });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Olist API error [${response.status}]: ${errorText}`);
      if (attempt < OLIST_RATE_LIMIT_MAX_RETRIES && isOlistRateLimitMessage(error.message)) {
        await sleep(OLIST_RATE_LIMIT_BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      throw error;
    }

    const data = await response.json();

    if (data.retorno?.status === "Erro") {
      const error = new Error(`Olist: ${data.retorno.erros?.[0]?.erro || JSON.stringify(data.retorno)}`);
      lastError = error;
      if (attempt < OLIST_RATE_LIMIT_MAX_RETRIES && isOlistRateLimitMessage(error.message)) {
        await sleep(OLIST_RATE_LIMIT_BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      throw error;
    }

    return data.retorno;
  }

  throw lastError ?? new Error("Olist: limite de API excedido");
}

// ── Push local products to Olist ERP ──
async function pushProducts(
  supabase: ReturnType<typeof getSupabaseClient>,
  options: { offset?: number; limit?: number; logId?: string; productIds?: string[] } = {}
) {
  const offset = Math.max(0, Number(options.offset ?? 0));
  const limit = Math.min(20, Math.max(1, Number(options.limit ?? 10)));
  const logId = normalizeText(options.logId) || crypto.randomUUID();
  const productIds = Array.isArray(options.productIds) && options.productIds.length > 0 ? options.productIds : null;

  const { data: existingLog } = await supabase
    .from("olist_sync_logs")
    .select("id, details")
    .eq("id", logId)
    .maybeSingle();

  if (!existingLog) {
    await supabase.from("olist_sync_logs").insert({
      id: logId,
      sync_type: "products",
      direction: "push",
      status: "running",
      records_processed: 0,
      records_failed: 0,
      details: { total: 0, created: 0, updated: 0, queued: 0, failures: [] },
    });
  }

  try {
    let total = 0;
    let productsQuery;

    if (productIds) {
      // Send specific products
      const { count, error: countErr } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .in("id", productIds);
      if (countErr) throw new Error(`DB error: ${countErr.message}`);
      total = count ?? 0;

      const { data: products, error: prodErr } = await supabase
        .from("products")
        .select("*, product_variations(*)")
        .in("id", productIds)
        .range(offset, offset + limit - 1);
      if (prodErr) throw new Error(`DB error: ${prodErr.message}`);
      productsQuery = products;
    } else {
      // Send all active products
      const { count, error: countErr } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (countErr) throw new Error(`DB error: ${countErr.message}`);
      total = count ?? 0;

      const { data: products, error: prodErr } = await supabase
        .from("products")
        .select("*, product_variations(*)")
        .eq("is_active", true)
        .range(offset, offset + limit - 1);
      if (prodErr) throw new Error(`DB error: ${prodErr.message}`);
      productsQuery = products;
    }

    if (total === 0) {
      await supabase.from("olist_sync_logs").update({
        status: "success",
        records_processed: 0,
        records_failed: 0,
        completed_at: new Date().toISOString(),
        details: { total: 0, created: 0, updated: 0, queued: 0, failures: [], message: "Nenhum produto encontrado" },
      }).eq("id", logId);
      return { processed: 0, failed: 0, total: 0, created: 0, updated: 0, queued: 0, hasMore: false, nextOffset: offset, logId };
    }

    const products = productsQuery || [];
    const previousDetails = (existingLog?.details as Record<string, any> | null) || {};
    let processed = toNonNegativeNumber(previousDetails.processed, 0);
    let failed = toNonNegativeNumber(previousDetails.failed, 0);
    let created = toNonNegativeNumber(previousDetails.created, 0);
    let updated = toNonNegativeNumber(previousDetails.updated, 0);
    let queued = toNonNegativeNumber(previousDetails.queued, 0);
    const failureDetails: Array<{ product_id: string; product_name: string; error: string }> = Array.isArray(previousDetails.failures)
      ? previousDetails.failures.slice(0, 50)
      : [];

    for (const product of products) {
      try {
        await sleep(OLIST_REQUEST_DELAY_MS);

        const variations = Array.isArray(product.product_variations)
          ? product.product_variations.filter((v: any) => v?.is_active !== false)
          : [];

        const productCode = extractProductCode(product, variations);
        const productPayload = buildProductPayload(product, variations, "full");
        const createPayload = buildProductPayload(product, variations, "minimal");

        const { data: existing } = await supabase
          .from("olist_product_mappings")
          .select("id, olist_product_id")
          .eq("local_product_id", product.id)
          .maybeSingle();

        let existingOlistId = normalizeText(existing?.olist_product_id);
        // Skip "pending" IDs - they need to be resolved
        if (existingOlistId === "pending") existingOlistId = undefined;
        
        if (!existingOlistId && existing) {
          existingOlistId = await findOlistProductId(product, variations);
        }

        if (existingOlistId) {
          // UPDATE existing product
          await olistPost("produto.alterar.php", {
            produto: JSON.stringify({ ...productPayload, id: existingOlistId }),
          });

          await supabase.from("olist_product_mappings").update({
            olist_product_id: existingOlistId,
            last_synced_at: new Date().toISOString(),
            sync_status: "synced",
            olist_sku: productCode,
          }).eq("id", existing!.id);
          updated++;
        } else {
          // CREATE new product
          let result: any;
          let createdSuccessfully = false;

          try {
            result = await olistPost("produto.incluir.php", {
              produto: JSON.stringify(createPayload),
            });
            createdSuccessfully = true;
            console.log(`Tiny response for ${product.name}:`, JSON.stringify(result));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const normalizedMessage = message.toLowerCase();
            const looksLikeDuplicate = normalizedMessage.includes("já cadastrado") ||
              normalizedMessage.includes("ja cadastrado") ||
              normalizedMessage.includes("já existe") ||
              normalizedMessage.includes("ja existe") ||
              normalizedMessage.includes("duplic");

            if (!looksLikeDuplicate) {
              throw error;
            }

            // Product already exists - find it
            const foundOlistId = await findOlistProductId(product, variations);
            if (foundOlistId) {
              await olistPost("produto.alterar.php", {
                produto: JSON.stringify({ ...productPayload, id: foundOlistId }),
              });
              const mappingPayload = {
                local_product_id: product.id,
                olist_product_id: foundOlistId,
                olist_sku: productCode,
                sync_status: "synced",
                last_synced_at: new Date().toISOString(),
                metadata: { duplicate_detected: true, message },
              };
              if (existing) {
                await supabase.from("olist_product_mappings").update(mappingPayload).eq("id", existing.id);
              } else {
                await supabase.from("olist_product_mappings").insert(mappingPayload);
              }
              updated++;
              processed++;
              continue;
            } else {
              throw error;
            }
          }

          if (createdSuccessfully) {
            // Tiny API v2 returns status OK but registros:[] (async queue processing)
            // Try to extract ID from response, if not available save as "queued"
            const olistId = extractOlistProductId(result);
            
            // Also try searching after a short delay
            let resolvedId = olistId;
            if (!resolvedId) {
              await sleep(2000);
              resolvedId = await findOlistProductId(product, variations);
            }

            if (resolvedId) {
              await olistPost("produto.alterar.php", {
                produto: JSON.stringify({ ...productPayload, id: resolvedId }),
              });
            }

            const mappingPayload = {
              local_product_id: product.id,
              olist_product_id: resolvedId || "pending",
              olist_sku: productCode,
              sync_status: resolvedId ? "synced" : "queued",
              last_synced_at: new Date().toISOString(),
              metadata: { response: result, status_processamento: result?.status_processamento },
            };

            if (existing) {
              await supabase.from("olist_product_mappings").update(mappingPayload).eq("id", existing.id);
            } else {
              await supabase.from("olist_product_mappings").insert(mappingPayload);
            }

            if (resolvedId) {
              created++;
            } else {
              queued++;
            }
          }
        }

        processed++;
      } catch (e) {
        failed++;
        failureDetails.push({
          product_id: product.id,
          product_name: product.name,
          error: e instanceof Error ? e.message : "Unknown error",
        });
        console.error(`Error pushing product ${product.name}:`, e);
      }
    }

    const nextOffset = offset + products.length;
    const hasMore = nextOffset < total;
    const details = {
      total,
      processed,
      failed,
      created,
      updated,
      queued,
      failures: failureDetails.slice(0, 10),
      message: hasMore
        ? `Enviando lote ${Math.floor(offset / limit) + 1}. ${nextOffset} de ${total} produtos processados.`
          : failed > 0
          ? `${queued > 0 ? queued + " produto(s) na fila de processamento do Tiny. " : ""}Parte dos produtos falhou. Tente novamente.`
          : queued > 0
            ? `${created} criados, ${updated} atualizados, ${queued} aguardando confirmação no Tiny ERP.`
            : "Todos os produtos foram enviados com sucesso",
    };

    await supabase.from("olist_sync_logs").update({
      status: hasMore ? "running" : failed > 0 || queued > 0 ? "partial_success" : "success",
      records_processed: processed,
      records_failed: failed,
      completed_at: hasMore ? null : new Date().toISOString(),
      details,
    }).eq("id", logId);

    if (!hasMore) {
      await supabase.from("olist_integration").update({
        last_product_sync_at: new Date().toISOString(),
        last_error: failed > 0 ? `${failed} produto(s) falharam na sincronização` : null,
      }).neq("id", "00000000-0000-0000-0000-000000000000");
    }

    return { processed, failed, total, created, updated, queued, hasMore, nextOffset, logId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("olist_sync_logs").update({
      status: "error",
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
    }).eq("id", logId);
    await supabase.from("olist_integration").update({ last_error: errorMsg }).neq("id", "00000000-0000-0000-0000-000000000000");
    throw error;
  }
}

// ── Reconcile queued products (find IDs for pending mappings) ──
async function reconcileProducts(supabase: ReturnType<typeof getSupabaseClient>) {
  const { data: pendingMappings } = await supabase
    .from("olist_product_mappings")
    .select("id, local_product_id, olist_sku, olist_product_id")
    .or("sync_status.eq.queued,olist_product_id.eq.pending")
    .limit(50);

  if (!pendingMappings || pendingMappings.length === 0) {
    return { resolved: 0, pending: 0, total: 0 };
  }

  let resolved = 0;
  let stillPending = 0;

  for (const mapping of pendingMappings) {
    try {
      await sleep(OLIST_REQUEST_DELAY_MS);
      const code = mapping.olist_sku || mapping.local_product_id;
      const olistId = await findOlistProductIdByCode(code);
      
      if (olistId) {
        await supabase.from("olist_product_mappings").update({
          olist_product_id: olistId,
          sync_status: "synced",
          last_synced_at: new Date().toISOString(),
        }).eq("id", mapping.id);
        resolved++;
      } else {
        stillPending++;
      }
    } catch (e) {
      stillPending++;
      console.error(`Error reconciling mapping ${mapping.id}:`, e);
    }
  }

  return { resolved, pending: stillPending, total: pendingMappings.length };
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

          const total = orderItems.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);

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
        result = await pushProducts(supabase, {
          offset: body.offset,
          limit: body.limit,
          logId: body.logId,
          productIds: body.productIds,
        });
        break;
      case "sync-products":
        result = await syncProducts(supabase);
        break;
      case "sync-orders":
        result = await syncOrders(supabase);
        break;
      case "reconcile-products":
        result = await reconcileProducts(supabase);
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
        const { data: mappings } = await supabase.from("olist_product_mappings").select("*, products:local_product_id(id, name, barcode)").order("created_at", { ascending: false });
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
          JSON.stringify({ error: "Ação inválida" }),
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
