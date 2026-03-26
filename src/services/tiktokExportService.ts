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

const TIKTOK_HEADERS = [
  'Categoria',
  'Marca',
  'Nome do produto',
  'Descrição do produto',
  'Imagem principal',
  'Imagem 2',
  'Imagem 3',
  'Imagem 4',
  'Imagem 5',
  'Imagem 6',
  'Imagem 7',
  'Imagem do produto 8',
  'Imagem do produto 9',
  'Tipo de código identificador',
  'Código identificador',
  'Nome da variação principal (tema)',
  'Valor da variação principal (opcional)',
  'Imagem principal da variação 1',
  'Nome da variação secundária (tema)',
  'Valor da variação secundária (opcional)',
  'Peso do pacote(g)',
  'Comprimento do pacote(cm)',
  'Largura do pacote(cm)',
  'Altura do pacote(cm)',
  'Opções de entrega',
  'Preço de varejo (moeda local)',
  'Quantidade',
  'SKU do vendedor',
];

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

async function loadExportData(productIds?: string[]) {
  let query = supabase.from('products').select('*').eq('is_active', true).order('name');
  if (productIds && productIds.length > 0) query = query.in('id', productIds);
  const { data: productsData, error } = await query;
  if (error) throw error;
  const products = (productsData || []) as unknown as ExportProduct[];
  if (products.length === 0) throw new Error('Nenhum produto encontrado para exportar.');

  const productIdList = products.map(p => p.id);

  // Categories
  const categoryIds = [...new Set(products.map(p => p.category_id).filter(Boolean))] as string[];
  const categoryMap: Record<string, string> = {};
  if (categoryIds.length > 0) {
    const { data: cats } = await supabase.from('categories').select('id, name').in('id', categoryIds);
    (cats || []).forEach((c: { id: string; name: string }) => { categoryMap[c.id] = c.name; });
  }

  // Variations
  const { data: variationsData } = await supabase
    .from('product_variations').select('*').in('product_id', productIdList).order('sort_order');
  const variations = (variationsData || []) as unknown as ExportVariation[];

  // Variation values
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

function generateSKU(name: string, suffix?: string): string {
  const base = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 ]/g, '')
    .split(' ').filter(Boolean).slice(0, 3).map(w => w.slice(0, 4)).join('-');
  return suffix ? `${base}-${suffix}` : base;
}

export async function exportProductsToTikTokXLSX(productIds?: string[]): Promise<void> {
  const { products, categoryMap, variations, variationValuesMap } = await loadExportData(productIds);

  const rows: Record<string, string>[] = [];

  for (const product of products) {
    const categoryName = product.category_id ? (categoryMap[product.category_id] || '') : '';
    const productVariations = variations.filter(v => v.product_id === product.id);
    const images = getProductImages(product);
    const weightGrams = product.weight_kg ? Math.round(product.weight_kg * 1000) : 200;
    const baseSku = generateSKU(product.name);

    const baseRow: Record<string, string> = {
      'Categoria': categoryName,
      'Marca': '',
      'Nome do produto': product.name,
      'Descrição do produto': product.description || product.name,
      'Imagem principal': images[0] || '',
      'Imagem 2': images[1] || '',
      'Imagem 3': images[2] || '',
      'Imagem 4': images[3] || '',
      'Imagem 5': images[4] || '',
      'Imagem 6': images[5] || '',
      'Imagem 7': images[6] || '',
      'Imagem do produto 8': images[7] || '',
      'Imagem do produto 9': images[8] || '',
      'Tipo de código identificador': isValidGTIN(product.barcode) ? 'JAN' : '',
      'Código identificador': isValidGTIN(product.barcode) ? product.barcode!.replace(/\D/g, '') : '',
      'Peso do pacote(g)': String(weightGrams),
      'Comprimento do pacote(cm)': String(product.depth_cm || 20),
      'Largura do pacote(cm)': String(product.width_cm || 15),
      'Altura do pacote(cm)': String(product.height_cm || 10),
      'Opções de entrega': '',
    };

    if (productVariations.length === 0) {
      // Simple product - one row
      rows.push({
        ...baseRow,
        'Nome da variação principal (tema)': '',
        'Valor da variação principal (opcional)': '',
        'Imagem principal da variação 1': '',
        'Nome da variação secundária (tema)': '',
        'Valor da variação secundária (opcional)': '',
        'Preço de varejo (moeda local)': String(product.price),
        'Quantidade': String(product.stock || 0),
        'SKU do vendedor': baseSku,
      });
    } else {
      // Product with variations - one row per variation
      // Determine attribute structure (primary = first attr, secondary = second attr)
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
          : generateSKU(product.name, values.map(v => v.attribute_value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toUpperCase()).join('-'));

        rows.push({
          ...baseRow,
          'Nome da variação principal (tema)': primaryAttr,
          'Valor da variação principal (opcional)': primaryValue,
          'Imagem principal da variação 1': variation.image_url && variation.image_url !== 'null' ? variation.image_url : '',
          'Nome da variação secundária (tema)': secondaryAttr,
          'Valor da variação secundária (opcional)': secondaryValue,
          'Preço de varejo (moeda local)': String(variation.price || product.price),
          'Quantidade': String(variation.stock || 0),
          'SKU do vendedor': varSku,
        });
      }
    }
  }

  // Build XLSX
  const ws = XLSX.utils.json_to_sheet(rows, { header: TIKTOK_HEADERS });

  // Set column widths
  ws['!cols'] = TIKTOK_HEADERS.map(h => ({ wch: Math.max(h.length, 20) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `tiktokshop-produtos-${date}.xlsx`);
}
