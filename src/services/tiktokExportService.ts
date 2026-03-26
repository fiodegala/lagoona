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

// Column indices (0-based) matching the template internal keys
const COL = {
  category: 0,
  brand: 1,
  product_name: 2,
  product_description: 3,
  main_image: 4,
  image_2: 5, image_3: 6, image_4: 7, image_5: 8, image_6: 9, image_7: 10, image_8: 11, image_9: 12,
  gtin_type: 13,
  gtin_code: 14,
  property_name_1: 15,
  property_value_1: 16,
  property_1_image: 17,
  property_name_2: 18,
  property_value_2: 19,
  parcel_weight: 20,
  parcel_length: 21,
  parcel_width: 22,
  parcel_height: 23,
  delivery: 24,
  price: 25,
  quantity: 26,
  seller_sku: 27,
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
  const cleaned = code.replace(/\D/g, '');
  return [8, 12, 13, 14].includes(cleaned.length);
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
            variation_id: pvv.variation_id,
            attribute_name: av.attrName,
            attribute_value: av.value,
          });
        }
      });
    }
  }

  return { products, categoryMap, variations, variationValuesMap };
}

function makeRow(cols: number): (string | number | null)[] {
  return new Array(cols).fill(null);
}

export async function exportProductsToTikTokXLSX(productIds?: string[]): Promise<void> {
  const { products, categoryMap, variations, variationValuesMap } = await loadExportData(productIds);

  // Fetch and clone the official template
  const response = await fetch('/templates/tiktok-template.xlsx');
  const arrayBuffer = await response.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets['Template'];

  // The template has: row1=internal keys, row2=version config, row3=PT headers, row4=required labels, row5=instructions, row6=example
  // We need to remove the example row (row 6) and add our data starting at row 6
  // In XLSX.js rows are 1-indexed in cell addresses

  // Build data rows
  const dataRows: (string | number | null)[][] = [];
  const NUM_COLS = 28;

  for (const product of products) {
    const categoryName = product.category_id ? (categoryMap[product.category_id] || '') : '';
    const productVariations = variations.filter(v => v.product_id === product.id);
    const images = getProductImages(product);
    const weightGrams = product.weight_kg ? Math.round(product.weight_kg * 1000) : 200;
    const baseSku = generateSKU(product.name);

    const fillBase = (row: (string | number | null)[]) => {
      row[COL.category] = categoryName;
      row[COL.brand] = '';
      row[COL.product_name] = product.name;
      row[COL.product_description] = product.description || product.name;
      row[COL.main_image] = images[0] || '';
      row[COL.image_2] = images[1] || '';
      row[COL.image_3] = images[2] || '';
      row[COL.image_4] = images[3] || '';
      row[COL.image_5] = images[4] || '';
      row[COL.image_6] = images[5] || '';
      row[COL.image_7] = images[6] || '';
      row[COL.image_8] = images[7] || '';
      row[COL.image_9] = images[8] || '';
      row[COL.gtin_type] = isValidGTIN(product.barcode) ? 'JAN' : '';
      row[COL.gtin_code] = isValidGTIN(product.barcode) ? product.barcode!.replace(/\D/g, '') : '';
      row[COL.parcel_weight] = weightGrams;
      row[COL.parcel_length] = product.depth_cm || 20;
      row[COL.parcel_width] = product.width_cm || 15;
      row[COL.parcel_height] = product.height_cm || 10;
      row[COL.delivery] = '';
    };

    if (productVariations.length === 0) {
      const row = makeRow(NUM_COLS);
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

        const row = makeRow(NUM_COLS);
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

  // Write data into the worksheet starting at row 6 (replacing the example row)
  // Cell addresses are 1-indexed, so row 6 = index 5 in 0-based
  const startRow = 6; // 1-indexed
  const colLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => 'A' + l)
  );

  // Remove example row data (row 6)
  for (let c = 0; c < NUM_COLS; c++) {
    const cellRef = colLetters[c] + '6';
    delete ws[cellRef];
  }

  // Write new data
  for (let r = 0; r < dataRows.length; r++) {
    const rowNum = startRow + r;
    for (let c = 0; c < NUM_COLS; c++) {
      const cellRef = colLetters[c] + rowNum;
      const value = dataRows[r][c];
      if (value !== null && value !== undefined && value !== '') {
        ws[cellRef] = { v: value, t: typeof value === 'number' ? 'n' : 's' };
      } else {
        delete ws[cellRef];
      }
    }
  }

  // Update the sheet range
  const lastRow = startRow + dataRows.length - 1;
  ws['!ref'] = `A1:AB${Math.max(lastRow, 6)}`;

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `tiktokshop-produtos-${date}.xlsx`);
}
