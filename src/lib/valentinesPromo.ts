// Promoção Dia dos Namorados:
// "Compre 1, leve a segunda peça (de menor ou igual valor) com 50% OFF."
// Regra: a cada par de unidades no carrinho, a unidade mais barata do par
// recebe 50% de desconto. Itens "ímpares" (a 3ª, 5ª, etc.) saem integrais.
// Exemplos:
//   2 itens [169,90 / 89,90]  → 89,90 com 50% OFF
//   2 itens [169,90 / 169,90] → 1 deles com 50% OFF
//   3 itens [a > b = c]       → c (mais barata) com 50% OFF
//   4 itens                   → 2 descontos de 50%

export const VALENTINES_PROMO = {
  enabled: true,
  // Janela de vigência (horário de Brasília)
  startsAt: new Date('2026-06-02T00:00:00-03:00'),
  endsAt: new Date('2026-06-12T23:59:59-03:00'),
  label: 'Dia dos Namorados',
  discountPercent: 50,
} as const;

export function isValentinesPromoActive(now: Date = new Date()): boolean {
  if (!VALENTINES_PROMO.enabled) return false;
  return now >= VALENTINES_PROMO.startsAt && now <= VALENTINES_PROMO.endsAt;
}

export interface ValentinesCartLine {
  price: number;
  quantity: number;
}

/**
 * Calcula o valor do desconto da promoção Dia dos Namorados para o carrinho.
 * Expande quantidades em unidades, ordena DESC por preço e aplica 50% OFF
 * em cada unidade de índice ímpar (1, 3, 5...).
 */
export function calculateValentinesDiscount(items: ValentinesCartLine[]): number {
  const units: number[] = [];
  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.quantity || 0));
    for (let i = 0; i < qty; i++) units.push(Number(item.price) || 0);
  }
  if (units.length < 2) return 0;
  units.sort((a, b) => b - a);
  let discount = 0;
  for (let i = 1; i < units.length; i += 2) {
    discount += units[i] * (VALENTINES_PROMO.discountPercent / 100);
  }
  return Math.round(discount * 100) / 100;
}
