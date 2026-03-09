import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { period = '30d' } = await req.json().catch(() => ({}));
    
    const daysBack = period === '7d' ? 7 : period === '14d' ? 14 : 30;
    const since = new Date(Date.now() - daysBack * 86400000).toISOString();

    // Fetch analytics data
    const [pageViews, clicks, productViews, productPageViews, funnelData] = await Promise.all([
      supabase
        .from("site_analytics_events")
        .select("page_path, page_title, duration_ms, created_at")
        .eq("event_type", "page_view_end")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("site_analytics_events")
        .select("element_area, element_text, page_path, created_at")
        .eq("event_type", "click")
        .gte("created_at", since)
        .limit(1000),
      supabase
        .from("site_analytics_events")
        .select("product_id, created_at")
        .eq("event_type", "product_view")
        .gte("created_at", since)
        .limit(1000),
      // Also get page_view events on product pages to catch views even without product_view event
      supabase
        .from("site_analytics_events")
        .select("page_path, session_id, created_at")
        .eq("event_type", "page_view")
        .like("page_path", "/produto/%")
        .gte("created_at", since)
        .limit(2000),
      supabase
        .from("site_analytics_events")
        .select("event_type, session_id, page_path")
        .in("event_type", ["page_view", "product_view", "add_to_cart", "checkout_start", "checkout_complete"])
        .gte("created_at", since)
        .limit(5000),
    ]);

    // Process page time data
    const pageTimeMap: Record<string, { total: number; count: number }> = {};
    (pageViews.data || []).forEach((pv: any) => {
      if (!pv.duration_ms || pv.duration_ms < 500) return;
      const key = pv.page_path;
      if (!pageTimeMap[key]) pageTimeMap[key] = { total: 0, count: 0 };
      pageTimeMap[key].total += pv.duration_ms;
      pageTimeMap[key].count += 1;
    });

    const avgTimeByPage = Object.entries(pageTimeMap)
      .map(([path, { total, count }]) => ({
        page: path,
        avg_seconds: Math.round(total / count / 1000),
        views: count,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);

    // Process click map
    const clickAreaMap: Record<string, number> = {};
    (clicks.data || []).forEach((c: any) => {
      const area = c.element_area || "unknown";
      clickAreaMap[area] = (clickAreaMap[area] || 0) + 1;
    });

    const clickMap = Object.entries(clickAreaMap)
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count);

    // Process product views with product names
    const productViewMap: Record<string, number> = {};
    (productViews.data || []).forEach((pv: any) => {
      if (pv.product_id) {
        productViewMap[pv.product_id] = (productViewMap[pv.product_id] || 0) + 1;
      }
    });

    const topProductIds = Object.entries(productViewMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    let topProducts: { id: string; name: string; views: number }[] = [];
    if (topProductIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .in("id", topProductIds.map(([id]) => id));

      const nameMap: Record<string, string> = {};
      (products || []).forEach((p: any) => { nameMap[p.id] = p.name; });

      topProducts = topProductIds.map(([id, views]) => ({
        id,
        name: nameMap[id] || "Produto removido",
        views,
      }));
    }

    // Process funnel
    const sessionEvents: Record<string, Set<string>> = {};
    (funnelData.data || []).forEach((e: any) => {
      if (!sessionEvents[e.session_id]) sessionEvents[e.session_id] = new Set();
      sessionEvents[e.session_id].add(e.event_type);
    });

    const totalSessions = Object.keys(sessionEvents).length;
    const funnel = {
      page_view: totalSessions,
      product_view: 0,
      add_to_cart: 0,
      checkout_start: 0,
      checkout_complete: 0,
    };

    Object.values(sessionEvents).forEach((events) => {
      if (events.has("product_view")) funnel.product_view++;
      if (events.has("add_to_cart")) funnel.add_to_cart++;
      if (events.has("checkout_start")) funnel.checkout_start++;
      if (events.has("checkout_complete")) funnel.checkout_complete++;
    });

    // Build summary for AI
    const summary = {
      period: `${daysBack} dias`,
      totalSessions,
      avgTimeByPage,
      clickMap,
      topProducts,
      funnel,
    };

    // Call AI for recommendations
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiRecommendations = null;

    if (LOVABLE_API_KEY) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `Você é um analista de e-commerce expert em UX e conversão. Analise os dados comportamentais de um site de moda e forneça recomendações PRÁTICAS e ACIONÁVEIS em português do Brasil. Seja direto e específico. Formato: retorne um JSON com a estrutura { "insights": [{ "category": "tempo"|"produtos"|"funil"|"cliques"|"geral", "title": "título curto", "description": "descrição detalhada da recomendação", "priority": "alta"|"media"|"baixa", "impact": "descrição do impacto esperado" }] }. Retorne entre 5 e 8 insights.`,
              },
              {
                role: "user",
                content: `Dados de analytics dos últimos ${daysBack} dias:\n\n${JSON.stringify(summary, null, 2)}`,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          // Try to parse JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiRecommendations = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (aiError) {
        console.error("AI analysis error:", aiError);
      }
    }

    return new Response(
      JSON.stringify({
        ...summary,
        aiRecommendations,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
