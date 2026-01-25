import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Banknote,
  CreditCard,
  QrCode,
  Split,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentPanelProps {
  total: number;
  onPayment: (
    method: 'cash' | 'card' | 'pix' | 'mixed',
    amountReceived?: number,
    paymentDetails?: Record<string, number>
  ) => void;
  isProcessing: boolean;
  disabled?: boolean;
}

const PaymentPanel = ({
  total,
  onPayment,
  isProcessing,
  disabled,
}: PaymentPanelProps) => {
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card' | 'pix' | 'mixed' | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [mixedAmounts, setMixedAmounts] = useState({
    cash: '',
    card: '',
    pix: '',
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const parseCurrency = (value: string) => {
    return parseFloat(value.replace(',', '.')) || 0;
  };

  const cashChange = selectedMethod === 'cash' 
    ? Math.max(0, parseCurrency(cashReceived) - total) 
    : 0;

  const mixedTotal = 
    parseCurrency(mixedAmounts.cash) +
    parseCurrency(mixedAmounts.card) +
    parseCurrency(mixedAmounts.pix);

  const mixedRemaining = total - mixedTotal;

  const handlePayment = () => {
    if (!selectedMethod) return;

    if (selectedMethod === 'cash') {
      onPayment('cash', parseCurrency(cashReceived));
    } else if (selectedMethod === 'mixed') {
      onPayment('mixed', undefined, {
        cash: parseCurrency(mixedAmounts.cash),
        card: parseCurrency(mixedAmounts.card),
        pix: parseCurrency(mixedAmounts.pix),
      });
    } else {
      onPayment(selectedMethod);
    }
  };

  const canPay = () => {
    if (disabled || isProcessing || !selectedMethod) return false;
    
    if (selectedMethod === 'cash') {
      return parseCurrency(cashReceived) >= total;
    }
    if (selectedMethod === 'mixed') {
      return Math.abs(mixedRemaining) < 0.01;
    }
    return true;
  };

  const quickCashValues = [
    total,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold mb-3">Forma de Pagamento</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={selectedMethod === 'cash' ? 'default' : 'outline'}
            className="h-16 flex-col gap-1"
            onClick={() => setSelectedMethod('cash')}
            disabled={disabled}
          >
            <Banknote className="h-6 w-6" />
            <span>Dinheiro</span>
          </Button>
          <Button
            variant={selectedMethod === 'card' ? 'default' : 'outline'}
            className="h-16 flex-col gap-1"
            onClick={() => setSelectedMethod('card')}
            disabled={disabled}
          >
            <CreditCard className="h-6 w-6" />
            <span>Cartão</span>
          </Button>
          <Button
            variant={selectedMethod === 'pix' ? 'default' : 'outline'}
            className="h-16 flex-col gap-1"
            onClick={() => setSelectedMethod('pix')}
            disabled={disabled}
          >
            <QrCode className="h-6 w-6" />
            <span>PIX</span>
          </Button>
          <Button
            variant={selectedMethod === 'mixed' ? 'default' : 'outline'}
            className="h-16 flex-col gap-1"
            onClick={() => setSelectedMethod('mixed')}
            disabled={disabled}
          >
            <Split className="h-6 w-6" />
            <span>Misto</span>
          </Button>
        </div>
      </div>

      {/* Cash payment details */}
      {selectedMethod === 'cash' && (
        <div className="space-y-3">
          <Separator />
          <div>
            <Label>Valor recebido</Label>
            <Input
              type="number"
              placeholder="R$ 0,00"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              className="text-lg h-12 mt-1"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {quickCashValues.map((value) => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                onClick={() => setCashReceived(value.toString())}
              >
                {formatCurrency(value)}
              </Button>
            ))}
          </div>
          {parseCurrency(cashReceived) >= total && (
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <div className="text-sm text-muted-foreground">Troco</div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(cashChange)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mixed payment details */}
      {selectedMethod === 'mixed' && (
        <div className="space-y-3">
          <Separator />
          <div className="grid gap-3">
            <div>
              <Label className="flex items-center gap-2">
                <Banknote className="h-4 w-4" /> Dinheiro
              </Label>
              <Input
                type="number"
                placeholder="R$ 0,00"
                value={mixedAmounts.cash}
                onChange={(e) =>
                  setMixedAmounts({ ...mixedAmounts, cash: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Cartão
              </Label>
              <Input
                type="number"
                placeholder="R$ 0,00"
                value={mixedAmounts.card}
                onChange={(e) =>
                  setMixedAmounts({ ...mixedAmounts, card: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <QrCode className="h-4 w-4" /> PIX
              </Label>
              <Input
                type="number"
                placeholder="R$ 0,00"
                value={mixedAmounts.pix}
                onChange={(e) =>
                  setMixedAmounts({ ...mixedAmounts, pix: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>
          <div
            className={cn(
              'rounded-lg p-3 text-center',
              Math.abs(mixedRemaining) < 0.01
                ? 'bg-green-500/10 text-green-600'
                : mixedRemaining > 0
                  ? 'bg-orange-500/10 text-orange-600'
                  : 'bg-destructive/10 text-destructive'
            )}
          >
            <div className="text-sm">
              {mixedRemaining > 0.01
                ? 'Falta'
                : mixedRemaining < -0.01
                  ? 'Excedente'
                  : 'Valor correto'}
            </div>
            <div className="text-xl font-bold">
              {formatCurrency(Math.abs(mixedRemaining))}
            </div>
          </div>
        </div>
      )}

      {/* Confirm button */}
      <Button
        className="w-full h-14 text-lg gap-2"
        onClick={handlePayment}
        disabled={!canPay()}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            Finalizar - {formatCurrency(total)}
          </>
        )}
      </Button>
    </div>
  );
};

export default PaymentPanel;
