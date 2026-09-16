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

  return rows;
}

export async function exportProductsToMercadoLivreCSV(options?: {
  productIds?: string[];
  onlyActive?: boolean;
}): Promise<{ csv: string; rows: number }> {
  const rows = await buildMercadoLivreRows(options);
  const csv = '\uFEFF' + rows.map(row => row.map(escapeCSV).join(';')).join('\n');
  return { csv, rows: rows.length - 1 };
}

function escapeXML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // remove caracteres de controle inválidos em XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/**
 * Gera uma planilha XML (SpreadsheetML / Excel 2003) com o layout do Mercado Livre.
 * Abre direto no Excel/Google Sheets, mantendo acentuação e colunas separadas.
 */
export async function exportProductsToMercadoLivreXML(options?: {
  productIds?: string[];
  onlyActive?: boolean;
}): Promise<{ xml: string; rows: number }> {
  const rows = await buildMercadoLivreRows(options);
  const [header, ...body] = rows;

  const headerRow = `<Row>${header
    .map(h => `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXML(h)}</Data></Cell>`)
    .join('')}</Row>`;

  const bodyRows = body
    .map(row => `<Row>${row.map(cell => `<Cell><Data ss:Type="String">${escapeXML(cell)}</Data></Cell>`).join('')}</Row>`)
    .join('\n      ');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Bottom"/>
    </Style>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Mercado Livre">
    <Table>
      ${headerRow}
      ${bodyRows}
    </Table>
  </Worksheet>
</Workbook>`;

  return { xml, rows: body.length };
}

function download(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadMercadoLivreCSV(csv: string) {
  download(csv, 'text/csv;charset=utf-8;', `mercado-livre-produtos-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function downloadMercadoLivreXML(xml: string) {
  download(xml, 'application/xml;charset=utf-8;', `mercado-livre-produtos-${new Date().toISOString().slice(0, 10)}.xml`);
}

/**
 * Gera e baixa um arquivo .xlsx real (Excel) com o layout do Mercado Livre.
 */
