import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { product_id, variation_id, new_quantity, override_phone } = body;

    if (!product_id) {
      return new Response(
        JSON.stringify({ error: "product_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get product info
    const { data: product, error: productErr } = await supabase
      .from("products")
      .select("id, name, min_stock, barcode")
      .eq("id", product_id)
      .single();

    if (productErr || !product) {
      console.error("Product not found:", productErr);
      return new Response(
        JSON.stringify({ skipped: true, reason: "product not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate total stock across all stores for this product+variation
    let stockQuery = supabase
      .from("store_stock")
      .select("quantity")
      .eq("product_id", product_id);

    if (variation_id) {
      stockQuery = stockQuery.eq("variation_id", variation_id);
    } else {
      stockQuery = stockQuery.is("variation_id", null);
    }

    const { data: stockRows } = await stockQuery;
    const totalStock = (stockRows || []).reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);

    const minStock = product.min_stock || 0;

    // Only alert if stock is below minimum
    if (totalStock >= minStock) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "stock above minimum" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get variation label if applicable
    let variationLabel = "";
    if (variation_id) {
      const { data: varValues } = await supabase
        .from("product_variation_values")
        .select("attribute_value_id")
        .eq("variation_id", variation_id);

      if (varValues && varValues.length > 0) {
        const attrValueIds = varValues.map((v: any) => v.attribute_value_id);
        const { data: attrValues } = await supabase
          .from("product_attribute_values")
          .select("value")
          .in("id", attrValueIds);

        if (attrValues) {
          variationLabel = attrValues.map((av: any) => av.value).join(" / ");
        }
      }
    }

    // Get admin phone for low stock alerts from store_config
    const { data: configData } = await supabase
      .from("store_config")
      .select("value")
      .eq("key", "low_stock_alert_phone")
      .maybeSingle();

    const alertPhone = override_phone || (configData?.value as any)?.phone;

    if (!alertPhone) {
      console.log("No alert phone configured, skipping notification");
      return new Response(
        JSON.stringify({ skipped: true, reason: "no alert phone configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if we already sent an alert for this product recently (last 6 hours) to avoid spam
    const { data: recentLog } = await supabase
      .from("whatsapp_logs")
      .select("id")
      .eq("message_type", "low_stock_alert")
      .gte("created_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .ilike("customer_name", `%${product.name}%`)
      .limit(1);

    if (recentLog && recentLog.length > 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "alert already sent recently" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send WhatsApp alert
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN");
    const clientToken = Deno.env.get("ZAPI_TOKEN");

    if (!instanceId || !instanceToken || !clientToken) {
      console.error("Z-API not configured");
      return new Response(
        JSON.stringify({ skipped: true, reason: "Z-API not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = alertPhone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    const productDesc = variationLabel
      ? `${product.name} (${variationLabel})`
      : product.name;

    // Fetch detailed stock per variation per store for this product
    let detailedStockText = "";
    try {
      // Get all variations for this product
      const { data: allVariations } = await supabase
        .from("product_variations")
        .select("id")
        .eq("product_id", product_id);

      const variationIds = (allVariations || []).map((v: any) => v.id);
      
      // Get all stock rows for this product (all variations + base)
      const { data: allStockRows } = await supabase
        .from("store_stock")
        .select("quantity, variation_id, store_id")
        .eq("product_id", product_id);

      // Get store names
      const storeIds = [...new Set((allStockRows || []).map((r: any) => r.store_id))];
      const storeNameMap: Record<string, string> = {};
      if (storeIds.length > 0) {
        const { data: stores } = await supabase
          .from("stores")
          .select("id, name")
          .in("id", storeIds);
        for (const s of (stores || [])) {
          storeNameMap[s.id] = s.name;
        }
      }

      // Get variation labels for all variations
      const varLabelMap: Record<string, string> = {};
      if (variationIds.length > 0) {
        for (const vid of variationIds) {
          const { data: vvData } = await supabase
            .from("product_variation_values")
            .select("attribute_value_id")
            .eq("variation_id", vid);
          if (vvData && vvData.length > 0) {
            const avIds = vvData.map((v: any) => v.attribute_value_id);
            const { data: avData } = await supabase
              .from("product_attribute_values")
              .select("value")
              .in("id", avIds);
            if (avData) {
              varLabelMap[vid] = avData.map((a: any) => a.value).join(" / ");
            }
          }
        }
      }

      // Group stock by variation
      const stockByVariation: Record<string, { label: string; stores: { name: string; qty: number }[]; total: number }> = {};

      for (const row of (allStockRows || [])) {
        const vId = row.variation_id || "_base_";
        if (!stockByVariation[vId]) {
          const label = vId === "_base_" ? "Sem variação" : (varLabelMap[vId] || vId);
          stockByVariation[vId] = { label, stores: [], total: 0 };
        }
        const storeName = storeNameMap[row.store_id] || "Loja";
        const qty = row.quantity || 0;
        stockByVariation[vId].stores.push({ name: storeName, qty });
        stockByVariation[vId].total += qty;
      }

      // Build detailed text
      const lines: string[] = [];
      for (const [, info] of Object.entries(stockByVariation)) {
        const storeDetails = info.stores
          .filter((s) => s.qty > 0 || info.stores.length <= 5)
          .map((s) => `   • ${s.name}: ${s.qty} un.`)
          .join("\n");
        lines.push(`▸ *${info.label}* — Total: *${info.total} un.*\n${storeDetails}`);
      }

      if (lines.length > 0) {
        detailedStockText = `\n\n📋 *Detalhamento por variação:*\n\n${lines.join("\n\n")}`;
      }
    } catch (detailErr) {
      console.error("Error fetching detailed stock:", detailErr);
    }

    const message = `⚠️ *Alerta de Estoque Baixo*\n\n` +
      `O produto *${productDesc}* está com estoque abaixo do mínimo configurado.\n\n` +
      `📦 Estoque atual: *${totalStock} un.*\n` +
      `📉 Mínimo configurado: *${minStock} un.*${detailedStockText}\n\n` +
      `Verifique a necessidade de reposição! 🔄`;

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`;

    const zapiResponse = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify({ phone: formattedPhone, message }),
    });

    const zapiData = await zapiResponse.json();

    // Log the alert
    try {
      await supabase.from("whatsapp_logs").insert({
        phone: formattedPhone,
        customer_name: productDesc,
        message_type: "low_stock_alert",
        status: zapiResponse.ok ? "sent" : "failed",
        zapi_message_id: zapiData?.messageId || null,
        error_message: zapiResponse.ok ? null : JSON.stringify(zapiData),
      });
    } catch (logErr) {
      console.error("Failed to log alert:", logErr);
    }

    return new Response(
      JSON.stringify({ success: true, product: productDesc, totalStock, minStock }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
