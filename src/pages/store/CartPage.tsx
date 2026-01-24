import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import StoreLayout from '@/components/store/StoreLayout';
import { useCart } from '@/contexts/CartContext';

const CartPage = () => {
  const { items, updateQuantity, removeItem, clearCart, getTotal } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const total = getTotal();

  if (items.length === 0) {
    return (
      <StoreLayout>
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

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8">
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
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Subtotal ({items.length} {items.length === 1 ? 'item' : 'itens'})
                  </span>
                  <span>{formatPrice(total)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frete</span>
                  <span className="text-muted-foreground">Calcular no checkout</span>
                </div>

                <Separator />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button asChild className="w-full gap-2" size="lg">
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
