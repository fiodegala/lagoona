import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ME_API_URL = "https://melhorenvio.com.br/api/v2";

function normalizeDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function splitDocument(value?: string | null) {
  const digits = normalizeDigits(value);

  return {
    document: digits.length === 11 ? digits : "",
    company_document: digits.length === 14 ? digits : "",
  };
}

function sanitizeComplement(value?: string | null) {
  return (value || "").trim().slice(0, 64);
}

async function getMelhorEnvioToken(): Promise<string> {
  const token = Deno.env.get("MELHOR_ENVIO_ACCESS_TOKEN");
  if (!token) {
    throw new Error("MELHOR_ENVIO_ACCESS_TOKEN not configured");
  }
  return token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    switch (action) {
      case "calculate": {
        const { from_zip, to_zip, weight, height, width, length, insurance_value } = params;

        if (!from_zip || !to_zip || !weight) {
          return jsonError("Missing required fields: from_zip, to_zip, weight", 400);
        }

        const token = await getMelhorEnvioToken();

        const body = {
          from: { postal_code: from_zip.replace(/\D/g, "") },
          to: { postal_code: to_zip.replace(/\D/g, "") },
          products: [
            {
              id: "1",
              width: width || 11,
              height: height || 2,
              length: length || 16,
              weight: weight || 0.3,
              insurance_value: insurance_value || 0,
              quantity: 1,
            },
          ],
        };

        const response = await fetch(`${ME_API_URL}/me/shipment/calculate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "FDG contato@fiodegala.com.br",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Melhor Envio calculate error:", response.status, errorText);
          return jsonError(`Melhor Envio API error: ${response.status}`, 502);
        }

        const data = await response.json();

        // Filter only available services (no errors) and exclude LATAM Cargo (requires special unit config)
        const excludedServices = [12]; // LATAM Cargo
        const available = (Array.isArray(data) ? data : []).filter(
          (s: any) => !s.error && s.price && !excludedServices.includes(s.id)
        ).map((s: any) => ({
          id: s.id,
          name: s.name,
          price: parseFloat(s.price),
          discount: parseFloat(s.discount || "0"),
          delivery_time: s.delivery_time,
          delivery_range: s.delivery_range,
          company: {
            id: s.company?.id,
            name: s.company?.name,
            picture: s.company?.picture,
          },
        }));

        return jsonResponse({ services: available });
      }

      case "generate_label": {
        const token = await getMelhorEnvioToken();
        const { service_id, order_data } = params;

        if (!service_id || !order_data) {
          return jsonError("Missing service_id or order_data", 400);
        }

        const { from, to, products, insurance_value } = order_data;
        const pkg = order_data.package || { weight: 0.3, width: 11, height: 2, length: 16 };
        const fromDocuments = splitDocument(from.document);
        const toDocuments = splitDocument(to.document);

        // Step 1: Add to cart
        const cartBody = {
          service: service_id,
          from: {
            name: from.name,
            phone: from.phone,
            email: from.email,
            document: fromDocuments.document,
            company_document: fromDocuments.company_document,
            state_register: from.state_register || "",
            address: from.address,
            number: from.number,
            complement: sanitizeComplement(from.complement),
            district: from.neighborhood,
            city: from.city,
            state_abbr: from.state_abbr,
            postal_code: from.postal_code,
          },
          to: {
            name: to.name,
            phone: to.phone,
            email: to.email,
            document: toDocuments.document,
            company_document: toDocuments.company_document,
            state_register: to.state_register || "",
            address: to.address,
            number: to.number,
            complement: sanitizeComplement(to.complement),
            district: to.neighborhood,
            city: to.city,
            state_abbr: to.state_abbr,
            postal_code: to.postal_code,
          },
          products: products || [{ name: "Pedido", quantity: 1, unitary_value: insurance_value || 0 }],
          volumes: [{
            weight: pkg.weight,
            width: pkg.width,
            height: pkg.height,
            length: pkg.length,
          }],
          options: {
            insurance_value: insurance_value || 0,
            receipt: false,
            own_hand: false,
          },
        };

        console.log("Adding to cart:", JSON.stringify(cartBody));

        const cartResponse = await fetch(`${ME_API_URL}/me/cart`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "FDG contato@fiodegala.com.br",
          },
          body: JSON.stringify(cartBody),
        });

        const cartData = await cartResponse.json();
        console.log("Cart response:", JSON.stringify(cartData));

        if (!cartResponse.ok || cartData?.error) {
          const errorMsg = cartData?.error || cartData?.message || 
            (cartData?.errors ? JSON.stringify(cartData.errors) : "Failed to add to cart");
          console.error("Cart error details:", errorMsg);
          return jsonError(errorMsg, 502);
        }

        const orderId = cartData.id;
        if (!orderId) {
          return jsonError("No order ID returned from cart", 502);
        }

        // Step 2: Checkout (pay for label)
        const checkoutResponse = await fetch(`${ME_API_URL}/me/shipment/checkout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "FDG contato@fiodegala.com.br",
          },
          body: JSON.stringify({ orders: [orderId] }),
        });

        const checkoutData = await checkoutResponse.json();
        console.log("Checkout response:", JSON.stringify(checkoutData));

        if (!checkoutResponse.ok) {
          return jsonError(`Checkout failed: ${JSON.stringify(checkoutData)}`, 502);
        }

        // Step 3: Generate label
        const generateResponse = await fetch(`${ME_API_URL}/me/shipment/generate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "FDG contato@fiodegala.com.br",
          },
          body: JSON.stringify({ orders: [orderId] }),
        });

        const generateData = await generateResponse.json();
        console.log("Generate response:", JSON.stringify(generateData));

        // Step 4: Get print URL
        const printResponse = await fetch(`${ME_API_URL}/me/shipment/print`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "FDG contato@fiodegala.com.br",
          },
          body: JSON.stringify({ orders: [orderId], mode: "public" }),
        });

        const printData = await printResponse.json();
        console.log("Print response:", JSON.stringify(printData));

        const labelUrl = printData?.url || null;

        return jsonResponse({
          order_id: orderId,
          label_url: labelUrl,
          checkout: checkoutData,
          print: printData,
        });
      }

      case "generate": {
        // Legacy: simple cart add
        const token = await getMelhorEnvioToken();
        const { order } = params;

        if (!order) {
          return jsonError("Missing order data", 400);
        }

        const cartResponse = await fetch(`${ME_API_URL}/me/cart`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "FDG contato@fiodegala.com.br",
          },
          body: JSON.stringify(order),
        });

        if (!cartResponse.ok) {
          const errorText = await cartResponse.text();
          console.error("Cart error:", errorText);
          return jsonError("Failed to add to cart", 502);
        }

        const cartData = await cartResponse.json();
        return jsonResponse({ cart: cartData });
      }

      case "checkout": {
        const token = await getMelhorEnvioToken();
        const { orders } = params;

        const checkoutResponse = await fetch(`${ME_API_URL}/me/shipment/checkout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "FDG contato@fiodegala.com.br",
          },
          body: JSON.stringify({ orders }),
        });

        if (!checkoutResponse.ok) {
          const errorText = await checkoutResponse.text();
          console.error("Checkout error:", errorText);
          return jsonError("Failed to checkout", 502);
        }

        const checkoutData = await checkoutResponse.json();
        return jsonResponse({ checkout: checkoutData });
      }

      case "print": {
        const token = await getMelhorEnvioToken();
        const { orders } = params;

        const printResponse = await fetch(`${ME_API_URL}/me/shipment/print`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "FDG contato@fiodegala.com.br",
          },
          body: JSON.stringify({ orders, mode: "public" }),
        });

        if (!printResponse.ok) {
          const errorText = await printResponse.text();
          console.error("Print error:", errorText);
          return jsonError("Failed to generate print URL", 502);
        }

        const printData = await printResponse.json();
        return jsonResponse({ print: printData });
      }

      case "tracking": {
        const token = await getMelhorEnvioToken();
        const { orders } = params;

        const trackingResponse = await fetch(`${ME_API_URL}/me/shipment/tracking`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "FDG contato@fiodegala.com.br",
          },
          body: JSON.stringify({ orders }),
        });

        if (!trackingResponse.ok) {
          const errorText = await trackingResponse.text();
          console.error("Tracking error:", errorText);
          return jsonError("Failed to get tracking", 502);
        }

        const trackingData = await trackingResponse.json();
        return jsonResponse({ tracking: trackingData });
      }

      default:
        return jsonError("Invalid action. Use: calculate, generate, checkout, print, tracking", 400);
    }
  } catch (error) {
    console.error("Melhor Envio function error:", error);
    return jsonError(error instanceof Error ? error.message : "Internal error", 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
