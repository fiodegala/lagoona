import { useEffect, useState } from 'react';
import { Camera, Gift, Sparkles } from 'lucide-react';
import { getTop5SiteProductNames, isTop5ByName } from '@/lib/topSiteProducts';

interface Props {
  productName: string;
  onWriteReview?: () => void;
}

const ReviewIncentiveBanner = ({ productName, onWriteReview }: Props) => {
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const top = await getTop5SiteProductNames();
        if (!cancelled) setEligible(isTop5ByName(productName, top));
      } catch {
        if (!cancelled) setEligible(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productName]);

  if (!eligible) return null;

  return (
    <button
      type="button"
      onClick={onWriteReview}
      className="w-full text-left rounded-xl border border-store-gold/40 bg-gradient-to-r from-store-gold/10 via-store-gold/5 to-transparent p-4 hover:from-store-gold/15 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-10 w-10 rounded-full bg-store-gold/15 flex items-center justify-center">
          <Gift className="h-5 w-5 text-store-gold" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-store-accent">Ganhe R$ 10 OFF</span>
            <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide bg-store-gold/20 text-store-gold px-2 py-0.5 rounded-full font-semibold">
              <Sparkles className="h-3 w-3" /> Top 5 mais vendidos
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Compre, poste uma <strong className="text-foreground">avaliação com foto</strong> deste produto e receba um cupom de <strong className="text-foreground">R$ 10</strong> para sua próxima compra (mín. R$ 50).
          </p>
          <div className="flex items-center gap-1 text-xs text-store-gold font-medium group-hover:underline">
            <Camera className="h-3.5 w-3.5" />
            Avaliar com foto agora
          </div>
        </div>
      </div>
    </button>
  );
};

export default ReviewIncentiveBanner;
