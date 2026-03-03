import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORY_MAP: Record<string, string> = {
  "CALÇA JEANS SLIM": "CALÇA JEANS SLIM",
  "SAPATOS": "SAPATO",
  "CAMISETA BÁSICA": "CAMISETA BÁSICA",
  "GOLA MÉDIA": "GOLA MÉDIA",
  "GOLA POLO": "GOLA POLO",
  "CAMISA MANGA LONGA": "CAMISA MANGA LONGA",
  "CAMISA MANGA CURTA": "CAMISA MANGA CURTA",
  "BERMUDA JEANS": "BERMUDA JEANS",
  "ASSESSÓRIOS": "ASSESSÓRIOS",
  "BERMUDA ALFAIATARIA": "BERMUDA ALFAIATARIA",
  "CALÇA ALFAIATARIA": "CALÇA ALFAIATARIA",
  "CALÇA CIGARRETE": "CALÇA CIGARRETE",
  "BLAZER": "BLAZER",
  "CINTO": "CINTO",
  "CUECA FDG": "CUECA",
  "CUECA": "CUECA",
  "CALÇA SOCIAL": "CALÇA SOCIAL DE REGULAGEM",
  "CALÇA JEANS TRADICIONAL": "CALÇA JEANS TRADICIONAL",
  "BONÉS": "BONÉ",
  "PROMOÇÕES": "PROMOÇÕES",
  "SHORT": "SHORT LINHO",
  "MEIA": "MEIAS",
  "GOLA MÉDIA TEXTURIZADA": "GOLA MÉDIA TEXTURIZADA",
  "BLAZER CASUAL": "BLAZER CASUAL",
  "SHORT TECH": "SHORT TECH",
  "SHORT TECH VELUDO": "SHORT TECH VELUDO",
};

interface OldProduct {
  id: string;
  name: string;
  category: string | null;
  barcode: string;
  price: number;
  stock: number;
  min_stock: number;
  active: boolean;
  image_url: string | null;
  price_varejo: number | null;
  price_atacado: number | null;
  price_atacarejo: number | null;
  weight: number | null;
  height: number | null;
  width: number | null;
  slug: string | null;
}

interface OldVariation {
  id: string;
  product_id: string;
  attributes: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  stock: number;
  image_url: string | null;
  price_varejo: number | null;
  price_atacado: number | null;
  price_atacarejo: number | null;
}

