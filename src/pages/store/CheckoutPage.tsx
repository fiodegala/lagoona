import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Package, CheckCircle } from 'lucide-react';
import ShippingCalculator from '@/components/store/ShippingCalculator';
import MercadoPagoPayment from '@/components/store/MercadoPagoPayment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import StoreLayout from '@/components/store/StoreLayout';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';

const ABANDONED_CART_SESSION_KEY = 'abandoned-cart-session';

const getOrCreateSessionId = () => {
  let sessionId = localStorage.getItem(ABANDONED_CART_SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(ABANDONED_CART_SESSION_KEY, sessionId);
  }
  return sessionId;
};

const CheckoutPage = () => {
  const { items, getTotal, getSubtotal, clearCart, getItemCount } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [step, setStep] = useState<'info' | 'payment'>('info');
  const [abandonedCartSaved, setAbandonedCartSaved] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    complement: '',
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  // Save/update abandoned cart when form data or items change
  useEffect(() => {
    if (items.length === 0 || orderComplete) return;
    // Only save if user has entered at least some data
    const hasData = formData.name || formData.email || formData.phone;
    if (!hasData && abandonedCartSaved) return;
    if (!hasData) return;

    const sessionId = getOrCreateSessionId();
    const saveTimeout = setTimeout(async () => {
      try {
        const cartData = {
          session_id: sessionId,
          customer_name: formData.name || null,
          customer_email: formData.email || null,
          customer_phone: formData.phone || null,
          shipping_address: formData.address ? {
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zip_code: formData.zipCode,
            complement: formData.complement,
          } : null,
          items: items.map(item => ({
            productId: item.productId,
            variationId: item.variationId,
            name: item.name,
            variationLabel: item.variationLabel,
            price: item.price,
            quantity: item.quantity,
            imageUrl: item.imageUrl,
          })),
          subtotal: getSubtotal(),
          item_count: getItemCount(),
          status: 'abandoned' as const,
        };

        // Upsert: try update first, then insert
        const { data: existing } = await supabase
          .from('abandoned_carts')
          .select('id')
          .eq('session_id', sessionId)
          .eq('status', 'abandoned')
          .maybeSingle();

        if (existing) {
          await supabase
            .from('abandoned_carts')
            .update(cartData)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('abandoned_carts')
            .insert(cartData);
        }
        setAbandonedCartSaved(true);
      } catch (err) {
        console.error('Error saving abandoned cart:', err);
      }
    }, 2000); // Debounce 2s

    return () => clearTimeout(saveTimeout);
  }, [formData, items, orderComplete]);

  // Mark cart as recovered when order is completed
  const markCartRecovered = async () => {
    const sessionId = localStorage.getItem(ABANDONED_CART_SESSION_KEY);
    if (!sessionId) return;
    try {
      await supabase
        .from('abandoned_carts')
        .update({ status: 'recovered', recovered_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('status', 'abandoned');
      localStorage.removeItem(ABANDONED_CART_SESSION_KEY);
    } catch (err) {
      console.error('Error marking cart as recovered:', err);
    }
  };

  const total = getTotal();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error('Seu carrinho está vazio');
      return;
    }

    if (!formData.name || !formData.email || !formData.phone || !formData.address || !formData.city || !formData.state || !formData.zipCode) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderItems = items.map(item => ({
        product_id: item.productId,
        variation_id: item.variationId || null,
        name: item.name,
        variation_label: item.variationLabel || null,
        price: item.price,
        quantity: item.quantity,
      }));

      const { data, error } = await supabase
        .from('orders')
        .insert({
          customer_email: formData.email,
          customer_name: formData.name,
          shipping_address: {
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zip_code: formData.zipCode,
            complement: formData.complement,
            phone: formData.phone,
          },
          items: orderItems,
          total: total,
          status: 'pending',
          payment_status: 'pending',
          store_id: 'e0b8ebbc-1b3b-4aec-b5f7-6925762e6ea1', // Site store
        })
        .select('id')
        .single();

      if (error) throw error;

      setOrderId(data.id);
      setStep('payment');
      toast.success('Pedido criado! Agora escolha a forma de pagamento.');
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Erro ao processar pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    try {
      // Update order with payment info
      if (orderId) {
        await supabase
          .from('orders')
           .update({
            payment_status: paymentData.status === 'approved' ? 'paid' : 'pending',
            payment_method: paymentData.payment_method_id,
            metadata: {
              mercadopago_payment_id: paymentData.id,
              payment_status: paymentData.status,
              payment_status_detail: paymentData.status_detail,
              payment_type_id: paymentData.payment_type_id,
              installments: paymentData.installments || 1,
              transaction_amount: paymentData.transaction_amount || null,
            },
          })
          .eq('id', orderId);
      }
    } catch (err) {
      console.error('Error updating order:', err);
    }

    setOrderComplete(true);
    clearCart();
    markCartRecovered();
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
  };

  if (items.length === 0 && !orderComplete && step === 'info') {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-24 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Carrinho vazio</h1>
          <p className="text-muted-foreground mb-6">
            Adicione produtos ao carrinho para continuar.
          </p>
          <Button asChild>
            <Link to="/loja">Ver Produtos</Link>
          </Button>
        </div>
      </StoreLayout>
    );
  }

  if (orderComplete && orderId) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-24 text-center max-w-lg">
          <div className="p-4 rounded-full bg-success/10 w-fit mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-success" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Pedido Realizado!</h1>
          <p className="text-muted-foreground mb-2">
            Seu pedido foi registrado com sucesso.
          </p>
          <p className="text-sm font-mono bg-muted px-3 py-1 rounded inline-block mb-6">
            Pedido #{orderId.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Enviamos um email de confirmação para {formData.email}
          </p>
          <div className="flex flex-col gap-3">
            <Button asChild>
              <Link to="/loja">Continuar Comprando</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Voltar ao Início</Link>
            </Button>
          </div>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to={step === 'payment' ? '#' : '/carrinho'} onClick={step === 'payment' ? (e) => { e.preventDefault(); setStep('info'); } : undefined}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 'payment' ? 'Voltar aos Dados' : 'Voltar ao Carrinho'}
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-8">
          {step === 'info' ? 'Finalizar Compra' : 'Pagamento'}
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {step === 'info' ? (
              <form onSubmit={handleCreateOrder}>
                {/* Personal data */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Dados Pessoais</CardTitle>
                  </CardHeader>
                  <CardContent className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Label htmlFor="name">Nome Completo *</Label>
                      <Input id="name" name="name" value={formData.name} onChange={handleInputChange} required />
                    </div>
                    <div>
                      <Label htmlFor="email">E-mail *</Label>
                      <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefone *</Label>
                      <Input id="phone" name="phone" type="tel" placeholder="(00) 00000-0000" value={formData.phone} onChange={handleInputChange} required />
                    </div>
                  </CardContent>
                </Card>

                {/* Shipping address */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Endereço de Entrega</CardTitle>
                  </CardHeader>
                  <CardContent className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Label htmlFor="address">Endereço *</Label>
                      <Input id="address" name="address" placeholder="Rua, número" value={formData.address} onChange={handleInputChange} required />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="complement">Complemento</Label>
                      <Input id="complement" name="complement" placeholder="Apartamento, bloco, etc." value={formData.complement} onChange={handleInputChange} />
                    </div>
                    <div>
                      <Label htmlFor="city">Cidade *</Label>
                      <Input id="city" name="city" value={formData.city} onChange={handleInputChange} required />
                    </div>
                    <div>
                      <Label htmlFor="state">Estado *</Label>
                      <Input id="state" name="state" placeholder="SP" maxLength={2} value={formData.state} onChange={handleInputChange} required />
                    </div>
                    <div>
                      <Label htmlFor="zipCode">CEP *</Label>
                      <Input id="zipCode" name="zipCode" placeholder="00000-000" value={formData.zipCode} onChange={handleInputChange} required />
                    </div>
                  </CardContent>
                </Card>

                <ShippingCalculator orderTotal={total} />

                <div className="mt-6 lg:hidden">
                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      'Ir para Pagamento'
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              orderId && (
                <MercadoPagoPayment
                  amount={total}
                  orderId={orderId}
                  customerEmail={formData.email}
                  customerName={formData.name}
                  description={`Pedido #${orderId.slice(0, 8).toUpperCase()}`}
                  onPaymentSuccess={handlePaymentSuccess}
                  onPaymentError={handlePaymentError}
                />
              )
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="w-12 h-12 shrink-0 rounded bg-muted overflow-hidden">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity}x {formatPrice(item.price)}
                        </p>
                      </div>
                      <p className="text-sm font-medium">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Frete</span>
                    <span className="text-success">Grátis</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
              </CardContent>
              {step === 'info' && (
                <CardFooter>
                  <Button
                    type="submit"
                    form="checkout-form"
                    className="w-full hidden lg:flex"
                    size="lg"
                    disabled={isSubmitting}
                    onClick={handleCreateOrder}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      'Ir para Pagamento'
                    )}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
};

export default CheckoutPage;
