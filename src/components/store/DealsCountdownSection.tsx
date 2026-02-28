import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/store/ProductCard';
import { Product } from '@/services/products';

interface DealsCountdownSectionProps {
  products: Product[];
}

const getEndOfDay = () => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end.getTime() - now.getTime();
};

const formatTime = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
};

const TimeBlock = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="bg-store-deal text-white font-bold text-xl md:text-2xl w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-lg shadow-lg shadow-store-deal/30">
      {String(value).padStart(2, '0')}
    </div>
    <span className="text-[10px] md:text-xs text-muted-foreground mt-1 uppercase tracking-wider">{label}</span>
  </div>
);

const DealsCountdownSection = ({ products }: DealsCountdownSectionProps) => {
  const [timeLeft, setTimeLeft] = useState(getEndOfDay);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getEndOfDay());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { hours, minutes, seconds } = formatTime(timeLeft);

  if (products.length === 0) return null;

  return (
    <section className="py-16 md:py-20 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-store-deal/5 via-transparent to-store-deal/5" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-store-deal/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-store-deal/30 to-transparent" />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="p-3 rounded-xl bg-store-deal/10 border border-store-deal/20">
                <Flame className="h-6 w-6 text-store-deal" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-store-deal rounded-full animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-store-deal" />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-store-deal">Tempo limitado</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-display font-bold">Ofertas do Dia</h2>
              <div className="w-12 h-0.5 bg-store-deal mt-2" />
            </div>
          </div>

          {/* Countdown Timer */}
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground uppercase tracking-wider hidden md:block">Termina em:</span>
            <div className="flex items-center gap-2">
              <TimeBlock value={hours} label="Hrs" />
              <span className="text-store-deal font-bold text-xl mt-[-16px]">:</span>
              <TimeBlock value={minutes} label="Min" />
              <span className="text-store-deal font-bold text-xl mt-[-16px]">:</span>
              <TimeBlock value={seconds} label="Seg" />
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {products.slice(0, 5).map((product) => (
            <ProductCard key={product.id} product={product} showDiscount />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Button asChild variant="outline" className="gap-2 border-store-deal/30 text-store-deal hover:bg-store-deal/10 font-semibold">
            <Link to="/loja?ordenar=ofertas">
              Ver todas as ofertas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default DealsCountdownSection;
