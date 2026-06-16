import { Truck, Sparkles, CreditCard } from 'lucide-react';

const TrustBar = () => {
  const items = [
    { icon: Truck, title: 'Frete Grátis', desc: 'Acima de R$ 499,00' },
    { icon: Sparkles, title: 'PIX -5%', desc: 'Desconto à vista' },
    { icon: CreditCard, title: 'Até 6x sem juros', desc: 'No cartão de crédito' },
  ];

  return (
    <div className="w-full" style={{ background: '#002776' }}>
      <div className="container mx-auto px-4 py-2.5">
        <div className="flex items-center justify-center divide-x divide-white/20">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-center gap-2 px-3 md:px-8 text-white">
              <item.icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" style={{ color: '#FFDF00' }} />
              <div className="leading-tight text-center">
                <span className="font-bold text-xs md:text-sm block">{item.title}</span>
                <span className="text-[10px] md:text-xs opacity-80 block">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrustBar;
