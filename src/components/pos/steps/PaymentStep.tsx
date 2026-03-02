import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, User, ShoppingBag } from 'lucide-react';
import PaymentPanel from '@/components/pos/PaymentPanel';
import { CartItem } from '@/components/pos/POSCart';
import { Seller } from './SellerStep';
import { Customer } from '@/components/pos/CustomerSelector';
import { SaleType } from '@/components/pos/ProductSearch';

interface PaymentStepProps {
  cartItems: CartItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  saleType: SaleType;
  selectedSeller: Seller | null;
  selectedCustomer: Customer | null;
  isProcessing: boolean;
  onPayment: (method: 'cash' | 'card' | 'pix' | 'mixed', amountReceived?: number, paymentDetails?: Record<string, number>) => void;
  onBack: () => void;
}

const saleTypeLabels: Record<SaleType, string> = {
  varejo: 'Varejo',
  atacado: 'Atacado',
  exclusivo: 'Exclusivo',
  troca: 'Troca',
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
  onPayment,
  onBack,
}: PaymentStepProps) => {
  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left - Order Summary */}
      <div className="flex-1 flex flex-col overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Resumo da Venda</h2>
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>

        {/* Sale info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">Tipo de Venda</div>
              <div className="font-semibold">{saleTypeLabels[saleType]}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">Vendedor</div>
              <div className="font-semibold">{selectedSeller?.full_name || '—'}</div>
            </div>
          </div>
        </div>

        {selectedCustomer && (
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-card mb-6">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">Cliente</div>
              <div className="font-semibold">{selectedCustomer.name}</div>
              {selectedCustomer.document && (
                <div className="text-xs text-muted-foreground">{selectedCustomer.document}</div>
              )}
            </div>
          </div>
        )}

        {/* Items */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 text-sm font-semibold flex">
            <span className="flex-1">Produto</span>
            <span className="w-16 text-center">Qtd</span>
            <span className="w-24 text-right">Preço Un.</span>
            <span className="w-24 text-right">Total</span>
          </div>
          {cartItems.map((item) => (
            <div key={item.id} className="px-4 py-3 border-t flex items-center text-sm">
              <span className="flex-1 truncate">{item.name}</span>
              <span className="w-16 text-center">{item.quantity}</span>
              <span className="w-24 text-right">{formatCurrency(item.unit_price)}</span>
              <span className="w-24 text-right font-medium">{formatCurrency(item.total)}</span>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

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
          <div className="flex justify-between text-xl font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Right - Payment */}
      <div className="w-96 border-l flex flex-col">
        <PaymentPanel
          total={total}
          onPayment={onPayment}
          isProcessing={isProcessing}
          disabled={cartItems.length === 0}
        />
      </div>
    </div>
  );
};

export default PaymentStep;
