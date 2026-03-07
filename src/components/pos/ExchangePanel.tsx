import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ProductSearch, { ProductResult, SaleType } from './ProductSearch';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  Plus,
  Minus,
  Loader2,
  Wallet,
  ShoppingBag,
  Package,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ExchangeItem {
  id: string;
  product_id: string;
  variation_id?: string;
  name: string;
  sku?: string;
  unit_price: number;
  quantity: number;
  max_stock: number;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
}

interface ExchangePanelProps {
  isOnline: boolean;
  customerCreditBalance: number;
  onConfirmExchange: (data: ExchangeData) => void;
  isProcessing: boolean;
}

export interface ExchangeData {
  returnedItems: ExchangeItem[];
  newItems: ExchangeItem[];
  returnTotal: number;
  newTotal: number;
  difference: number;
  creditUsed: number;
  amountToPay: number;
  creditToStore: number;
  newItemsPriceType: SaleType;
  paymentMethod?: 'cash' | 'card' | 'pix';
  amountReceived?: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const ExchangePanel = ({
  isOnline,
  customerCreditBalance,
  onConfirmExchange,
  isProcessing,
}: ExchangePanelProps) => {
  const [returnedItems, setReturnedItems] = useState<ExchangeItem[]>([]);
  const [newItems, setNewItems] = useState<ExchangeItem[]>([]);
  const [returnedItemsPriceType, setReturnedItemsPriceType] = useState<SaleType>('varejo');
  const [newItemsPriceType, setNewItemsPriceType] = useState<SaleType>('varejo');
  const [useCredit, setUseCredit] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'pix' | null>(null);
  const [cashReceived, setCashReceived] = useState('');

  const calcItemTotal = (item: ExchangeItem) => {
    const gross = item.unit_price * item.quantity;
    if (!item.discount_type || !item.discount_value) return gross;
    if (item.discount_type === 'percentage') return gross * (1 - item.discount_value / 100);
    return Math.max(0, gross - item.discount_value);
  };

  const returnTotal = returnedItems.reduce((sum, item) => sum + calcItemTotal(item), 0);
  const newTotal = newItems.reduce((sum, item) => sum + calcItemTotal(item), 0);
  const difference = newTotal - returnTotal;

  // If difference > 0 → customer pays. If < 0 → customer gets credit.
  const availableCredit = useCredit ? customerCreditBalance : 0;
  const creditUsed = difference > 0 ? Math.min(availableCredit, difference) : 0;
  const amountToPay = Math.max(0, difference - creditUsed);
  const creditToStore = difference < 0 ? Math.abs(difference) : 0;

  const resolvePrice = useCallback((product: ProductResult, priceType: SaleType): number => {
    switch (priceType) {
      case 'atacado':
        return product.wholesale_price ?? product.price;
      case 'exclusivo':
        return product.exclusive_price ?? product.price;
      default:
        return product.promotional_price ?? product.price;
    }
  }, []);

  const handleAddReturnedProduct = useCallback((product: ProductResult) => {
    const unitPrice = resolvePrice(product, returnedItemsPriceType);
    const existing = returnedItems.find(i => i.product_id === product.id && !i.variation_id);
    if (existing) {
      setReturnedItems(items =>
        items.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i)
      );
    } else {
      setReturnedItems(items => [...items, {
        id: crypto.randomUUID(),
        product_id: product.id,
        name: product.name,
        unit_price: unitPrice,
        quantity: 1,
        max_stock: 999,
      }]);
    }
  }, [returnedItems, returnedItemsPriceType, resolvePrice]);

  const handleAddNewProduct = useCallback((product: ProductResult) => {
    const unitPrice = resolvePrice(product, newItemsPriceType);
    const existing = newItems.find(i => i.product_id === product.id && !i.variation_id);
    if (existing) {
      setNewItems(items =>
        items.map(i => i.id === existing.id
          ? { ...i, quantity: Math.min(i.quantity + 1, i.max_stock) }
          : i
        )
      );
    } else {
      setNewItems(items => [...items, {
        id: crypto.randomUUID(),
        product_id: product.id,
        name: product.name,
        unit_price: unitPrice,
        quantity: 1,
        max_stock: product.stock,
      }]);
    }
  }, [newItems, newItemsPriceType, resolvePrice]);

