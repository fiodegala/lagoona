import { useEffect, useState } from 'react';
import { Truck, Sparkles, CreditCard } from 'lucide-react';

const messages = [
  {
    icon: Truck,
    text: (
      <>
        <strong className="font-semibold">FRETE GRÁTIS</strong> em compras acima de{' '}
        <strong className="font-semibold">R$ 299,00</strong>
      </>
    ),
  },
  {
    icon: Sparkles,
    text: (
      <>
        Pague no <strong className="font-semibold">PIX</strong> e ganhe{' '}
        <strong className="font-semibold">5% OFF</strong> em todo o site
      </>
    ),
  },
  {
    icon: CreditCard,
    text: (
      <>
        Parcele em até <strong className="font-semibold">6x sem juros</strong> no cartão
      </>
    ),
  },
];

const TopAnnouncementBar = () => {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % messages.length);
        setVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const current = messages[index];
  const Icon = current.icon;

  return (
    <div className="bg-store-primary text-store-accent text-xs sm:text-sm overflow-hidden">
      <div className="container mx-auto px-4 py-2 flex items-center justify-center min-h-[36px]">
        <div
          className={`flex items-center gap-2 transition-all duration-300 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
          }`}
        >
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="text-center">{current.text}</span>
        </div>
      </div>
    </div>
  );
};

export default TopAnnouncementBar;
