/**
 * Regras de exibição e montagem da mensagem dos avisos de cashback.
 * O cálculo do cashback é feito no banco (upsert_cashback_reminder) a partir das regras salvas.
 * Brasil não tem horário de verão desde 2019, então o horário de Brasília é sempre UTC-3.
 */

export interface CashbackReminderItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface CashbackReminder {
  id: string;
  sale_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  store_id: string | null;
  store_name: string | null;
  sale_date: string;
  sale_total: number;
  items: CashbackReminderItem[];
  cashback_percent: number;
  cashback_value: number;
  min_use_value: number;
  expires_at: string;
  status: 'pending' | 'sent' | 'cancelled';
  sent_at: string | null;
  sent_by: string | null;
}

export const DEFAULT_CASHBACK_TEMPLATE =
  'Olá, {nome}! Tudo bem? Aqui é da Fio de Gala 💛\nNa sua compra de {data_compra} na loja {loja}, no valor de {valor_compra}, você ganhou {cashback} de cashback para usar em compras a partir de {compra_minima}.\nSeu cashback vale até {validade}. Esperamos você!';

const SP_OFFSET_MS = 3 * 60 * 60 * 1000;

export const formatBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

/** Data (AAAA-MM-DD) no horário de Brasília. */
export const spDateKey = (d: Date | string) => {
  const t = new Date(d).getTime() - SP_OFFSET_MS;
  return new Date(t).toISOString().slice(0, 10);
};

/** Início do dia de hoje em Brasília, como ISO em UTC. */
export const spStartOfTodayISO = (now: Date = new Date()) => `${spDateKey(now)}T03:00:00.000Z`;

/** "12/11/2026" a partir de uma data ou de "AAAA-MM-DD". */
export const formatDateBR = (d: string | Date) => {
  const key = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : spDateKey(d);
  const [y, m, day] = key.split('-');
  return `${day}/${m}/${y}`;
};

/** O aviso aparece a partir do dia seguinte à compra e só enquanto o cashback vale. */
export const isReminderDue = (
  r: Pick<CashbackReminder, 'sale_date' | 'expires_at' | 'status'>,
  now: Date = new Date(),
) => {
  if (r.status !== 'pending') return false;
  const today = spDateKey(now);
  return spDateKey(r.sale_date) < today && r.expires_at >= today;
};

export const buildCashbackMessage = (template: string, r: CashbackReminder) => {
  const firstName = (r.customer_name || '').trim().split(/\s+/)[0] || '';
  const pretty = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : '';
  const values: Record<string, string> = {
    nome: pretty,
    nome_completo: r.customer_name || '',
    loja: r.store_name || '',
    data_compra: formatDateBR(r.sale_date),
    valor_compra: formatBRL(r.sale_total),
    cashback: formatBRL(r.cashback_value),
    compra_minima: formatBRL(r.min_use_value),
    validade: formatDateBR(r.expires_at),
  };
  return (template || DEFAULT_CASHBACK_TEMPLATE).replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m));
};

/** Telefone em formato internacional para o WhatsApp (55 + DDD + número). */
export const normalizeWhatsappPhone = (phone?: string | null) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
};

export const whatsappLink = (phone: string | null | undefined, message: string) => {
  const p = normalizeWhatsappPhone(phone);
  if (!p) return null;
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
};

/** Valor do cashback: percentual da compra, em centavos. */
export const cashbackValue = (saleTotal: number, percent: number) =>
  Math.round(saleTotal * percent) / 100;

/**
 * Compra mínima seguinte no modo proporcional: o cashback cobre no máximo `coverPercent`% da próxima compra,
 * arredondado para cima em reais inteiros (mesma conta do banco, cashback_min_next_purchase).
 */
export const cashbackMinNextPurchase = (cashback: number, coverPercent: number) =>
  Math.ceil(Math.round((cashback * 100 / coverPercent) * 1e6) / 1e6);
