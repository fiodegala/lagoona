import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUserIdFromAuthHeader } from "../_shared/utils.ts";

const ALWAYS_VISIBLE_MENUS = ["manual", "service-orders", "announcements"] as const;

const normalizeAllowedMenus = (menus: unknown): string[] => {
  const baseMenus = Array.isArray(menus)
    ? menus.filter((menu): menu is string => typeof menu === "string" && menu.length > 0 && !ALWAYS_VISIBLE_MENUS.includes(menu as (typeof ALWAYS_VISIBLE_MENUS)[number]))
    : [];

  return Array.from(new Set([...baseMenus, ...ALWAYS_VISIBLE_MENUS]));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callingUserId = await getUserIdFromAuthHeader(authHeader);
    if (!callingUserId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem criar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, email, password, fullName, role, store_id, allowed_menus, user_id: targetUserId, new_password } = body;
    const normalizedAllowedMenus = normalizeAllowedMenus(allowed_menus);

    // adminClient already created above

    // Handle password update action
    if (action === "update-password") {
      if (!targetUserId || !new_password) {
        return new Response(JSON.stringify({ error: "ID do usuário e nova senha são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (new_password.length < 6) {
        return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: new_password,
      });
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || !password || !fullName || !role) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user via admin API (won't affect calling user's session)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      const msg = createError.message.includes("already been registered")
        ? "Já existe um usuário cadastrado com este e-mail"
        : createError.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role,
        store_id: store_id || null,
      });

    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save menu permissions if provided
    if (normalizedAllowedMenus.length > 0) {
      const { error: menuError } = await adminClient
        .from("user_menu_permissions")
        .insert({
          user_id: newUser.user.id,
          allowed_menus: normalizedAllowedMenus,
        });

      if (menuError) {
        console.error("Error saving menu permissions:", menuError);
      }
    }

    return new Response(JSON.stringify({ user: newUser.user }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
