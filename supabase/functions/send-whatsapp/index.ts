import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STATUS_MESSAGES: Record<string, (name: string) => string> = {
  confirmed: (name) =>
    `Olá ${name}! ✅\n\nSeu pedido foi *confirmado* com sucesso!\n\nEstamos preparando tudo para você. 😊`,
  processing: (name) =>
    `Olá ${name}! 📦\n\nSeu pedido está sendo *preparado*!\n\nEm breve ele será enviado. Fique de olho! 🚀`,
  shipped: (name) =>
    `Olá ${name}! 🚚\n\nSeu pedido foi *enviado*!\n\nVocê receberá o código de rastreio em breve. 😊`,
  delivered: (name) =>
    `Olá ${name}! 🎉\n\nSeu pedido foi *entregue*!\n\nEsperamos que você aproveite! Se precisar de algo, estamos à disposição. 💛`,
  cancelled: (name) =>
    `Olá ${name}.\n\nInformamos que seu pedido foi *cancelado*.\n\nSe tiver dúvidas, entre em contato conosco. 🙏`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { phone, customerName, trackingCode, trackingUrl, carrier, messageType, orderId } = body;

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "phone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN");
    const clientToken = Deno.env.get("ZAPI_TOKEN");

    if (!instanceId || !instanceToken || !clientToken) {
      return new Response(
        JSON.stringify({ error: "Z-API não configurada (faltam credenciais)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const name = customerName || "Cliente";

    let message: string;
    let logMessageType = messageType || "tracking";

    if (messageType && STATUS_MESSAGES[messageType]) {
      message = STATUS_MESSAGES[messageType](name);
    } else if (trackingCode) {
      const carrierName = carrier || "transportadora";
      message = `Olá ${name}! 🎉\n\nSeu pedido foi enviado!\n\n📦 *Transportadora:* ${carrierName}\n🔍 *Código de rastreio:* ${trackingCode}`;
      if (trackingUrl) {
        message += `\n\n🔗 Acompanhe aqui: ${trackingUrl}`;
      }
      message += `\n\nQualquer dúvida, estamos à disposição! 😊`;
      logMessageType = "tracking";
    } else {
      return new Response(
        JSON.stringify({ error: "messageType ou trackingCode são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Log the WhatsApp message attempt
    if (orderId) {
      try {
        await supabase.from("whatsapp_logs").insert({
          order_id: orderId,
          phone: formattedPhone,
          customer_name: name,
          message_type: logMessageType,
          status: zapiResponse.ok ? "sent" : "failed",
          zapi_message_id: zapiData?.messageId || null,
          error_message: zapiResponse.ok ? null : JSON.stringify(zapiData),
        });
      } catch (logErr) {
        console.error("Failed to log WhatsApp message:", logErr);
      }
    }

    if (!zapiResponse.ok) {
      console.error("Z-API error:", zapiData);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar WhatsApp", details: zapiData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, zapiResponse: zapiData }),
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
