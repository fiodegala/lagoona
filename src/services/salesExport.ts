import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PAY_LABELS: Record<string, string> = {
  cash: 'Dinheiro', card: 'Cartão', credit: 'Crédito', debit: 'Débito', pix: 'PIX',
  mixed: 'Misto', boleto: 'Boleto', cheque: 'Cheque',
};
const STATUS_LABELS: Record<string, string> = {
  completed: 'Concluída', cancelled: 'Cancelada', pending: 'Pendente',
};
const TYPE_LABELS: Record<string, string> = {
  varejo: 'Varejo', atacado: 'Atacado', exclusivo: 'Exclusivo', troca: 'Troca', brinde: 'Brinde',
};

const money = (n: number) => (Math.round(Number(n || 0) * 100) / 100).toFixed(2).replace('.', ',');
const dt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');

export interface ExportSaleItem {
  produto: string; sku: string; quantidade: number; preco_unitario: number; desconto: number; total: number;
}
export interface ExportSale {
  id: string; data: string; status: string; tipo: string; canal: string; loja: string; vendedor: string;
  cliente: string; documento: string; tipo_cliente: string; razao_social: string; telefone: string; email: string;
  endereco: string; bairro: string; cidade: string; estado: string; cep: string; aniversario: string;
  subtotal: number; desconto: number; cupom: string; total: number; forma_pagamento: string; pagamentos: string;
  parcelas: string; valor_recebido: number; troco: number; qtd_pecas: number; campanha: string;
  observacoes: string; cancelada_em: string; motivo_cancelamento: string; itens: ExportSaleItem[];
}

export function parseItems(items: any): any[] {
  try { return Array.isArray(items) ? items : JSON.parse(items) || []; } catch { return []; }
}

/** Describes how a sale was paid, e.g. "Crédito 3x R$ 1000,00 + PIX R$ 500,00". */
export function describePayment(method: string, details: any): { text: string; installments: string } {
  const d = details || {};
  if (Array.isArray(d.payments) && d.payments.length) {
    const parts = d.payments.map((p: any) => {
      const inst = Number(p.installments || 1);
      return `${PAY_LABELS[p.type] || p.type}${inst > 1 ? ` ${inst}x` : ''} R$ ${money(p.amount)}`;
    });
    const maxInst = Math.max(...d.payments.map((p: any) => Number(p.installments || 1)));
    return { text: parts.join(' + '), installments: maxInst > 1 ? `${maxInst}x` : '1x' };
  }
  let label = PAY_LABELS[method] || method || '';
  if (method === 'card' && d.cardType) label = `Cartão ${PAY_LABELS[d.cardType] || d.cardType}`;
  const inst = Number(d.installments || 1);
  return { text: label, installments: inst > 1 ? `${inst}x de R$ ${money(d.installmentValue)}` : '1x' };
}

export function buildSaleRecord(
  s: any, customer: any | null, storeName: string, sellerName: string,
): ExportSale {
  const items = parseItems(s.items);
  const pay = describePayment(s.payment_method, s.payment_details);
  const c = customer || {};
  const street = [c.address, c.address_number, c.address_complement].filter(Boolean).join(', ');
  return {
    id: s.id,
    data: dt(s.created_at),
    status: STATUS_LABELS[s.status] || s.status || '',
    tipo: TYPE_LABELS[s.sale_type] || s.sale_type || 'Varejo',
    canal: s.payment_details?.sale_origin === 'online' ? 'Online' : 'Presencial',
    loja: storeName,
    vendedor: sellerName,
    cliente: c.name || s.customer_name || 'Consumidor Final',
    documento: c.document || s.customer_document || '',
    tipo_cliente: c.customer_type === 'pj' ? 'PJ' : c.customer_type ? 'PF' : '',
    razao_social: c.razao_social || '',
    telefone: c.phone || '',
    email: c.email || '',
    endereco: street,
    bairro: c.neighborhood || '',
    cidade: c.city || '',
    estado: c.state || '',
    cep: c.zip_code || '',
    aniversario: c.birthday ? new Date(c.birthday + 'T12:00:00').toLocaleDateString('pt-BR') : '',
    subtotal: Number(s.subtotal || 0),
    desconto: Number(s.discount_amount || 0),
    cupom: s.coupon_code || '',
    total: Number(s.total || 0),
    forma_pagamento: PAY_LABELS[s.payment_method] || s.payment_method || '',
    pagamentos: pay.text,
    parcelas: pay.installments,
    valor_recebido: Number(s.amount_received || 0),
    troco: Number(s.change_amount || 0),
    qtd_pecas: items.reduce((sum, i) => sum + Number(i.quantity || 0), 0),
    campanha: s.is_campaign ? 'Sim' : 'Não',
    observacoes: s.notes || '',
    cancelada_em: dt(s.cancelled_at),
    motivo_cancelamento: s.cancel_reason || '',
    itens: items.map((i) => {
      const qty = Number(i.quantity || 0);
      const unit = Number(i.unit_price ?? i.price ?? 0);
      return {
        produto: i.name || '', sku: i.sku || '', quantidade: qty, preco_unitario: unit,
        desconto: Number(i.discount_amount || 0), total: Number(i.total ?? unit * qty),
      };
    }),
  };
}

