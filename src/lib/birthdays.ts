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
  'Olá, {nome}! Feliz aniversário! 🎉💛\nAqui é da Fio de Gala! Passando para desejar um dia incrível, cheio de saúde, alegria e muitas conquistas.\nVá a qualquer loja Fio de Gala para comemorar essa data especial e retirar seu presente — válido dentro do mês do seu aniversário, até {validade}!';

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

/** Último dia do mês do aniversário em "DD/MM/AAAA" a partir de "AAAA-MM-DD". */
export const formatBirthdayValidityBR = (isoDate: string) => {
  const [yStr, mStr] = isoDate.slice(0, 10).split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return '';
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${pad2(lastDay)}/${pad2(m)}/${y}`;
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
    validade: formatBirthdayValidityBR(r.birthday_date),
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const uploadBirthdayGiftImage = async (file: File): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem (JPG, PNG ou WebP).');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('A imagem deve ter no máximo 8 MB.');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `birthdays/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error('Erro ao enviar imagem: ' + error.message);
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
};

export const saveBirthdayGiftImage = async (
  imageUrl: string | null,
  userId?: string | null,
  messageTemplate?: string,
): Promise<void> => {
  const payload: {
    gift_image_url: string | null;
    updated_at: string;
    updated_by: string | null;
    message_template?: string;
  } = {
    gift_image_url: imageUrl,
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
  };
  if (messageTemplate !== undefined) {
    payload.message_template = messageTemplate.trim() || DEFAULT_BIRTHDAY_TEMPLATE;
  }
  const { data, error } = await supabase
    .from('birthday_settings')
    .update(payload)
    .eq('id', 1)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const { error: upsertErr } = await supabase.from('birthday_settings').upsert({
      id: 1,
      enabled: true,
      days_before: 0,
      days_after: 0,
      message_template: DEFAULT_BIRTHDAY_TEMPLATE,
      ...payload,
    });
    if (upsertErr) throw upsertErr;
  }
};

export const generateBirthdayMessageFromImage = async (imageUrl: string): Promise<string> => {
  const response = await supabase.functions.invoke('generate-birthday-message', {
    body: { imageUrl },
  });
  const data = response?.data;
  const error = response?.error;
  if (error) throw new Error(error.message || 'Não foi possível gerar a mensagem a partir da imagem.');
  if (data?.error) throw new Error(String(data.error));
  if (!data?.message) throw new Error('A IA não retornou uma mensagem. Tente novamente.');
  return String(data.message);
};

export const imageExtensionFromMime = (mime: string): string => {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'png';
};

export const downloadBlobFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL?.(url), 30_000);
};

export { whatsappLink };