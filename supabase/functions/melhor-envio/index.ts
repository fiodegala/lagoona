import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ME_API_URL = "https://melhorenvio.com.br/api/v2";

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
      case "test": {
        const token = await getMelhorEnvioToken();
        console.log("Token length:", token.length, "starts:", token.substring(0, 30));
        const testUrl = `${ME_API_URL}/me/shipment/calculate`;
        console.log("Testing URL:", testUrl);
        try {
          const res = await fetch(testUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
              "User-Agent": "FDG contato@fiodegala.com.br",
            },
            body: JSON.stringify({
              from: { postal_code: "74550020" },
              to: { postal_code: "01310100" },
              products: [{ id: "1", width: 11, height: 2, length: 16, weight: 0.3, insurance_value: 0, quantity: 1 }],
            }),
          });
          const text = await res.text();
          console.log("Response status:", res.status);
          console.log("Response body (first 500):", text.substring(0, 500));
          return jsonResponse({ status: res.status, body: text.substring(0, 1000) });
        } catch (e) {
          console.error("Fetch error:", e);
          return jsonError(`Fetch error: ${e}`, 500);
        }
      }

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

        const url = `${ME_API_URL}/me/shipment/calculate`;
        console.log("Calling Melhor Envio:", url);
        console.log("Token starts with:", token.substring(0, 20));

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "FDG System contato@fiodegala.com.br",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Melhor Envio calculate error:", response.status, errorText);
          return jsonError(`Melhor Envio API error: ${response.status}`, 502);
        }

        const data = await response.json();

        // Filter only available services (no errors)
        const available = (Array.isArray(data) ? data : []).filter(
          (s: any) => !s.error && s.price
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

      case "generate": {
        // Generate shipping label
        const token = await getMelhorEnvioToken();
        const { order } = params;

        if (!order) {
          return jsonError("Missing order data", 400);
        }

        // Step 1: Add to cart
        const cartResponse = await fetch(`${ME_API_URL}/me/cart`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "FDG System (contato@fiodegala.com.br)",
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
            "User-Agent": "FDG System (contato@fiodegala.com.br)",
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
            "User-Agent": "FDG System (contato@fiodegala.com.br)",
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
            "User-Agent": "FDG System (contato@fiodegala.com.br)",
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
