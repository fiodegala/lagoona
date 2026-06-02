// Promoção Dia dos Namorados:
// "Compre 1, leve a segunda peça (de menor ou igual valor) com 50% OFF."
// A cada par de unidades, a unidade mais barata do par recebe 50% de desconto.

export const VALENTINES_CONFIG_KEY = 'valentines_promo';

export interface ValentinesPromoConfig {
  enabled: boolean;
  starts_at: string | null; // ISO
  ends_at: string | null;   // ISO
  label: string;
  discount_percent: number; // 0-100
}

export const DEFAULT_VALENTINES_CONFIG: ValentinesPromoConfig = {
  enabled: false,
  starts_at: null,
  ends_at: null,
  label: 'Dia dos Namorados',
  discount_percent: 50,
};

export function isValentinesPromoActive(
  config: ValentinesPromoConfig | null | undefined,
  now: Date = new Date()
): boolean {
  if (!config || !config.enabled) return false;
  if (config.starts_at && now < new Date(config.starts_at)) return false;
  if (config.ends_at && now > new Date(config.ends_at)) return false;
  return true;
}

export interface ValentinesCartLine {
  price: number;
  quantity: number;
}

/**
 * Expande quantidades em unidades, ordena DESC por preço e aplica X% OFF
 * em cada unidade de índice ímpar (1, 3, 5...).
 */
export function calculateValentinesDiscount(
  items: ValentinesCartLine[],
  discountPercent: number = DEFAULT_VALENTINES_CONFIG.discount_percent
): number {
  const units: number[] = [];
  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.quantity || 0));
    for (let i = 0; i < qty; i++) units.push(Number(item.price) || 0);
  }
  if (units.length < 2) return 0;
  units.sort((a, b) => b - a);
  let discount = 0;
  const factor = Math.max(0, Math.min(100, discountPercent)) / 100;
  for (let i = 1; i < units.length; i += 2) {
    discount += units[i] * factor;
  }
  return Math.round(discount * 100) / 100;
}
