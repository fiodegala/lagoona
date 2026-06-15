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
  // Promoção desativada permanentemente
  return false;
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

export interface ValentinesCartLineWithId extends ValentinesCartLine {
  id: string;
}

/**
 * Retorna um mapa { itemId: quantidadeComDesconto } indicando quantas
 * unidades de cada item recebem o desconto da promoção.
 */
export function getValentinesDiscountedUnits(
  items: ValentinesCartLineWithId[]
): Record<string, number> {
  const units: { id: string; price: number }[] = [];
  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.quantity || 0));
    for (let i = 0; i < qty; i++) units.push({ id: item.id, price: Number(item.price) || 0 });
  }
  const result: Record<string, number> = {};
  if (units.length < 2) return result;
  units.sort((a, b) => b.price - a.price);
  for (let i = 1; i < units.length; i += 2) {
    result[units[i].id] = (result[units[i].id] || 0) + 1;
  }
  return result;
}