function parseAttributes(attrStr: string): Array<{ name: string; value: string }> {
  try {
    if (!attrStr || attrStr === "null") return [];
    const cleaned = attrStr.replace(/""/g, '"');
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { products, variations } = await req.json();

    console.log(`Received ${products.length} products and ${variations.length} variations`);

    // 1. Load all categories
    const { data: categories } = await supabase.from("categories").select("id, name");
    const categoryByName: Record<string, string> = {};
    for (const cat of categories || []) {
      categoryByName[cat.name.toUpperCase().trim()] = cat.id;
    }

    // 2. Batch insert products (chunks of 20)
    let productsInserted = 0;
    let productsSkipped = 0;
    const oldToNewProductId: Record<string, string> = {};

    const productChunks = chunkArray(products as OldProduct[], 20);
    for (const chunk of productChunks) {
      const insertRows = chunk.map((p) => {
        let categoryId: string | null = null;
        if (p.category && p.category !== "null") {
          const mappedName = CATEGORY_MAP[p.category.trim()] || p.category.trim();
          categoryId = categoryByName[mappedName.toUpperCase().trim()] || null;
        }
        const price = p.price_varejo || p.price || 0;
        return {
          name: p.name,
          price,
          stock: p.stock || 0,
          min_stock: p.min_stock || 0,
          category_id: categoryId,
          image_url: p.image_url && p.image_url !== "" ? p.image_url : null,
          is_active: p.active !== false,
          barcode: p.barcode || null,
          wholesale_price: p.price_atacado || null,
          exclusive_price: p.price_atacarejo || null,
          promotional_price: null as number | null,
          weight_kg: p.weight || null,
          width_cm: p.width || null,
          height_cm: p.height || null,
          depth_cm: 20,
          metadata: p.slug ? { slug: p.slug } : {},
        };
      });

      const { data: inserted, error } = await supabase
        .from("products")
        .insert(insertRows)
        .select("id");

      if (error) {
        console.error(`Batch product insert error:`, error.message);
        productsSkipped += chunk.length;
        continue;
      }

      // Map old IDs to new IDs (maintain order)
      for (let i = 0; i < chunk.length; i++) {
        if (inserted[i]) {
          oldToNewProductId[chunk[i].id] = inserted[i].id;
          productsInserted++;
        }
      }
    }

    console.log(`Products inserted: ${productsInserted}, skipped: ${productsSkipped}`);

    // 3. Group variations by product_id
    const variationsByProduct: Record<string, OldVariation[]> = {};
    for (const v of variations as OldVariation[]) {
      if (!variationsByProduct[v.product_id]) {
        variationsByProduct[v.product_id] = [];
      }
      variationsByProduct[v.product_id].push(v);
    }

    // 4. Process variations per product
    let variationsInserted = 0;
    let variationsSkipped = 0;

    for (const [oldProductId, vars] of Object.entries(variationsByProduct)) {
      const newProductId = oldToNewProductId[oldProductId];
      if (!newProductId) {
        variationsSkipped += vars.length;
        continue;
      }

      // Parse unique attribute names
      const firstAttrs = parseAttributes(vars[0].attributes);
      const attrNames = firstAttrs.map((a) => a.name);

      if (attrNames.length === 0) {
        variationsSkipped += vars.length;
        continue;
      }

      // Batch insert attributes
      const attrInsertRows = attrNames.map((name) => ({ product_id: newProductId, name }));
      const { data: createdAttrs, error: attrErr } = await supabase
        .from("product_attributes")
        .insert(attrInsertRows)
        .select("id, name");

      if (attrErr || !createdAttrs) {
        console.error(`Attr insert error for product ${newProductId}:`, attrErr?.message);
        variationsSkipped += vars.length;
        continue;
      }

      const attrIdByName: Record<string, string> = {};
      for (const a of createdAttrs) {
        attrIdByName[a.name] = a.id;
      }

      // Collect unique values per attribute
      const uniqueValues: Record<string, Set<string>> = {};
      for (const name of attrNames) uniqueValues[name] = new Set();
      for (const v of vars) {
        for (const a of parseAttributes(v.attributes)) {
          uniqueValues[a.name]?.add(a.value.trim());
        }
      }

      // Batch insert attribute values
      const avInsertRows: Array<{ attribute_id: string; value: string }> = [];
      for (const [attrName, values] of Object.entries(uniqueValues)) {
        const attrId = attrIdByName[attrName];
        if (!attrId) continue;
        for (const val of values) {
          avInsertRows.push({ attribute_id: attrId, value: val });
        }
      }

      const { data: createdAVs, error: avErr } = await supabase
        .from("product_attribute_values")
        .insert(avInsertRows)
        .select("id, attribute_id, value");

      if (avErr || !createdAVs) {
        console.error(`Attr value insert error:`, avErr?.message);
        variationsSkipped += vars.length;
        continue;
      }

      // Build lookup: "attrName|value" -> attribute_value_id
      const attrValueId: Record<string, string> = {};
      const attrIdToName: Record<string, string> = {};
      for (const a of createdAttrs) attrIdToName[a.id] = a.name;
      for (const av of createdAVs) {
        const aName = attrIdToName[av.attribute_id];
        if (aName) attrValueId[`${aName}|${av.value}`] = av.id;
      }

      // Batch insert variations (chunks of 20)
      const varChunks = chunkArray(vars, 20);
      let sortOrder = 0;
      for (const varChunk of varChunks) {
        const varInsertRows = varChunk.map((v) => ({
          product_id: newProductId,
          price: v.price_varejo || v.price || null,
          stock: v.stock || 0,
          is_active: true,
          sku: v.sku || null,
          barcode: v.barcode || null,
          image_url: v.image_url && v.image_url !== "null" ? v.image_url : null,
          wholesale_price: v.price_atacado || null,
          exclusive_price: v.price_atacarejo || null,
          sort_order: sortOrder++,
        }));

        const { data: createdVars, error: varErr } = await supabase
          .from("product_variations")
          .insert(varInsertRows)
          .select("id");

        if (varErr || !createdVars) {
          console.error(`Variation insert error:`, varErr?.message);
          variationsSkipped += varChunk.length;
          continue;
        }

        // Batch insert variation_values
        const vvInsertRows: Array<{ variation_id: string; attribute_value_id: string }> = [];
        for (let i = 0; i < varChunk.length; i++) {
          if (!createdVars[i]) continue;
          const attrs = parseAttributes(varChunk[i].attributes);
          for (const a of attrs) {
            const avId = attrValueId[`${a.name}|${a.value.trim()}`];
            if (avId) {
              vvInsertRows.push({ variation_id: createdVars[i].id, attribute_value_id: avId });
            }
          }
        }

        if (vvInsertRows.length > 0) {
          const { error: vvErr } = await supabase
            .from("product_variation_values")
            .insert(vvInsertRows);
          if (vvErr) {
            console.error(`Variation values insert error:`, vvErr.message);
          }
        }

        variationsInserted += createdVars.length;
      }
    }

    console.log(`Variations inserted: ${variationsInserted}, skipped: ${variationsSkipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        productsInserted,
        productsSkipped,
        variationsInserted,
        variationsSkipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
