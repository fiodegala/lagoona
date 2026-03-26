import { supabase } from '@/integrations/supabase/client';

interface ExportProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  min_stock: number;
  barcode: string | null;
  is_active: boolean;
  image_url: string | null;
  weight_kg: number | null;
  width_cm: number | null;
  height_cm: number | null;
  depth_cm: number | null;
  wholesale_price: number | null;
  promotional_price: number | null;
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
  promotional_price: number | null;
  wholesale_price: number | null;
}

interface ExportVariationValue {
  variation_id: string;
  attribute_name: string;
  attribute_value: string;
}

interface CategoryMap {
  [id: string]: string;
}

const CSV_HEADERS = [
  'ID', 'Código (SKU)', 'Descrição', 'Unidade', 'NCM (Classificação fiscal)',
  'Origem', 'Preço', 'Valor IPI fixo', 'Observações', 'Situação', 'Estoque',
  'Preço de custo', 'Cód do fornecedor', 'Fornecedor', 'Localização',
  'Estoque máximo', 'Estoque mínimo', 'Peso líquido (Kg)', 'Peso bruto (Kg)',
  'GTIN/EAN', 'GTIN/EAN tributável', 'Descrição complementar', 'CEST',
  'Código de Enquadramento IPI', 'Formato embalagem', 'Largura embalagem',
  'Altura Embalagem', 'Comprimento embalagem', 'Diâmetro embalagem',
  'Tipo do produto', 'URL imagem 1', 'URL imagem 2', 'URL imagem 3',
  'URL imagem 4', 'URL imagem 5', 'URL imagem 6', 'Categoria',
  'Código do pai', 'Variações', 'Marca', 'Garantia', 'Sob encomenda',
  'Preço promocional', 'URL imagem externa 1', 'URL imagem externa 2',
  'URL imagem externa 3', 'URL imagem externa 4', 'URL imagem externa 5',
  'URL imagem externa 6', 'Link do vídeo', 'Título SEO', 'Descrição SEO',
  'Palavras chave SEO', 'Slug', 'Dias para preparação', 'Controlar lotes',
  'Unidade por caixa', 'URL imagem externa 7', 'URL imagem externa 8',
  'URL imagem externa 9', 'URL imagem externa 10', 'Markup',
  'Permitir inclusão nas vendas', 'EX TIPI',
];

