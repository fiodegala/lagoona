import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Banknote, CreditCard, QrCode, Split, FileText, ScrollText, Plus, Trash2, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { auditService } from '@/services/auditService';

type PaymentMethod = 'cash' | 'card' | 'pix' | 'mixed' | 'boleto' | 'cheque';
type MixedPaymentType = 'cash' | 'credit' | 'debit' | 'pix' | 'boleto' | 'cheque';

interface MixedLine {
  id: string;
  type: MixedPaymentType;
  amount: string;
  installments: string;
}

const installmentEligibleTypes: MixedPaymentType[] = ['credit', 'boleto', 'cheque'];
const maxInstallmentsByType: Record<MixedPaymentType, number> = {
  cash: 1, credit: 6, debit: 1, pix: 1, boleto: 12, cheque: 12,
};

const paymentTypeLabels: Record<MixedPaymentType, { label: string; icon: React.ReactNode }> = {
  cash: { label: 'Dinheiro', icon: <Banknote className="h-4 w-4" /> },
  credit: { label: 'Crédito', icon: <CreditCard className="h-4 w-4" /> },
  debit: { label: 'Débito', icon: <CreditCard className="h-4 w-4" /> },
  pix: { label: 'PIX', icon: <QrCode className="h-4 w-4" /> },
  boleto: { label: 'Boleto', icon: <FileText className="h-4 w-4" /> },
  cheque: { label: 'Cheque', icon: <ScrollText className="h-4 w-4" /> },
};

interface EditPaymentMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: any;
  onUpdated?: (updatedSale: any) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const parseCurrency = (v: string) => parseFloat(v.replace(',', '.')) || 0;

