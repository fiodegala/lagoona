import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, User, ShoppingBag, CalendarIcon, Gift, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PaymentPanel from '@/components/pos/PaymentPanel';
import ProductSearch, { ProductResult } from '@/components/pos/ProductSearch';
import { CartItem } from '@/components/pos/POSCart';
import { Seller } from './SellerStep';
import { Customer } from '@/components/pos/CustomerSelector';
import { SaleType } from '@/components/pos/ProductSearch';
import { cn } from '@/lib/utils';

interface PaymentStepProps {
  cartItems: CartItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  saleType: SaleType;
  selectedSeller: Seller | null;
  selectedCustomer: Customer | null;
  isProcessing: boolean;
  isAdmin?: boolean;
  onPayment: (method: 'cash' | 'card' | 'pix' | 'mixed' | 'boleto' | 'cheque', amountReceived?: number, paymentDetails?: Record<string, number>, saleDate?: string) => void;
  onBack: () => void;
  onAddGiftItem?: (product: ProductResult, variationId?: string) => void;
}

const saleTypeLabels: Record<SaleType, string> = {
  varejo: 'Varejo',
  atacado: 'Atacado',
  exclusivo: 'Exclusivo',
  troca: 'Troca',
  orcamento: 'Orçamento',
  brinde: 'Brinde',
  colaborador: 'Colaborador',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const PaymentStep = ({
  cartItems,
  subtotal,
  discountAmount,
  total,
  saleType,
  selectedSeller,
  selectedCustomer,
  isProcessing,
  isAdmin = false,
  onPayment,
  onBack,
  onAddGiftItem,
}: PaymentStepProps) => {
  const today = new Date();
  const [saleDate, setSaleDate] = useState<Date>(today);
  const isBackdated = saleDate.toDateString() !== today.toDateString();
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);

  const isQuote = saleType === 'orcamento';
  const [validityOption, setValidityOption] = useState<'7' | '15' | '30' | '60' | 'custom' | 'none'>('15');
  const [customValidityDate, setCustomValidityDate] = useState<Date>(addDays(today, 15));

  const computeExpiresAt = (): string | null => {
    if (!isQuote) return null;
    switch (validityOption) {
      case '7': return addDays(today, 7).toISOString();
      case '15': return addDays(today, 15).toISOString();
      case '30': return addDays(today, 30).toISOString();
      case '60': return addDays(today, 60).toISOString();
      case 'custom': return customValidityDate.toISOString();
      case 'none': return null;
      default: return null;
    }
  };

  const handlePaymentWithDate = (method: 'cash' | 'card' | 'pix' | 'mixed', amountReceived?: number, paymentDetails?: Record<string, unknown>) => {
    const saleDateISO = isBackdated ? saleDate.toISOString() : undefined;
    const extraDetails: Record<string, unknown> = { ...(paymentDetails || {}) };
    if (isQuote) {
      extraDetails.__expires_at = computeExpiresAt();
    }
    onPayment(method, amountReceived, extraDetails as Record<string, number>, saleDateISO);
  };

  const handleGiftProductSelect = (product: ProductResult, variationId?: string) => {
    onAddGiftItem?.(product, variationId);
    setGiftDialogOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
      {/* Left - Order Summary */}
      <div className="flex-1 flex flex-col overflow-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">Resumo da Venda</h2>
          <Button variant="outline" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
        </div>

        {/* Sale info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border bg-card">
            <ShoppingBag className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm text-muted-foreground">Tipo de Venda</div>
              <div className="font-semibold text-sm sm:text-base">{saleTypeLabels[saleType]}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border bg-card">
            <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm text-muted-foreground">Vendedor</div>
              <div className="font-semibold text-sm sm:text-base truncate">{selectedSeller?.full_name || '—'}</div>
            </div>
          </div>
        </div>

        {/* Sale Date Picker */}
        <div className={cn(
          "flex items-center gap-3 p-3 sm:p-4 rounded-lg border mb-4 sm:mb-6",
          isBackdated ? "bg-orange-500/10 border-orange-500/30" : "bg-card"
        )}>
          <CalendarIcon className={cn("h-5 w-5 flex-shrink-0", isBackdated ? "text-orange-600" : "text-muted-foreground")} />
          <div className="flex-1 min-w-0">
            <div className="text-xs sm:text-sm text-muted-foreground">Data da Venda</div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-auto p-0 font-semibold hover:bg-transparent text-sm sm:text-base">
                  {format(saleDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <Calendar
                  mode="single"
                  selected={saleDate}
                  onSelect={(date) => date && setSaleDate(date)}
                  disabled={(date) => date > today}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          {isBackdated && (
            <span className="text-xs font-medium text-orange-600 bg-orange-500/20 px-2 py-1 rounded flex-shrink-0">
              Retroativa
            </span>
          )}
        </div>

        {/* Quote Validity Picker */}
        {isQuote && (
          <div className="flex items-start gap-3 p-3 sm:p-4 rounded-lg border mb-4 sm:mb-6 bg-primary/5 border-primary/20">
            <Clock className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="text-xs sm:text-sm text-muted-foreground">Validade do Orçamento</div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={validityOption} onValueChange={(v) => setValidityOption(v as typeof validityOption)}>
                  <SelectTrigger className="h-9 w-auto min-w-[170px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="15">15 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="custom">Data personalizada</SelectItem>
                    <SelectItem value="none">Sem validade</SelectItem>
                  </SelectContent>
                </Select>

                {validityOption === 'custom' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 font-medium">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {format(customValidityDate, "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover" align="start">
                      <Calendar
                        mode="single"
                        selected={customValidityDate}
                        onSelect={(date) => date && setCustomValidityDate(date)}
                        disabled={(date) => date < today}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}

                {validityOption !== 'none' && (
                  <span className="text-xs text-muted-foreground">
                    Válido até{' '}
                    <strong className="text-foreground">
                      {format(
                        validityOption === 'custom'
                          ? customValidityDate
                          : addDays(today, parseInt(validityOption, 10)),
                        "dd/MM/yyyy",
                        { locale: ptBR }
                      )}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedCustomer && (
          <div className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border bg-card mb-4 sm:mb-6">
            <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm text-muted-foreground">Cliente</div>
              <div className="font-semibold text-sm sm:text-base truncate">{selectedCustomer.name}</div>
              {selectedCustomer.document && (
                <div className="text-xs text-muted-foreground">{selectedCustomer.document}</div>
              )}
            </div>
          </div>
        )}

        {/* Gift button */}
        {onAddGiftItem && saleType !== 'brinde' && (
          <div className="mb-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setGiftDialogOpen(true)}
            >
              <Gift className="h-4 w-4" />
              Adicionar Brinde
            </Button>
          </div>
        )}

        {/* Items */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold flex">
            <span className="flex-1">Produto</span>
            <span className="w-12 sm:w-16 text-center">Qtd</span>
            <span className="w-20 sm:w-24 text-right hidden sm:block">Preço Un.</span>
            <span className="w-20 sm:w-24 text-right">Total</span>
          </div>
          {cartItems.map((item) => (
            <div key={item.id} className="px-3 sm:px-4 py-2 sm:py-3 border-t flex items-center text-xs sm:text-sm">
              <span className="flex-1 truncate flex items-center gap-2">
                {item.name}
                {item.is_gift && (
                  <Badge variant="secondary" className="text-[10px] bg-purple-500/20 text-purple-700 border-purple-500/30">
                    Brinde
                  </Badge>
                )}
              </span>
              <span className="w-12 sm:w-16 text-center">{item.quantity}</span>
              <span className="w-20 sm:w-24 text-right hidden sm:block">{formatCurrency(item.unit_price)}</span>
              <span className="w-20 sm:w-24 text-right font-medium">{formatCurrency(item.total)}</span>
            </div>
          ))}
        </div>

        <Separator className="my-3 sm:my-4" />

        <div className="space-y-2 text-sm max-w-xs ml-auto">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Desconto</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg sm:text-xl font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Right - Payment */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l flex flex-col overflow-y-auto">
        <PaymentPanel
          total={total}
          onPayment={handlePaymentWithDate}
          isProcessing={isProcessing}
          disabled={cartItems.length === 0}
          isAdmin={isAdmin}
        />
      </div>

      {/* Gift product search dialog */}
      <Dialog open={giftDialogOpen} onOpenChange={setGiftDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Adicionar Brinde
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <ProductSearch
              onProductSelect={handleGiftProductSelect}
              isOnline={true}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentStep;
