import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const STORE_URL = Deno.env.get("STORE_URL") || "https://fiodegalafdg.lovable.app";

// In-memory rate limiting per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests/minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);

const BASE_SYSTEM_PROMPT = `Você é a assistente virtual da Fio de Gala (FDG), uma loja de moda masculina premium localizada em Goiânia - GO. Seu nome é Clara. Você é simpática, prestativa e conhece tudo sobre a loja.

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
- Entrega por motoboy: disponível APENAS para Goiânia - GO e região metropolitana/entorno. Para outras cidades, a entrega é feita pelos Correios ou transportadoras.

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

## Instruções de Comportamento para Produtos
- Quando o cliente perguntar sobre um produto específico (ex: "tem camiseta?", "vocês vendem calça?", "quero ver blazers"), SEMPRE busque no catálogo abaixo os produtos que correspondem.
- Se encontrar produtos correspondentes, apresente-os com nome, preço e o LINK DIRETO para a página do produto. Formate assim:
  👉 **[Nome do Produto]** - R$ XX,XX
  🔗 [Ver produto](LINK)
- Se o produto tiver preço promocional, mostre ambos: ~~R$ preço original~~ por **R$ preço promocional**
- Se NÃO encontrar o produto exato, sugira produtos semelhantes do catálogo (mesma categoria ou tipo parecido)
- Se não houver nenhum produto semelhante, diga educadamente que não temos no momento e ofereça a opção de falar com um atendente pelo WhatsApp: "Você pode falar diretamente com nossa equipe pelo WhatsApp: https://wa.me/5562994165785"
- Nunca invente produtos que não estão no catálogo abaixo

## Instruções Gerais
- Seja sempre educada, simpática e profissional
- Responda de forma concisa e objetiva
- Use emojis com moderação para tornar a conversa mais agradável
- Responda sempre em português brasileiro
- Se após 2-3 trocas de mensagem o cliente ainda parecer com dúvida ou insatisfeito, ou se a dúvida for complexa demais, ofereça proativamente o contato humano pelo WhatsApp
- Para dúvidas que não conseguir resolver, SEMPRE sugira contato pelo WhatsApp com esta frase exata: "Se preferir, fale diretamente com nossa equipe pelo WhatsApp: [Clique aqui para falar no WhatsApp](https://wa.me/5562994165785?text=Ol%C3%A1!%20Vim%20pelo%20chat%20da%20Clara%20e%20preciso%20de%20ajuda.) 📱"
- Ao final de respostas sobre trocas, devoluções, problemas com pedido ou qualquer assunto que possa precisar de atendimento humano, adicione a sugestão de WhatsApp`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ error: "Muitas mensagens enviadas. Tente novamente em alguns segundos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { messages } = body;

    // Validate messages array
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid messages format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit conversation length to prevent abuse
    const MAX_MESSAGES = 30;
    const MAX_MESSAGE_LENGTH = 500;
    const MAX_TOTAL_LENGTH = 10_000;

    if (messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: "Conversa muito longa. Por favor, inicie uma nova conversa." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate each message structure and content
    let totalLength = 0;
    for (const msg of messages) {
      if (!msg || typeof msg !== 'object') {
        return new Response(JSON.stringify({ error: "Formato de mensagem inválido." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        return new Response(JSON.stringify({ error: "Role de mensagem inválido." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof msg.content !== 'string' || msg.content.length === 0) {
        return new Response(JSON.stringify({ error: "Conteúdo de mensagem inválido." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (msg.role === 'user' && msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(JSON.stringify({ error: `Mensagem muito longa. Limite de ${MAX_MESSAGE_LENGTH} caracteres.` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      totalLength += msg.content.length;
    }

    if (totalLength > MAX_TOTAL_LENGTH) {
      return new Response(JSON.stringify({ error: "Conversa muito longa. Por favor, inicie uma nova conversa." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize: only pass role and content, strip any extra fields
    const sanitizedMessages = messages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content.slice(0, m.role === 'user' ? MAX_MESSAGE_LENGTH : 2000),
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch products from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: products } = await supabase
      .from("products")
      .select("id, name, price, promotional_price, category_id, is_active, description")
      .eq("is_active", true)
      .order("name");

    const { data: categories } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true);

    const { data: stockData } = await supabase
      .from("store_stock")
      .select("product_id, quantity");

    const stockMap = new Map<string, number>();
    if (stockData) {
      for (const s of stockData) {
        stockMap.set(s.product_id, (stockMap.get(s.product_id) || 0) + s.quantity);
      }
    }

    const categoryMap = new Map((categories || []).map(c => [c.id, c.name]));

    let catalogText = "\n\n## Catálogo de Produtos Disponíveis\n";
    if (products && products.length > 0) {
      for (const p of products) {
        const realStock = stockMap.get(p.id) || 0;
        if (realStock <= 0) continue;
        const cat = p.category_id ? categoryMap.get(p.category_id) || "Sem categoria" : "Sem categoria";
        const priceStr = p.promotional_price
          ? `~~R$ ${p.price.toFixed(2)}~~ por R$ ${p.promotional_price.toFixed(2)}`
          : `R$ ${p.price.toFixed(2)}`;
        const link = `${STORE_URL}/produto/${p.id}`;
        catalogText += `- **${p.name}** | Categoria: ${cat} | ${priceStr} | Link: ${link}\n`;
      }
    } else {
      catalogText += "Nenhum produto disponível no momento.\n";
    }

    const fullSystemPrompt = BASE_SYSTEM_PROMPT + catalogText;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...sanitizedMessages,
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
