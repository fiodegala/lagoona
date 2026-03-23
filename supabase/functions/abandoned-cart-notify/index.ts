import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RecoveryCouponConfig {
  enabled: boolean;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  expiration_hours: number;
  prefix: string;
}

const DEFAULT_COUPON_CONFIG: RecoveryCouponConfig = {
  enabled: true,
  discount_type: "percentage",
  discount_value: 10,
  expiration_hours: 48,
  prefix: "VOLTA",
};

function generateCouponCode(prefix: string, discountValue: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}${discountValue}-${suffix}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN");
    const clientToken = Deno.env.get("ZAPI_TOKEN");

    if (!instanceId || !instanceToken || !clientToken) {
      console.error("Z-API credentials not configured");
      return new Response(
        JSON.stringify({ error: "Z-API não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find abandoned carts older than 2 minutes that haven't been notified and have a phone
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { data: carts, error: fetchError } = await supabase
      .from("abandoned_carts")
      .select("id, customer_name, customer_email, customer_phone, items, subtotal, item_count")
      .eq("status", "abandoned")
      .is("notified_at", null)
      .not("customer_phone", "is", null)
      .neq("customer_phone", "")
      .lt("updated_at", twoMinutesAgo);

    if (fetchError) {
      console.error("Error fetching abandoned carts:", fetchError);
      throw fetchError;
    }

    if (!carts || carts.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum carrinho para notificar", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`;
    let sentCount = 0;

    // Load custom template if exists
    let messageTemplate = "Olá {nome}! 👋\n\nNotamos que você deixou alguns itens no carrinho da *Fio de Gala*! 🛒\n\n{produtos}\n💰 *Total: {total}*\n\n🎁 Use o cupom *{cupom}* e ganhe *10% de desconto* para finalizar sua compra!\n\n👉 Acesse: https://fiodegalafdg.lovable.app/loja\n\nPrecisa de ajuda? Responda essa mensagem! 💬";
    
    try {
      const { data: configData } = await supabase
        .from("store_config")
        .select("value")
        .eq("key", "whatsapp_templates")
        .maybeSingle();
      if (configData?.value && typeof configData.value === "object") {
        const templates = configData.value as Record<string, string>;
        if (templates["abandoned_cart"]) {
          messageTemplate = templates["abandoned_cart"];
        }
      }
    } catch (e) {
      console.error("Failed to load custom template:", e);
    }

    // Coupon creation disabled — all coupons are now created manually

    for (const cart of carts) {
      try {
        const cleanPhone = cart.customer_phone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        const name = cart.customer_name || "Cliente";

        // Build product list
        let produtos = "";
        if (Array.isArray(cart.items)) {
          produtos = cart.items
            .map((item: any) => `• ${item.name}${item.variationLabel ? ` (${item.variationLabel})` : ""} x${item.quantity}`)
            .join("\n");
        }

        const total = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(cart.subtotal || 0);

        // Auto-generate a unique recovery coupon (if enabled)
        let couponCode = "";
        if (couponConfig.enabled) {
          couponCode = generateCouponCode(couponConfig.prefix, couponConfig.discount_value);

          const expiresAt = new Date(Date.now() + couponConfig.expiration_hours * 60 * 60 * 1000).toISOString();
          await supabase.from("coupons").insert({
            code: couponCode,
            description: `Cupom de recuperação - Carrinho abandonado (${name})`,
            discount_type: couponConfig.discount_type,
            discount_value: couponConfig.discount_value,
            max_uses: 1,
            max_uses_per_customer: 1,
            is_active: true,
            expires_at: expiresAt,
          });
        }

        const message = messageTemplate
          .replaceAll("{nome}", name)
          .replaceAll("{produtos}", produtos)
          .replaceAll("{total}", total)
          .replaceAll("{email}", cart.customer_email || "")
          .replaceAll("{cupom}", couponCode);

        const zapiResponse = await fetch(zapiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": clientToken,
          },
          body: JSON.stringify({ phone: formattedPhone, message }),
        });

        const zapiData = await zapiResponse.json();

        // Log the message
        await supabase.from("whatsapp_logs").insert({
          phone: formattedPhone,
          customer_name: name,
          message_type: "abandoned_cart",
          status: zapiResponse.ok ? "sent" : "failed",
          zapi_message_id: zapiData?.messageId || null,
          error_message: zapiResponse.ok ? null : JSON.stringify(zapiData),
        });

        // Mark as notified and store the coupon code
        if (zapiResponse.ok) {
          await supabase
            .from("abandoned_carts")
            .update({
              notified_at: new Date().toISOString(),
              recovery_coupon_code: couponCode || null,
            })
            .eq("id", cart.id);
          sentCount++;
        }

        console.log(`Notification ${zapiResponse.ok ? "sent" : "failed"} for cart ${cart.id} (${formattedPhone}) with coupon ${couponCode}`);
      } catch (cartErr) {
        console.error(`Error processing cart ${cart.id}:`, cartErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified: sentCount, total: carts.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