export async function exportProductsToMercadoLivreXLSX(options?: {
  productIds?: string[];
  onlyActive?: boolean;
}): Promise<{ rows: number }> {
  const rows = await buildMercadoLivreRows(options);
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = (rows[0] || []).map((_, i) => ({
    wch: Math.min(
      60,
      Math.max(12, ...rows.slice(0, 200).map(r => String(r[i] ?? '').length + 2)),
    ),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mercado Livre');
  XLSX.writeFile(wb, `mercado-livre-produtos-${new Date().toISOString().slice(0, 10)}.xlsx`);
  return { rows: rows.length - 1 };
}

/**
 * Layout oficial da planilha de "Publicação em massa" do Mercado Livre
 * (categoria Calçados, Roupas e Bolsas > Camisetas e Regatas).
 * Reproduz as 7 linhas de cabeçalho do modelo oficial para que o arquivo
 * gerado possa ser enviado direto no Mercado Livre, sem copiar/colar.
 */
const ML_TEMPLATE_HEADER: string[][] = [
  [
    'Calçados, Roupas e Bolsas > Camisetas e Regatas', '', '',
    'Crie variações \nCopie todas as linhas que pertencem ao mesmo produto e altere estas colunas.',
    '', '', '', '', '', '', '', '', '', '', '', 'Informações do produto', '', '', '', 'Condições do anúncio',
    '', '', '', '', '', '', '', '',
    'Características do produto \nCaso crie variações, você deve manter as mesmas informações para todas',
    '', '', '', '', '', '', '', '', '', '', '', '', '', '',
  ],
  ['Camisetas e Regatas', ...Array(40).fill('')],
  [
    'Título: informe o produto, marca, modelo e destaque as características principais \nCaso crie variações, você deve criar um título geral para todas',
    'Quantidade de caracteres', 'Condição', 'Varia por: Nome comercial da cor', 'Varia por: Desenho impresso',
    'Varia por: Desenho do tecido', 'Tamanho', 'Marca', 'Gênero', 'Código do guia', 'Fotos',
    'Código universal de produto', 'SKU', 'Estoque', 'Preço [R$]', 'Formato de venda',
    'Quantidade de camisetas', 'Descrição', 'Tipo de anúncio', 'Tarifa de venda', 'Forma de envio',
    'Custo de envio', 'Retirar pessoalmente', 'Tipo de garantia', 'Tempo de garantia',
    'Unidade de Tempo de garantia', 'Modelo', 'Tipo de roupa', 'Tipo de manga', 'Material principal',
    'Esportiva', 'Usos recomendados', 'Tipo de tecido', 'Composição', 'Tipo de gola',
    'Forma de caimento', 'Apta para gestação', 'Materiais reciclados', 'Resumo de erros',
    'BUYBOX_FORMULA', 'HIDDEN_PICTURES',
  ],
  [
    'Obrigatório', '', 'Obrigatório', 'Obrigatório', '', '', 'Obrigatório', 'Obrigatório', 'Obrigatório',
    'Obrigatório', 'Obrigatório', 'Obrigatório', '', 'Obrigatório', 'Obrigatório', '', '', '',
    'Obrigatório', '', 'Obrigatório', 'Obrigatório', 'Obrigatório', '', '', '', 'Obrigatório',
    'Obrigatório', 'Obrigatório', 'Obrigatório', '', '', '', '', '', '', '', '', '', '', '',
  ],
  Array(41).fill(''),
  [
    '', '', 'Ver política', 'Preciso de ajuda sobre variações', 'Preciso de ajuda sobre variações',
    'Preciso de ajuda sobre variações', 'Verificar guia', '', '', 'Revisar guias de tamanhos existentes',
    'Obter URLs no gestor de fotos', 'Identificar o código universal', '', '', '', '', '', '', '', '',
    '', ' Saiba mais sobre envios', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    'Como preencher a planilha', '', '',
  ],
  [
    ...Array(18).fill(''),
    'Revise as condições de venda que completamos por você,  a partir dos seus anúncios anteriores.',
    ...Array(22).fill(''),
  ],
];

// Padrões da loja já configurados no modelo oficial do vendedor
const ML_TEMPLATE_DEFAULTS = {
  condicao: 'Novo',
  guia: '8314249 - Camisetas Masculinas FDG',
  tipoAnuncio: 'Premium',
  tarifa: '-',
  formaEnvio: 'Mercado Envios',
  custoEnvio: 'Você oferece frete grátis',
  retirar: 'Não aceito',
  tipoGarantia: 'Garantia do vendedor',
  tempoGarantia: '7',
  unidadeGarantia: 'dias',
} as const;

function templateRow(r: string[]): string[] {
  const [sku, titulo, descricao, , marca, , preco, , estoque, cor, tamanho, , gtin, , , , , , , fotos] = r;
  const row = Array(41).fill('');
  row[0] = titulo;
  row[1] = String(titulo.length);
  row[2] = ML_TEMPLATE_DEFAULTS.condicao;
  row[3] = cor; // Varia por: Nome comercial da cor
  row[6] = tamanho;
  row[7] = marca;
  row[9] = ML_TEMPLATE_DEFAULTS.guia;
  row[10] = fotos;
  row[11] = gtin;
  row[12] = sku;
  row[13] = estoque || '0';
  row[14] = preco;
  row[16] = '1'; // Quantidade de camisetas
  row[17] = descricao;
  row[18] = ML_TEMPLATE_DEFAULTS.tipoAnuncio;
  row[19] = ML_TEMPLATE_DEFAULTS.tarifa;
  row[20] = ML_TEMPLATE_DEFAULTS.formaEnvio;
  row[21] = ML_TEMPLATE_DEFAULTS.custoEnvio;
  row[22] = ML_TEMPLATE_DEFAULTS.retirar;
  row[23] = ML_TEMPLATE_DEFAULTS.tipoGarantia;
  row[24] = ML_TEMPLATE_DEFAULTS.tempoGarantia;
  row[25] = ML_TEMPLATE_DEFAULTS.unidadeGarantia;
  return row;
}

/**
 * Gera e baixa um .xlsx idêntico ao modelo oficial de publicação em massa
 * do Mercado Livre (aba "Camisetas e Regatas"), pronto para upload direto.
 * Uma linha por variação; variações do mesmo produto repetem o título.
 */
/**
 * Preenche a PRÓPRIA planilha baixada do Mercado Livre (arquivo original do
 * usuário), preservando abas ocultas, validações e metadados que o ML exige.
 * Esta é a forma recomendada: o ML rejeita arquivos criados de zero.
 */
export async function fillMercadoLivreDownloadedTemplate(
  file: File,
  options?: { productIds?: string[]; onlyActive?: boolean },
): Promise<{ rows: number; sheet: string }> {
  const rows = await buildMercadoLivreRows(options);
  const [, ...body] = rows;
  const data = body.map(templateRow);

  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { cellStyles: true, cellNF: true, bookVBA: true });

  // Aba de dados: a que contém a linha de cabeçalhos oficiais (col A = "Título...")
  const sheetName =
    wb.SheetNames.find(name => {
      const sheet = wb.Sheets[name];
      const a3 = sheet['A3'];
      return typeof a3?.v === 'string' && a3.v.toLowerCase().includes('título');
    }) || wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  const START_ROW = 7; // linha 8 na planilha (0-indexed)

  data.forEach((row, r) => {
    row.forEach((value, c) => {
      const address = XLSX.utils.encode_cell({ r: START_ROW + r, c });
      if (value === '' || value === undefined || value === null) {
        delete ws[address];
        return;
      }
      ws[address] = { t: 's', v: String(value) };
    });
  });

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  range.e.r = Math.max(range.e.r, START_ROW + data.length - 1);
  range.e.c = Math.max(range.e.c, 40);
  ws['!ref'] = XLSX.utils.encode_range(range);

  XLSX.writeFile(wb, file.name.replace(/\.xlsx?$/i, '') + '-preenchida.xlsx', { bookType: 'xlsx', cellStyles: true });
  return { rows: data.length, sheet: sheetName };
}

export async function exportProductsToMercadoLivreTemplateXLSX(options?: {
  productIds?: string[];
  onlyActive?: boolean;
}): Promise<{ rows: number }> {
  const rows = await buildMercadoLivreRows(options);
  const [, ...body] = rows;
  const data = body.map(templateRow);
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([...ML_TEMPLATE_HEADER, ...data]);
  ws['!cols'] = Array(41).fill({ wch: 22 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Camisetas e Regatas');
  XLSX.writeFile(wb, `mercado-livre-planilha-oficial-${new Date().toISOString().slice(0, 10)}.xlsx`);
  return { rows: data.length };
}
