import { useState, useEffect } from 'react';

interface CreditCardMockupProps {
  cardNumber: string;
  cardholderName: string;
  expirationDate: string;
  isFlipped: boolean;
  brand: string;
}

const BRAND_COLORS: Record<string, { gradient: string; accent: string }> = {
  visa: { gradient: 'from-blue-700 via-blue-600 to-blue-800', accent: 'text-blue-200' },
  mastercard: { gradient: 'from-red-700 via-orange-600 to-yellow-600', accent: 'text-orange-200' },
  amex: { gradient: 'from-slate-700 via-slate-600 to-slate-800', accent: 'text-slate-300' },
  elo: { gradient: 'from-yellow-600 via-red-500 to-blue-600', accent: 'text-yellow-200' },
  hipercard: { gradient: 'from-red-800 via-red-700 to-red-900', accent: 'text-red-200' },
  default: { gradient: 'from-zinc-700 via-zinc-600 to-zinc-800', accent: 'text-zinc-300' },
};

const BrandLogo = ({ brand }: { brand: string }) => {
  switch (brand) {
    case 'visa':
      return (
        <div className="text-white font-bold text-2xl italic tracking-tight" style={{ fontFamily: 'serif' }}>
          VISA
        </div>
      );
    case 'mastercard':
      return (
        <div className="flex items-center gap-[-8px]">
          <div className="w-8 h-8 rounded-full bg-red-500 opacity-90" />
          <div className="w-8 h-8 rounded-full bg-yellow-400 opacity-90 -ml-3" />
        </div>
      );
    case 'amex':
      return (
        <div className="text-white font-bold text-sm tracking-widest">
          AMEX
        </div>
      );
    case 'elo':
      return (
        <div className="text-white font-bold text-xl tracking-wider">
          elo
        </div>
      );
    case 'hipercard':
      return (
        <div className="text-white font-bold text-sm tracking-wider">
          HIPERCARD
        </div>
      );
    default:
      return (
        <div className="w-10 h-7 rounded border border-white/30 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-white/40" />
        </div>
      );
  }
};

const formatDisplayNumber = (num: string): string => {
  const clean = num.replace(/\s/g, '');
  const padded = clean.padEnd(16, '•');
  return `${padded.slice(0, 4)} ${padded.slice(4, 8)} ${padded.slice(8, 12)} ${padded.slice(12, 16)}`;
};

const CreditCardMockup = ({
  cardNumber,
  cardholderName,
  expirationDate,
  isFlipped,
  brand,
}: CreditCardMockupProps) => {
  const [displayBrand, setDisplayBrand] = useState(brand || 'default');
  const colors = BRAND_COLORS[displayBrand] || BRAND_COLORS.default;

  useEffect(() => {
    setDisplayBrand(brand || 'default');
  }, [brand]);

  const displayNumber = formatDisplayNumber(cardNumber);
  const displayName = cardholderName.trim() || 'SEU NOME AQUI';
  const displayExpiry = expirationDate || 'MM/AA';

  return (
    <div className="perspective-1000 w-full max-w-[340px] mx-auto mb-6">
      <div
        className={`relative w-full aspect-[1.586/1] transition-transform duration-700 preserve-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${colors.gradient} p-5 sm:p-6 flex flex-col justify-between backface-hidden shadow-2xl overflow-hidden`}
        >
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-white/5" />

          {/* Top row: chip + brand */}
          <div className="flex items-start justify-between relative z-10">
            {/* Chip */}
            <div className="w-11 h-8 rounded-md bg-gradient-to-br from-yellow-300 via-yellow-200 to-yellow-400 shadow-inner flex items-center justify-center">
              <div className="w-7 h-5 rounded-sm border border-yellow-500/40 bg-gradient-to-br from-yellow-100 to-yellow-300" />
            </div>
            <div className="animate-fade-in">
              <BrandLogo brand={displayBrand} />
            </div>
          </div>

          {/* Card number */}
          <div className="relative z-10 mt-4">
            <p className="text-white text-lg sm:text-xl font-mono tracking-[0.2em] drop-shadow-md transition-all duration-300">
              {displayNumber}
            </p>
          </div>

          {/* Bottom row: name + expiry */}
          <div className="flex items-end justify-between relative z-10 mt-3">
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] uppercase tracking-wider ${colors.accent} mb-0.5`}>
                Titular
              </p>
              <p className="text-white text-xs sm:text-sm font-medium uppercase truncate tracking-wide transition-all duration-300">
                {displayName}
              </p>
            </div>
            <div className="text-right ml-4 shrink-0">
              <p className={`text-[10px] uppercase tracking-wider ${colors.accent} mb-0.5`}>
                Validade
              </p>
              <p className="text-white text-xs sm:text-sm font-mono tracking-wider transition-all duration-300">
                {displayExpiry}
              </p>
            </div>
          </div>
        </div>

        {/* Back */}
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${colors.gradient} flex flex-col backface-hidden rotate-y-180 shadow-2xl overflow-hidden`}
        >
          {/* Magnetic stripe */}
          <div className="w-full h-12 bg-zinc-900 mt-6" />

          {/* CVV area */}
          <div className="px-6 mt-4 flex-1">
            <div className="bg-white/90 rounded-md px-4 py-2 flex items-center justify-end">
              <p className="text-zinc-800 font-mono text-sm tracking-widest">•••</p>
            </div>
            <p className={`text-[10px] text-right mt-1 ${colors.accent}`}>CVV</p>
          </div>

          {/* Bottom */}
          <div className="px-6 pb-5 flex items-center justify-between">
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-6 h-4 rounded-sm bg-white/10" />
              ))}
            </div>
            <BrandLogo brand={displayBrand} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditCardMockup;
