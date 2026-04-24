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
  Store,
  Video,
  Plus,
  Trash2,
  FileText,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SaleChannel = 'site' | 'instagram' | 'indicacao' | 'grupo_vip' | 'whatsapp' | 'loja_bs' | 'loja_hm44' | 'tiktok';

const allChannelOptions: { value: SaleChannel; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { value: 'site', label: 'Site', icon: <Globe className="h-4 w-4" /> },
  { value: 'instagram', label: 'Instagram', icon: <Instagram className="h-4 w-4" /> },
  { value: 'indicacao', label: 'Indicação', icon: <Users className="h-4 w-4" /> },
  { value: 'grupo_vip', label: 'Grupo VIP', icon: <Crown className="h-4 w-4" /> },
  { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" /> },
  { value: 'loja_bs', label: 'Loja BS', icon: <Store className="h-4 w-4" /> },
  { value: 'loja_hm44', label: 'Loja HM 44', icon: <Store className="h-4 w-4" /> },
  { value: 'tiktok', label: 'TikTok Shop', icon: <Video className="h-4 w-4" />, adminOnly: true },
];

type MixedPaymentType = 'cash' | 'credit' | 'debit' | 'pix';

interface MixedPaymentLine {
  id: string;
  type: MixedPaymentType;
  amount: string;
  installments: string;
}

const paymentTypeLabels: Record<MixedPaymentType, { label: string; icon: React.ReactNode }> = {
  cash: { label: 'Dinheiro', icon: <Banknote className="h-4 w-4" /> },
  credit: { label: 'Crédito', icon: <CreditCard className="h-4 w-4" /> },
  debit: { label: 'Débito', icon: <CreditCard className="h-4 w-4" /> },
  pix: { label: 'PIX', icon: <QrCode className="h-4 w-4" /> },
};

interface PaymentPanelProps {
  total: number;
  onPayment: (
    method: 'cash' | 'card' | 'pix' | 'mixed' | 'boleto' | 'cheque',
    amountReceived?: number,
    paymentDetails?: Record<string, unknown>
  ) => void;
  isProcessing: boolean;
  disabled?: boolean;
  isAdmin?: boolean;
}

const PaymentPanel = ({
  total,
  onPayment,
  isProcessing,
  disabled,
  isAdmin = false,
}: PaymentPanelProps) => {
  const channelOptions = allChannelOptions.filter(ch => !ch.adminOnly || isAdmin);
  const [selectedChannel, setSelectedChannel] = useState<SaleChannel | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card' | 'pix' | 'mixed' | 'boleto' | 'cheque' | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const [installments, setInstallments] = useState('1');
  const [boletoInstallments, setBoletoInstallments] = useState('1');
  const [chequeInstallments, setChequeInstallments] = useState('1');

  // Multi-line mixed payments
  const [mixedLines, setMixedLines] = useState<MixedPaymentLine[]>([
    { id: crypto.randomUUID(), type: 'credit', amount: '', installments: '1' },
    { id: crypto.randomUUID(), type: 'pix', amount: '', installments: '1' },
  ]);

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

  const mixedTotal = mixedLines.reduce((sum, line) => sum + parseCurrency(line.amount), 0);
  const mixedRemaining = total - mixedTotal;

  const installmentValue = total / parseInt(installments);

  const addMixedLine = () => {
    setMixedLines(prev => [
      ...prev,
      { id: crypto.randomUUID(), type: 'pix', amount: '', installments: '1' },
    ]);
  };

  const removeMixedLine = (id: string) => {
    if (mixedLines.length <= 2) return;
    setMixedLines(prev => prev.filter(l => l.id !== id));
  };

  const updateMixedLine = (id: string, updates: Partial<MixedPaymentLine>) => {
    setMixedLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, ...updates };
      // Reset installments when switching to non-credit
      if (updates.type && updates.type !== 'credit') {
        updated.installments = '1';
      }
      return updated;
    }));
  };

  const fillRemainingMixed = (id: string) => {
    const otherTotal = mixedLines
      .filter(l => l.id !== id)
      .reduce((sum, l) => sum + parseCurrency(l.amount), 0);
    const remaining = Math.max(0, total - otherTotal);
    updateMixedLine(id, { amount: remaining.toFixed(2) });
  };

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
      // Build payment details from lines
      const payments = mixedLines
        .filter(l => parseCurrency(l.amount) > 0)
        .map(l => ({
          type: l.type,
          amount: parseCurrency(l.amount),
          installments: l.type === 'credit' ? parseInt(l.installments) : 1,
        }));

      // Build legacy-compatible format + new multi-payment array
      const cashTotal = payments.filter(p => p.type === 'cash').reduce((s, p) => s + p.amount, 0);
      const pixTotal = payments.filter(p => p.type === 'pix').reduce((s, p) => s + p.amount, 0);
      const creditTotal = payments.filter(p => p.type === 'credit').reduce((s, p) => s + p.amount, 0);
      const debitTotal = payments.filter(p => p.type === 'debit').reduce((s, p) => s + p.amount, 0);
      const cardTotal = creditTotal + debitTotal;

      // For legacy compat: pick the first card line's type/installments
      const firstCardLine = payments.find(p => p.type === 'credit' || p.type === 'debit');

      onPayment('mixed', undefined, {
        ...channelInfo,
        cash: cashTotal,
        card: cardTotal,
        pix: pixTotal,
        debit: debitTotal,
        credit: creditTotal,
        mixedCardType: firstCardLine?.type === 'credit' ? 'credit' : 'debit',
        mixedInstallments: firstCardLine?.installments || 1,
        payments, // New: full array of all payment lines
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
      return Math.abs(mixedRemaining) < 0.01 && mixedLines.some(l => parseCurrency(l.amount) > 0);
    }
    return true;
  };

  const quickCashValues = [
    total,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const handleMethodChange = (method: 'cash' | 'card' | 'pix' | 'mixed') => {
    setSelectedMethod(method);
    if (method !== 'card') {
      setCardType('credit');
      setInstallments('1');
    }
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto max-h-full">
      {/* Channel selector */}
      <div>
        <h3 className="font-semibold mb-3">Canal do Cliente</h3>
        <div className="flex flex-wrap gap-2">
          {channelOptions.map((ch) => (
            <Button
              key={ch.value}
              variant={selectedChannel === ch.value ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              onClick={() => setSelectedChannel(ch.value)}
              disabled={disabled}
            >
              {ch.icon}
              {ch.label}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

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
          <div className="space-y-2">
            <Label>Tipo de Cartão</Label>
            <RadioGroup
              value={cardType}
              onValueChange={(value) => {
                setCardType(value as 'credit' | 'debit');
                if (value === 'debit') setInstallments('1');
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="credit" id="credit" />
                <Label htmlFor="credit" className="cursor-pointer font-normal">Crédito</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="debit" id="debit" />
                <Label htmlFor="debit" className="cursor-pointer font-normal">Débito</Label>
              </div>
            </RadioGroup>
          </div>

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

      {/* Mixed payment details — MULTIMODAL */}
      {selectedMethod === 'mixed' && (
        <div className="space-y-3">
          <Separator />
          <div className="space-y-3">
            {mixedLines.map((line, index) => (
              <div key={line.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Pagamento {index + 1}
                  </span>
                  {mixedLines.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => removeMixedLine(line.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Payment type selector */}
                <div className="grid grid-cols-4 gap-1">
                  {(['cash', 'credit', 'debit', 'pix'] as MixedPaymentType[]).map((type) => (
                    <Button
                      key={type}
                      variant={line.type === type ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs gap-1 px-1.5"
                      onClick={() => updateMixedLine(line.id, { type })}
                    >
                      {paymentTypeLabels[type].icon}
                      <span className="hidden sm:inline">{paymentTypeLabels[type].label}</span>
                    </Button>
                  ))}
                </div>

                {/* Amount */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="R$ 0,00"
                      value={line.amount}
                      onChange={(e) => updateMixedLine(line.id, { amount: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs whitespace-nowrap"
                    onClick={() => fillRemainingMixed(line.id)}
                  >
                    Restante
                  </Button>
                </div>

                {/* Credit installments */}
                {line.type === 'credit' && parseCurrency(line.amount) > 0 && (
                  <Select
                    value={line.installments}
                    onValueChange={(v) => updateMixedLine(line.id, { installments: v })}
                  >
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue placeholder="Parcelas" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {Array.from({ length: 6 }, (_, i) => i + 1).map((num) => {
                        const val = parseCurrency(line.amount) / num;
                        return (
                          <SelectItem key={num} value={num.toString()}>
                            {num}x de {formatCurrency(val)}
                            {num === 1 && ' (à vista)'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>

          {/* Add payment line */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={addMixedLine}
          >
            <Plus className="h-4 w-4" />
            Adicionar forma de pagamento
          </Button>

          {/* Remaining indicator */}
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
                  : 'Valor correto ✓'}
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
