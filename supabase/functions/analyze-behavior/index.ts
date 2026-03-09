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

    // Fetch all analytics data in parallel
    const [pageViews, clicks, productViews, productPageViews, funnelData, searchEvents, sessionStarts, bounceEvents, favoriteEvents, cartRemoves] = await Promise.all([
      supabase
        .from("site_analytics_events")
        .select("page_path, page_title, duration_ms, created_at")
        .eq("event_type", "page_view_end")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("site_analytics_events")
        .select("element_area, element_text, page_path, metadata, created_at")
        .eq("event_type", "click")
        .gte("created_at", since)
        .limit(2000),
      supabase
        .from("site_analytics_events")
        .select("product_id, created_at")
        .eq("event_type", "product_view")
        .gte("created_at", since)
        .limit(2000),
      supabase
        .from("site_analytics_events")
        .select("page_path, session_id, created_at")
        .eq("event_type", "page_view")
        .like("page_path", "/produto/%")
        .gte("created_at", since)
        .limit(3000),
      supabase
        .from("site_analytics_events")
        .select("event_type, session_id, page_path")
        .in("event_type", ["page_view", "product_view", "add_to_cart", "checkout_start", "checkout_complete"])
        .gte("created_at", since)
        .limit(5000),
      supabase
        .from("site_analytics_events")
        .select("metadata, created_at")
        .eq("event_type", "search")
        .gte("created_at", since)
        .limit(1000),
      supabase
        .from("site_analytics_events")
        .select("session_id, metadata, created_at")
        .eq("event_type", "session_start")
        .gte("created_at", since)
        .limit(2000),
      supabase
        .from("site_analytics_events")
        .select("session_id, created_at")
        .eq("event_type", "bounce")
        .gte("created_at", since)
        .limit(2000),
      supabase
        .from("site_analytics_events")
        .select("event_type, product_id, created_at")
        .in("event_type", ["favorite_add", "favorite_remove"])
        .gte("created_at", since)
        .limit(1000),
      supabase
        .from("site_analytics_events")
        .select("product_id, metadata, created_at")
        .eq("event_type", "remove_from_cart")
        .gte("created_at", since)
        .limit(1000),
    ]);

    // === Process page time data ===
    const pageTimeMap: Record<string, { total: number; count: number }> = {};
    (pageViews.data || []).forEach((pv: any) => {
      if (!pv.duration_ms || pv.duration_ms < 500) return;
      const key = pv.page_path;
      if (!pageTimeMap[key]) pageTimeMap[key] = { total: 0, count: 0 };
      pageTimeMap[key].total += pv.duration_ms;
      pageTimeMap[key].count += 1;
    });
    const avgTimeByPage = Object.entries(pageTimeMap)
      .map(([path, { total, count }]) => ({ page: path, avg_seconds: Math.round(total / count / 1000), views: count }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);

    // === Click map ===
    const clickAreaMap: Record<string, number> = {};
    (clicks.data || []).forEach((c: any) => {
      const area = c.element_area || "unknown";
      clickAreaMap[area] = (clickAreaMap[area] || 0) + 1;
    });
    const clickMap = Object.entries(clickAreaMap)
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count);

    // === Heatmap data (click coordinates by page) ===
    const heatmapByPage: Record<string, { x: number; y: number; count: number }[]> = {};
    (clicks.data || []).forEach((c: any) => {
      const meta = c.metadata as any;
      if (meta?.click_x != null && meta?.click_y != null) {
        const page = c.page_path;
        if (!heatmapByPage[page]) heatmapByPage[page] = [];
        // Group by rough 5% zones
        const zoneX = Math.round(meta.click_x / 5) * 5;
        const zoneY = Math.round(meta.click_y / 5) * 5;
        const existing = heatmapByPage[page].find(h => h.x === zoneX && h.y === zoneY);
        if (existing) existing.count++;
        else heatmapByPage[page].push({ x: zoneX, y: zoneY, count: 1 });
      }
    });
    // Get top 3 pages heatmap
    const heatmapPages = Object.entries(heatmapByPage)
      .sort(([, a], [, b]) => b.reduce((s, h) => s + h.count, 0) - a.reduce((s, h) => s + h.count, 0))
      .slice(0, 3)
      .map(([page, zones]) => ({ page, zones: zones.sort((a, b) => b.count - a.count).slice(0, 20) }));

    // === Product views ===
    const productViewMap: Record<string, number> = {};
    (productViews.data || []).forEach((pv: any) => {
      if (pv.product_id) productViewMap[pv.product_id] = (productViewMap[pv.product_id] || 0) + 1;
    });
    (productPageViews.data || []).forEach((pv: any) => {
      const match = pv.page_path?.match(/\/produto\/([0-9a-f-]{36})/);
      if (match) {
        const pid = match[1];
        productViewMap[pid] = (productViewMap[pid] || 0) + 1;
      }
    });
    const topProductIds = Object.entries(productViewMap).sort(([, a], [, b]) => b - a).slice(0, 10);
    let topProducts: { id: string; name: string; views: number }[] = [];
    if (topProductIds.length > 0) {
      const { data: products } = await supabase.from("products").select("id, name").in("id", topProductIds.map(([id]) => id));
      const nameMap: Record<string, string> = {};
      (products || []).forEach((p: any) => { nameMap[p.id] = p.name; });
      topProducts = topProductIds.map(([id, views]) => ({ id, name: nameMap[id] || "Produto removido", views }));
    }

    // === Funnel ===
    const sessionEvents: Record<string, Set<string>> = {};
    (funnelData.data || []).forEach((e: any) => {
      if (!sessionEvents[e.session_id]) sessionEvents[e.session_id] = new Set();
      sessionEvents[e.session_id].add(e.event_type);
      if (e.event_type === "page_view" && e.page_path?.startsWith("/produto/")) {
        sessionEvents[e.session_id].add("product_view");
      }
    });
    const totalSessions = Object.keys(sessionEvents).length;
    const funnel = { page_view: totalSessions, product_view: 0, add_to_cart: 0, checkout_start: 0, checkout_complete: 0 };
    Object.values(sessionEvents).forEach((events) => {
      if (events.has("product_view")) funnel.product_view++;
      if (events.has("add_to_cart")) funnel.add_to_cart++;
      if (events.has("checkout_start")) funnel.checkout_start++;
      if (events.has("checkout_complete")) funnel.checkout_complete++;
    });

    // === Bounce rate ===
    const totalBounces = (bounceEvents.data || []).length;
    const totalSessionStarts = (sessionStarts.data || []).length;
    const bounceRate = totalSessionStarts > 0 ? Math.round((totalBounces / totalSessionStarts) * 100) : 0;

    // === Device & Browser breakdown ===
    const deviceMap: Record<string, number> = {};
    const browserMap: Record<string, number> = {};
    const osMap: Record<string, number> = {};
    const trafficSourceMap: Record<string, number> = {};
    const trafficMediumMap: Record<string, number> = {};
    let newVisitors = 0;
    let returningVisitors = 0;

    (sessionStarts.data || []).forEach((s: any) => {
      const meta = s.metadata as any;
      if (meta) {
        // Device
        const dt = meta.device_type || 'unknown';
        deviceMap[dt] = (deviceMap[dt] || 0) + 1;
        // Browser
        const br = meta.browser || 'unknown';
        browserMap[br] = (browserMap[br] || 0) + 1;
        // OS
        const os = meta.os || 'unknown';
        osMap[os] = (osMap[os] || 0) + 1;
        // Traffic
        const src = meta.traffic_source || 'direct';
        trafficSourceMap[src] = (trafficSourceMap[src] || 0) + 1;
        const med = meta.traffic_medium || 'none';
        trafficMediumMap[med] = (trafficMediumMap[med] || 0) + 1;
        // New vs returning
        if (meta.is_new_visitor) newVisitors++;
        else returningVisitors++;
      }
    });

    const devices = Object.entries(deviceMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const browsers = Object.entries(browserMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const operatingSystems = Object.entries(osMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const trafficSources = Object.entries(trafficSourceMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const trafficMediums = Object.entries(trafficMediumMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // === Search analytics ===
    const searchQueryMap: Record<string, { count: number; avg_results: number; total_results: number }> = {};
    let searchesWithNoResults = 0;
    (searchEvents.data || []).forEach((s: any) => {
      const meta = s.metadata as any;
      const query = (meta?.search_query || '').toLowerCase().trim();
      if (!query) return;
      if (!searchQueryMap[query]) searchQueryMap[query] = { count: 0, avg_results: 0, total_results: 0 };
      searchQueryMap[query].count++;
      searchQueryMap[query].total_results += (meta?.results_count || 0);
      if ((meta?.results_count || 0) === 0) searchesWithNoResults++;
    });
    const topSearches = Object.entries(searchQueryMap)
      .map(([query, data]) => ({ query, count: data.count, avg_results: Math.round(data.total_results / data.count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    const totalSearches = (searchEvents.data || []).length;

    // === Favorites analytics ===
    const favAdds = (favoriteEvents.data || []).filter((e: any) => e.event_type === 'favorite_add');
    const favRemoves = (favoriteEvents.data || []).filter((e: any) => e.event_type === 'favorite_remove');
    const favProductMap: Record<string, number> = {};
    favAdds.forEach((f: any) => {
      if (f.product_id) favProductMap[f.product_id] = (favProductMap[f.product_id] || 0) + 1;
    });
    const topFavProductIds = Object.entries(favProductMap).sort(([, a], [, b]) => b - a).slice(0, 10);
    let topFavorites: { id: string; name: string; count: number }[] = [];
    if (topFavProductIds.length > 0) {
      const { data: favProducts } = await supabase.from("products").select("id, name").in("id", topFavProductIds.map(([id]) => id));
      const nameMap: Record<string, string> = {};
      (favProducts || []).forEach((p: any) => { nameMap[p.id] = p.name; });
      topFavorites = topFavProductIds.map(([id, count]) => ({ id, name: nameMap[id] || "Produto removido", count }));
    }

    // === Cart abandonment events ===
    const cartRemoveMap: Record<string, number> = {};
    (cartRemoves.data || []).forEach((r: any) => {
      if (r.product_id) cartRemoveMap[r.product_id] = (cartRemoveMap[r.product_id] || 0) + 1;
    });
    const topCartRemoveIds = Object.entries(cartRemoveMap).sort(([, a], [, b]) => b - a).slice(0, 10);
    let topCartRemoves: { id: string; name: string; removes: number }[] = [];
    if (topCartRemoveIds.length > 0) {
      const { data: removeProducts } = await supabase.from("products").select("id, name").in("id", topCartRemoveIds.map(([id]) => id));
      const nameMap: Record<string, string> = {};
      (removeProducts || []).forEach((p: any) => { nameMap[p.id] = p.name; });
      topCartRemoves = topCartRemoveIds.map(([id, removes]) => ({ id, name: nameMap[id] || "Produto removido", removes }));
    }

    // Build summary
    const summary = {
      period: `${daysBack} dias`,
      totalSessions,
      avgTimeByPage,
      clickMap,
      heatmapPages,
      topProducts,
      funnel,
      bounceRate,
      totalBounces,
      devices,
      browsers,
      operatingSystems,
      trafficSources,
      trafficMediums,
      newVisitors,
      returningVisitors,
      topSearches,
      totalSearches,
      searchesWithNoResults,
      topFavorites,
      totalFavoriteAdds: favAdds.length,
      totalFavoriteRemoves: favRemoves.length,
      topCartRemoves,
      totalCartRemoves: (cartRemoves.data || []).length,
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
                content: `Você é um analista de e-commerce expert em UX e conversão. Analise os dados comportamentais de um site de moda e forneça recomendações PRÁTICAS e ACIONÁVEIS em português do Brasil. Considere: taxa de rejeição, dispositivos, fontes de tráfego, buscas, favoritos, funil e heatmap. Seja direto e específico. Formato: retorne um JSON com a estrutura { "insights": [{ "category": "bounce"|"dispositivos"|"trafego"|"busca"|"favoritos"|"funil"|"cliques"|"tempo"|"produtos"|"geral", "title": "título curto", "description": "descrição detalhada da recomendação", "priority": "alta"|"media"|"baixa", "impact": "descrição do impacto esperado" }] }. Retorne entre 6 e 10 insights.`,
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
      JSON.stringify({ ...summary, aiRecommendations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