const EditPaymentMethodModal = ({ open, onOpenChange, sale, onUpdated }: EditPaymentMethodModalProps) => {
  const total = Number(sale?.total || 0);
  const existingDetails: Record<string, any> = sale?.payment_details || {};

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const [installments, setInstallments] = useState('1');
  const [boletoInstallments, setBoletoInstallments] = useState('1');
  const [chequeInstallments, setChequeInstallments] = useState('1');
  const [mixedLines, setMixedLines] = useState<MixedLine[]>([
    { id: crypto.randomUUID(), type: 'credit', amount: '', installments: '1' },
    { id: crypto.randomUUID(), type: 'pix', amount: '', installments: '1' },
  ]);
  const [saving, setSaving] = useState(false);

  // Pre-fill from existing sale when opening
  useEffect(() => {
    if (!open || !sale) return;
    const method = (sale.payment_method as PaymentMethod) || 'cash';
    setSelectedMethod(method);
    setCashReceived(sale.amount_received != null ? String(sale.amount_received) : '');

    if (method === 'card') {
      setCardType((existingDetails.cardType as 'credit' | 'debit') || 'credit');
      setInstallments(String(existingDetails.installments || 1));
    } else {
      setCardType('credit');
      setInstallments('1');
    }
    setBoletoInstallments(method === 'boleto' ? String(existingDetails.installments || 1) : '1');
    setChequeInstallments(method === 'cheque' ? String(existingDetails.installments || 1) : '1');

    if (method === 'mixed' && Array.isArray(existingDetails.payments) && existingDetails.payments.length > 0) {
      setMixedLines(
        existingDetails.payments.map((p: any) => ({
          id: crypto.randomUUID(),
          type: (p.type as MixedPaymentType) || 'pix',
          amount: String(p.amount || ''),
          installments: String(p.installments || 1),
        }))
      );
    } else {
      setMixedLines([
        { id: crypto.randomUUID(), type: 'credit', amount: '', installments: '1' },
        { id: crypto.randomUUID(), type: 'pix', amount: '', installments: '1' },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sale?.id]);

  const cashChange = selectedMethod === 'cash' ? Math.max(0, parseCurrency(cashReceived) - total) : 0;
  const installmentValue = total / Math.max(parseInt(installments) || 1, 1);
  const mixedTotal = mixedLines.reduce((s, l) => s + parseCurrency(l.amount), 0);
  const mixedRemaining = total - mixedTotal;

  const addMixedLine = () =>
    setMixedLines((prev) => [...prev, { id: crypto.randomUUID(), type: 'pix', amount: '', installments: '1' }]);

  const removeMixedLine = (id: string) => {
    if (mixedLines.length <= 2) return;
    setMixedLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateMixedLine = (id: string, updates: Partial<MixedLine>) => {
    setMixedLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...updates };
        if (updates.type && !installmentEligibleTypes.includes(updates.type)) {
          updated.installments = '1';
        }
        return updated;
      })
    );
  };

  const fillRemainingMixed = (id: string) => {
    const otherTotal = mixedLines.filter((l) => l.id !== id).reduce((s, l) => s + parseCurrency(l.amount), 0);
    const remaining = Math.max(0, total - otherTotal);
    updateMixedLine(id, { amount: remaining.toFixed(2) });
  };

  const canSave = () => {
    if (saving) return false;
    if (selectedMethod === 'cash') return parseCurrency(cashReceived) >= total;
    if (selectedMethod === 'mixed') {
      return Math.abs(mixedRemaining) < 0.01 && mixedLines.some((l) => parseCurrency(l.amount) > 0);
    }
    return true;
  };

  const buildPayload = () => {
    const channel = existingDetails.channel; // preserve sale channel
    const baseDetails: Record<string, any> = channel ? { channel } : {};

    if (selectedMethod === 'cash') {
      const received = parseCurrency(cashReceived);
      return {
        payment_method: 'cash',
        payment_details: baseDetails,
        amount_received: received,
        change_amount: Math.max(0, received - total),
      };
    }
    if (selectedMethod === 'pix') {
      return { payment_method: 'pix', payment_details: baseDetails, amount_received: null, change_amount: 0 };
    }
    if (selectedMethod === 'card') {
      const inst = cardType === 'credit' ? parseInt(installments) : 1;
      return {
        payment_method: 'card',
        payment_details: { ...baseDetails, cardType, installments: inst, installmentValue: total / inst },
        amount_received: null,
        change_amount: 0,
      };
    }
    if (selectedMethod === 'boleto') {
      const inst = parseInt(boletoInstallments);
      return {
        payment_method: 'boleto',
        payment_details: { ...baseDetails, installments: inst, installmentValue: total / inst },
        amount_received: null,
        change_amount: 0,
      };
    }
    if (selectedMethod === 'cheque') {
      const inst = parseInt(chequeInstallments);
      return {
        payment_method: 'cheque',
        payment_details: { ...baseDetails, installments: inst, installmentValue: total / inst },
        amount_received: null,
        change_amount: 0,
      };
    }
    // mixed
    const payments = mixedLines
      .filter((l) => parseCurrency(l.amount) > 0)
      .map((l) => ({
        type: l.type,
        amount: parseCurrency(l.amount),
        installments: installmentEligibleTypes.includes(l.type) ? parseInt(l.installments) : 1,
      }));
    const sumBy = (t: MixedPaymentType) => payments.filter((p) => p.type === t).reduce((s, p) => s + p.amount, 0);
    const cashTotal = sumBy('cash');
    const creditTotal = sumBy('credit');
    const debitTotal = sumBy('debit');
    const firstCardLine = payments.find((p) => p.type === 'credit' || p.type === 'debit');
    return {
      payment_method: 'mixed',
      payment_details: {
        ...baseDetails,
        cash: cashTotal,
        card: creditTotal + debitTotal,
        pix: sumBy('pix'),
        debit: debitTotal,
        credit: creditTotal,
        boleto: sumBy('boleto'),
        cheque: sumBy('cheque'),
        mixedCardType: firstCardLine?.type === 'credit' ? 'credit' : 'debit',
        mixedInstallments: firstCardLine?.installments || 1,
        payments,
      },
      amount_received: cashTotal > 0 ? cashTotal : null,
      change_amount: 0,
    };
  };

  const handleSave = async () => {
    if (!sale?.id) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      const { error } = await supabase
        .from('pos_sales')
        .update(payload as any)
        .eq('id', sale.id);
      if (error) throw error;

      auditService.log({
        action: 'update_payment_method',
        entity_type: 'pos_sale',
        entity_id: sale.id,
        details: {
          old_method: sale.payment_method,
          old_details: sale.payment_details,
          new_method: payload.payment_method,
          new_details: payload.payment_details,
          total: sale.total,
        },
      });

      toast.success('Forma de pagamento atualizada');
      onUpdated?.({ ...sale, ...payload });
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao atualizar pagamento: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alterar Forma de Pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-3 text-sm flex justify-between">
            <span className="text-muted-foreground">Total da Venda</span>
            <span className="font-bold text-base">{formatCurrency(total)}</span>
          </div>

          {/* Method picker */}
          <div>
            <Label className="mb-2 block">Forma de Pagamento</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'cash', label: 'Dinheiro', icon: <Banknote className="h-5 w-5" /> },
                { v: 'card', label: 'Cartão', icon: <CreditCard className="h-5 w-5" /> },
                { v: 'pix', label: 'PIX', icon: <QrCode className="h-5 w-5" /> },
                { v: 'boleto', label: 'Boleto', icon: <FileText className="h-5 w-5" /> },
                { v: 'cheque', label: 'Cheque', icon: <ScrollText className="h-5 w-5" /> },
                { v: 'mixed', label: 'Misto', icon: <Split className="h-5 w-5" /> },
              ] as { v: PaymentMethod; label: string; icon: React.ReactNode }[]).map((m) => (
                <Button
                  key={m.v}
                  variant={selectedMethod === m.v ? 'default' : 'outline'}
                  className="h-14 flex-col gap-1"
                  onClick={() => setSelectedMethod(m.v)}
                  type="button"
                >
                  {m.icon}
                  <span className="text-xs">{m.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Cash */}
          {selectedMethod === 'cash' && (
            <div className="space-y-2">
              <Separator />
              <Label>Valor recebido</Label>
              <Input
                type="number"
                placeholder="R$ 0,00"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="h-11"
              />
              {parseCurrency(cashReceived) >= total && (
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">Troco</div>
                  <div className="text-xl font-bold text-primary">{formatCurrency(cashChange)}</div>
                </div>
              )}
            </div>
          )}

          {/* Card */}
          {selectedMethod === 'card' && (
            <div className="space-y-3">
              <Separator />
              <div>
                <Label>Tipo de Cartão</Label>
                <RadioGroup
                  value={cardType}
                  onValueChange={(v) => {
                    setCardType(v as 'credit' | 'debit');
                    if (v === 'debit') setInstallments('1');
                  }}
                  className="flex gap-4 mt-1"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="credit" id="edit-credit" />
                    <Label htmlFor="edit-credit" className="cursor-pointer font-normal">Crédito</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="debit" id="edit-debit" />
                    <Label htmlFor="edit-debit" className="cursor-pointer font-normal">Débito</Label>
                  </div>
                </RadioGroup>
              </div>
              {cardType === 'credit' && (
                <div>
                  <Label>Parcelas</Label>
                  <Select value={installments} onValueChange={setInstallments}>
                    <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x de {formatCurrency(total / n)}{n === 1 && ' (à vista)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="bg-primary/10 rounded-lg p-2 text-center mt-2 text-sm">
                    {parseInt(installments) === 1 ? 'À vista: ' : `${installments}x de `}
                    <strong>{formatCurrency(installmentValue)}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Boleto */}
          {selectedMethod === 'boleto' && (
            <div className="space-y-2">
              <Separator />
              <Label>Parcelas</Label>
              <Select value={boletoInstallments} onValueChange={setBoletoInstallments}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x de {formatCurrency(total / n)}{n === 1 && ' (à vista)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Cheque */}
          {selectedMethod === 'cheque' && (
            <div className="space-y-2">
              <Separator />
              <Label>Parcelas</Label>
              <Select value={chequeInstallments} onValueChange={setChequeInstallments}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x de {formatCurrency(total / n)}{n === 1 && ' (à vista)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Mixed */}
          {selectedMethod === 'mixed' && (
            <div className="space-y-3">
              <Separator />
              <div className="flex items-center justify-between">
                <Label>Pagamentos</Label>
                <Button type="button" size="sm" variant="outline" onClick={addMixedLine} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>

              {mixedLines.map((line) => (
                <div key={line.id} className="border rounded-lg p-3 space-y-2 bg-card">
                  <div className="flex items-center gap-2">
                    <Select
                      value={line.type}
                      onValueChange={(v) => updateMixedLine(line.id, { type: v as MixedPaymentType })}
                    >
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        {(Object.keys(paymentTypeLabels) as MixedPaymentType[]).map((t) => (
                          <SelectItem key={t} value={t}>
                            <span className="flex items-center gap-2">
                              {paymentTypeLabels[t].icon}
                              {paymentTypeLabels[t].label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={line.amount}
                      onChange={(e) => updateMixedLine(line.id, { amount: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fillRemainingMixed(line.id)}
                      title="Preencher restante"
                    >
                      Restante
                    </Button>
                    {mixedLines.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMixedLine(line.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  {installmentEligibleTypes.includes(line.type) && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Parcelas:</Label>
                      <Select
                        value={line.installments}
                        onValueChange={(v) => updateMixedLine(line.id, { installments: v })}
                      >
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          {Array.from({ length: maxInstallmentsByType[line.type] }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Soma</span>
                <span className="font-medium">{formatCurrency(mixedTotal)}</span>
              </div>
              <div
                className={`flex justify-between text-sm font-bold ${
                  Math.abs(mixedRemaining) < 0.01 ? 'text-green-600' : 'text-destructive'
                }`}
              >
                <span>Restante</span>
                <span>{formatCurrency(mixedRemaining)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Alteração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditPaymentMethodModal;
