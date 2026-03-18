import { corsHeaders, getSupabaseClient, jsonResponse, errorResponse } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      return errorResponse("Forbidden", 403);
    }

    // Get active integration
    const { data: integration } = await supabase
      .from("instagram_integrations")
      .select("id, instagram_user_id, instagram_username, token_type, expires_at, scopes, status, connected_at, updated_at, access_token")
      .eq("status", "active")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!integration) {
      return jsonResponse({ connected: false });
    }

    // Mask the token for display
    const tokenRaw = integration.access_token;
    const maskedToken = tokenRaw
      ? `${tokenRaw.substring(0, 8)}...${tokenRaw.substring(tokenRaw.length - 4)}`
      : null;

    const { data: bodyData } = await req.json().catch(() => ({ data: null }));
    const showFull = bodyData?.showFullToken === true;

    return jsonResponse({
      connected: true,
      integration: {
        id: integration.id,
        instagram_user_id: integration.instagram_user_id,
        instagram_username: integration.instagram_username,
        token_type: integration.token_type,
        expires_at: integration.expires_at,
        scopes: integration.scopes,
        status: integration.status,
        connected_at: integration.connected_at,
        masked_token: maskedToken,
        full_token: showFull ? tokenRaw : undefined,
      },
    });
  } catch (error) {
    console.error("Instagram status error:", error);
    return errorResponse("Internal server error", 500);
  }
});
