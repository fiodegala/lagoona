import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Category name mapping from old system to current DB
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
  attributes: string; // JSON string
  sku: string | null;
  barcode: string | null;
  price: number | null;
  stock: number;
  image_url: string | null;
  price_varejo: number | null;
  price_atacado: number | null;
  price_atacarejo: number | null;
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

    // 1. Load all categories
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name");

    const categoryByName: Record<string, string> = {};
    for (const cat of categories || []) {
      categoryByName[cat.name.toUpperCase().trim()] = cat.id;
    }

    // 2. Insert products
    let productsInserted = 0;
    let productsSkipped = 0;
    const oldToNewProductId: Record<string, string> = {};

    for (const p of products as OldProduct[]) {
      // Map category
      let categoryId: string | null = null;
      if (p.category && p.category !== "null") {
        const mappedName = CATEGORY_MAP[p.category.trim()] || p.category.trim();
        categoryId = categoryByName[mappedName.toUpperCase().trim()] || null;
      }

      const price = p.price_varejo || p.price || 0;

      const insertData = {
        name: p.name,
        price: price,
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
        depth_cm: 20, // default from old data
        metadata: {} as Record<string, unknown>,
      };

      if (p.slug) {
        insertData.metadata = { slug: p.slug };
      }

      const { data: newProduct, error } = await supabase
        .from("products")
        .insert(insertData)
        .select("id")
        .single();

      if (error) {
        console.error(`Error inserting product ${p.name}:`, error.message);
        productsSkipped++;
        continue;
      }

      oldToNewProductId[p.id] = newProduct.id;
      productsInserted++;
    }

    // 3. Group variations by product_id
    const variationsByProduct: Record<string, OldVariation[]> = {};
    for (const v of variations as OldVariation[]) {
      if (!variationsByProduct[v.product_id]) {
        variationsByProduct[v.product_id] = [];
      }
      variationsByProduct[v.product_id].push(v);
    }

    // 4. Insert variations with attributes
    let variationsInserted = 0;
    let variationsSkipped = 0;

    for (const [oldProductId, vars] of Object.entries(variationsByProduct)) {
      const newProductId = oldToNewProductId[oldProductId];
      if (!newProductId) {
        variationsSkipped += vars.length;
        continue;
      }

      // Parse unique attribute names from first variation
      const firstAttrs = parseAttributes(vars[0].attributes);
      const attrNames = firstAttrs.map((a) => a.name);

      // Create product_attributes
      const attrIdByName: Record<string, string> = {};
      for (const attrName of attrNames) {
        const { data: attr, error } = await supabase
          .from("product_attributes")
          .insert({ product_id: newProductId, name: attrName })
          .select("id")
          .single();
        if (error) {
          console.error(`Error creating attr ${attrName}:`, error.message);
          continue;
        }
        attrIdByName[attrName] = attr.id;
      }

      // Collect unique attribute values per attribute
      const uniqueValues: Record<string, Set<string>> = {};
      for (const attrName of attrNames) {
        uniqueValues[attrName] = new Set();
      }
      for (const v of vars) {
        const attrs = parseAttributes(v.attributes);
        for (const a of attrs) {
          uniqueValues[a.name]?.add(a.value.trim());
        }
      }

      // Create attribute values
      const attrValueId: Record<string, string> = {}; // "attrName|value" -> id
      for (const [attrName, values] of Object.entries(uniqueValues)) {
        const attrId = attrIdByName[attrName];
        if (!attrId) continue;
        for (const val of values) {
          const { data: av, error } = await supabase
            .from("product_attribute_values")
            .insert({ attribute_id: attrId, value: val })
            .select("id")
            .single();
          if (error) {
            console.error(`Error creating attr value ${val}:`, error.message);
            continue;
          }
          attrValueId[`${attrName}|${val}`] = av.id;
        }
      }

      // Create variations
      let sortOrder = 0;
      for (const v of vars) {
        const price = v.price_varejo || v.price || null;
        const { data: newVar, error } = await supabase
          .from("product_variations")
          .insert({
            product_id: newProductId,
            price: price,
            stock: v.stock || 0,
            is_active: true,
            sku: v.sku || null,
            barcode: v.barcode || null,
            image_url: v.image_url && v.image_url !== "null" ? v.image_url : null,
            wholesale_price: v.price_atacado || null,
            exclusive_price: v.price_atacarejo || null,
            sort_order: sortOrder++,
          })
          .select("id")
          .single();

        if (error) {
          console.error(`Error creating variation:`, error.message);
          variationsSkipped++;
          continue;
        }

        // Link variation values
        const attrs = parseAttributes(v.attributes);
        for (const a of attrs) {
          const avId = attrValueId[`${a.name}|${a.value.trim()}`];
          if (avId) {
            await supabase.from("product_variation_values").insert({
              variation_id: newVar.id,
              attribute_value_id: avId,
            });
          }
        }

        variationsInserted++;
      }
    }

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

function parseAttributes(
  attrStr: string
): Array<{ name: string; value: string }> {
  try {
    if (!attrStr || attrStr === "null") return [];
    // Handle CSV-escaped JSON: replace "" with "
    const cleaned = attrStr.replace(/""/g, '"');
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}
