import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
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
import {
  Trash2,
  Plus,
  Minus,
  Percent,
  Tag,
  X,
  Package,
  Hash,
  DollarSign,
  BarChart3,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';

export type PricingMode = 'varejo' | 'atacado' | 'exclusivo';

export interface CartItem {
  id: string;
  product_id: string;
  variation_id?: string;
  name: string;
  sku?: string;
  image_url?: string | null;
  unit_price: number;
  original_price?: number;
  is_promotional?: boolean;
  available_promotional_price?: number;
  quantity: number;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  discount_amount: number;
  total: number;
  max_stock: number;
  is_lagoona?: boolean;
  is_gift?: boolean;
  is_return?: boolean;
  // Price tiers for mode switching
  retail_price?: number;
  wholesale_price?: number | null;
  exclusive_price?: number | null;
}

interface POSCartProps {
  items: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdatePrice: (itemId: string, newPrice: number) => void;
  onApplyItemDiscount: (
    itemId: string,
    discountType: 'percentage' | 'fixed' | undefined,
    discountValue: number
  ) => void;
  onTogglePromoPrice: (itemId: string, usePromo: boolean) => void;
  generalDiscount: { type: 'percentage' | 'fixed'; value: number };
  onApplyGeneralDiscount: (type: 'percentage' | 'fixed', value: number) => void;
  subtotal: number;
  discountAmount: number;
  total: number;
  pricingMode?: PricingMode;
  onChangePricingMode?: (mode: PricingMode) => void;
  showPricingModeSwitcher?: boolean;
}

const POSCart = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onUpdatePrice,
  onApplyItemDiscount,
  onTogglePromoPrice,
  generalDiscount,
  onApplyGeneralDiscount,
  subtotal,
  discountAmount,
  total,
  pricingMode,
  onChangePricingMode,
  showPricingModeSwitcher,
}: POSCartProps) => {
  const [discountInput, setDiscountInput] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [detailItem, setDetailItem] = useState<CartItem | null>(null);
  const [imageFullscreen, setImageFullscreen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleApplyGeneralDiscount = () => {
    const value = parseFloat(discountInput.replace(',', '.')) || 0;
    if (value > 0) {
      onApplyGeneralDiscount(discountType, value);
    }
  };

  const handleRemoveGeneralDiscount = () => {
    setDiscountInput('');
    onApplyGeneralDiscount('percentage', 0);
  };

  return (
    <div className="h-full flex flex-col bg-card border-l">
      {/* Header */}
      <div className="p-4 border-b space-y-2">
        <div>
          <h2 className="text-lg font-semibold">Carrinho</h2>
          <p className="text-sm text-muted-foreground">
            {items.reduce((sum, i) => sum + i.quantity, 0)} {items.reduce((sum, i) => sum + i.quantity, 0) === 1 ? 'peça' : 'peças'} ({items.length} {items.length === 1 ? 'item' : 'itens'})
          </p>
        </div>
        {showPricingModeSwitcher && onChangePricingMode && pricingMode && (
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Select value={pricingMode} onValueChange={(v) => onChangePricingMode(v as PricingMode)}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="varejo">Varejo</SelectItem>
                <SelectItem value="atacado">Atacado</SelectItem>
                <SelectItem value="exclusivo">Exclusivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Items */}
      <ScrollArea className="flex-1">
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Carrinho vazio</p>
            <p className="text-sm">Adicione produtos para começar</p>
          </div>
        ) : (
          <div className="p-2">
            {items.map((item) => {
              const nameParts = item.name.split(' — ');
              const productName = nameParts[0];
              const variationLabel = nameParts.length > 1 ? nameParts.slice(1).join(' — ') : null;

              return (
              <div
                key={item.id}
                className={cn(
                  "p-3 rounded-lg hover:bg-accent/50 transition-colors",
                  item.is_return && "bg-blue-500/10 border border-blue-500/30"
                )}
              >
                <div className="flex items-start gap-2">
                  {/* Variation/Product image - clickable */}
                  <button
                    type="button"
                    className="flex-shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    onClick={() => setDetailItem(item)}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      className={cn(
                        "font-medium text-sm truncate text-left hover:underline cursor-pointer block w-full",
                        item.is_return && "text-blue-600"
                      )}
                      onClick={() => setDetailItem(item)}
                    >
                      {item.is_return && '↩ '}{productName}
                    </button>
                    {item.is_return && (
                      <Badge variant="outline" className="text-xs mt-0.5 bg-blue-500/20 text-blue-700 border-blue-500/30">
                        Devolução
                      </Badge>
                    )}
                    {variationLabel && (
                      <Badge variant="outline" className="text-xs mt-0.5">
                        {variationLabel}
                      </Badge>
                    )}
                    {item.sku && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {item.sku}
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      {item.is_promotional && item.original_price && (
                        <span className="line-through text-xs mr-1">{formatCurrency(item.original_price)}</span>
                      )}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="hover:text-primary hover:underline cursor-pointer inline-flex items-center gap-0.5"
                            title="Editar preço"
                          >
                            {formatCurrency(item.unit_price)} un.
                            <DollarSign className="h-3 w-3 opacity-50" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56" align="start">
                          <div className="space-y-3">
                            <Label>Alterar preço unitário</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue={item.unit_price}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseFloat((e.target as HTMLInputElement).value);
                                  if (!isNaN(val) && val >= 0) onUpdatePrice(item.id, val);
                                }
                              }}
                              placeholder="Novo preço"
                            />
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={(e) => {
                                const input = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement);
                                const val = parseFloat(input?.value);
                                if (!isNaN(val) && val >= 0) onUpdatePrice(item.id, val);
                              }}
                            >
                              Aplicar
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                      {item.is_promotional && (
                        <Badge variant="secondary" className="ml-1 text-[10px] bg-green-500/20 text-green-700 border-green-500/30">
                          Promo
                        </Badge>
                      )}
                    </div>
                    {item.available_promotional_price && (
                      <Button
                        variant={item.is_promotional ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn(
                          'h-6 text-xs gap-1 mt-0.5',
                          item.is_promotional
                            ? 'bg-green-500/20 text-green-700 hover:bg-green-500/30'
                            : 'text-green-600 hover:text-green-700'
                        )}
                        onClick={() => onTogglePromoPrice(item.id, !item.is_promotional)}
                      >
                        <Tag className="h-3 w-3" />
                        {item.is_promotional ? 'Remover promoção' : `Usar promo ${formatCurrency(item.available_promotional_price)}`}
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => onRemoveItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        onUpdateQuantity(item.id, parseInt(e.target.value) || 1)
                      }
                      className="h-7 w-14 text-center px-1"
                      min={1}
                      max={item.max_stock}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.max_stock}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Item discount */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={item.discount_amount > 0 ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 gap-1"
                      >
                        <Percent className="h-3 w-3" />
                        {item.discount_amount > 0 && (
                          <span className="text-xs">
                            -{formatCurrency(item.discount_amount)}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="end">
                      <div className="space-y-3">
                        <Label>Desconto no item</Label>
                        <div className="flex gap-2">
                          <Button
                            variant={item.discount_type === 'percentage' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() =>
                              onApplyItemDiscount(item.id, 'percentage', item.discount_value || 0)
                            }
                          >
                            %
                          </Button>
                          <Button
                            variant={item.discount_type === 'fixed' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() =>
                              onApplyItemDiscount(item.id, 'fixed', item.discount_value || 0)
                            }
                          >
                            R$
                          </Button>
                        </div>
                        <Input
                          type="number"
                          placeholder={item.discount_type === 'percentage' ? '0%' : 'R$ 0,00'}
                          defaultValue={item.discount_value || ''}
                          onChange={(e) =>
                            onApplyItemDiscount(
                              item.id,
                              item.discount_type || 'percentage',
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                        {item.discount_amount > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-destructive"
                            onClick={() => onApplyItemDiscount(item.id, undefined, 0)}
                          >
                            Remover desconto
                          </Button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Item total */}
                <div className="flex items-center justify-between mt-2 text-sm">
                  {item.discount_amount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      -{formatCurrency(item.discount_amount)}
                    </Badge>
                  )}
                  <div className={cn("ml-auto font-semibold", item.is_return && "text-blue-600")}>
                    {item.is_return ? '-' : ''}{formatCurrency(item.total)}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer with totals */}
      <div className="border-t p-4 space-y-3">
        {/* General discount */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={generalDiscount.value > 0 ? 'secondary' : 'outline'}
                  size="sm"
                  className="w-full gap-2"
                >
                  <Percent className="h-4 w-4" />
                  {generalDiscount.value > 0 ? (
                    <span>
                      Desconto: {generalDiscount.type === 'percentage' 
                        ? `${generalDiscount.value}%` 
                        : formatCurrency(generalDiscount.value)}
                    </span>
                  ) : (
                    'Adicionar desconto geral'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="start">
                <div className="space-y-3">
                  <Label>Desconto na venda</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={discountType === 'percentage' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setDiscountType('percentage')}
                    >
                      Porcentagem (%)
                    </Button>
                    <Button
                      variant={discountType === 'fixed' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setDiscountType('fixed')}
                    >
                      Valor (R$)
                    </Button>
                  </div>
                  <Input
                    type="number"
                    placeholder={discountType === 'percentage' ? '10%' : 'R$ 50,00'}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                  />
                  <Button onClick={handleApplyGeneralDiscount} className="w-full">
                    Aplicar desconto
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {generalDiscount.value > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={handleRemoveGeneralDiscount}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Separator />

        {/* Totals */}
        <div className="space-y-1 text-sm">
          {(() => {
            const newItems = items.filter(i => !i.is_return);
            const returnItems = items.filter(i => i.is_return);
            const hasReturns = returnItems.length > 0;
            const newSubtotal = newItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
            const returnSubtotal = returnItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
            return (
              <>
                {hasReturns ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Novos</span>
                      <span>{formatCurrency(newSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                      <span>Devoluções</span>
                      <span>-{formatCurrency(returnSubtotal)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                )}
              </>
            );
          })()}
          {discountAmount > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Desconto</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex justify-between text-xl font-bold">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(total)}</span>
        </div>
      </div>
      {/* Item Detail Modal */}
      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Detalhes do Item
            </DialogTitle>
          </DialogHeader>
          {detailItem && (() => {
            const parts = detailItem.name.split(' — ');
            const pName = parts[0];
            const vLabel = parts.length > 1 ? parts.slice(1).join(' — ') : null;
            return (
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                {/* Image - 4:7 aspect ratio, clickable */}
                <div className="flex-shrink-0 flex justify-center sm:justify-start">
                  {detailItem.image_url ? (
                    <button
                      type="button"
                      onClick={() => setImageFullscreen(true)}
                      className="block rounded-lg overflow-hidden hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <img
                        src={detailItem.image_url}
                        alt={detailItem.name}
                        className="w-36 sm:w-52 rounded-lg object-cover"
                        style={{ aspectRatio: '4/7' }}
                      />
                    </button>
                  ) : (
                    <div className="w-36 sm:w-52 rounded-lg bg-muted flex items-center justify-center" style={{ aspectRatio: '4/7' }}>
                      <Tag className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 space-y-3 min-w-0">
                  <div>
                    <p className="text-base sm:text-lg font-semibold">{pName}</p>
                    {vLabel && (
                      <Badge variant="outline" className="mt-1">{vLabel}</Badge>
                    )}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {detailItem.sku && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-muted-foreground text-xs">SKU</p>
                          <p className="font-mono font-medium truncate">{detailItem.sku}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-muted-foreground text-xs">Preço unitário</p>
                        <p className="font-semibold">{formatCurrency(detailItem.unit_price)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-muted-foreground text-xs">Quantidade</p>
                        <p className="font-semibold">{detailItem.quantity}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-muted-foreground text-xs">Estoque disponível</p>
                        <p className="font-semibold">{detailItem.max_stock} un.</p>
                      </div>
                    </div>
                  </div>

                  {detailItem.discount_amount > 0 && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Desconto aplicado</span>
                        <span className="text-destructive font-medium">-{formatCurrency(detailItem.discount_amount)}</span>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="flex justify-between text-base sm:text-lg font-bold">
                    <span>Total do item</span>
                    <span className="text-primary">{formatCurrency(detailItem.total)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Modal */}
      <Dialog open={imageFullscreen} onOpenChange={setImageFullscreen}>
        <DialogContent className="sm:max-w-4xl p-2 bg-black/95 border-none">
          {detailItem?.image_url && (
            <img
              src={detailItem.image_url}
              alt={detailItem.name}
              className="w-full h-auto max-h-[85vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSCart;
