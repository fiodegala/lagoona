import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface ExportProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  barcode: string | null;
  is_active: boolean;
  image_url: string | null;
  weight_kg: number | null;
  width_cm: number | null;
  height_cm: number | null;
  depth_cm: number | null;
  category_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface ExportVariation {
  id: string;
  product_id: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  stock: number;
  image_url: string | null;
  is_active: boolean;
}

interface ExportVariationValue {
  variation_id: string;
  attribute_name: string;
  attribute_value: string;
}

const COL = {
  category: 0, brand: 1, product_name: 2, product_description: 3,
  main_image: 4, image_2: 5, image_3: 6, image_4: 7, image_5: 8,
  image_6: 9, image_7: 10, image_8: 11, image_9: 12,
  gtin_type: 13, gtin_code: 14,
  property_name_1: 15, property_value_1: 16, property_1_image: 17,
  property_name_2: 18, property_value_2: 19,
  parcel_weight: 20, parcel_length: 21, parcel_width: 22, parcel_height: 23,
  delivery: 24, price: 25, quantity: 26, seller_sku: 27,
};

function getProductImages(product: ExportProduct): string[] {
  const images: string[] = [];
  if (product.image_url) images.push(product.image_url);
  const meta = product.metadata as Record<string, unknown> | null;
  if (meta?.additional_images && Array.isArray(meta.additional_images)) {
    (meta.additional_images as string[]).forEach(img => images.push(img));
  }
  return images.slice(0, 9);
}

function isValidGTIN(code: string | null | undefined): boolean {
  if (!code || code === 'null') return false;
  return [8, 12, 13, 14].includes(code.replace(/\D/g, '').length);
}

function generateSKU(name: string, suffix?: string): string {
  const base = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 ]/g, '')
    .split(' ').filter(Boolean).slice(0, 3).map(w => w.slice(0, 4)).join('-');
  return suffix ? `${base}-${suffix}` : base;
}

async function loadExportData(productIds?: string[]) {
  let query = supabase.from('products').select('*').eq('is_active', true).order('name');
  if (productIds && productIds.length > 0) query = query.in('id', productIds);
  const { data: productsData, error } = await query;
  if (error) throw error;
  const products = (productsData || []) as unknown as ExportProduct[];
  if (products.length === 0) throw new Error('Nenhum produto encontrado para exportar.');

  const productIdList = products.map(p => p.id);
  const categoryIds = [...new Set(products.map(p => p.category_id).filter(Boolean))] as string[];
  const categoryMap: Record<string, string> = {};
  if (categoryIds.length > 0) {
    const { data: cats } = await supabase.from('categories').select('id, name').in('id', categoryIds);
    (cats || []).forEach((c: { id: string; name: string }) => { categoryMap[c.id] = c.name; });
  }

  const { data: variationsData } = await supabase
    .from('product_variations').select('*').in('product_id', productIdList).order('sort_order');
  const variations = (variationsData || []) as unknown as ExportVariation[];

  const variationIds = variations.map(v => v.id);
  const variationValuesMap: Record<string, ExportVariationValue[]> = {};
  if (variationIds.length > 0) {
    const { data: pvvData } = await supabase
      .from('product_variation_values').select('variation_id, attribute_value_id').in('variation_id', variationIds);
    const attrValueIds = [...new Set((pvvData || []).map((v: { attribute_value_id: string }) => v.attribute_value_id))];
    if (attrValueIds.length > 0) {
      const { data: avData } = await supabase
        .from('product_attribute_values').select('id, value, attribute_id').in('id', attrValueIds);
      const attrIds = [...new Set((avData || []).map((a: { attribute_id: string }) => a.attribute_id))];
      const { data: attrsData } = await supabase.from('product_attributes').select('id, name').in('id', attrIds);
      const attrNameMap: Record<string, string> = {};
      (attrsData || []).forEach((a: { id: string; name: string }) => { attrNameMap[a.id] = a.name; });
      const avMap: Record<string, { value: string; attrName: string }> = {};
      (avData || []).forEach((a: { id: string; value: string; attribute_id: string }) => {
        avMap[a.id] = { value: a.value, attrName: attrNameMap[a.attribute_id] || 'Atributo' };
      });
      (pvvData || []).forEach((pvv: { variation_id: string; attribute_value_id: string }) => {
        if (!variationValuesMap[pvv.variation_id]) variationValuesMap[pvv.variation_id] = [];
        const av = avMap[pvv.attribute_value_id];
        if (av) {
          variationValuesMap[pvv.variation_id].push({
            variation_id: pvv.variation_id, attribute_name: av.attrName, attribute_value: av.value,
          });
        }
      });
    }
  }
  return { products, categoryMap, variations, variationValuesMap };
}

const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => 'A' + l)
);
const NUM_COLS = 28;

/**
 * Exports products into a TikTok Seller Center XLSX template.
 * The user must provide the template file (ArrayBuffer) downloaded from TikTok
 * for their specific product category.
 */
