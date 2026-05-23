import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, CreditCard, User } from 'lucide-react';
import { Customer } from '@/components/pos/CustomerSelector';

interface GiftCardAmountStepProps {
  selectedCustomer: Customer | null;
  initialAmount: number;
  onConfirm: (amount: number) => void;
  onBack: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const presets = [50, 100, 150, 200, 300, 500];

const GiftCardAmountStep = ({ selectedCustomer, initialAmount, onConfirm, onBack }: GiftCardAmountStepProps) => {
  const [amount, setAmount] = useState<string>(initialAmount > 0 ? initialAmount.toFixed(2).replace('.', ',') : '');

  useEffect(() => {
    if (initialAmount > 0) setAmount(initialAmount.toFixed(2).replace('.', ','));
  }, [initialAmount]);

  const parsedAmount = (() => {
    const cleaned = amount.replace(/[^\d,\.]/g, '').replace('.', '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  })();

  const canContinue = parsedAmount > 0 && !!selectedCustomer;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-2xl mx-auto w-full">
      <div className="w-full flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>

      <div className="p-4 rounded-full bg-primary/10 mb-4">
        <CreditCard className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-1">Cartão Presente</h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Defina o valor que o cliente está pagando. O valor virará saldo de crédito para ele resgatar depois. Nenhum produto sai do estoque agora.
      </p>

      {selectedCustomer ? (
        <div className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card mb-6">
          <User className="h-5 w-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Cliente que receberá o saldo</div>
            <div className="font-semibold truncate">{selectedCustomer.name}</div>
            {selectedCustomer.document && (
              <div className="text-xs text-muted-foreground">{selectedCustomer.document}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full p-3 rounded-lg border border-destructive/40 bg-destructive/5 text-sm text-destructive mb-6">
          Selecione um cliente na etapa anterior para vincular o saldo.
        </div>
      )}

      <div className="w-full space-y-3">
        <Label htmlFor="gift-card-amount" className="text-base">Valor do Cartão Presente</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
          <Input
            id="gift-card-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="pl-10 h-14 text-2xl font-bold"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {presets.map((p) => (
            <Button
              key={p}
              type="button"
              variant="outline"
              onClick={() => setAmount(p.toFixed(2).replace('.', ','))}
            >
              {formatCurrency(p)}
            </Button>
          ))}
        </div>
      </div>

      <Button
        size="lg"
        className="mt-8 px-12"
        onClick={() => onConfirm(parsedAmount)}
        disabled={!canContinue}
      >
        Ir para Pagamento • {formatCurrency(parsedAmount)}
      </Button>
    </div>
  );
};

export default GiftCardAmountStep;
