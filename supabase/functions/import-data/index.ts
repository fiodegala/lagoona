import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin/manager
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleCheck } = await supabase.rpc("is_admin_or_manager", { _user_id: user.id });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { type, records, batch_index, total_batches } = body;

    if (!type || !records || !Array.isArray(records)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let inserted = 0;
    let errors: string[] = [];
    const BATCH_SIZE = 50;

    if (type === "customers") {
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE).map((r: any) => ({
          name: r.name || r.nome || "Sem nome",
          email: r.email || null,
          phone: r.phone || r.telefone || null,
          document: r.document || r.cpf || r.cnpj || r.documento || null,
          customer_type: r.customer_type || r.tipo || "fisica",
          address: r.address || r.endereco || null,
          city: r.city || r.cidade || null,
          state: r.state || r.estado || null,
          zip_code: r.zip_code || r.cep || null,
          neighborhood: r.neighborhood || r.bairro || null,
          notes: r.notes || r.observacoes || null,
          is_active: true,
        }));

        const { data, error } = await supabase.from("customers").insert(batch).select("id");
        if (error) {
          errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          inserted += data?.length || 0;
        }
      }
    }

    if (type === "sales") {
      // Get user's store_id
      const { data: storeId } = await supabase.rpc("user_store_id", { _user_id: user.id });

      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE).map((r: any) => ({
          local_id: crypto.randomUUID(),
          user_id: user.id,
          store_id: r.store_id || storeId || null,
          customer_name: r.customer_name || r.cliente || null,
          customer_document: r.customer_document || r.cpf_cliente || null,
          items: r.items || r.itens || [],
          subtotal: parseFloat(r.subtotal || r.valor || "0") || 0,
          total: parseFloat(r.total || r.valor_total || r.subtotal || r.valor || "0") || 0,
          discount_amount: parseFloat(r.discount_amount || r.desconto || "0") || 0,
          payment_method: r.payment_method || r.forma_pagamento || "dinheiro",
          sale_type: r.sale_type || r.tipo_venda || "varejo",
          status: r.status || "completed",
          notes: r.notes || r.observacoes || null,
          created_at: r.created_at || r.data || new Date().toISOString(),
        }));

        const { data, error } = await supabase.from("pos_sales").insert(batch).select("id");
        if (error) {
          errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          inserted += data?.length || 0;
        }
      }
    }

    if (type === "sales_sheet") {
      // Import from Google Sheets cash register format
      const { data: defaultStoreId } = await supabase.rpc("user_store_id", { _user_id: user.id });

      // Build seller name -> user_id AND store_id maps from profiles + user_roles
      const sellerMap: Record<string, string> = {};
      const sellerStoreMap: Record<string, string> = {};
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name");
      if (allProfiles) {
        // Also fetch user_roles to get store_id per user
        const userIds = allProfiles.map(p => p.user_id);
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, store_id")
          .in("user_id", userIds);
        const roleMap: Record<string, string> = {};
        if (roles) {
          for (const r of roles) {
            if (r.store_id) roleMap[r.user_id] = r.store_id;
          }
        }

        for (const p of allProfiles) {
          const fullLower = p.full_name.trim().toLowerCase();
          sellerMap[fullLower] = p.user_id;
          if (roleMap[p.user_id]) sellerStoreMap[fullLower] = roleMap[p.user_id];
          const firstName = fullLower.split(/[\s\-]/)[0];
          if (firstName && !sellerMap[firstName]) {
            sellerMap[firstName] = p.user_id;
            if (roleMap[p.user_id]) sellerStoreMap[firstName] = roleMap[p.user_id];
          }
        }
      }
      console.log("Seller map keys:", Object.keys(sellerMap));

      const resolveUserId = (vendedor: string | undefined): string => {
        if (!vendedor) return user.id;
        const key = vendedor.trim().toLowerCase();
        if (sellerMap[key]) return sellerMap[key];
        for (const [name, uid] of Object.entries(sellerMap)) {
          if (name.includes(key) || key.includes(name)) return uid;
        }
        console.log("No match found for seller:", vendedor);
        return user.id;
      };

      const resolveStoreId = (vendedor: string | undefined): string | null => {
        if (!vendedor) return defaultStoreId || null;
        const key = vendedor.trim().toLowerCase();
        if (sellerStoreMap[key]) return sellerStoreMap[key];
        for (const [name, sid] of Object.entries(sellerStoreMap)) {
          if (name.includes(key) || key.includes(name)) return sid;
        }
        return defaultStoreId || null;
      };

      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batchRecords = records.slice(i, i + BATCH_SIZE);
        const batch = await Promise.all(batchRecords.map(async (r: any) => {
          const parcelas = r.parcelas ? r.parcelas.replace(/[^0-9]/g, '') : '';
          const paymentDetails: any = {};
          if (r.forma_pagamento_original) paymentDetails.method1 = r.forma_pagamento_original;
          if (r.forma_pagamento_2_original) paymentDetails.method2 = r.forma_pagamento_2_original;
          if (parcelas) paymentDetails.installments = parseInt(parcelas, 10);
          if (r.como_conheceu) paymentDetails.referral_source = r.como_conheceu;
          if (r.vendedor) paymentDetails.seller = r.vendedor;
          if (r.online_ou_presencial) paymentDetails.channel = r.online_ou_presencial;
          if (r.nome_loja) paymentDetails.store_name = r.nome_loja;
          if (r.whatsapp) paymentDetails.whatsapp = r.whatsapp;
          if (r.cidade) paymentDetails.city = r.cidade;
          if (r.estado) paymentDetails.state = r.estado;
          if (r.referencia) paymentDetails.product_ref = r.referencia;
          if (r.venda_promocional) paymentDetails.is_promo = r.venda_promocional;

          const createdAt = r.data || new Date().toISOString();
          const customerName = r.cliente || '';
          const totalVal = r.valor_total || 0;
          const paymentMethod = r.forma_pagamento || "cash";
          const seller = r.vendedor || '';
          const productRef = r.referencia || '';

          // Build a dedup hash from key fields to prevent duplicate imports
          const hashInput = `${customerName}|${createdAt.substring(0, 10)}|${totalVal}|${paymentMethod}|${seller}|${productRef}`;
          const encoder = new TextEncoder();
          const data = encoder.encode(hashInput.toLowerCase().trim());
          const hashBuffer = await crypto.subtle.digest("SHA-256", data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const dedupHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

          return {
            local_id: crypto.randomUUID(),
            user_id: resolveUserId(r.vendedor),
            store_id: resolveStoreId(r.vendedor),
            customer_name: customerName || null,
            items: r.referencia ? [{
              name: r.referencia,
              quantity: r.quantidade || 1,
              price: r.valor_unitario || r.valor_total || 0,
            }] : [],
            subtotal: totalVal,
            total: totalVal,
            discount_amount: r.valor_desconto || 0,
            payment_method: paymentMethod,
            sale_type: r.tipo_venda || "varejo",
            status: "completed",
            notes: `Importado da planilha de caixa | Vendedor: ${seller || '-'} | Ref: ${productRef || '-'} | ${r.como_conheceu || ''}`,
            payment_details: paymentDetails,
            created_at: createdAt,
            dedup_hash: dedupHash,
          };
        }));

        const { data, error } = await supabase.from("pos_sales").upsert(batch, {
          onConflict: "dedup_hash",
          ignoreDuplicates: true,
        }).select("id");
        if (error) {
          errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          inserted += data?.length || 0;
        }
      }
    }

    if (type === "orders") {
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE).map((r: any) => ({
          customer_email: r.customer_email || r.email || "importado@sistema.com",
          customer_name: r.customer_name || r.cliente || null,
          items: r.items || r.itens || [],
          total: parseFloat(r.total || r.valor_total || "0") || 0,
          status: r.status || "delivered",
          payment_method: r.payment_method || r.forma_pagamento || null,
          payment_status: r.payment_status || r.status_pagamento || "paid",
          notes: r.notes || r.observacoes || null,
          created_at: r.created_at || r.data || new Date().toISOString(),
          shipping_address: r.shipping_address || r.endereco_entrega || null,
          external_id: r.external_id || r.id_externo || null,
        }));

        const { data, error } = await supabase.from("orders").insert(batch).select("id");
        if (error) {
          errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          inserted += data?.length || 0;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted,
        errors,
        batch_index,
        total_batches,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