export async function buildSaleRecords(sales: any[]): Promise<ExportSale[]> {
  const custIds = [...new Set(sales.map((s) => s.customer_id).filter(Boolean))] as string[];
  const customers = new Map<string, any>();
  for (let i = 0; i < custIds.length; i += 200) {
    const { data } = await supabase.from('customers').select('*').in('id', custIds.slice(i, i + 200));
    (data || []).forEach((c: any) => customers.set(c.id, c));
  }
  const storeMap = new Map<string, string>();
  const { data: stores } = await supabase.from('stores').select('id,name');
  (stores || []).forEach((s: any) => storeMap.set(s.id, s.name));
  const staffIds = [...new Set(sales.map((s) => s.seller_id || s.user_id).filter(Boolean))] as string[];
  const staff = new Map<string, string>();
  if (staffIds.length) {
    const { data } = await supabase.rpc('get_staff_names', { _user_ids: staffIds });
    (data || []).forEach((p: any) => staff.set(p.user_id, p.full_name));
  }
  return sales.map((s) =>
    buildSaleRecord(
      s,
      s.customer_id ? customers.get(s.customer_id) : null,
      storeMap.get(s.store_id) || '',
      staff.get(s.seller_id || s.user_id) || '',
    ),
  );
}

type SaleKey = Exclude<keyof ExportSale, 'itens'>;
const SALE_COLS: { key: SaleKey; label: string; money?: boolean }[] = [
  { key: 'id', label: 'ID da venda' }, { key: 'data', label: 'Data' }, { key: 'status', label: 'Status' },
  { key: 'tipo', label: 'Modalidade' }, { key: 'canal', label: 'Canal' }, { key: 'loja', label: 'Loja' },
  { key: 'vendedor', label: 'Vendedor' }, { key: 'cliente', label: 'Cliente' }, { key: 'documento', label: 'CPF/CNPJ' },
  { key: 'tipo_cliente', label: 'Tipo cliente' }, { key: 'razao_social', label: 'Razão social' },
  { key: 'telefone', label: 'Telefone' }, { key: 'email', label: 'E-mail' }, { key: 'endereco', label: 'Endereço' },
  { key: 'bairro', label: 'Bairro' }, { key: 'cidade', label: 'Cidade' }, { key: 'estado', label: 'Estado' },
  { key: 'cep', label: 'CEP' }, { key: 'aniversario', label: 'Aniversário' },
  { key: 'subtotal', label: 'Subtotal venda', money: true }, { key: 'desconto', label: 'Desconto venda', money: true },
  { key: 'cupom', label: 'Cupom' }, { key: 'total', label: 'Total venda', money: true },
  { key: 'forma_pagamento', label: 'Forma de pagamento' }, { key: 'pagamentos', label: 'Detalhe pagamento' },
  { key: 'parcelas', label: 'Parcelas' }, { key: 'valor_recebido', label: 'Valor recebido', money: true },
  { key: 'troco', label: 'Troco', money: true }, { key: 'qtd_pecas', label: 'Qtd. peças' },
  { key: 'campanha', label: 'Campanha' }, { key: 'observacoes', label: 'Observações' },
  { key: 'cancelada_em', label: 'Cancelada em' }, { key: 'motivo_cancelamento', label: 'Motivo cancelamento' },
];
const ITEM_COLS: { key: keyof ExportSaleItem; label: string; money?: boolean }[] = [
  { key: 'produto', label: 'Produto' }, { key: 'sku', label: 'SKU' }, { key: 'quantidade', label: 'Qtd. item' },
  { key: 'preco_unitario', label: 'Preço unitário', money: true }, { key: 'desconto', label: 'Desconto item', money: true },
  { key: 'total', label: 'Total item', money: true },
];

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** One line per item, repeating the sale and customer data on each line. */
export function salesToCSV(sales: ExportSale[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cell = (v: any, isMoney?: boolean) => esc(isMoney ? money(v) : v);
  const header = [...SALE_COLS, ...ITEM_COLS].map((c) => esc(c.label)).join(';');
  const lines = [header];
  for (const s of sales) {
    const base = SALE_COLS.map((c) => cell(s[c.key], c.money));
    const items = s.itens.length ? s.itens : [null];
    for (const it of items) {
      lines.push([...base, ...ITEM_COLS.map((c) => (it ? cell(it[c.key], c.money) : '""'))].join(';'));
    }
  }
  return '\uFEFF' + lines.join('\r\n');
}

export function exportSalesCSV(sales: ExportSale[], name: string) {
  download(new Blob([salesToCSV(sales)], { type: 'text/csv;charset=utf-8' }), name + '.csv');
}

export function salesToXML(sales: ExportSale[]): string {
  const x = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const val = (v: any, isMoney?: boolean) => x(isMoney ? (Math.round(Number(v || 0) * 100) / 100).toFixed(2) : v);
  const body = sales.map((s) => {
    const fields = SALE_COLS.map((c) => `    <${c.key}>${val(s[c.key], c.money)}</${c.key}>`).join('\n');
    const items = s.itens.map((it) =>
      '      <item>\n' + ITEM_COLS.map((c) => `        <${c.key}>${val(it[c.key], c.money)}</${c.key}>`).join('\n') + '\n      </item>',
    ).join('\n');
    return `  <venda>\n${fields}\n    <itens>\n${items}\n    </itens>\n  </venda>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<vendas>\n${body}\n</vendas>\n`;
}

export function exportSalesXML(sales: ExportSale[], name: string) {
  download(new Blob([salesToXML(sales)], { type: 'application/xml' }), name + '.xml');
}

export function exportSalesPDF(sales: ExportSale[], name: string, subtitle: string) {
  const doc = new jsPDF({ orientation: 'portrait' });
  const active = sales.filter((s) => s.status !== 'Cancelada');
  const total = active.reduce((sum, s) => sum + s.total, 0);
  doc.setFontSize(14); doc.text('Vendas — Fio de Gala', 14, 14);
  doc.setFontSize(9);
  doc.text(`${subtitle} · ${sales.length} vendas · Total (sem canceladas): R$ ${money(total)}`, 14, 20);
  let y = 26;
  for (const s of sales) {
    const info = [
      ['Venda', `#${s.id.slice(0, 8)} · ${s.data} · ${s.status} · ${s.tipo} · ${s.canal}`],
      ['Loja / Vendedor', `${s.loja || '-'} / ${s.vendedor || '-'}`],
      ['Cliente', [s.cliente, s.documento, s.telefone, s.email].filter(Boolean).join(' · ')],
      ...(s.endereco || s.cidade ? [['Endereço', [s.endereco, s.bairro, s.cidade, s.estado, s.cep].filter(Boolean).join(', ')]] : []),
      ['Pagamento', `${s.pagamentos} (${s.parcelas})`],
      ['Valores', `Subtotal R$ ${money(s.subtotal)} · Desconto R$ ${money(s.desconto)}${s.cupom ? ` (cupom ${s.cupom})` : ''} · Total R$ ${money(s.total)}`],
      ...(s.observacoes ? [['Observações', s.observacoes]] : []),
      ...(s.motivo_cancelamento || s.cancelada_em ? [['Cancelamento', `${s.cancelada_em} ${s.motivo_cancelamento}`.trim()]] : []),
    ];
    autoTable(doc, {
      startY: y, body: info, theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 } },
    });
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 1,
      head: [['Produto', 'SKU', 'Qtd.', 'Unitário', 'Desconto', 'Total']],
      body: s.itens.map((i) => [i.produto, i.sku, String(i.quantidade), `R$ ${money(i.preco_unitario)}`, `R$ ${money(i.desconto)}`, `R$ ${money(i.total)}`]),
      styles: { fontSize: 7 }, headStyles: { fillColor: [40, 44, 60] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }
  doc.save(name + '.pdf');
}
