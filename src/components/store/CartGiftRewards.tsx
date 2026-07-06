import { useEffect, useState } from 'react';
import { Gift, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const PROMO_START = new Date('2026-07-09T00:00:00-03:00');

const TIERS = [
  { min: 199, label: 'Abridor Premium em Aço Inox', tier: 1 as const },
  { min: 349, label: 'Fone Bluetooth Premium', tier: 2 as const },
  { min: 649, label: 'SmartWatch Premium', tier: 3 as const, limit: 10 },
];

const formatPrice = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface Props {
  subtotal: number;
  compact?: boolean;
}

export const CartGiftRewards = ({ subtotal, compact }: Props) => {
  const now = new Date();
  const active = now >= PROMO_START;
  const [smartwatchRemaining, setSmartwatchRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('total', 649)
        .gte('created_at', PROMO_START.toISOString())
        .neq('status', 'cancelled');
      if (!cancelled) {
        const used = count ?? 0;
        setSmartwatchRemaining(Math.max(0, 10 - used));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, subtotal]);

  if (!active) return null;

  const earned: { label: string; tier: number; note?: string }[] = [];
  const next: { label: string; missing: number } | null = (() => {
    for (const t of TIERS) {
      if (subtotal >= t.min) {
        if (t.tier === 3) {
          if (smartwatchRemaining === null || smartwatchRemaining > 0) {
            earned.push({
              label: t.label,
              tier: t.tier,
              note:
                smartwatchRemaining !== null
                  ? `Restam ${smartwatchRemaining} de 10 unidades!`
                  : 'Limitado às 10 primeiras compras!',
            });
          }
        } else {
          earned.push({ label: t.label, tier: t.tier });
        }
      }
    }
    const upcoming = TIERS.find((t) => subtotal < t.min);
    if (!upcoming) return null;
    if (upcoming.tier === 3 && smartwatchRemaining === 0) return null;
    return { label: upcoming.label, missing: upcoming.min - subtotal };
  })();

  if (earned.length === 0 && !next) return null;

  return (
    <div className={`space-y-2 ${compact ? '' : 'my-3'}`}>
      {earned.map((e) => (
        <div
          key={e.tier}
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs"
        >
          <Gift className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              🎁 Brinde conquistado: {e.label}
            </p>
            {e.note && (
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                {e.note}
              </p>
            )}
          </div>
        </div>
      ))}
      {next && (
        <div className="flex items-start gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2.5 text-xs">
          <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p className="flex-1">
            Faltam <strong>{formatPrice(next.missing)}</strong> para ganhar{' '}
            <strong>{next.label}</strong> de brinde!
          </p>
        </div>
      )}
    </div>
  );
};

export default CartGiftRewards;
