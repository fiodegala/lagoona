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
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Validate HMAC authentication with "import:write" scope
  const authResult = await validateHmacAuth(req, "import:write");

  if (!authResult.valid) {
    return errorResponse(authResult.error || "Unauthorized", 401);
  }

  const apiKeyId = authResult.apiKey!.id;
  const supabase = getSupabaseClient();

  try {
    if (method !== "POST") {
      const resp = errorResponse("Method not allowed", 405);
      await logApiRequest(apiKeyId, path, method, 405, clientIp, userAgent, Date.now() - startTime);
      return resp;
    }

    const body = await req.json();
    const { type, records } = body;

    if (!type || !records || !Array.isArray(records) || records.length === 0) {
      const resp = errorResponse(
        "Payload inválido. Envie { type: 'customers'|'sales'|'orders', records: [...] }",
        400
      );
      await logApiRequest(apiKeyId, path, method, 400, clientIp, userAgent, Date.now() - startTime);
      return resp;
    }

    if (!["customers", "sales", "orders"].includes(type)) {
      const resp = errorResponse(
        "Tipo inválido. Use: customers, sales ou orders",
        400
      );
      await logApiRequest(apiKeyId, path, method, 400, clientIp, userAgent, Date.now() - startTime);
      return resp;
    }

    // Limit batch size per request
    const MAX_RECORDS = 500;
    if (records.length > MAX_RECORDS) {
      const resp = errorResponse(
        `Máximo de ${MAX_RECORDS} registros por requisição. Envie em lotes.`,
        400
      );
      await logApiRequest(apiKeyId, path, method, 400, clientIp, userAgent, Date.now() - startTime);
      return resp;
    }

    let inserted = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 50;

    if (type === "customers") {
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE).map((r: any) => ({
          name: r.name || r.nome || "Sem nome",
          email: r.email || null,
          phone: r.phone || r.telefone || null,
          document: r.document || r.cpf || r.cnpj || r.documento || null,
          customer_type: r.customer_type || r.tipo || "fisica",
          address: r.address || r.endereco || null,
          city: r.city || r.cidade || null,
          state: r.state || r.estado || null,
          zip_code: r.zip_code || r.cep || null,
          neighborhood: r.neighborhood || r.bairro || null,
          notes: r.notes || r.observacoes || null,
          is_active: true,
        }));

        const { data, error } = await supabase
          .from("customers")
          .insert(batch)
          .select("id");
        if (error) {
          errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          inserted += data?.length || 0;
        }
      }
    }

    if (type === "sales") {
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE).map((r: any) => ({
          local_id: r.local_id || crypto.randomUUID(),
          user_id: r.user_id || "00000000-0000-0000-0000-000000000000",
          store_id: r.store_id || null,
          customer_name: r.customer_name || r.cliente || null,
          customer_document: r.customer_document || r.cpf_cliente || null,
          items: r.items || r.itens || [],
          subtotal: parseFloat(r.subtotal || r.valor || "0") || 0,
          total: parseFloat(r.total || r.valor_total || r.subtotal || r.valor || "0") || 0,
          discount_amount: parseFloat(r.discount_amount || r.desconto || "0") || 0,
          payment_method: r.payment_method || r.forma_pagamento || "dinheiro",
          sale_type: r.sale_type || r.tipo_venda || "varejo",
          status: r.status || "completed",
          notes: r.notes || r.observacoes || null,
          created_at: r.created_at || r.data || new Date().toISOString(),
        }));

        const { data, error } = await supabase
          .from("pos_sales")
          .insert(batch)
          .select("id");
        if (error) {
          errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          inserted += data?.length || 0;
        }
      }
    }

    if (type === "orders") {
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE).map((r: any) => ({
          customer_email: r.customer_email || r.email || "importado@api.com",
          customer_name: r.customer_name || r.cliente || null,
          items: r.items || r.itens || [],
          total: parseFloat(r.total || r.valor_total || "0") || 0,
          status: r.status || "delivered",
          payment_method: r.payment_method || r.forma_pagamento || null,
          payment_status: r.payment_status || r.status_pagamento || "paid",
          notes: r.notes || r.observacoes || null,
          created_at: r.created_at || r.data || new Date().toISOString(),
          shipping_address: r.shipping_address || r.endereco_entrega || null,
          external_id: r.external_id || r.id_externo || null,
        }));

        const { data, error } = await supabase
          .from("orders")
          .insert(batch)
          .select("id");
        if (error) {
          errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          inserted += data?.length || 0;
        }
      }
    }

    const status = errors.length > 0 ? 207 : 200;
    await logApiRequest(
      apiKeyId,
      path,
      method,
      status,
      clientIp,
      userAgent,
      Date.now() - startTime,
      JSON.stringify(body).length
    );

    return jsonResponse({
      success: true,
      type,
      inserted,
      total_sent: records.length,
      errors: errors.length > 0 ? errors : undefined,
    }, status);
  } catch (error) {
    console.error("API Import error:", error);
    await logApiRequest(apiKeyId, path, method, 500, clientIp, userAgent, Date.now() - startTime);
    return errorResponse(error.message || "Internal error", 500);
  }
});
