import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um consultor especialista em gestão operacional e resolução de demandas internas. Analise a Ordem de Serviço fornecida e responda de forma estruturada:

## Formato de Resposta

### 📋 Diagnóstico
Resuma o problema/demanda de forma clara e objetiva.

### 💡 Soluções Recomendadas
Liste de 2 a 4 soluções práticas, ordenadas da mais recomendada para a menos. Para cada solução:
- Descrição da ação
- Estimativa de esforço (baixo/médio/alto)
- Impacto esperado

### ⚡ Próximos Passos
Liste os passos imediatos que o responsável deve tomar, em ordem de prioridade.

### ⚠️ Riscos e Atenções
Aponte possíveis riscos ou pontos de atenção caso a demanda não seja resolvida.

### 🎯 Prioridade Sugerida
Com base na análise, sugira se a prioridade atual está adequada ou deve ser ajustada, e por quê.

## Regras
- Seja prático e direto, com linguagem profissional
- Considere o departamento para contextualizar as soluções
- Use emojis com moderação para clareza visual
- Respostas em português do Brasil`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, department, priority, status, comments } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Analise esta Ordem de Serviço:

**Título:** ${title}
**Departamento:** ${department}
**Prioridade atual:** ${priority}
**Status:** ${status}
**Descrição:** ${description}
${comments && comments.length > 0 ? `\n**Comentários anteriores:**\n${comments.map((c: any) => `- ${c.user_name}: ${c.comment}`).join('\n')}` : ''}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos nas configurações." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao consultar IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-service-order error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
