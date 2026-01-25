import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, DollarSign, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface OpenSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (openingBalance: number, notes?: string) => Promise<void>;
}

export const OpenSessionModal = ({
  open,
  onOpenChange,
  onConfirm,
}: OpenSessionModalProps) => {
  const [balance, setBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(parseFloat(balance.replace(',', '.')) || 0, notes || undefined);
      setBalance('');
      setNotes('');
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir Caixa</DialogTitle>
          <DialogDescription>
            Informe o valor inicial em dinheiro para abrir o caixa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="balance">Valor inicial (R$)</Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="balance"
                type="number"
                placeholder="0,00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Observações sobre a abertura..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Abrir Caixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface CloseSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedBalance: number;
  onConfirm: (closingBalance: number, notes?: string) => Promise<void>;
}

export const CloseSessionModal = ({
  open,
  onOpenChange,
  expectedBalance,
  onConfirm,
}: CloseSessionModalProps) => {
  const [balance, setBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const closingBalance = parseFloat(balance.replace(',', '.')) || 0;
  const difference = closingBalance - expectedBalance;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(closingBalance, notes || undefined);
      setBalance('');
      setNotes('');
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar Caixa</DialogTitle>
          <DialogDescription>
            Faça a contagem do caixa e informe o valor total.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Valor esperado</div>
            <div className="text-2xl font-bold">{formatCurrency(expectedBalance)}</div>
          </div>
          
          <div>
            <Label htmlFor="closing-balance">Valor em caixa (R$)</Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="closing-balance"
                type="number"
                placeholder="0,00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          {balance && (
            <div
              className={`rounded-lg p-4 ${
                difference === 0
                  ? 'bg-green-500/10 text-green-600'
                  : difference > 0
                    ? 'bg-blue-500/10 text-blue-600'
                    : 'bg-destructive/10 text-destructive'
              }`}
            >
              <div className="text-sm">
                {difference === 0
                  ? 'Caixa confere'
                  : difference > 0
                    ? 'Sobra'
                    : 'Falta'}
              </div>
              <div className="text-xl font-bold">
                {formatCurrency(Math.abs(difference))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="closing-notes">Observações (opcional)</Label>
            <Textarea
              id="closing-notes"
              placeholder="Observações sobre o fechamento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || !balance}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Fechar Caixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface CashMovementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (type: 'withdrawal' | 'deposit', amount: number, description?: string) => Promise<void>;
}

export const CashMovementModal = ({
  open,
  onOpenChange,
  onConfirm,
}: CashMovementModalProps) => {
  const [type, setType] = useState<'withdrawal' | 'deposit'>('withdrawal');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    const value = parseFloat(amount.replace(',', '.')) || 0;
    if (value <= 0) return;

    setIsLoading(true);
    try {
      await onConfirm(type, value, description || undefined);
      setAmount('');
      setDescription('');
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimentação de Caixa</DialogTitle>
          <DialogDescription>
            Registre uma sangria (retirada) ou suprimento (entrada) de dinheiro.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo de movimentação</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'withdrawal' | 'deposit')}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="withdrawal">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle className="h-4 w-4 text-destructive" />
                    Sangria (Retirada)
                  </div>
                </SelectItem>
                <SelectItem value="deposit">
                  <div className="flex items-center gap-2">
                    <ArrowDownCircle className="h-4 w-4 text-green-600" />
                    Suprimento (Entrada)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="movement-amount">Valor (R$)</Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="movement-amount"
                type="number"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          <div>
            <Label htmlFor="movement-description">Motivo</Label>
            <Textarea
              id="movement-description"
              placeholder={
                type === 'withdrawal'
                  ? 'Ex: Pagamento de fornecedor'
                  : 'Ex: Troco adicional'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || !amount}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
