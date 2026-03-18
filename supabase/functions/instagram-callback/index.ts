import { getSupabaseClient } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorReason = url.searchParams.get("error_reason");

    const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://fiodegalafdg.lovable.app";

    if (error) {
      console.error("OAuth error:", error, errorReason);
      return Response.redirect(`${FRONTEND_URL}/admin/settings?instagram=error&reason=${encodeURIComponent(errorReason || error)}`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${FRONTEND_URL}/admin/settings?instagram=error&reason=missing_params`, 302);
    }

    // Decode and validate state
    let statePayload: { userId: string; nonce: string; timestamp: number };
    try {
      statePayload = JSON.parse(atob(state));
    } catch {
      return Response.redirect(`${FRONTEND_URL}/admin/settings?instagram=error&reason=invalid_state`, 302);
    }

    // Check timestamp (10 min window)
    if (Date.now() - statePayload.timestamp > 600000) {
      return Response.redirect(`${FRONTEND_URL}/admin/settings?instagram=error&reason=expired_state`, 302);
    }

    const supabase = getSupabaseClient();

    // Validate state nonce exists in DB
    const { data: storedState } = await supabase
      .from("store_config")
      .select("value")
      .eq("key", `instagram_oauth_state_${statePayload.nonce}`)
      .single();

    if (!storedState) {
      return Response.redirect(`${FRONTEND_URL}/admin/settings?instagram=error&reason=state_not_found`, 302);
    }

    // Clean up the state entry
    await supabase.from("store_config").delete().eq("key", `instagram_oauth_state_${statePayload.nonce}`);

    const INSTAGRAM_APP_ID = Deno.env.get("INSTAGRAM_APP_ID");
    const INSTAGRAM_APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET");
    const REDIRECT_URI = Deno.env.get("INSTAGRAM_REDIRECT_URI");

    if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET || !REDIRECT_URI) {
      return Response.redirect(`${FRONTEND_URL}/admin/settings?instagram=error&reason=server_config`, 302);
    }

    // Exchange code for short-lived token
    const tokenResponse = await fetch("https://graph.facebook.com/v21.0/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      return Response.redirect(`${FRONTEND_URL}/admin/settings?instagram=error&reason=token_exchange_failed`, 302);
    }

    const shortLivedToken = tokenData.access_token;

    // Exchange for long-lived token
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${INSTAGRAM_APP_ID}&client_secret=${INSTAGRAM_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
    );
    const longLivedData = await longLivedResponse.json();

    let finalToken = shortLivedToken;
    let tokenType = "short_lived";
    let expiresAt: string | null = null;

    if (longLivedData.access_token) {
      finalToken = longLivedData.access_token;
      tokenType = "long_lived";
      if (longLivedData.expires_in) {
        expiresAt = new Date(Date.now() + longLivedData.expires_in * 1000).toISOString();
      }
    }

    // Get Instagram Business Account info via Pages
    let igUserId: string | null = null;
    let igUsername: string | null = null;

    try {
      // Get pages
      const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${finalToken}`);
      const pagesData = await pagesRes.json();

      if (pagesData.data && pagesData.data.length > 0) {
        const pageId = pagesData.data[0].id;
        const pageToken = pagesData.data[0].access_token;

        // Get Instagram Business Account linked to page
        const igRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${pageToken}`);
        const igData = await igRes.json();

        if (igData.instagram_business_account) {
          igUserId = igData.instagram_business_account.id;

          // Get username
          const profileRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}?fields=username&access_token=${finalToken}`);
          const profileData = await profileRes.json();
          igUsername = profileData.username || null;
        }
      }
    } catch (e) {
      console.error("Error fetching IG profile:", e);
    }

    // Clean up pending entries
    await supabase.from("instagram_integrations")
      .delete()
      .eq("user_id", statePayload.userId)
      .eq("status", "pending");

    // Save integration
    await supabase.from("instagram_integrations").upsert({
      user_id: statePayload.userId,
      instagram_user_id: igUserId || `fb_${Date.now()}`,
      instagram_username: igUsername,
      access_token: finalToken,
      token_type: tokenType,
      expires_at: expiresAt,
      scopes: ["instagram_basic", "instagram_content_publish", "instagram_manage_comments", "instagram_manage_insights", "pages_show_list", "pages_read_engagement"],
      status: "active",
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "instagram_user_id" });

    return Response.redirect(`${FRONTEND_URL}/admin/settings?instagram=success`, 302);
  } catch (error) {
    console.error("Instagram callback error:", error);
    const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://fiodegalafdg.lovable.app";
    return Response.redirect(`${FRONTEND_URL}/admin/settings?instagram=error&reason=internal_error`, 302);
  }
});
