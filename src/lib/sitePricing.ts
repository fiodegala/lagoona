/**
 * Preço de varejo exibido no SITE (loja pública).
 * Regra: se o produto/variação tem preço de atacado (>0), o varejo do site é 2× o atacado.
 * Caso contrário, mantém o `price` original.
 *
 * IMPORTANTE: NÃO aplicar no PDV — o PDV usa `product.price` diretamente.
 */
export function siteRetailPrice(input: {
  price?: number | null;
  wholesale_price?: number | null;
} | null | undefined): number {
  if (!input) return 0;
  const wholesale = input.wholesale_price;
  if (wholesale != null && Number(wholesale) > 0) {
    return Number(wholesale) * 2;
  }
  return Number(input.price ?? 0);
}
