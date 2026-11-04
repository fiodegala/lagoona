import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportCustomerRow {
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;
  aniversario: string;
  qtd_compras: number;
  total_gasto: number;
  ultima_compra: string;
}

const COLS: { key: keyof ExportCustomerRow; label: string }[] = [
  { key: 'nome', label: 'Nome' },
  { key: 'documento', label: 'CPF/CNPJ' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'estado', label: 'Estado' },
  { key: 'aniversario', label: 'Aniversário' },
  { key: 'qtd_compras', label: 'Qtd. compras' },
  { key: 'total_gasto', label: 'Total gasto' },
  { key: 'ultima_compra', label: 'Última compra' },
];

export async function buildCustomerRows(sales: any[]): Promise<ExportCustomerRow[]> {
  const valid = sales.filter((s) => s.status !== 'cancelled');
  const ids = [...new Set(valid.map((s) => s.customer_id).filter(Boolean))] as string[];
  const customers = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from('customers')
      .select('id,name,document,phone,email,city,state,birthday')
      .in('id', ids.slice(i, i + 200));
    (data || []).forEach((c: any) => customers.set(c.id, c));
  }
  const map = new Map<string, ExportCustomerRow & { _last: string }>();
  for (const s of valid) {
    const c = s.customer_id ? customers.get(s.customer_id) : null;
    const name = c?.name || s.customer_name;
    if (!name || name === 'Consumidor Final') continue;
    const key = s.customer_id || (s.customer_document || '').replace(/\D/g, '') || name.toLowerCase();
    const cur = map.get(key) || {
      nome: name,
      documento: c?.document || s.customer_document || '',
      telefone: c?.phone || s.customer_phone || '',
      email: c?.email || '',
      cidade: c?.city || '',
      estado: c?.state || '',
      aniversario: c?.birthday ? new Date(c.birthday + 'T12:00:00').toLocaleDateString('pt-BR') : '',
      qtd_compras: 0, total_gasto: 0, ultima_compra: '', _last: '',
    };
    cur.qtd_compras += 1;
    cur.total_gasto += Number(s.total || 0);
    if (s.created_at > cur._last) {
      cur._last = s.created_at;
      cur.ultima_compra = new Date(s.created_at).toLocaleDateString('pt-BR');
    }
    map.set(key, cur);
  }
  return [...map.values()]
    .map(({ _last, ...r }) => ({ ...r, total_gasto: Math.round(r.total_gasto * 100) / 100 }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

const fmt = (r: ExportCustomerRow, k: keyof ExportCustomerRow) =>
  k === 'total_gasto' ? r.total_gasto.toFixed(2).replace('.', ',') : String(r[k] ?? '');

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function exportCSV(rows: ExportCustomerRow[], name: string) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [COLS.map((c) => esc(c.label)).join(';'), ...rows.map((r) => COLS.map((c) => esc(fmt(r, c.key))).join(';'))];
  download(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), name + '.csv');
}

export function exportXML(rows: ExportCustomerRow[], name: string) {
  const x = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const body = rows.map((r) => '  <cliente>\n' + COLS.map((c) => `    <${c.key}>${x(c.key === 'total_gasto' ? r.total_gasto.toFixed(2) : String(r[c.key] ?? ''))}</${c.key}>`).join('\n') + '\n  </cliente>').join('\n');
  download(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n<clientes>\n${body}\n</clientes>\n`], { type: 'application/xml' }), name + '.xml');
}

export function exportPDF(rows: ExportCustomerRow[], name: string, subtitle: string) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14); doc.text('Clientes — Fio de Gala', 14, 14);
  doc.setFontSize(9); doc.text(`${subtitle} · ${rows.length} clientes`, 14, 20);
  autoTable(doc, {
    startY: 25,
    head: [COLS.map((c) => c.label)],
    body: rows.map((r) => COLS.map((c) => (c.key === 'total_gasto' ? 'R$ ' + fmt(r, c.key) : fmt(r, c.key)))),
    styles: { fontSize: 7 },
  });
  doc.save(name + '.pdf');
}
