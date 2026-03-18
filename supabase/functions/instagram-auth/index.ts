import { corsHeaders, getSupabaseClient, jsonResponse, errorResponse } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the user is admin/manager
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Unauthorized", 401);
    }

    const supabase = getSupabaseClient();
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return errorResponse("Unauthorized", 401);
    }

    // Check admin/manager role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "manager"]);

    if (!roleData || roleData.length === 0) {
      return errorResponse("Forbidden: admin or manager role required", 403);
    }

    const INSTAGRAM_APP_ID = Deno.env.get("INSTAGRAM_APP_ID");
    const REDIRECT_URI = Deno.env.get("INSTAGRAM_REDIRECT_URI");

    if (!INSTAGRAM_APP_ID || !REDIRECT_URI) {
      return errorResponse("Instagram app not configured", 500);
    }

    // Generate a secure state parameter
    const statePayload = {
      userId: userData.user.id,
      nonce: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    const state = btoa(JSON.stringify(statePayload));

    // Store state in DB for validation
    await supabase.from("instagram_integrations").upsert({
      user_id: userData.user.id,
      access_token: "__pending__",
      status: "pending",
      token_type: "pending",
      scopes: [],
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      instagram_user_id: `pending_${statePayload.nonce}`,
    }, { onConflict: "instagram_user_id" });

    // Store state nonce for validation on callback
    await supabase.from("store_config").upsert({
      key: `instagram_oauth_state_${statePayload.nonce}`,
      value: statePayload,
      is_public: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    const scopes = "instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,pages_show_list,pages_read_engagement";

    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${encodeURIComponent(state)}`;

    return jsonResponse({ authUrl, state });
  } catch (error) {
    console.error("Instagram auth error:", error);
    return errorResponse("Internal server error", 500);
  }
});
