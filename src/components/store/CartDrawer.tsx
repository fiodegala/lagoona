import { Link } from 'react-router-dom';
import { ShoppingCart, Minus, Plus, Trash2, ShoppingBag, Truck, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCart } from '@/contexts/CartContext';

const CartDrawer = () => {
  const { items, removeItem, updateQuantity, getItemCount, getSubtotal, getTotal, appliedCoupon, comboDiscount } = useCart();
  const itemCount = getItemCount();
  const subtotal = getSubtotal();
  const total = getTotal();

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  const totalDiscount = (appliedCoupon?.discount || 0) + comboDiscount;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-foreground/70 hover:text-foreground">
          <ShoppingCart className="h-5 w-5" />
          {itemCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-store-gold text-store-dark">
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
                {items.map((item) => (
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
                      <p className="text-sm font-bold text-store-accent mt-1">{formatPrice(item.price)}</p>

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
                      <p className="text-sm font-bold">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="border-t p-4 space-y-3 bg-background">
              {/* Free shipping progress */}
              {(() => {
                const FREE_SHIPPING_THRESHOLD = 299;
                const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - total);
                const progress = Math.min(100, (total / FREE_SHIPPING_THRESHOLD) * 100);
                const reached = remaining === 0;
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      {reached ? (
                        <>
                          <PartyPopper className="h-3.5 w-3.5 text-success shrink-0" />
                          <span className="font-medium text-success">Você ganhou frete grátis! 🎉</span>
                        </>
                      ) : (
                        <>
                          <Truck className="h-3.5 w-3.5 text-store-gold shrink-0" />
                          <span className="text-foreground">
                            Faltam <span className="font-semibold text-store-accent">{formatPrice(remaining)}</span> para o <span className="font-semibold">frete grátis</span>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${reached ? 'bg-success' : 'bg-store-gold'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Descontos</span>
                    <span>-{formatPrice(totalDiscount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-store-accent">{formatPrice(total)}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <SheetClose asChild>
                  <Button asChild className="w-full bg-store-primary text-store-accent hover:bg-store-primary/90 font-semibold">
                    <Link to="/checkout">Finalizar Compra</Link>
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
