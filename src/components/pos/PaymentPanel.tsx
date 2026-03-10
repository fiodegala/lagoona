import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Banknote,
  CreditCard,
  QrCode,
  Split,
  Loader2,
  Globe,
  Instagram,
  Users,
  Crown,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SaleChannel = 'site' | 'instagram' | 'indicacao' | 'grupo_vip' | 'whatsapp';

const channelOptions: { value: SaleChannel; label: string; icon: React.ReactNode }[] = [
  { value: 'site', label: 'Site', icon: <Globe className="h-4 w-4" /> },
  { value: 'instagram', label: 'Instagram', icon: <Instagram className="h-4 w-4" /> },
  { value: 'indicacao', label: 'Indicação', icon: <Users className="h-4 w-4" /> },
  { value: 'grupo_vip', label: 'Grupo VIP', icon: <Crown className="h-4 w-4" /> },
  { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" /> },
];

interface PaymentPanelProps {
  total: number;
  onPayment: (
    method: 'cash' | 'card' | 'pix' | 'mixed',
    amountReceived?: number,
    paymentDetails?: Record<string, unknown>
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
  const [selectedChannel, setSelectedChannel] = useState<SaleChannel | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card' | 'pix' | 'mixed' | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const [installments, setInstallments] = useState('1');
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

  const installmentValue = total / parseInt(installments);

  const handlePayment = () => {
    if (!selectedMethod || !selectedChannel) return;

    const channelInfo = { channel: selectedChannel };

    if (selectedMethod === 'cash') {
      onPayment('cash', parseCurrency(cashReceived), channelInfo);
    } else if (selectedMethod === 'card') {
      onPayment('card', undefined, {
        ...channelInfo,
        cardType,
        installments: cardType === 'credit' ? parseInt(installments) : 1,
        installmentValue: cardType === 'credit' ? installmentValue : total,
      });
    } else if (selectedMethod === 'mixed') {
      onPayment('mixed', undefined, {
        ...channelInfo,
        cash: parseCurrency(mixedAmounts.cash),
        card: parseCurrency(mixedAmounts.card),
        pix: parseCurrency(mixedAmounts.pix),
      });
    } else {
      onPayment(selectedMethod, undefined, channelInfo);
    }
  };

  const canPay = () => {
    if (disabled || isProcessing || !selectedMethod || !selectedChannel) return false;
    
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

  // Reset card options when switching methods
  const handleMethodChange = (method: 'cash' | 'card' | 'pix' | 'mixed') => {
    setSelectedMethod(method);
    if (method !== 'card') {
      setCardType('credit');
      setInstallments('1');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold mb-3">Forma de Pagamento</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={selectedMethod === 'cash' ? 'default' : 'outline'}
            className="h-16 flex-col gap-1"
            onClick={() => handleMethodChange('cash')}
            disabled={disabled}
          >
            <Banknote className="h-6 w-6" />
            <span>Dinheiro</span>
          </Button>
          <Button
            variant={selectedMethod === 'card' ? 'default' : 'outline'}
            className="h-16 flex-col gap-1"
            onClick={() => handleMethodChange('card')}
            disabled={disabled}
          >
            <CreditCard className="h-6 w-6" />
            <span>Cartão</span>
          </Button>
          <Button
            variant={selectedMethod === 'pix' ? 'default' : 'outline'}
            className="h-16 flex-col gap-1"
            onClick={() => handleMethodChange('pix')}
            disabled={disabled}
          >
            <QrCode className="h-6 w-6" />
            <span>PIX</span>
          </Button>
          <Button
            variant={selectedMethod === 'mixed' ? 'default' : 'outline'}
            className="h-16 flex-col gap-1"
            onClick={() => handleMethodChange('mixed')}
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

      {/* Card payment details */}
      {selectedMethod === 'card' && (
        <div className="space-y-4">
          <Separator />
          
          {/* Credit/Debit selection */}
          <div className="space-y-2">
            <Label>Tipo de Cartão</Label>
            <RadioGroup
              value={cardType}
              onValueChange={(value) => {
                setCardType(value as 'credit' | 'debit');
                if (value === 'debit') {
                  setInstallments('1');
                }
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="credit" id="credit" />
                <Label htmlFor="credit" className="cursor-pointer font-normal">
                  Crédito
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="debit" id="debit" />
                <Label htmlFor="debit" className="cursor-pointer font-normal">
                  Débito
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Installments (credit only) */}
          {cardType === 'credit' && (
            <div className="space-y-2">
              <Label>Parcelas</Label>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione as parcelas" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {Array.from({ length: 6 }, (_, i) => i + 1).map((num) => {
                    const value = total / num;
                    return (
                      <SelectItem key={num} value={num.toString()}>
                        {num}x de {formatCurrency(value)}
                        {num === 1 && ' (à vista)'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              {/* Installment summary */}
              <div className="bg-primary/10 rounded-lg p-3 text-center mt-3">
                <div className="text-sm text-muted-foreground">
                  {parseInt(installments) === 1 ? 'Pagamento à vista' : `${installments}x de`}
                </div>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(installmentValue)}
                </div>
                {parseInt(installments) > 1 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Total: {formatCurrency(total)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Debit summary */}
          {cardType === 'debit' && (
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <div className="text-sm text-muted-foreground">Débito à vista</div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(total)}
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
