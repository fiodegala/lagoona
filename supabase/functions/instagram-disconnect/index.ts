import { corsHeaders, getSupabaseClient, jsonResponse, errorResponse } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
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

    // Set all active integrations to disconnected
    const { error: updateError } = await supabase
      .from("instagram_integrations")
      .update({ status: "disconnected", updated_at: new Date().toISOString() })
      .eq("status", "active");

    if (updateError) {
      console.error("Disconnect error:", updateError);
      return errorResponse("Failed to disconnect", 500);
    }

    return jsonResponse({ success: true, message: "Instagram disconnected" });
  } catch (error) {
    console.error("Instagram disconnect error:", error);
    return errorResponse("Internal server error", 500);
  }
});
