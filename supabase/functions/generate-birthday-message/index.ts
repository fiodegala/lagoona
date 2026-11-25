import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai@3";
import { streamText } from "npm:ai@6";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "./run-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você escreve mensagens curtas, calorosas e elegantes de WhatsApp para clientes aniversariantes da loja de moda Fio de Gala (em português do Brasil).

Regras obrigatórias:
- Analise a imagem enviada e identifique exatamente qual produto/brinde aparece na foto, além de qualquer texto ou regra visível (como nome do produto, validade ou condição de retirada).
- Diga de forma clara e direta na mensagem que o cliente GANHOU esse produto específico mostrado na imagem de presente de aniversário da Fio de Gala (ex.: "você ganhou um Cinto Elástico de presente de aniversário"). Se a foto mostrar várias cores/opções do mesmo produto, fale no singular (ex.: "um Cinto Elástico para escolher sua cor favorita"), a menos que a imagem diga explicitamente que é um kit.
- Crie UMA mensagem pronta para o WhatsApp parabenizando o cliente, avisando que ele ganhou o produto da imagem e convidando para retirar o presente em qualquer uma de nossas lojas da Fio de Gala (NÃO restrinja a uma loja específica).
- Informe claramente o prazo de validade para retirada: dentro do mês do aniversário, usando o marcador {validade} (ex.: "Válido para retirada dentro do mês do seu aniversário, até {validade}.").
- Use exatamente os marcadores {nome} (para o primeiro nome do cliente) e {validade} (para o último dia do mês do aniversário), sem inventar outros marcadores.
- Seja breve e natural para WhatsApp (3 a 5 linhas curtas, emojis com moderação, sem asteriscos de markdown exagerados).
- Retorne SOMENTE o texto da mensagem, sem aspas, sem título e sem explicações.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem gerar a mensagem" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageUrl } = await req.json();
    if (
      typeof imageUrl !== "string" ||
      (!imageUrl.startsWith("https://") && !imageUrl.startsWith("data:image/"))
    ) {
      return new Response(JSON.stringify({ error: "Envie uma imagem válida do brinde" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Serviço de IA não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: LOVABLE_API_KEY,
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Olhe esta imagem do presente de aniversário da Fio de Gala e escreva a mensagem de WhatsApp parabenizando o cliente {nome}, dizendo claramente que ele ganhou o produto mostrado na imagem de presente, convidando para retirar em qualquer uma de nossas lojas e avisando que a retirada é válida dentro do mês do aniversário, até {validade}.",
            },
            {
              type: "image",
              image: imageUrl.startsWith("https://") ? new URL(imageUrl) : imageUrl,
            },
          ],
        },
      ],
      abortSignal: req.signal,
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    const message = (await result.text).trim();
    if (!message) {
      return new Response(JSON.stringify({ error: "A IA não retornou texto. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const runId = runIdFetch.getRunId();
    return new Response(JSON.stringify({ message }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        ...(runId ? { "X-Lovable-AIG-Run-ID": runId } : {}),
      },
    });
  } catch (e) {
    if (req.signal.aborted && e instanceof Error && e.name === "AbortError") {
      return new Response(null, { status: 499, headers: corsHeaders });
    }
    console.error("generate-birthday-message error:", e);
    const statusCode = (e as { statusCode?: number })?.statusCode;
    if (statusCode === 429) {
      return new Response(JSON.stringify({ error: "Muitas tentativas seguidas. Aguarde alguns segundos e tente novamente." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (statusCode === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados no momento." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao gerar mensagem" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});