  const updateReturnedQty = (id: string, qty: number) => {
    if (qty < 1) return;
    setReturnedItems(items => items.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const updateNewQty = (id: string, qty: number) => {
    if (qty < 1) return;
    setNewItems(items => items.map(i => i.id === id ? { ...i, quantity: Math.min(qty, i.max_stock) } : i));
  };

  const removeReturned = (id: string) => setReturnedItems(items => items.filter(i => i.id !== id));
  const removeNew = (id: string) => setNewItems(items => items.filter(i => i.id !== id));

  const parseCurrency = (value: string) => parseFloat(value.replace(',', '.')) || 0;

  const canConfirm = () => {
    if (isProcessing) return false;
    if (returnedItems.length === 0 && newItems.length === 0) return false;
    if (amountToPay > 0 && !paymentMethod) return false;
    if (paymentMethod === 'cash' && parseCurrency(cashReceived) < amountToPay) return false;
    return true;
  };

  const handleConfirm = () => {
    onConfirmExchange({
      returnedItems,
      newItems,
      returnTotal,
      newTotal,
      difference,
      creditUsed,
      amountToPay,
      creditToStore,
      newItemsPriceType,
      paymentMethod: amountToPay > 0 ? paymentMethod || undefined : undefined,
      amountReceived: paymentMethod === 'cash' ? parseCurrency(cashReceived) : undefined,
    });
  };

  const cashChange = paymentMethod === 'cash' ? Math.max(0, parseCurrency(cashReceived) - amountToPay) : 0;

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* RETURNED ITEMS SECTION */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownToLine className="h-4 w-4 text-green-600" />
              <h3 className="font-semibold text-sm">Produtos Devolvidos</h3>
              <Badge variant="secondary" className="text-xs">{returnedItems.length}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Produtos que voltam ao estoque (preço de varejo)
            </p>
            <ProductSearch
              onProductSelect={handleAddReturnedProduct}
              isOnline={isOnline}
            />
            {returnedItems.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {returnedItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-md border bg-green-500/5 border-green-500/20">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{formatCurrency(item.unit_price)} un.</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateReturnedQty(item.id, item.quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateReturnedQty(item.id, item.quantity + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-sm font-semibold w-20 text-right text-green-600">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeReturned(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="text-right text-sm font-semibold text-green-600">
                  Crédito: {formatCurrency(returnTotal)}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* NEW ITEMS SECTION */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpFromLine className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-sm">Produtos Novos</h3>
              <Badge variant="secondary" className="text-xs">{newItems.length}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Produtos que saem do estoque
            </p>
            {/* Price type for new items */}
            <div className="flex gap-1 mb-2">
              {([
                { value: 'varejo' as SaleType, label: 'Varejo', icon: ShoppingBag },
                { value: 'atacado' as SaleType, label: 'Atacado', icon: Package },
                { value: 'exclusivo' as SaleType, label: 'Exclusivo', icon: Star },
              ]).map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={newItemsPriceType === value ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 gap-1 text-xs"
                  onClick={() => {
                    if (newItems.length > 0) {
                      setNewItems([]);
                    }
                    setNewItemsPriceType(value);
                  }}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </Button>
              ))}
            </div>
            <ProductSearch
              onProductSelect={handleAddNewProduct}
              isOnline={isOnline}
            />
            {newItems.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {newItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-md border bg-blue-500/5 border-blue-500/20">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{formatCurrency(item.unit_price)} un.</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateNewQty(item.id, item.quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateNewQty(item.id, item.quantity + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-sm font-semibold w-20 text-right text-blue-600">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeNew(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="text-right text-sm font-semibold text-blue-600">
                  Total novos: {formatCurrency(newTotal)}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* SUMMARY */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Resumo da Troca</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Devolvidos</span>
                <span className="text-green-600 font-medium">+ {formatCurrency(returnTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Novos</span>
                <span className="text-blue-600 font-medium">- {formatCurrency(newTotal)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Diferença</span>
                <span className={cn(
                  difference > 0 ? 'text-destructive' : difference < 0 ? 'text-green-600' : 'text-foreground'
                )}>
                  {difference > 0 ? `Cliente paga ${formatCurrency(difference)}` :
                   difference < 0 ? `Crédito de ${formatCurrency(Math.abs(difference))}` :
                   'Sem diferença'}
                </span>
              </div>

              {/* Customer credit balance */}
              {customerCreditBalance > 0 && difference > 0 && (
                <div className="flex items-center justify-between p-2 rounded-md bg-accent/50 mt-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <span className="text-sm">Saldo do cliente</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold">{formatCurrency(customerCreditBalance)}</span>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCredit}
                        onChange={e => setUseCredit(e.target.checked)}
                        className="rounded"
                      />
                      Usar saldo
                    </label>
                  </div>
                </div>
              )}

              {creditUsed > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo utilizado</span>
                  <span className="text-green-600">- {formatCurrency(creditUsed)}</span>
                </div>
              )}

              {amountToPay > 0 && (
                <>
                  <div className="flex justify-between font-bold text-base mt-1">
                    <span>A pagar</span>
                    <span className="text-destructive">{formatCurrency(amountToPay)}</span>
                  </div>

                  {/* Payment method */}
                  <div className="mt-3 space-y-2">
                    <Label className="text-sm">Forma de pagamento</Label>
                    <div className="flex gap-2">
                      {(['cash', 'card', 'pix'] as const).map(method => (
                        <Button
                          key={method}
                          variant={paymentMethod === method ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => setPaymentMethod(method)}
                        >
                          {method === 'cash' ? 'Dinheiro' : method === 'card' ? 'Cartão' : 'PIX'}
                        </Button>
                      ))}
                    </div>

                    {paymentMethod === 'cash' && (
                      <div className="space-y-2">
                        <Label className="text-xs">Valor recebido</Label>
                        <Input
                          type="number"
                          placeholder="R$ 0,00"
                          value={cashReceived}
                          onChange={e => setCashReceived(e.target.value)}
                          className="h-10"
                        />
                        {parseCurrency(cashReceived) >= amountToPay && (
                          <div className="bg-primary/10 rounded-lg p-2 text-center">
                            <div className="text-xs text-muted-foreground">Troco</div>
                            <div className="text-lg font-bold text-primary">{formatCurrency(cashChange)}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {creditToStore > 0 && (
                <div className="flex justify-between font-bold text-base mt-1 p-2 rounded-md bg-green-500/10">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="h-4 w-4" />
                    Crédito gerado
                  </span>
                  <span className="text-green-600">{formatCurrency(creditToStore)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Confirm button */}
      <div className="p-3 border-t">
        <Button
          className="w-full h-12 text-base gap-2"
          onClick={handleConfirm}
          disabled={!canConfirm()}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Processando...
            </>
          ) : (
            <>Confirmar Troca</>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ExchangePanel;
