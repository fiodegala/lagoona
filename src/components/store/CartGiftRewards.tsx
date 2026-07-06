import { useEffect, useMemo, useState } from 'react';
import { Gift, Check, Lock, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const PROMO_START = new Date('2026-07-09T00:00:00-03:00');
const STORAGE_KEY = 'cart-gift-choice';

type TierId = 'opener' | 'headphones' | 'smartwatch';

interface Tier {
  id: TierId;
  min: number;
  label: string;
  short: string;
  emoji: string;
  limited?: number;
}

const TIERS: Tier[] = [
  { id: 'opener', min: 199, label: 'Abridor Premium em Aço Inox', short: 'Abridor', emoji: '🍾' },
  { id: 'headphones', min: 349, label: 'Fone Bluetooth Premium', short: 'Fone Bluetooth', emoji: '🎧' },
  { id: 'smartwatch', min: 649, label: 'SmartWatch Premium', short: 'SmartWatch', emoji: '⌚', limited: 10 },
];

const formatPrice = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface Props {
  subtotal: number;
  compact?: boolean;
}

export const CartGiftRewards = ({ subtotal, compact }: Props) => {
  const active = new Date() >= PROMO_START;
  const [smartwatchRemaining, setSmartwatchRemaining] = useState<number | null>(null);
  const [choice, setChoice] = useState<TierId | null>(() => {
    if (typeof window === 'undefined') return null;
    return (localStorage.getItem(STORAGE_KEY) as TierId | null) || null;
  });

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
      if (!cancelled) setSmartwatchRemaining(Math.max(0, 10 - (count ?? 0)));
    })();
    return () => {
      cancelled = true;
    };
  }, [active, subtotal]);

  // Eligible tiers given current subtotal + slot availability
  const eligible = useMemo(
    () =>
      TIERS.filter((t) => {
        if (subtotal < t.min) return false;
        if (t.id === 'smartwatch' && smartwatchRemaining !== null && smartwatchRemaining <= 0)
          return false;
        return true;
      }),
    [subtotal, smartwatchRemaining],
  );

  // Auto-select highest eligible if none chosen or current choice no longer eligible
  useEffect(() => {
    if (eligible.length === 0) return;
    const current = eligible.find((t) => t.id === choice);
    if (!current) {
      const best = eligible[eligible.length - 1];
      setChoice(best.id);
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, best.id);
    }
  }, [eligible, choice]);

  const selectChoice = (id: TierId) => {
    setChoice(id);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, id);
  };

  if (!active) return null;

  const maxTierValue = TIERS[TIERS.length - 1].min;
  const progressPct = Math.min(100, (subtotal / maxTierValue) * 100);
  const nextTier = TIERS.find((t) => subtotal < t.min);
  const chosen = eligible.find((t) => t.id === choice) ?? null;

  return (
    <div className={`rounded-lg border border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-amber-500/10 p-3 ${compact ? '' : 'my-3'} space-y-3`}>
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Brinde exclusivo — escolha 1 prêmio
        </p>
      </div>

      {/* Progress bar */}
      <div className="relative pt-6 pb-8">
        <div className="h-2 rounded-full bg-amber-500/15 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {TIERS.map((t) => {
          const reached = subtotal >= t.min;
          const soldOut = t.id === 'smartwatch' && smartwatchRemaining !== null && smartwatchRemaining <= 0;
          const leftPct = Math.min(100, (t.min / maxTierValue) * 100);
          return (
            <div
              key={t.id}
              className="absolute top-0 flex flex-col items-center -translate-x-1/2"
              style={{ left: `${leftPct}%` }}
            >
              <span className="text-[10px] font-medium text-amber-900/80 dark:text-amber-200/80 whitespace-nowrap">
                {formatPrice(t.min)}
              </span>
              <div
                className={`mt-4 h-4 w-4 rounded-full border-2 flex items-center justify-center text-[8px] ${
                  reached && !soldOut
                    ? 'bg-amber-500 border-amber-600 text-white'
                    : soldOut
                      ? 'bg-muted border-muted-foreground/40 text-muted-foreground'
                      : 'bg-background border-amber-500/50'
                }`}
              >
                {reached && !soldOut ? <Check className="h-2.5 w-2.5" /> : soldOut ? <Lock className="h-2 w-2" /> : null}
              </div>
              <span className="mt-1 text-[10px] whitespace-nowrap text-muted-foreground">
                {t.emoji} {t.short}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {nextTier ? (
        <p className="text-xs text-amber-900/90 dark:text-amber-200/90 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Faltam <strong>{formatPrice(nextTier.min - subtotal)}</strong> para desbloquear{' '}
          <strong>{nextTier.label}</strong>
          {nextTier.id === 'smartwatch' && smartwatchRemaining !== null && smartwatchRemaining > 0 && (
            <span className="text-[11px] text-amber-800/70 dark:text-amber-300/70">
              — só restam {smartwatchRemaining}/10!
            </span>
          )}
        </p>
      ) : (
        <p className="text-xs text-amber-900/90 dark:text-amber-200/90 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Você desbloqueou todos os brindes disponíveis! Escolha o seu favorito abaixo.
        </p>
      )}

      {/* Choice selector */}
      {eligible.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-amber-900/90 dark:text-amber-200/90 uppercase tracking-wide">
            Seu brinde:
          </p>
          <div className="grid gap-1.5">
            {eligible.map((t) => {
              const isChosen = chosen?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectChoice(t.id)}
                  className={`flex items-center justify-between rounded-md border px-2.5 py-2 text-left text-xs transition-all ${
                    isChosen
                      ? 'border-amber-600 bg-amber-500/15 shadow-sm'
                      : 'border-amber-500/30 bg-background hover:bg-amber-500/5'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center ${
                        isChosen ? 'border-amber-600 bg-amber-600' : 'border-amber-500/40'
                      }`}
                    >
                      {isChosen && <Check className="h-2 w-2 text-white" />}
                    </span>
                    <span className="font-medium">
                      {t.emoji} {t.label}
                    </span>
                  </span>
                  {t.id === 'smartwatch' && smartwatchRemaining !== null && (
                    <span className="text-[10px] text-amber-800/70 dark:text-amber-300/70">
                      {smartwatchRemaining}/10
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground pt-1">
            Apenas 1 brinde por pedido. Sua escolha será registrada junto com o pedido.
          </p>
        </div>
      )}
    </div>
  );
};

export default CartGiftRewards;
