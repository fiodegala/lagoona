import { Button } from '@/components/ui/button';
import { ShoppingBag, Package, Star, RefreshCw, FileText, Gift, Users } from 'lucide-react';
import { SaleType } from '@/components/pos/ProductSearch';

export type QuotePriceMode = 'varejo' | 'atacado' | 'exclusivo';

interface SaleTypeStepProps {
  saleType: SaleType;
  onSelect: (type: SaleType) => void;
  onNext: () => void;
  quotePriceMode?: QuotePriceMode;
  onQuotePriceModeSelect?: (mode: QuotePriceMode) => void;
}

const saleTypes = [
  { value: 'varejo' as SaleType, label: 'Varejo', icon: ShoppingBag, description: 'Venda no preço padrão de varejo' },
  { value: 'atacado' as SaleType, label: 'Atacado', icon: Package, description: 'Preço especial para compras em quantidade' },
  { value: 'exclusivo' as SaleType, label: 'Exclusivo', icon: Star, description: 'Preço exclusivo para clientes selecionados' },
  { value: 'troca' as SaleType, label: 'Troca', icon: RefreshCw, description: 'Troca de produtos com devolução e saída' },
  { value: 'orcamento' as SaleType, label: 'Orçamento', icon: FileText, description: 'Gera orçamento sem registrar venda' },
  { value: 'brinde' as SaleType, label: 'Brinde', icon: Gift, description: 'Saída de produto sem valor (cortesia)' },
];

const quotePriceModes: { value: QuotePriceMode; label: string; icon: typeof ShoppingBag; description: string }[] = [
  { value: 'varejo', label: 'Varejo', icon: ShoppingBag, description: 'Preços de varejo no orçamento' },
  { value: 'atacado', label: 'Atacado', icon: Package, description: 'Preços de atacado no orçamento' },
  { value: 'exclusivo', label: 'Exclusivo', icon: Star, description: 'Preços exclusivos no orçamento' },
];

const SaleTypeStep = ({ saleType, onSelect, onNext, quotePriceMode = 'varejo', onQuotePriceModeSelect }: SaleTypeStepProps) => {
  const isQuote = saleType === 'orcamento';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-2">Tipo de Venda</h2>
      <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 text-center">Selecione o tipo de venda para prosseguir</p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-lg">
        {saleTypes.map(({ value, label, icon: Icon, description }) => (
          <button
            key={value}
            className={`flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-xl border-2 transition-all hover:shadow-md ${
              saleType === value
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => onSelect(value)}
          >
            <div className={`p-3 sm:p-4 rounded-full ${saleType === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Icon className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-base sm:text-lg">{label}</div>
              <div className="text-xs text-muted-foreground mt-1 hidden sm:block">{description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Sub-selection for quote price mode */}
      {isQuote && (
        <div className="mt-6 w-full max-w-lg">
          <p className="text-sm font-medium text-center mb-3">Modalidade de preço do orçamento:</p>
          <div className="grid grid-cols-3 gap-3">
            {quotePriceModes.map(({ value, label, icon: Icon, description }) => (
              <button
                key={value}
                className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-lg border-2 transition-all hover:shadow-sm ${
                  quotePriceMode === value
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => onQuotePriceModeSelect?.(value)}
              >
                <Icon className={`h-5 w-5 ${quotePriceMode === value ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-center">
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <Button size="lg" className="mt-6 sm:mt-8 px-12" onClick={onNext}>
        Próximo
      </Button>
    </div>
  );
};

export default SaleTypeStep;
