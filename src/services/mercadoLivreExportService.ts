import { supabase } from '@/integrations/supabase/client';

/**
 * Exportação de produtos no layout de "Publicação em massa" do Mercado Livre.
 * Gera 1 linha por variação (ou 1 linha para produtos simples), com as colunas
 * que a planilha do Mercado Livre pede. O arquivo é aberto no Excel/Sheets e
 * as colunas são coladas no template oficial da categoria.
 */

interface MLProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotional_price: number | null;
  stock: number;
  sku: string | null;
  barcode: string | null;
  is_active: boolean;
  image_url: string | null;
  images: string[] | null;
  weight_kg: number | null;
  width_cm: number | null;
  height_cm: number | null;
  depth_cm: number | null;
  category_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface MLVariation {
  id: string;
  product_id: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  promotional_price: number | null;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  sort_order: number | null;
}

interface AttrValue {
  attribute_name: string;
  attribute_value: string;
}

export const ML_HEADERS = [
  'SKU',
  'Título',
  'Descrição',
  'Categoria',
  'Marca',
  'Condição',
  'Preço (R$)',
  'Preço promocional (R$)',
  'Quantidade em estoque',
  'Cor',
  'Tamanho',
  'Outras variações',
  'Código universal (GTIN/EAN)',
  'Peso (kg)',
  'Largura (cm)',
  'Altura (cm)',
  'Comprimento (cm)',
  'Forma de envio',
  'Garantia',
  'Fotos (URLs separadas por vírgula)',
] as const;

const DEFAULT_BRAND = 'Fio de Gala';
const MAX_TITLE = 60;
const MAX_PHOTOS = 10;

function escapeCSV(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  const clean = str === 'null' || str === 'undefined' ? '' : str;
  return `"${clean.replace(/"/g, '""')}"`;
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return Number(value).toFixed(2).replace('.', ',');
}

function decimal(value: number | null | undefined): string {
  if (!value) return '';
  return String(value).replace('.', ',');
}

function isValidGTIN(code: string | null | undefined): boolean {
  if (!code || code === 'null') return false;
  const digits = code.replace(/\D/g, '');
  return [8, 12, 13, 14].includes(digits.length);
}

function truncateTitle(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  return clean.length <= MAX_TITLE ? clean : clean.slice(0, MAX_TITLE).trim();
}

