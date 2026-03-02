import { Button } from '@/components/ui/button';
import { ShoppingBag, Package, Star, RefreshCw } from 'lucide-react';
import { SaleType } from '@/components/pos/ProductSearch';

interface SaleTypeStepProps {
  saleType: SaleType;
  onSelect: (type: SaleType) => void;
  onNext: () => void;
}

const saleTypes = [
  { value: 'varejo' as SaleType, label: 'Varejo', icon: ShoppingBag, description: 'Venda no preço padrão de varejo' },
  { value: 'atacado' as SaleType, label: 'Atacado', icon: Package, description: 'Preço especial para compras em quantidade' },
  { value: 'exclusivo' as SaleType, label: 'Exclusivo', icon: Star, description: 'Preço exclusivo para clientes selecionados' },
  { value: 'troca' as SaleType, label: 'Troca', icon: RefreshCw, description: 'Troca de produtos com devolução e saída' },
];

const SaleTypeStep = ({ saleType, onSelect, onNext }: SaleTypeStepProps) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-bold mb-2">Tipo de Venda</h2>
      <p className="text-muted-foreground mb-8">Selecione o tipo de venda para prosseguir</p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
        {saleTypes.map(({ value, label, icon: Icon, description }) => (
          <button
            key={value}
            className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all hover:shadow-md ${
              saleType === value
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => onSelect(value)}
          >
            <div className={`p-4 rounded-full ${saleType === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Icon className="h-8 w-8" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-lg">{label}</div>
              <div className="text-xs text-muted-foreground mt-1">{description}</div>
            </div>
          </button>
        ))}
      </div>

      <Button size="lg" className="mt-8 px-12" onClick={onNext}>
        Próximo
      </Button>
    </div>
  );
};

export default SaleTypeStep;
