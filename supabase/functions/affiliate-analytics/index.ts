import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get affiliate record for this user
    const { data: affiliate } = await anonClient
      .from("affiliates")
      .select("id, referral_code")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!affiliate) {
      return new Response(JSON.stringify({ error: "Afiliado não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const days = body.days || 30;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Query analytics events that have this affiliate's referral code in metadata
    const { data: events, error: eventsError } = await adminClient
      .from("site_analytics_events")
      .select("event_type, page_path, metadata, screen_width, created_at")
      .gte("created_at", since.toISOString())
      .filter("metadata->>affiliate_code", "eq", affiliate.referral_code)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      return new Response(JSON.stringify({ error: "Erro ao buscar dados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allEvents = events || [];

    // Process analytics
    const pageViews = allEvents.filter(e => e.event_type === "page_view");
    const sessions = new Set(allEvents.map(e => (e.metadata as any)?.visitor_id).filter(Boolean));
    const uniqueVisitors = sessions.size;
    const totalPageViews = pageViews.length;

    // Page views by day
    const viewsByDay: Record<string, number> = {};
    pageViews.forEach(e => {
      const day = e.created_at.substring(0, 10);
      viewsByDay[day] = (viewsByDay[day] || 0) + 1;
    });

    // Top pages
    const pageCount: Record<string, number> = {};
    pageViews.forEach(e => {
      pageCount[e.page_path] = (pageCount[e.page_path] || 0) + 1;
    });
    const topPages = Object.entries(pageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    // Devices
    const deviceCount: Record<string, number> = {};
    allEvents.forEach(e => {
      const dt = (e.metadata as any)?.device_type || "unknown";
      if (!deviceCount[dt]) deviceCount[dt] = 0;
      deviceCount[dt]++;
    });

    // Traffic sources
    const sourceCount: Record<string, number> = {};
    allEvents.filter(e => e.event_type === "session_start").forEach(e => {
      const src = (e.metadata as any)?.traffic_source || "direct";
      sourceCount[src] = (sourceCount[src] || 0) + 1;
    });

    // Browsers
    const browserCount: Record<string, number> = {};
    allEvents.filter(e => e.event_type === "session_start").forEach(e => {
      const b = (e.metadata as any)?.browser || "other";
      browserCount[b] = (browserCount[b] || 0) + 1;
    });

    // Funnel events
    const addToCart = allEvents.filter(e => e.event_type === "add_to_cart").length;
    const checkoutStart = allEvents.filter(e => e.event_type === "checkout_start").length;
    const checkoutComplete = allEvents.filter(e => e.event_type === "checkout_complete").length;

    return new Response(JSON.stringify({
      referral_code: affiliate.referral_code,
      period_days: days,
      summary: {
        unique_visitors: uniqueVisitors,
        total_page_views: totalPageViews,
        total_events: allEvents.length,
        add_to_cart: addToCart,
        checkout_start: checkoutStart,
        checkout_complete: checkoutComplete,
      },
      views_by_day: viewsByDay,
      top_pages: topPages,
      devices: deviceCount,
      sources: sourceCount,
      browsers: browserCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
