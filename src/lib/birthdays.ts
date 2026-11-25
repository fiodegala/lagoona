import { supabase } from '@/integrations/supabase/client';
import { spDateKey, whatsappLink } from '@/lib/cashback';

export interface BirthdayReminder {
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_document: string | null;
  birthday: string;
  birthday_year: number;
  birthday_date: string;
  turning_age: number;
  store_id: string | null;
  store_name: string | null;
  status: 'pending' | 'sent';
  sent_at: string | null;
  sent_by: string | null;
}

export interface BirthdaySettings {
  id: number;
  enabled: boolean;
  days_before: number;
  days_after: number;
  message_template: string;
  gift_image_url: string | null;
}

export const DEFAULT_BIRTHDAY_TEMPLATE =
  'Olá, {nome}! Feliz aniversário! 🎉💛\nAqui é da Fio de Gala! Passando para desejar um dia incrível, cheio de saúde, alegria e muitas conquistas.\nSerá um prazer receber você na {loja} para comemorar essa data especial!';

export type BirthdayPeriodKey =
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'next_7'
  | 'month'
  | 'next_month'
  | 'last_month'
  | 'all'
  | 'custom';

export const BIRTHDAY_PERIOD_OPTIONS: { value: BirthdayPeriodKey; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'tomorrow', label: 'Amanhã' },
  { value: 'week', label: 'Essa semana' },
  { value: 'next_7', label: 'Próximos 7 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'next_month', label: 'Próximo mês' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'all', label: 'Todo o ano' },
  { value: 'custom', label: 'Personalizado' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const utcISO = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const localISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** "25/11" a partir de "AAAA-MM-DD". */
export const formatDayMonthBR = (isoDate: string) => {
  const [, m, d] = isoDate.slice(0, 10).split('-');
  return d && m ? `${d}/${m}` : isoDate;
};

/** Verdadeiro quando a data de aniversário cai hoje no horário de Brasília. */
export const isBirthdayToday = (birthdayDate: string, now: Date = new Date()) =>
  birthdayDate.slice(0, 10) === spDateKey(now);

/** Verifica se um aniversário está dentro da janela configurada para o pop-up. */
export const isBirthdayPopupDue = (
  birthdayDate: string,
  status: 'pending' | 'sent',
  daysBefore: number,
  daysAfter: number,
  now: Date = new Date(),
) => {
  if (status !== 'pending') return false;
  const [y, m, d] = spDateKey(now).split('-').map(Number);
  const from = utcISO(y, m - 1, d - daysAfter);
  const to = utcISO(y, m - 1, d + daysBefore);
  const day = birthdayDate.slice(0, 10);
  return day >= from && day <= to;
};

export const birthdayPeriodRange = (
  period: BirthdayPeriodKey,
  now: Date = new Date(),
  customFrom?: Date,
  customTo?: Date,
): { from: string; to: string } => {
  const [y, m, d] = spDateKey(now).split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  switch (period) {
    case 'today': {
      const k = utcISO(y, m - 1, d);
      return { from: k, to: k };
    }
    case 'tomorrow': {
      const k = utcISO(y, m - 1, d + 1);
      return { from: k, to: k };
    }
    case 'week': {
      const mondayOffset = (dow + 6) % 7;
      return { from: utcISO(y, m - 1, d - mondayOffset), to: utcISO(y, m - 1, d - mondayOffset + 6) };
    }
    case 'next_7':
      return { from: utcISO(y, m - 1, d), to: utcISO(y, m - 1, d + 6) };
    case 'month':
      return { from: utcISO(y, m - 1, 1), to: utcISO(y, m, 0) };
    case 'next_month':
      return { from: utcISO(y, m, 1), to: utcISO(y, m + 1, 0) };
    case 'last_month':
      return { from: utcISO(y, m - 2, 1), to: utcISO(y, m - 1, 0) };
    case 'custom':
      return { from: customFrom ? localISO(customFrom) : '', to: customTo ? localISO(customTo) : '' };
    default:
      return { from: '', to: '' };
  }
};

export const buildBirthdayMessage = (
  template: string | null | undefined,
  r: Pick<BirthdayReminder, 'customer_name' | 'store_name' | 'birthday_date' | 'turning_age'>,
) => {
  const firstName = (r.customer_name || '').trim().split(/\s+/)[0] || '';
  const pretty = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : '';
  const age = Number.isFinite(r.turning_age) && r.turning_age > 0 ? String(r.turning_age) : '';
  const values: Record<string, string> = {
    nome: pretty,
    nome_completo: r.customer_name || '',
    loja: r.store_name || 'Fio de Gala',
    data_aniversario: formatDayMonthBR(r.birthday_date),
    idade: age,
  };
  return (template?.trim() || DEFAULT_BIRTHDAY_TEMPLATE).replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m));
};

/** Busca todos os aniversariantes com paginação para não cortar acima de 1000 linhas. */
export const fetchAllBirthdayReminders = async (
  year?: number | null,
  onlyPopupDue = false,
): Promise<BirthdayReminder[]> => {
  const pageSize = 1000;
  const all: BirthdayReminder[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .rpc('get_birthday_reminders', {
        _year: year ?? undefined,
        _only_popup_due: onlyPopupDue,
      })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data || []) as unknown as BirthdayReminder[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
};

export { whatsappLink };