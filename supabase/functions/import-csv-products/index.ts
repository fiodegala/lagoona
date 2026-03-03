import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseAttributes(attrStr: string): Array<{ name: string; value: string }> {
  try {
    if (!attrStr || attrStr === 'null' || attrStr.trim() === '') return [];
    const parsed = JSON.parse(attrStr);
    if (Array.isArray(parsed)) return parsed.filter((a: any) => a && a.name);
    return [];
  } catch {
    try {
      const alt = attrStr.replace(/^"/, '').replace(/"$/, '').replace(/""/g, '"');
      const parsed = JSON.parse(alt);
      if (Array.isArray(parsed)) return parsed.filter((a: any) => a && a.name);
      return [];
    } catch {
      console.error(`Failed to parse attributes: ${attrStr.substring(0, 100)}`);
      return [];
    }
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface CSVProduct {
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
  weight: number | null;
  length: number | null;
  height: number | null;
  width: number | null;
  category: string | null;
  slug: string | null;
  is_sale: boolean;
  is_launch: boolean;
}

interface CSVVariation {
  attributes: Array<{ name: string; value: string }>;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  stock: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { csvContent } = await req.json();
    if (!csvContent) {
      return new Response(JSON.stringify({ error: "csvContent is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lines = csvContent.split('\n').filter((l: string) => l.trim());
    const headers = parseCSVLine(lines[0]);
    const hMap: Record<string, number> = {};
    headers.forEach((h, i) => { hMap[h.trim()] = i; });

    // Parse rows into products and variations
    const productsMap: Record<string, { product: CSVProduct; variations: CSVVariation[] }> = {};

    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      const get = (key: string) => vals[hMap[key]]?.trim() || '';
      const tipo = get('tipo');

      if (tipo === 'PRODUTO') {
        const name = get('name');
        const id = get('id');
        productsMap[id] = {
          product: {
            name,
            price: parseFloat(get('price')) || 0,
            stock: parseInt(get('stock')) || 0,
            barcode: get('barcode') || null,
            weight: parseFloat(get('weight')) || null,
            length: parseFloat(get('length')) || null,
            height: parseFloat(get('height')) || null,
            width: parseFloat(get('width')) || null,
            category: get('category') !== 'null' ? get('category') : null,
            slug: get('slug') !== 'null' ? get('slug') : null,
            is_sale: get('is_sale') === 'true',
            is_launch: get('is_launch') === 'true',
          },
          variations: [],
        };
      } else if (tipo === 'VARIAÇÃO') {
        const productId = get('product_id') || get('id');
        if (!productsMap[productId]) {
          // Create a placeholder product entry
          productsMap[productId] = {
            product: {
              name: get('name'),
              price: parseFloat(get('price')) || 0,
              stock: parseInt(get('stock')) || 0,
              barcode: get('barcode') || null,
              weight: parseFloat(get('weight')) || null,
              length: parseFloat(get('length')) || null,
              height: parseFloat(get('height')) || null,
              width: parseFloat(get('width')) || null,
              category: get('category') !== 'null' ? get('category') : null,
              slug: get('slug') !== 'null' ? get('slug') : null,
              is_sale: get('is_sale') === 'true',
              is_launch: get('is_launch') === 'true',
            },
            variations: [],
          };
        }

        const attrsStr = get('attributes');
        const attrs = parseAttributes(attrsStr);

        productsMap[productId].variations.push({
          attributes: attrs,
          sku: get('sku_variation') || null,
          barcode: get('barcode_variation') || null,
          price: parseFloat(get('price_variation')) || null,
          stock: parseInt(get('stock_variation')) || 0,
        });
      }
    }

    console.log(`Parsed ${Object.keys(productsMap).length} products from CSV`);

    // Load categories
    const { data: categories } = await supabase.from("categories").select("id, name");
    const categoryByName: Record<string, string> = {};
    for (const cat of categories || []) {
      categoryByName[cat.name.toUpperCase().trim()] = cat.id;
    }

    // Load stores
    const { data: stores } = await supabase.from("stores").select("id, name, type");
    const bernardoId = stores?.find((s: any) => s.name.includes("Bernardo"))?.id;
    const hyperId = stores?.find((s: any) => s.name.includes("Hyper"))?.id;

    let productsInserted = 0;
    let productsSkipped = 0;
    let variationsInserted = 0;
    let variationsSkipped = 0;
    let stockInserted = 0;
    const stockEntries: Array<{ store_id: string; product_id: string; variation_id: string | null; quantity: number }> = [];

    for (const [_oldId, entry] of Object.entries(productsMap)) {
      const p = entry.product;

      // Map category
      let categoryId: string | null = null;
      if (p.category) {
        categoryId = categoryByName[p.category.toUpperCase().trim()] || null;
        if (!categoryId) {
          console.log(`Category not found: "${p.category}", will be null`);
        }
      }

      // Build metadata
      const metadata: Record<string, any> = {};
      if (p.slug) metadata.slug = p.slug;
      if (p.is_sale) metadata.is_sale = true;
      if (p.is_launch) metadata.is_launch = true;

      // Insert product
      const { data: inserted, error: prodErr } = await supabase
        .from("products")
        .insert({
          name: p.name,
          price: p.price,
          stock: p.stock,
          min_stock: 0,
          category_id: categoryId,
          is_active: true,
          barcode: p.barcode,
          weight_kg: p.weight,
          width_cm: p.width,
          height_cm: p.height,
          depth_cm: p.length || 20,
          metadata,
          promotional_price: p.is_sale ? p.price : null,
        })
        .select("id")
        .single();

      if (prodErr || !inserted) {
        console.error(`Product insert error for "${p.name}":`, prodErr?.message);
        productsSkipped++;
        continue;
      }

      const newProductId = inserted.id;
      productsInserted++;
      console.log(`Inserted product "${p.name}" -> ${newProductId}`);

      // Process variations
      const vars = entry.variations;
      if (vars.length === 0) {
        // Simple product - add stock
        if (p.stock > 0 && bernardoId && hyperId) {
          const half1 = Math.ceil(p.stock / 2);
          const half2 = p.stock - half1;
          stockEntries.push({ store_id: bernardoId, product_id: newProductId, variation_id: null, quantity: half1 });
          stockEntries.push({ store_id: hyperId, product_id: newProductId, variation_id: null, quantity: half2 });
        }
        continue;
      }

      // Collect unique attribute names and values
      const allAttrNames = new Set<string>();
      const uniqueValues: Record<string, Set<string>> = {};
      for (const v of vars) {
        for (const a of v.attributes) {
          if (a.name) {
            allAttrNames.add(a.name);
            if (!uniqueValues[a.name]) uniqueValues[a.name] = new Set();
            uniqueValues[a.name].add(a.value?.trim() || "(sem valor)");
          }
        }
      }

      const attrNames = [...allAttrNames];
      if (attrNames.length === 0) {
        console.log(`No attributes found for variations of "${p.name}", skipping attribute creation`);
        variationsSkipped += vars.length;
        continue;
      }

      // Insert attributes
      const attrInsertRows = attrNames.map((name) => ({ product_id: newProductId, name }));
      const { data: createdAttrs, error: attrErr } = await supabase
        .from("product_attributes")
        .insert(attrInsertRows)
        .select("id, name");

      if (attrErr || !createdAttrs) {
        console.error(`Attr insert error:`, attrErr?.message);
        variationsSkipped += vars.length;
        continue;
      }

      const attrIdByName: Record<string, string> = {};
      for (const a of createdAttrs) attrIdByName[a.name] = a.id;

      // Insert attribute values
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
      const attrIdToName: Record<string, string> = {};
      for (const a of createdAttrs) attrIdToName[a.id] = a.name;
      const attrValueId: Record<string, string> = {};
      for (const av of createdAVs) {
        const aName = attrIdToName[av.attribute_id];
        if (aName) attrValueId[`${aName}|${av.value}`] = av.id;
      }

      // Insert variations in chunks
      const varChunks = chunkArray(vars, 20);
      let sortOrder = 0;
      for (const varChunk of varChunks) {
        const varInsertRows = varChunk.map((v) => ({
          product_id: newProductId,
          price: v.price || p.price || null,
          stock: v.stock || 0,
          is_active: true,
          sku: v.sku || null,
          barcode: v.barcode || null,
          image_url: null,
          wholesale_price: null,
          exclusive_price: null,
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

        // Link variation values
        const vvInsertRows: Array<{ variation_id: string; attribute_value_id: string }> = [];
        for (let i = 0; i < varChunk.length; i++) {
          if (!createdVars[i]) continue;
          for (const a of varChunk[i].attributes) {
            const lookupValue = a.value?.trim() || "(sem valor)";
            const avId = attrValueId[`${a.name}|${lookupValue}`];
            if (avId) {
              vvInsertRows.push({ variation_id: createdVars[i].id, attribute_value_id: avId });
            }
          }

          // Stock distribution 50/50
          const stock = varChunk[i].stock || 0;
          if (stock > 0 && bernardoId && hyperId) {
            const half1 = Math.ceil(stock / 2);
            const half2 = stock - half1;
            stockEntries.push({ store_id: bernardoId, product_id: newProductId, variation_id: createdVars[i].id, quantity: half1 });
            stockEntries.push({ store_id: hyperId, product_id: newProductId, variation_id: createdVars[i].id, quantity: half2 });
          }
        }

        if (vvInsertRows.length > 0) {
          const { error: vvErr } = await supabase
            .from("product_variation_values")
            .insert(vvInsertRows);
          if (vvErr) console.error(`Variation values insert error:`, vvErr.message);
        }

        variationsInserted += createdVars.length;
      }
    }

    // Batch insert store_stock
    if (stockEntries.length > 0) {
      const stockChunks = chunkArray(stockEntries, 50);
      for (const chunk of stockChunks) {
        const { error: stockErr } = await supabase.from("store_stock").insert(chunk);
        if (stockErr) {
          console.error(`Stock insert error:`, stockErr.message);
        } else {
          stockInserted += chunk.length;
        }
      }
    }

    console.log(`Done! Products: ${productsInserted}, Variations: ${variationsInserted}, Stock entries: ${stockInserted}`);

    return new Response(
      JSON.stringify({
        success: true,
        productsInserted,
        productsSkipped,
        variationsInserted,
        variationsSkipped,
        stockInserted,
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
