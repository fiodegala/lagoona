import { Button } from '@/components/ui/button';
import { ChevronLeft, UserCheck, SkipForward } from 'lucide-react';
import CustomerSelector, { Customer } from '@/components/pos/CustomerSelector';
import { SaleType } from '@/components/pos/ProductSearch';

interface CustomerStepProps {
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  saleType: SaleType;
  onNext: () => void;
  onBack: () => void;
}

const CustomerStep = ({ selectedCustomer, onSelectCustomer, saleType, onNext, onBack }: CustomerStepProps) => {
  const isExchange = saleType === 'troca';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-bold mb-2">Selecione o Cliente</h2>
      <p className="text-muted-foreground mb-8">
        {isExchange
          ? 'É obrigatório selecionar um cliente para troca'
          : 'Vincule um cliente à venda ou pule esta etapa'}
      </p>

      <div className="w-full max-w-md space-y-4">
        <CustomerSelector
          selectedCustomer={selectedCustomer}
          onSelectCustomer={onSelectCustomer}
        />

        {selectedCustomer && (
          <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary/5">
            <div className="p-2 rounded-full bg-primary text-primary-foreground">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">{selectedCustomer.name}</div>
              {selectedCustomer.document && (
                <div className="text-sm text-muted-foreground">{selectedCustomer.document}</div>
              )}
              {selectedCustomer.phone && (
                <div className="text-sm text-muted-foreground">{selectedCustomer.phone}</div>
              )}
            </div>
          </div>
        )}

        {isExchange && !selectedCustomer && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            ⚠️ Selecione um cliente para realizar a troca
          </div>
        )}
      </div>

      <div className="flex gap-4 mt-8">
        <Button variant="outline" size="lg" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        {!isExchange && !selectedCustomer ? (
          <Button variant="secondary" size="lg" onClick={onNext}>
            <SkipForward className="h-4 w-4 mr-2" /> Pular
          </Button>
        ) : (
          <Button size="lg" className="px-12" onClick={onNext} disabled={isExchange && !selectedCustomer}>
            Próximo
          </Button>
        )}
      </div>
    </div>
  );
};

export default CustomerStep;
