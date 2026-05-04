// Debug endpoint: reconstrói o payload de assinatura e retorna detalhes
// para comparar com o que o cliente está calculando.
// NÃO valida nonce nem timestamp aqui — é só pra debug de HMAC.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-key, x-timestamp, x-nonce, x-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const keyData = new TextEncoder().encode(key);
  const messageData = new TextEncoder().encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const method = req.method;
    const pathname = url.pathname;
    const search = url.search;
    const fullPath = pathname + search;

    const clientKey = req.headers.get("x-client-key");
    const timestamp = req.headers.get("x-timestamp");
    const nonce = req.headers.get("x-nonce");
    const clientSignature = req.headers.get("x-signature");

    let bodyString = "";
    if (method !== "GET" && method !== "HEAD") {
      try {
        bodyString = await req.text();
      } catch {
        bodyString = "";
      }
    }
    const bodyHash = await sha256(bodyString || "");

    // Tentamos reconstruir várias variantes de payload pra mostrar qual bate
    const variants: Record<string, string> = {
      "pathname_only": `${method}\n${pathname}\n${timestamp}\n${nonce}\n${bodyHash}`,
      "pathname_with_query": `${method}\n${fullPath}\n${timestamp}\n${nonce}\n${bodyHash}`,
      "with_functions_v1_prefix": `${method}\n/functions/v1${pathname}\n${timestamp}\n${nonce}\n${bodyHash}`,
      "with_functions_v1_prefix_and_query": `${method}\n/functions/v1${fullPath}\n${timestamp}\n${nonce}\n${bodyHash}`,
    };

    const result: Record<string, unknown> = {
      received: {
        method,
        url: req.url,
        pathname,
        search,
        fullPath,
        clientKey,
        timestamp,
        nonce,
        clientSignature,
        bodyString,
        bodyHash,
      },
      server_canonical: {
        algorithm: "HMAC-SHA256",
        hmac_key_formula: "sha256(SECRET_API_KEY) hex string",
        payload_format: "METHOD\\nPATHNAME\\nTIMESTAMP\\nNONCE\\nSHA256(body)",
        empty_body_hash:
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        notes: [
          "PATHNAME = url.pathname (sem query string).",
          "PATHNAME NÃO inclui /functions/v1 (a função recebe a URL já roteada).",
          "ACCESS_TOKEN (at_) NÃO é usado em nenhum header.",
          "Headers obrigatórios: X-Client-Key, X-Timestamp, X-Nonce, X-Signature.",
        ],
      },
      variants_payload: variants,
    };

    if (clientKey) {
      const { data: apiKey, error } = await supabase
        .from("api_keys")
        .select("id, name, secret_key_hash, status, scopes")
        .eq("public_key", clientKey)
        .single();

      if (error || !apiKey) {
        result.api_key_lookup = { found: false, error: error?.message };
      } else {
        const expected: Record<string, string> = {};
        for (const [name, payload] of Object.entries(variants)) {
          expected[name] = await hmacSha256(apiKey.secret_key_hash, payload);
        }

        let matchedVariant: string | null = null;
        if (clientSignature) {
          for (const [name, sig] of Object.entries(expected)) {
            if (sig === clientSignature) {
              matchedVariant = name;
              break;
            }
          }
        }

        result.api_key_lookup = {
          found: true,
          name: apiKey.name,
          status: apiKey.status,
          scopes: apiKey.scopes,
        };
        result.expected_signatures = expected;
        result.canonical_expected_signature = expected["pathname_only"];
        result.match = matchedVariant
          ? { matched: true, variant: matchedVariant }
          : {
              matched: false,
              hint:
                "Nenhuma variante bateu. Verifique: (1) chave HMAC = sha256(SECRET) em hex, (2) body hash hex SHA256, (3) nonce/timestamp idênticos aos headers, (4) PATHNAME = url.pathname sem query.",
            };
      }
    }

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
