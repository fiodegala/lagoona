import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Package, Tag, X, Loader2, CheckCircle, Sparkles, Truck, Heart, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import StoreLayout from '@/components/store/StoreLayout';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { SEO } from "@/components/seo/SEO";

const CartPage = () => {
  const { user } = useAuth();
  const { 
    items, 
    updateQuantity, 
    removeItem, 
    clearCart, 
    getSubtotal, 
    getTotal,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    couponLoading,
    appliedCombos,
    comboDiscount,
    comboFreeShipping,
    valentinesDiscount,
    valentinesPromoActive,
    valentinesPromoLabel,
  } = useCart();
  
  const [couponCode, setCouponCode] = useState('');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const subtotal = getSubtotal();
  const total = getTotal();

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      toast.error('Digite um código de cupom');
      return;
    }

    // For per-customer-limited coupons (e.g. BEMVINDO10), require an email to enforce limit
    let customerEmail = user?.email || undefined;
    if (!customerEmail) {
      const input = window.prompt('Digite seu e-mail para aplicar o cupom (necessário para validar o limite por cliente):');
      if (!input) return;
      customerEmail = input.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        toast.error('E-mail inválido');
        return;
      }
    }

    const result = await applyCoupon(code, customerEmail);

    if (result.valid) {
      toast.success(`Cupom aplicado! Desconto de ${formatPrice(result.discount || 0)}`);
      setCouponCode('');
    } else {
      toast.error(result.error || 'Cupom inválido');
    }
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    toast.success('Cupom removido');
  };

  if (items.length === 0) {
    return (
      <StoreLayout>
              <SEO title="Carrinho — Fio de Gala" description="Revise os itens do seu carrinho e finalize a compra com segurança na Fio de Gala." canonicalPath="/carrinho" />
<div className="container mx-auto px-4 py-24 text-center">
          <ShoppingBag className="h-20 w-20 mx-auto text-muted-foreground/30 mb-6" />
          <h1 className="text-2xl font-bold mb-2">Seu carrinho está vazio</h1>
          <p className="text-muted-foreground mb-8">
            Adicione produtos para continuar suas compras.
          </p>
          <Button asChild size="lg" className="gap-2">
            <Link to="/loja">
              Ver Produtos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </StoreLayout>
    );
  }

  const REWARD_THRESHOLD = 500;
  const remainingForReward = Math.max(0, REWARD_THRESHOLD - total);
  const rewardProgress = Math.min(100, (total / REWARD_THRESHOLD) * 100);
  const rewardUnlocked = remainingForReward <= 0;

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Reward Progress Bar — Boné + Frete Grátis */}
        <div className={`mb-6 p-4 rounded-lg border ${rewardUnlocked ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50'}`}>
          {!rewardUnlocked ? (
            <>
              <div className="flex items-start gap-2 mb-2 flex-wrap">
                <Gift className="h-5 w-5 text-store-primary shrink-0 mt-0.5" />
                <p className="text-sm">
                  Falta <strong>{formatPrice(remainingForReward)}</strong> para completar <strong>R$ 500,00</strong> e ganhar um <strong>boné grátis</strong> + <strong>frete grátis</strong>!
                </p>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] progress-bar-glow relative overflow-hidden"
                  style={{ width: `${rewardProgress}%`, backgroundColor: '#009C3B' }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-right">
                {formatPrice(total)} / {formatPrice(REWARD_THRESHOLD)}
              </p>
            </>
          ) : (
            <p className="text-sm text-green-700 dark:text-green-400 font-medium flex items-center gap-2 flex-wrap">
              <Gift className="h-5 w-5 shrink-0" />
              Parabéns! Você ganhou um <strong>boné grátis</strong> + <strong>frete grátis</strong>! 🎉
            </p>
          )}
        </div>


        <h1 className="text-3xl font-bold mb-8">Carrinho de Compras</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Image */}
                    <div className="w-24 h-24 shrink-0 rounded-md overflow-hidden bg-muted">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/produto/${item.productId}`}
                        className="font-medium hover:text-primary transition-colors line-clamp-2"
                      >
                        {item.name}
                      </Link>
                      
                      {item.variationLabel && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.variationLabel}
                        </p>
                      )}

                      <p className="text-lg font-semibold text-primary mt-2">
                        {formatPrice(item.price)}
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex flex-col items-end justify-between">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.stock}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              variant="outline"
              onClick={clearCart}
              className="text-muted-foreground"
            >
              Limpar Carrinho
            </Button>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Coupon Section */}
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Cupom de desconto
                  </label>
                  
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-success/10 border border-success/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <div>
                          <p className="font-mono font-bold text-sm">{appliedCoupon.coupon.code}</p>
                          <p className="text-xs text-success">
                            -{formatPrice(appliedCoupon.discount)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={handleRemoveCoupon}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite o código"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="font-mono uppercase"
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                      />
                      <Button 
                        variant="outline" 
                        onClick={handleApplyCoupon}
                        disabled={couponLoading}
                      >
                        {couponLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Aplicar'
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Subtotal ({items.length} {items.length === 1 ? 'item' : 'itens'})
                  </span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto ({appliedCoupon.coupon.code})</span>
                    <span>-{formatPrice(appliedCoupon.discount)}</span>
                  </div>
                )}

                {valentinesDiscount > 0 && (
                  <div className="flex justify-between text-sm text-rose-600 dark:text-rose-400">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {valentinesPromoLabel} (2ª peça 50% OFF)
                    </span>
                    <span>-{formatPrice(valentinesDiscount)}</span>
                  </div>
                )}

                {valentinesPromoActive && items.length >= 2 && valentinesDiscount === 0 && (
                  <div className="flex items-start gap-2 rounded-md bg-rose-500/10 border border-rose-500/30 p-2 text-xs text-rose-700 dark:text-rose-400">
                    <Heart className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      A promoção <strong>{valentinesPromoLabel}</strong> (2ª peça com 50% OFF) não pode ser combinada com cupom ou combo ativo.
                    </span>
                  </div>
                )}

                {appliedCombos.length > 0 && (
                  <div className="space-y-1">
                    {appliedCombos.map((ac) => (
                      <div key={ac.combo.id} className="flex justify-between text-sm text-green-600">
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Combo: {ac.combo.name}
                        </span>
                        <span>-{formatPrice(ac.discount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frete</span>
                  {comboFreeShipping ? (
                    <Badge variant="default" className="gap-1 text-xs">
                      <Truck className="h-3 w-3" /> Grátis (Combo)
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">Calcular no checkout</span>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>

                {/* PIX 5% discount preview (não aplica durante Dia dos Namorados) */}
                {!valentinesPromoActive && (() => {
                  const pixDiscount = Math.round(total * 5) / 100;
                  const pixTotal = Math.round((total - pixDiscount) * 100) / 100;
                  return (
                    <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          Pagando no PIX (-5%)
                        </span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {formatPrice(pixTotal)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Economize {formatPrice(pixDiscount)} escolhendo PIX no pagamento.
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button
                  asChild
                  className="w-full gap-2 font-semibold"
                  size="lg"
                  style={{ backgroundColor: '#009C3B', color: '#FFDF00' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#007A2F')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#009C3B')}
                >
                  <Link to="/checkout">
                    Finalizar Compra
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/loja">Continuar Comprando</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
};

export default CartPage;
