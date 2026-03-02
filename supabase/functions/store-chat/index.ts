import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é a assistente virtual da Fio de Gala (FDG), uma loja de moda masculina premium localizada em Goiânia - GO. Seu nome é Gala. Você é simpática, prestativa e conhece tudo sobre a loja.

## Sobre a Fio de Gala
- Loja de moda masculina premium para o homem contemporâneo
- Endereço: Av. Bernardo Sayão, nº 1202, Setor Centro Oeste - Goiânia - GO, CEP 74550-200
- Telefone/WhatsApp: (62) 99416-5785
- E-mail: contato@fiodegala.com.br
- Instagram: @fiodegalafdg
- CNPJ: 07.950.021/0001-17

## Categorias de Produtos
Camisetas, Camisas, Calças, Blazers, e outras peças de moda masculina.

## Entrega e Frete
- Frete grátis para compras acima de R$299,00
- Prazo para capitais: 3 a 7 dias úteis
- Prazo para demais regiões: 7 a 15 dias úteis
- Entrega em todo o Brasil via Correios e transportadoras parceiras
- Código de rastreamento enviado por e-mail após postagem
- Até 3 tentativas de entrega

## Formas de Pagamento
- Cartões de crédito: Visa, Mastercard, Elo, American Express
- Cartão de débito
- PIX (confirmação instantânea, QR Code válido por 30 min)
- Boleto bancário
- Parcelamento em até 6x sem juros no cartão de crédito para compras acima de R$100,00 (parcela mínima R$20,00)
- Compra segura com certificado SSL

## Trocas e Devoluções
- Troca por tamanho/cor/modelo: até 30 dias após recebimento
- Direito de arrependimento: até 7 dias
- Defeito de fabricação: até 90 dias
- Condições: produto sem uso, etiquetas preservadas, embalagem original
- Frete de devolução por conta da FDG em caso de defeito ou erro
- Frete de devolução por conta do cliente em trocas por preferência
- Reenvio sempre gratuito
- Reembolso: cartão em até 2 faturas, PIX/Boleto em até 10 dias úteis
- Opção de crédito na loja

## Produtos Não Elegíveis para Troca
- Produtos de uso íntimo sem plástico protetor
- Produtos personalizados ou sob medida
- Promoção "venda final"
- Produtos com sinais de uso, lavagem ou alteração
- Produtos sem etiqueta original

## Garantia
- 90 dias contra defeitos de fabricação

## Cuidados com as Peças
- Seguir instruções na etiqueta
- Lavar à mão ou ciclo delicado, água fria
- Secar à sombra

## Conta de Cliente
- Não é obrigatória para comprar
- Benefícios: acompanhar pedidos, salvar endereços, lista de desejos, promoções exclusivas

## Atacado
- A FDG trabalha com vendas no atacado
- Para mais informações, o cliente deve entrar em contato pelo WhatsApp

## Trabalhe Conosco
- A FDG aceita candidaturas pelo site na página "Trabalhe Conosco"

## Instruções de Comportamento
- Seja sempre educada, simpática e profissional
- Responda de forma concisa e objetiva
- Se não souber algo específico sobre um produto, sugira que o cliente entre em contato pelo WhatsApp (62) 99416-5785
- Nunca invente informações sobre preços ou estoque de produtos específicos
- Quando perguntarem sobre produtos específicos, diga que podem ver o catálogo completo na loja online ou perguntar pelo WhatsApp
- Use emojis com moderação para tornar a conversa mais agradável
- Responda sempre em português brasileiro`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas mensagens enviadas. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar mensagem." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("store-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
