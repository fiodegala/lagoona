// Shared Valentine's promo helpers used by edge functions.
// Kept pure (no I/O) so it can be unit-tested with Deno.test.

export interface ValentinesPromoConfig {
  enabled?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  label?: string;
  discount_percent?: number;
}

export const VALENTINES_MAX_INSTALLMENTS = 2;

export function isValentinesPromoActive(
  cfg: ValentinesPromoConfig | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!cfg || !cfg.enabled) return false;
  if (cfg.starts_at && now < new Date(cfg.starts_at)) return false;
  if (cfg.ends_at && now > new Date(cfg.ends_at)) return false;
  return true;
}

/**
 * Returns an error message if the installments value violates the promo rule,
 * or null when it's allowed. `isCard` is true only for credit-card payments
 * (where `token` is present); other methods are not capped.
 */
export function validateInstallmentsForPromo(args: {
  cfg: ValentinesPromoConfig | null | undefined;
  isCard: boolean;
  installments: number;
  now?: Date;
}): string | null {
  const { cfg, isCard, installments, now } = args;
  if (!isCard) return null;
  if (!isValentinesPromoActive(cfg, now)) return null;
  if (Number(installments || 1) > VALENTINES_MAX_INSTALLMENTS) {
    return `Durante a promoção do Dia dos Namorados, o parcelamento máximo é ${VALENTINES_MAX_INSTALLMENTS}x sem juros.`;
  }
  return null;
}