function plainDescription(description: string | null): string {
  if (!description) return '';
  return description
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugSku(name: string): string {
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

function productPhotos(product: MLProduct): string {
  const list: string[] = [];
  if (product.image_url && product.image_url !== 'null') list.push(product.image_url);
  if (Array.isArray(product.images)) {
    product.images.forEach(img => { if (img && !list.includes(img)) list.push(img); });
  }
  const meta = product.metadata as Record<string, unknown> | null;
  if (meta?.additional_images && Array.isArray(meta.additional_images)) {
    (meta.additional_images as string[]).forEach(img => { if (img && !list.includes(img)) list.push(img); });
  }
  return list.slice(0, MAX_PHOTOS).join(', ');
}

function pickAttr(values: AttrValue[], keywords: string[]): string {
  const found = values.find(v => {
    const name = v.attribute_name.toLowerCase();
    return keywords.some(k => name.includes(k));
  });
  return found?.attribute_value ?? '';
}

function otherAttrs(values: AttrValue[]): string {
  return values
    .filter(v => {
      const name = v.attribute_name.toLowerCase();
      return !['cor', 'color', 'tamanho', 'size', 'numeração'].some(k => name.includes(k));
    })
    .map(v => `${v.attribute_name}: ${v.attribute_value}`)
    .join(' | ');
}

export async function buildMercadoLivreRows(options?: {
  productIds?: string[];
  onlyActive?: boolean;
}): Promise<string[][]> {
  const onlyActive = options?.onlyActive ?? true;

  let query = supabase.from('products').select('*').order('name');
  if (onlyActive) query = query.eq('is_active', true);
  if (options?.productIds?.length) query = query.in('id', options.productIds);

  const { data: productsData, error } = await query;
  if (error) throw error;
  const products = (productsData || []) as unknown as MLProduct[];
  if (products.length === 0) throw new Error('Nenhum produto encontrado para exportar.');

  const productIds = products.map(p => p.id);

  // Categorias
  const categoryMap: Record<string, string> = {};
  const categoryIds = [...new Set(products.map(p => p.category_id).filter(Boolean))] as string[];
  if (categoryIds.length) {
    const { data: cats } = await supabase.from('categories').select('id, name').in('id', categoryIds);
    (cats || []).forEach((c: { id: string; name: string }) => { categoryMap[c.id] = c.name; });
  }

  // Variações (em lotes para não estourar limites)
  const variations: MLVariation[] = [];
  for (let i = 0; i < productIds.length; i += 200) {
    const chunk = productIds.slice(i, i + 200);
    const { data } = await supabase
      .from('product_variations')
      .select('*')
      .in('product_id', chunk)
      .eq('is_active', true)
      .order('sort_order');
    variations.push(...((data || []) as unknown as MLVariation[]));
  }

  // Atributos das variações
  const variationValues: Record<string, AttrValue[]> = {};
  const variationIds = variations.map(v => v.id);
  for (let i = 0; i < variationIds.length; i += 300) {
    const chunk = variationIds.slice(i, i + 300);
    if (!chunk.length) break;
    const { data: pvv } = await supabase
      .from('product_variation_values')
      .select('variation_id, attribute_value_id')
      .in('variation_id', chunk);
    const valueIds = [...new Set((pvv || []).map((r: { attribute_value_id: string }) => r.attribute_value_id))];
    if (!valueIds.length) continue;

    const { data: avData } = await supabase
      .from('product_attribute_values')
      .select('id, value, attribute_id')
      .in('id', valueIds);
    const attrIds = [...new Set((avData || []).map((a: { attribute_id: string }) => a.attribute_id))];
    const { data: attrsData } = await supabase
      .from('product_attributes')
      .select('id, name')
      .in('id', attrIds);

    const attrNames: Record<string, string> = {};
    (attrsData || []).forEach((a: { id: string; name: string }) => { attrNames[a.id] = a.name; });
    const avMap: Record<string, AttrValue> = {};
    (avData || []).forEach((a: { id: string; value: string; attribute_id: string }) => {
      avMap[a.id] = { attribute_name: attrNames[a.attribute_id] || 'Atributo', attribute_value: a.value };
    });

    (pvv || []).forEach((r: { variation_id: string; attribute_value_id: string }) => {
      const av = avMap[r.attribute_value_id];
      if (!av) return;
      if (!variationValues[r.variation_id]) variationValues[r.variation_id] = [];
      variationValues[r.variation_id].push(av);
    });
  }

  const rows: string[][] = [[...ML_HEADERS]];

  for (const product of products) {
    const categoryName = product.category_id ? (categoryMap[product.category_id] || '') : '';
    const photos = productPhotos(product);
    const description = plainDescription(product.description);
    const baseSku = product.sku && product.sku !== 'null' ? product.sku : slugSku(product.name);
    const productVariations = variations.filter(v => v.product_id === product.id);

    const common = (sku: string, price: number, promo: number | null, stock: number, gtin: string | null, cor: string, tamanho: string, outras: string, photoList: string) => ([
      sku,
      truncateTitle(product.name),
      description,
      categoryName,
      DEFAULT_BRAND,
      'Novo',
      money(price),
      promo && promo > 0 ? money(promo) : '',
      String(stock ?? 0),
      cor,
      tamanho,
      outras,
      isValidGTIN(gtin) ? gtin!.replace(/\D/g, '') : '',
      decimal(product.weight_kg),
      decimal(product.width_cm),
      decimal(product.height_cm),
      decimal(product.depth_cm),
      'Mercado Envios',
      '3 meses de garantia do vendedor',
      photoList,
    ]);

    if (productVariations.length === 0) {
      rows.push(common(baseSku, product.price, product.promotional_price, product.stock, product.barcode, '', '', '', photos));
      continue;
    }

    for (const variation of productVariations) {
      const values = variationValues[variation.id] || [];
      const cor = pickAttr(values, ['cor', 'color']);
      const tamanho = pickAttr(values, ['tamanho', 'size', 'numera']);
      const suffix = values.map(v => v.attribute_value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toUpperCase()).join('-');
      const sku = variation.sku && variation.sku !== 'null' ? variation.sku : `${baseSku}-${suffix}`;
      const varPhotos = variation.image_url && variation.image_url !== 'null'
        ? [variation.image_url, ...photos.split(', ').filter(Boolean)].slice(0, MAX_PHOTOS).join(', ')
        : photos;
      rows.push(common(
        sku,
        variation.price ?? product.price,
        variation.promotional_price,
        variation.stock,
        variation.barcode,
        cor,
        tamanho,
        otherAttrs(values),
        varPhotos,
      ));
    }
  }

  const csv = '\uFEFF' + rows.map(row => row.map(escapeCSV).join(';')).join('\n');
  return { csv, rows: rows.length - 1 };
}

export function downloadMercadoLivreCSV(csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mercado-livre-produtos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
