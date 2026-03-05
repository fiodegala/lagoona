import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é a assistente IA administrativa da Fio de Gala (FDG). Você ajuda gerentes e administradores com tarefas operacionais do sistema.

## Suas Capacidades
Você pode executar ações no sistema usando as ferramentas disponíveis. SEMPRE que o usuário pedir para fazer algo, use a ferramenta apropriada.

## Regras Importantes
1. Sempre confirme a ação antes de executar mudanças (criar, atualizar, deletar).
2. Para consultas (buscar estoque, pedidos, etc.), execute diretamente e mostre os resultados.
3. Formate valores monetários em R$ com 2 casas decimais.
4. Seja concisa e objetiva nas respostas.
5. Use tabelas markdown para exibir listas de dados.
6. Quando sugerir upsells, analise os dados de vendas e produtos relacionados.

## Fluxo de Confirmação
Quando o usuário pedir uma ação que modifica dados:
1. Resuma o que será feito
2. Peça confirmação explícita ("Confirma?")
3. Só execute após o "sim/confirmo/ok"

## Formato de Resposta
- Use markdown para formatação
- Use emojis com moderação para clareza visual
- Apresente dados tabulares quando apropriado`;

const tools = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Buscar produtos por nome, categoria ou status. Retorna lista de produtos com estoque.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca (nome do produto)" },
          category_id: { type: "string", description: "ID da categoria para filtrar" },
          only_active: { type: "boolean", description: "Filtrar apenas ativos (padrão: true)" },
          only_low_stock: { type: "boolean", description: "Filtrar apenas produtos com estoque baixo" },
          only_out_of_stock: { type: "boolean", description: "Filtrar apenas produtos sem estoque" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stock_details",
      description: "Consultar estoque detalhado de um produto por loja, incluindo variações.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "ID do produto" },
          product_name: { type: "string", description: "Nome do produto para buscar" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_orders",
      description: "Buscar pedidos por status, email do cliente ou período.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Status do pedido (pending, processing, shipped, delivered, cancelled)" },
          customer_email: { type: "string", description: "Email do cliente" },
          order_id: { type: "string", description: "ID do pedido" },
          limit: { type: "number", description: "Limite de resultados (padrão: 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_product",
      description: "Criar um novo produto no catálogo.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do produto" },
          price: { type: "number", description: "Preço em reais" },
          category_id: { type: "string", description: "ID da categoria" },
          description: { type: "string", description: "Descrição do produto" },
          promotional_price: { type: "number", description: "Preço promocional (opcional)" },
          is_active: { type: "boolean", description: "Se o produto está ativo (padrão: true)" },
        },
        required: ["name", "price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_stock_transfer",
      description: "Solicitar transferência de estoque entre lojas.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "ID do produto" },
          variation_id: { type: "string", description: "ID da variação (opcional)" },
          from_store_id: { type: "string", description: "ID da loja de origem" },
          to_store_id: { type: "string", description: "ID da loja de destino" },
          quantity: { type: "number", description: "Quantidade a transferir" },
          notes: { type: "string", description: "Observações da transferência" },
        },
        required: ["product_id", "from_store_id", "to_store_id", "quantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_upsells",
      description: "Analisar vendas e sugerir produtos para upsell/cross-sell baseado em um produto.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "ID do produto base" },
          product_name: { type: "string", description: "Nome do produto para buscar" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_categories",
      description: "Listar todas as categorias do catálogo.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_stores",
      description: "Listar todas as lojas/unidades do sistema.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sales_summary",
      description: "Obter resumo de vendas por período (pedidos online + PDV).",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Número de dias para o período (padrão: 30)" },
        },
        required: [],
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, any>, supabase: any, userId: string): Promise<string> {
  try {
    switch (name) {
      case "search_products": {
        let query = supabase.from("products").select("id, name, price, promotional_price, category_id, is_active, min_stock");
        if (args.query) query = query.ilike("name", `%${args.query}%`);
        if (args.category_id) query = query.eq("category_id", args.category_id);
        if (args.only_active !== false) query = query.eq("is_active", true);
        query = query.order("name").limit(20);
        const { data: products, error } = await query;
        if (error) return `Erro ao buscar produtos: ${error.message}`;
        if (!products || products.length === 0) return "Nenhum produto encontrado.";

        // Fetch stock
        const productIds = products.map((p: any) => p.id);
        const { data: stockData } = await supabase.from("store_stock").select("product_id, quantity").in("product_id", productIds);
        const stockMap = new Map<string, number>();
        (stockData || []).forEach((s: any) => stockMap.set(s.product_id, (stockMap.get(s.product_id) || 0) + s.quantity));

        let filtered = products;
        if (args.only_low_stock) {
          filtered = filtered.filter((p: any) => {
            const stock = stockMap.get(p.id) || 0;
            return stock > 0 && stock <= p.min_stock;
          });
        }
        if (args.only_out_of_stock) {
          filtered = filtered.filter((p: any) => (stockMap.get(p.id) || 0) === 0);
        }

        const { data: categories } = await supabase.from("categories").select("id, name");
        const catMap = new Map((categories || []).map((c: any) => [c.id, c.name]));

        const rows = filtered.map((p: any) => {
          const stock = stockMap.get(p.id) || 0;
          const cat = catMap.get(p.category_id) || "-";
          return `| ${p.name} | ${cat} | R$ ${p.price.toFixed(2)} | ${p.promotional_price ? `R$ ${p.promotional_price.toFixed(2)}` : '-'} | ${stock} | ${p.is_active ? '✅' : '❌'} | \`${p.id}\` |`;
        });

        return `Encontrados ${filtered.length} produtos:\n\n| Produto | Categoria | Preço | Promo | Estoque | Ativo | ID |\n|---------|-----------|-------|-------|---------|-------|----|\n${rows.join('\n')}`;
      }

      case "get_stock_details": {
        let productId = args.product_id;
        if (!productId && args.product_name) {
          const { data } = await supabase.from("products").select("id, name").ilike("name", `%${args.product_name}%`).limit(1);
          if (data?.[0]) productId = data[0].id;
          else return `Produto "${args.product_name}" não encontrado.`;
        }
        if (!productId) return "Informe o ID ou nome do produto.";

        const { data: product } = await supabase.from("products").select("id, name, price").eq("id", productId).single();
        if (!product) return "Produto não encontrado.";

        const { data: stores } = await supabase.from("stores").select("id, name");
        const { data: stock } = await supabase.from("store_stock").select("store_id, variation_id, quantity").eq("product_id", productId);
        const { data: variations } = await supabase.from("product_variations").select(`id, sku, product_variation_values(attribute_value_id, product_attribute_values:attribute_value_id(value))`).eq("product_id", productId);

        const storeMap = new Map((stores || []).map((s: any) => [s.id, s.name]));
        const varMap = new Map((variations || []).map((v: any) => {
          const label = v.product_variation_values?.map((pvv: any) => pvv.product_attribute_values?.value).filter(Boolean).join(' / ') || 'Sem variação';
          return [v.id, label];
        }));

        let total = 0;
        const rows = (stock || []).map((s: any) => {
          total += s.quantity;
          const storeName = storeMap.get(s.store_id) || s.store_id;
          const varLabel = s.variation_id ? varMap.get(s.variation_id) || s.variation_id : 'Produto base';
          return `| ${storeName} | ${varLabel} | ${s.quantity} |`;
        });

        return `📦 **${product.name}** (R$ ${product.price.toFixed(2)})\nEstoque total: **${total} unidades**\n\n| Loja | Variação | Qtd |\n|------|----------|-----|\n${rows.join('\n')}`;
      }

      case "search_orders": {
        let query = supabase.from("orders").select("id, customer_name, customer_email, status, payment_status, total, created_at, tracking_code");
        if (args.status) query = query.eq("status", args.status);
        if (args.customer_email) query = query.ilike("customer_email", `%${args.customer_email}%`);
        if (args.order_id) query = query.eq("id", args.order_id);
        query = query.order("created_at", { ascending: false }).limit(args.limit || 10);
        const { data: orders, error } = await query;
        if (error) return `Erro: ${error.message}`;
        if (!orders || orders.length === 0) return "Nenhum pedido encontrado.";

        const statusLabels: Record<string, string> = {
          pending: '⏳ Pendente', processing: '🔄 Processando', shipped: '📦 Enviado',
          delivered: '✅ Entregue', cancelled: '❌ Cancelado',
        };

        const rows = orders.map((o: any) => {
          const date = new Date(o.created_at).toLocaleDateString('pt-BR');
          return `| ${o.id.slice(0, 8)}... | ${o.customer_name || '-'} | ${statusLabels[o.status] || o.status} | R$ ${o.total.toFixed(2)} | ${date} | ${o.tracking_code || '-'} |`;
        });

        return `Encontrados ${orders.length} pedidos:\n\n| ID | Cliente | Status | Total | Data | Rastreio |\n|----|---------|--------|-------|------|----------|\n${rows.join('\n')}`;
      }

      case "create_product": {
        const { data, error } = await supabase.from("products").insert({
          name: args.name,
          price: args.price,
          category_id: args.category_id || null,
          description: args.description || null,
          promotional_price: args.promotional_price || null,
          is_active: args.is_active !== false,
        }).select().single();

        if (error) return `Erro ao criar produto: ${error.message}`;
        return `✅ Produto criado com sucesso!\n\n- **Nome:** ${data.name}\n- **Preço:** R$ ${data.price.toFixed(2)}\n- **ID:** \`${data.id}\`\n\n⚠️ Lembre-se de adicionar imagens e variações pelo painel de Produtos.`;
      }

      case "request_stock_transfer": {
        const { data, error } = await supabase.from("stock_transfers").insert({
          product_id: args.product_id,
          variation_id: args.variation_id || null,
          from_store_id: args.from_store_id,
          to_store_id: args.to_store_id,
          quantity: args.quantity,
          notes: args.notes || `Solicitado via Assistente IA`,
          requested_by: userId,
          status: 'pending',
        }).select().single();

        if (error) return `Erro ao solicitar transferência: ${error.message}`;
        
        const { data: fromStore } = await supabase.from("stores").select("name").eq("id", args.from_store_id).single();
        const { data: toStore } = await supabase.from("stores").select("name").eq("id", args.to_store_id).single();

        return `✅ Transferência solicitada!\n\n- **De:** ${fromStore?.name || args.from_store_id}\n- **Para:** ${toStore?.name || args.to_store_id}\n- **Quantidade:** ${args.quantity}\n- **Status:** ⏳ Pendente\n- **ID:** \`${data.id}\`\n\nA loja de origem receberá a notificação para confirmar.`;
      }

      case "suggest_upsells": {
        let productId = args.product_id;
        if (!productId && args.product_name) {
          const { data } = await supabase.from("products").select("id, name").ilike("name", `%${args.product_name}%`).limit(1);
          if (data?.[0]) productId = data[0].id;
          else return `Produto "${args.product_name}" não encontrado.`;
        }

        const { data: product } = await supabase.from("products").select("id, name, price, category_id").eq("id", productId).single();
        if (!product) return "Produto não encontrado.";

        // Get existing upsells
        const { data: existingUpsells } = await supabase.from("product_upsells").select("upsell_product_id").eq("product_id", productId);
        const existingIds = new Set((existingUpsells || []).map((u: any) => u.upsell_product_id));

        // Find products in same category
        const { data: sameCat } = await supabase.from("products").select("id, name, price, promotional_price")
          .eq("category_id", product.category_id).eq("is_active", true).neq("id", productId).limit(5);

        // Find products in different categories (complementary)
        const { data: otherCat } = await supabase.from("products").select("id, name, price, promotional_price, category_id")
          .eq("is_active", true).neq("category_id", product.category_id).neq("id", productId).limit(5);

        const { data: categories } = await supabase.from("categories").select("id, name");
        const catMap = new Map((categories || []).map((c: any) => [c.id, c.name]));

        let result = `📊 **Sugestões de Upsell para "${product.name}"** (R$ ${product.price.toFixed(2)})\n\n`;

        if (existingIds.size > 0) {
          result += `⚠️ Já possui ${existingIds.size} upsell(s) configurado(s).\n\n`;
        }

        result += `### Mesma Categoria (${catMap.get(product.category_id) || '-'})\n`;
        if (sameCat && sameCat.length > 0) {
          result += `| Produto | Preço | Já configurado |\n|---------|-------|----------------|\n`;
          sameCat.forEach((p: any) => {
            result += `| ${p.name} | R$ ${(p.promotional_price || p.price).toFixed(2)} | ${existingIds.has(p.id) ? '✅' : '❌'} |\n`;
          });
        } else {
          result += "Nenhum produto na mesma categoria.\n";
        }

        result += `\n### Produtos Complementares\n`;
        if (otherCat && otherCat.length > 0) {
          result += `| Produto | Categoria | Preço | Já configurado |\n|---------|-----------|-------|----------------|\n`;
          otherCat.forEach((p: any) => {
            result += `| ${p.name} | ${catMap.get(p.category_id) || '-'} | R$ ${(p.promotional_price || p.price).toFixed(2)} | ${existingIds.has(p.id) ? '✅' : '❌'} |\n`;
          });
        } else {
          result += "Nenhum produto complementar encontrado.\n";
        }

        result += `\n💡 **Dica:** Para configurar upsells, acesse Compre Junto no menu admin.`;
        return result;
      }

      case "list_categories": {
        const { data, error } = await supabase.from("categories").select("id, name, slug, is_active, parent_id").order("sort_order");
        if (error) return `Erro: ${error.message}`;
        if (!data || data.length === 0) return "Nenhuma categoria cadastrada.";

        const rows = data.map((c: any) => `| ${c.name} | ${c.slug} | ${c.is_active ? '✅' : '❌'} | \`${c.id}\` |`);
        return `| Categoria | Slug | Ativa | ID |\n|-----------|------|-------|----|\n${rows.join('\n')}`;
      }

      case "list_stores": {
        const { data, error } = await supabase.from("stores").select("id, name, type, is_active").order("name");
        if (error) return `Erro: ${error.message}`;
        if (!data || data.length === 0) return "Nenhuma loja cadastrada.";

        const rows = data.map((s: any) => `| ${s.name} | ${s.type} | ${s.is_active ? '✅' : '❌'} | \`${s.id}\` |`);
        return `| Loja | Tipo | Ativa | ID |\n|------|------|-------|----|\n${rows.join('\n')}`;
      }

      case "get_sales_summary": {
        const days = args.days || 30;
        const since = new Date(Date.now() - days * 86400000).toISOString();

        const [{ data: orders }, { data: posSales }] = await Promise.all([
          supabase.from("orders").select("id, total, status, created_at").gte("created_at", since),
          supabase.from("pos_sales").select("id, total, status, created_at").gte("created_at", since).eq("status", "completed"),
        ]);

        const validOrders = (orders || []).filter((o: any) => o.status !== 'cancelled');
        const onlineTotal = validOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
        const posTotal = (posSales || []).reduce((s: number, o: any) => s + Number(o.total), 0);
        const grandTotal = onlineTotal + posTotal;
        const totalCount = validOrders.length + (posSales || []).length;
        const avgTicket = totalCount > 0 ? grandTotal / totalCount : 0;

        return `📊 **Resumo de Vendas (últimos ${days} dias)**\n\n| Métrica | Valor |\n|---------|-------|\n| Pedidos Online | ${validOrders.length} |\n| Vendas PDV | ${(posSales || []).length} |\n| Total de Vendas | ${totalCount} |\n| Faturamento Online | R$ ${onlineTotal.toFixed(2)} |\n| Faturamento PDV | R$ ${posTotal.toFixed(2)} |\n| **Faturamento Total** | **R$ ${grandTotal.toFixed(2)}** |\n| Ticket Médio | R$ ${avgTicket.toFixed(2)} |`;
      }

      default:
        return `Ferramenta "${name}" não reconhecida.`;
    }
  } catch (e) {
    console.error(`Tool ${name} error:`, e);
    return `Erro ao executar "${name}": ${e instanceof Error ? e.message : 'Erro desconhecido'}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user is authenticated and has admin/manager role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roles } = await serviceClient.from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    if (!userRoles.includes('admin') && !userRoles.includes('manager')) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores e gerentes." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Sanitize messages
    const sanitizedMessages = messages.slice(-20).map((m: any) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content.slice(0, 2000) : m.content,
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id, name: m.name } : {}),
    }));

    // Initial AI call with tools
    let aiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...sanitizedMessages,
    ];

    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result = await response.json();
    let assistantMessage = result.choices?.[0]?.message;

    // Tool call loop (max 5 iterations)
    let iterations = 0;
    while (assistantMessage?.tool_calls && iterations < 5) {
      iterations++;
      aiMessages.push(assistantMessage);

      // Execute all tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {}

        console.log(`Executing tool: ${fnName}`, fnArgs);
        const toolResult = await executeTool(fnName, fnArgs, serviceClient, user.id);

        aiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: fnName,
          content: toolResult,
        });
      }

      // Call AI again with tool results
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          tools,
          stream: false,
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("AI tool loop error:", response.status, t);
        break;
      }

      result = await response.json();
      assistantMessage = result.choices?.[0]?.message;
    }

    const finalContent = assistantMessage?.content || "Desculpe, não consegui processar sua solicitação.";

    return new Response(JSON.stringify({ content: finalContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
