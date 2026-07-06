import { Link } from 'react-router-dom';
import { ShoppingCart, Minus, Plus, Trash2, ShoppingBag, Truck, PartyPopper, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCart } from '@/contexts/CartContext';
import { getValentinesDiscountedUnits } from '@/lib/valentinesPromo';
import CartGiftRewards from '@/components/store/CartGiftRewards';

const CartDrawer = () => {
  const {
    items, removeItem, updateQuantity, getItemCount, getSubtotal, getTotal,
    appliedCoupon, comboDiscount,
    valentinesDiscount, valentinesPromoActive, valentinesPromoLabel, valentinesPromoPercent,
  } = useCart();
  const itemCount = getItemCount();
  const subtotal = getSubtotal();
  const total = getTotal();

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  const totalDiscount = (appliedCoupon?.discount || 0) + comboDiscount + valentinesDiscount;
  const valentinesFactor = Math.max(0, Math.min(100, valentinesPromoPercent || 0)) / 100;
  const discountedUnits = valentinesPromoActive && valentinesDiscount > 0
    ? getValentinesDiscountedUnits(
        items
          .filter(i => !i.isPromotional)
          .map(i => ({ id: i.id, price: Number(i.price) || 0, quantity: i.quantity }))
      )
    : {};

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={
            valentinesPromoActive
              ? 'relative text-rose-600 hover:text-rose-700 hover:bg-rose-500/10'
              : 'relative text-foreground/70 hover:text-foreground'
          }
        >
          {valentinesPromoActive ? (
            <Heart className="h-5 w-5 fill-rose-500 text-rose-500" />
          ) : (
            <ShoppingCart className="h-5 w-5" />
          )}
          {itemCount > 0 && (
            <Badge
              className={
                valentinesPromoActive
                  ? 'absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-rose-600 text-white'
                  : 'absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-store-gold text-store-dark'
              }
            >
              {itemCount > 99 ? '99+' : itemCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-5 w-5" />
            Meu Carrinho
            {itemCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {itemCount} {itemCount === 1 ? 'item' : 'itens'}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-full bg-muted p-4">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Carrinho vazio</p>
              <p className="text-sm text-muted-foreground mt-1">Adicione produtos para continuar</p>
            </div>
            <SheetClose asChild>
              <Button asChild variant="outline" size="sm">
                <Link to="/loja">Explorar loja</Link>
              </Button>
            </SheetClose>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {items.map((item) => {
                  const discQty = discountedUnits[item.id] || 0;
                  const fullQty = item.quantity - discQty;
                  const unitDiscounted = item.price * (1 - valentinesFactor);
                  const lineTotal = fullQty * item.price + discQty * unitDiscounted;
                  const hasDiscount = discQty > 0;
                  return (
                  <div key={item.id} className="p-4 flex gap-3">
                    {/* Image */}
                    <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border bg-muted">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2 leading-tight">{item.name}</p>
                      {hasDiscount ? (
                        <div className="mt-1">
                          <p className="text-xs text-muted-foreground line-through leading-none">{formatPrice(item.price)}</p>
                          <p className="text-sm font-bold text-rose-600 leading-tight">
                            {formatPrice(unitDiscounted)}
                            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide">-{Math.round(valentinesFactor * 100)}%</span>
                          </p>
                          {discQty < item.quantity && (
                            <p className="text-[10px] text-rose-600/80 mt-0.5">
                              {discQty} de {item.quantity} un. com desconto
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-store-accent mt-1">{formatPrice(item.price)}</p>
                      )}

                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border rounded-md">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-1 hover:bg-muted transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-7 text-center text-xs font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.stock}
                            className="p-1 hover:bg-muted transition-colors disabled:opacity-30"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Line total */}
                    <div className="shrink-0 text-right">
                      {hasDiscount ? (
                        <>
                          <p className="text-xs text-muted-foreground line-through leading-none">{formatPrice(item.price * item.quantity)}</p>
                          <p className="text-sm font-bold text-rose-600">{formatPrice(lineTotal)}</p>
                        </>
                      ) : (
                        <p className="text-sm font-bold">{formatPrice(item.price * item.quantity)}</p>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="border-t p-4 space-y-3 bg-background">
              {/* Free shipping progress */}
              {(() => {
                const FREE_SHIPPING_THRESHOLD = 499;
                const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - total);
                const progress = Math.min(100, (total / FREE_SHIPPING_THRESHOLD) * 100);
                const reached = remaining === 0;
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2 text-[11px] sm:text-xs leading-snug">
                      {reached ? (
                        <>
                          <PartyPopper className="h-3.5 w-3.5 text-[#60a5fa] shrink-0 mt-0.5" />
                          <span className="font-medium text-[#1e3a8a] break-words">Você ganhou frete grátis! 🎉</span>
                        </>
                      ) : (
                        <>
                          <Truck className="h-3.5 w-3.5 text-[#60a5fa] shrink-0 mt-0.5" />
                          <span className="text-foreground break-words min-w-0">
                            Falta <span className="font-semibold text-[#1e3a8a] whitespace-nowrap">{formatPrice(remaining)}</span> para você ganhar <span className="font-semibold">frete grátis</span>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="relative h-2.5 w-full bg-[#172554]/15 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${reached ? 'bg-gradient-to-r from-[#1e3a8a] to-[#60a5fa]' : 'bg-gradient-to-r from-[#1e3a8a] to-[#60a5fa]'}`}
                        style={{ width: `${progress}%` }}
                      />
                      <span
                        className="absolute top-1/2 -translate-y-1/2 text-sm leading-none pointer-events-none"
                        style={{ left: `calc(${Math.min(progress, 96)}% - 2px)` }}
                      >
                        🎁
                      </span>
                    </div>
                  </div>
                );
              })()}
              <CartGiftRewards subtotal={total} compact />
              {valentinesPromoActive && items.length >= 2 && valentinesDiscount === 0 && (
                <div className="flex items-start gap-2 rounded-md bg-rose-500/10 border border-rose-500/30 px-2 py-1.5 text-[11px] sm:text-xs text-rose-700 dark:text-rose-400">
                  <Heart className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span><strong>{valentinesPromoLabel}:</strong> não combina com cupom/combo ativo.</span>
                </div>
              )}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {valentinesDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {valentinesPromoLabel} (2ª peça 50%)
                    </span>
                    <span>-{formatPrice(valentinesDiscount)}</span>
                  </div>
                )}
                {totalDiscount - valentinesDiscount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Outros descontos</span>
                    <span>-{formatPrice(totalDiscount - valentinesDiscount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-store-accent">{formatPrice(total)}</span>
                </div>
                {/* PIX 5% discount preview — não aplica durante Dia dos Namorados */}
                {!valentinesPromoActive && (() => {
                  const pixDiscount = Math.round(total * 5) / 100;
                  const pixTotal = Math.round((total - pixDiscount) * 100) / 100;
                  return (
                    <div className="mt-1 flex items-center justify-between rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-1.5 text-xs">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        No PIX (-5%)
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {formatPrice(pixTotal)}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="grid gap-2">
                <SheetClose asChild>
                  <Button
                    asChild
                    className={
                      valentinesPromoActive
                        ? 'w-full bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 text-white hover:opacity-90 font-semibold'
                        : 'w-full font-semibold'
                    }
                    style={
                      valentinesPromoActive
                        ? undefined
                        : { backgroundColor: '#1e3a8a', color: '#60a5fa' }
                    }
                    onMouseEnter={(e) => {
                      if (!valentinesPromoActive) e.currentTarget.style.backgroundColor = '#1d4ed8';
                    }}
                    onMouseLeave={(e) => {
                      if (!valentinesPromoActive) e.currentTarget.style.backgroundColor = '#1e3a8a';
                    }}
                  >
                    <Link to="/checkout">
                      {valentinesPromoActive && <Heart className="h-4 w-4 mr-1 fill-white" />}
                      Finalizar Compra
                    </Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/carrinho">Ver carrinho completo</Link>
                  </Button>
                </SheetClose>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