function escapeCSV(value: string): string {
  if (value === null || value === undefined || value === 'null' || value === 'undefined') return '""';
  if (!value) return '""';
  const escaped = String(value).replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatPrice(value: number | null | undefined): string {
  if (!value && value !== 0) return '';
  return value.toFixed(2).replace('.', ',');
}

function formatWeight(value: number | null | undefined): string {
  if (!value || value === 0) return '';
  return String(value).replace('.', ',');
}

function formatDimension(value: number | null | undefined): string {
  if (!value || value === 0) return '';
  return String(value);
}

function isValidGTIN(code: string | null | undefined): boolean {
  if (!code || code === 'null') return false;
  const cleaned = code.replace(/\D/g, '');
  return [8, 12, 13, 14].includes(cleaned.length);
}

function formatGTIN(code: string | null | undefined): string {
  if (!isValidGTIN(code)) return '';
  return code!.replace(/\D/g, '');
}

function generateSKU(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .map(w => w.slice(0, 4))
    .join('-');
}

function buildCategoryPath(categoryName: string | null): string {
  return categoryName || '';
}

function buildParentRow(
  product: ExportProduct,
  sku: string,
  categoryName: string | null,
  images: string[],
): string[] {
  const row = new Array(CSV_HEADERS.length).fill('');
  row[0] = ''; // ID
  row[1] = sku; // SKU
  row[2] = product.name; // Descrição
  row[3] = 'Un'; // Unidade
  row[4] = ''; // NCM
  row[5] = '0'; // Origem
  row[6] = formatPrice(product.price); // Preço
  row[7] = ''; // IPI
  row[8] = ''; // Observações
  row[9] = product.is_active ? 'Ativo' : 'Inativo'; // Situação
  row[10] = String(product.stock || 0); // Estoque
  row[11] = ''; // Preço custo
  row[12] = ''; // Cód fornecedor
  row[13] = ''; // Fornecedor
  row[14] = ''; // Localização
  row[15] = ''; // Estoque máx
  row[16] = product.min_stock ? String(product.min_stock) : ''; // Estoque mín
  row[17] = formatWeight(product.weight_kg); // Peso líq
  row[18] = formatWeight(product.weight_kg); // Peso bruto
  row[19] = formatGTIN(product.barcode); // GTIN
  row[20] = ''; // GTIN tributável
  row[21] = product.description || ''; // Desc complementar
  row[22] = ''; // CEST
  row[23] = ''; // Enquadramento IPI
  row[24] = 'Pacote / Caixa'; // Formato embalagem
  row[25] = formatDimension(product.width_cm); // Largura
  row[26] = formatDimension(product.height_cm); // Altura
  row[27] = formatDimension(product.depth_cm); // Comprimento
  row[28] = ''; // Diâmetro
  row[29] = 'V'; // Tipo produto
  images.forEach((img, i) => { if (i < 6) row[30 + i] = img; });
  row[36] = buildCategoryPath(categoryName); // Categoria
  row[37] = ''; // Código do pai
  row[38] = ''; // Variações
  row[39] = ''; // Marca
  row[40] = ''; // Garantia
  row[41] = 'Não'; // Sob encomenda
  row[42] = formatPrice(product.promotional_price); // Preço promo
  row[62] = 'Sim'; // Permitir inclusão nas vendas
  return row;
}

function buildSimpleRow(
  product: ExportProduct,
  sku: string,
  categoryName: string | null,
  images: string[],
): string[] {
  const row = buildParentRow(product, sku, categoryName, images);
  row[29] = 'S';
  return row;
}

function buildVariationRow(
  product: ExportProduct,
  variation: ExportVariation,
  parentSku: string,
  variationValues: ExportVariationValue[],
  categoryName: string | null,
): string[] {
  const row = new Array(CSV_HEADERS.length).fill('');
  const varSku = variation.sku && variation.sku !== 'null' 
    ? variation.sku 
    : `${parentSku}-${variationValues.map(v => v.attribute_value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toUpperCase()).join('-')}`;
  const varDesc = variationValues.map(v => v.attribute_value).join(' ');
  
  row[0] = ''; // ID
  row[1] = varSku; // SKU
  row[2] = `${product.name} - ${varDesc}`; // Descrição
  row[3] = 'Un';
  row[5] = '0';
  row[6] = formatPrice(variation.price || product.price);
  row[9] = variation.is_active ? 'Ativo' : 'Inativo';
  row[10] = String(variation.stock || 0);
  row[17] = formatWeight(product.weight_kg);
  row[18] = formatWeight(product.weight_kg);
  row[19] = formatGTIN(variation.barcode);
  row[21] = product.description || '';
  row[24] = 'Pacote / Caixa';
  row[25] = formatDimension(product.width_cm);
  row[26] = formatDimension(product.height_cm);
  row[27] = formatDimension(product.depth_cm);
  row[28] = '';
  row[29] = 'S'; // Tipo variação
  if (variation.image_url && variation.image_url !== 'null') row[30] = variation.image_url;
  row[36] = buildCategoryPath(categoryName);
  row[37] = parentSku; // Código do pai
  row[38] = variationValues.map(v => `${v.attribute_name}:${v.attribute_value}`).join('||');
  row[41] = 'Não';
  row[42] = formatPrice(variation.promotional_price);
  row[62] = 'Sim';
  return row;
}

export async function exportProductsToTinyCSV(productIds?: string[]): Promise<string> {
  // 1. Load products
  let query = supabase.from('products').select('*').eq('is_active', true).order('name');
  if (productIds && productIds.length > 0) {
    query = query.in('id', productIds);
  }
  const { data: productsData, error: prodErr } = await query;
  if (prodErr) throw prodErr;
  const products = (productsData || []) as unknown as ExportProduct[];

  if (products.length === 0) throw new Error('Nenhum produto encontrado para exportar.');

  const productIdList = products.map(p => p.id);

  // 2. Load categories
  const categoryIds = [...new Set(products.map(p => p.category_id).filter(Boolean))] as string[];
  const categoryMap: CategoryMap = {};
  if (categoryIds.length > 0) {
    const { data: cats } = await supabase.from('categories').select('id, name').in('id', categoryIds);
    (cats || []).forEach((c: { id: string; name: string }) => { categoryMap[c.id] = c.name; });
  }

  // 3. Load variations
  const { data: variationsData } = await supabase
    .from('product_variations')
    .select('*')
    .in('product_id', productIdList)
    .order('sort_order');
  const variations = (variationsData || []) as unknown as ExportVariation[];

  // 4. Load attributes & values for variations
  const variationIds = variations.map(v => v.id);
  let variationValuesMap: Record<string, ExportVariationValue[]> = {};

  if (variationIds.length > 0) {
    const { data: pvvData } = await supabase
      .from('product_variation_values')
      .select('variation_id, attribute_value_id')
      .in('variation_id', variationIds);

    const attrValueIds = [...new Set((pvvData || []).map((v: { attribute_value_id: string }) => v.attribute_value_id))];
    
    if (attrValueIds.length > 0) {
      const { data: avData } = await supabase
        .from('product_attribute_values')
        .select('id, value, attribute_id')
        .in('id', attrValueIds);

      const attrIds = [...new Set((avData || []).map((a: { attribute_id: string }) => a.attribute_id))];
      const { data: attrsData } = await supabase
        .from('product_attributes')
        .select('id, name')
        .in('id', attrIds);

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

  // 5. Load product images from metadata
  function getProductImages(product: ExportProduct): string[] {
    const images: string[] = [];
    if (product.image_url) images.push(product.image_url);
    const meta = product.metadata as Record<string, unknown> | null;
    if (meta?.additional_images && Array.isArray(meta.additional_images)) {
      (meta.additional_images as string[]).forEach(img => images.push(img));
    }
    return images.slice(0, 6);
  }

  // 6. Build CSV rows
  const rows: string[][] = [CSV_HEADERS];

  for (const product of products) {
    const categoryName = product.category_id ? (categoryMap[product.category_id] || null) : null;
    const productVariations = variations.filter(v => v.product_id === product.id);
    const images = getProductImages(product);
    const sku = generateSKU(product.name);

    if (productVariations.length === 0) {
      // Simple product
      rows.push(buildSimpleRow(product, sku, categoryName, images));
    } else {
      // Parent product row
      rows.push(buildParentRow(product, sku, categoryName, images));
      // Variation rows
      for (const variation of productVariations) {
        const values = variationValuesMap[variation.id] || [];
        rows.push(buildVariationRow(product, variation, sku, values, categoryName));
      }
    }

    // Blank separator row
    rows.push(new Array(CSV_HEADERS.length).fill(''));
  }

  // 7. Convert to CSV string
  const csvContent = rows.map(row => row.map(cell => escapeCSV(String(cell))).join(',')).join('\n');
  
  // Add BOM for UTF-8
  return '\uFEFF' + csvContent;
}

export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
