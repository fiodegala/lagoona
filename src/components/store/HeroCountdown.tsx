import { Flame } from 'lucide-react';
import { useDealsCountdown } from '@/hooks/useDealsCountdown';

interface Props {
  /** When true, render compact dark variant for inline announcement bar */
  compact?: boolean;
}

const Block = ({ value, label, compact }: { value: number; label: string; compact?: boolean }) => (
  <div className="flex flex-col items-center">
    <div
      className={
        compact
          ? 'bg-white/15 text-white font-bold text-xs px-1.5 py-0.5 rounded min-w-[26px] text-center tabular-nums'
          : 'bg-store-deal text-white font-bold text-lg md:text-2xl w-11 h-11 md:w-14 md:h-14 flex items-center justify-center rounded-lg shadow-lg shadow-store-deal/40 tabular-nums'
      }
    >
      {String(value).padStart(2, '0')}
    </div>
    {!compact && (
      <span className="text-[10px] md:text-xs text-white/70 mt-1 uppercase tracking-wider">
        {label}
      </span>
    )}
  </div>
);

const Sep = ({ compact }: { compact?: boolean }) => (
  <span className={compact ? 'text-white/60 font-bold text-xs' : 'text-white/60 font-bold text-lg md:text-2xl pb-5'}>
    :
  </span>
);

const HeroCountdown = ({ compact = false }: Props) => {
  const { time, active } = useDealsCountdown();

  if (!active) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-store-gold" />
        <span className="font-semibold">OFERTA TERMINA EM</span>
        <div className="flex items-center gap-1">
          {time.days > 0 && (
            <>
              <Block value={time.days} label="d" compact />
              <Sep compact />
            </>
          )}
          <Block value={time.hours} label="h" compact />
          <Sep compact />
          <Block value={time.minutes} label="m" compact />
          <Sep compact />
          <Block value={time.seconds} label="s" compact />
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-2 bg-store-dark/70 backdrop-blur-sm border border-store-gold/30 rounded-xl px-5 py-4 mb-6">
      <div className="flex items-center gap-2 text-store-gold uppercase tracking-[0.2em] text-[10px] md:text-xs font-semibold">
        <Flame className="h-4 w-4" />
        Oferta termina em
      </div>
      <div className="flex items-end gap-2">
        {time.days > 0 && (
          <>
            <Block value={time.days} label="dias" />
            <Sep />
          </>
        )}
        <Block value={time.hours} label="horas" />
        <Sep />
        <Block value={time.minutes} label="min" />
        <Sep />
        <Block value={time.seconds} label="seg" />
      </div>
    </div>
  );
};

export default HeroCountdown;