export async function exportProductsToTikTokXLSX(
  templateBuffer: ArrayBuffer,
  productIds?: string[],
): Promise<void> {
  const { products, categoryMap, variations, variationValuesMap } = await loadExportData(productIds);

  const wb = XLSX.read(templateBuffer, { type: 'array' });
  const ws = wb.Sheets['Template'];
  if (!ws) throw new Error('Aba "Template" não encontrada no arquivo. Verifique se é o template correto do TikTok.');

  // Detect where data starts: find the row with internal keys (row 1 has "category")
  // Template structure: row1=keys, row2=version, row3=headers, row4=required, row5=instructions, row6+=example/data
  // We clear from row 6 onwards and write our data there
  const startRow = 6;

  // Preserve the template's category value from row 6 (example row) before clearing
  const templateCategoryCell = ws['A' + startRow];
  const templateCategory = templateCategoryCell ? String(templateCategoryCell.v || '') : '';

  // Clear existing example/data rows
  const currentRef = ws['!ref'] || 'A1:AB6';
  const lastExistingRow = XLSX.utils.decode_range(currentRef).e.r + 1;
  for (let r = startRow; r <= lastExistingRow; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      delete ws[COL_LETTERS[c] + r];
    }
  }

  // Build data rows
  const dataRows: (string | number | null)[][] = [];

  for (const product of products) {
    const categoryName = product.category_id ? (categoryMap[product.category_id] || '') : '';
    const productVariations = variations.filter(v => v.product_id === product.id);
    const images = getProductImages(product);
    const weightGrams = product.weight_kg ? Math.round(product.weight_kg * 1000) : 200;
    const baseSku = generateSKU(product.name);

    const fillBase = (row: (string | number | null)[]) => {
      row[COL.category] = templateCategory;
      row[COL.brand] = '';
      row[COL.product_name] = product.name;
      row[COL.product_description] = product.description || product.name;
      for (let i = 0; i < 9; i++) row[COL.main_image + i] = images[i] || '';
      row[COL.gtin_type] = isValidGTIN(product.barcode) ? 'JAN' : '';
      row[COL.gtin_code] = isValidGTIN(product.barcode) ? product.barcode!.replace(/\D/g, '') : '';
      row[COL.parcel_weight] = weightGrams;
      row[COL.parcel_length] = product.depth_cm || 20;
      row[COL.parcel_width] = product.width_cm || 15;
      row[COL.parcel_height] = product.height_cm || 10;
      row[COL.delivery] = '';
    };

    if (productVariations.length === 0) {
      const row = new Array(NUM_COLS).fill(null);
      fillBase(row);
      row[COL.price] = product.price;
      row[COL.quantity] = product.stock || 0;
      row[COL.seller_sku] = baseSku;
      dataRows.push(row);
    } else {
      const allAttrNames = new Set<string>();
      productVariations.forEach(v => {
        (variationValuesMap[v.id] || []).forEach(val => allAttrNames.add(val.attribute_name));
      });
      const attrNames = Array.from(allAttrNames);
      const primaryAttr = attrNames[0] || '';
      const secondaryAttr = attrNames[1] || '';

      for (const variation of productVariations) {
        const values = variationValuesMap[variation.id] || [];
        const primaryValue = values.find(v => v.attribute_name === primaryAttr)?.attribute_value || '';
        const secondaryValue = secondaryAttr ? (values.find(v => v.attribute_name === secondaryAttr)?.attribute_value || '') : '';
        const varSku = variation.sku && variation.sku !== 'null'
          ? variation.sku
          : generateSKU(product.name, values.map(v =>
              v.attribute_value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toUpperCase()
            ).join('-'));

        const row = new Array(NUM_COLS).fill(null);
        fillBase(row);
        row[COL.property_name_1] = primaryAttr;
        row[COL.property_value_1] = primaryValue;
        row[COL.property_1_image] = variation.image_url && variation.image_url !== 'null' ? variation.image_url : '';
        row[COL.property_name_2] = secondaryAttr;
        row[COL.property_value_2] = secondaryValue;
        row[COL.price] = variation.price || product.price;
        row[COL.quantity] = variation.stock || 0;
        row[COL.seller_sku] = varSku;
        dataRows.push(row);
      }
    }
  }

  // Write data into worksheet
  for (let r = 0; r < dataRows.length; r++) {
    const rowNum = startRow + r;
    for (let c = 0; c < NUM_COLS; c++) {
      const cellRef = COL_LETTERS[c] + rowNum;
      const value = dataRows[r][c];
      if (value !== null && value !== undefined && value !== '') {
        ws[cellRef] = { v: value, t: typeof value === 'number' ? 'n' : 's' };
      }
    }
  }

  const lastRow = startRow + dataRows.length - 1;
  ws['!ref'] = `A1:AB${Math.max(lastRow, 6)}`;

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `tiktokshop-produtos-${date}.xlsx`);
}
