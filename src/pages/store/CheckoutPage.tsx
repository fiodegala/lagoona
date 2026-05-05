import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Package, CheckCircle, ShieldCheck, Lock, Percent } from 'lucide-react';
import ShippingCalculator from '@/components/store/ShippingCalculator';
import MercadoPagoPayment from '@/components/store/MercadoPagoPayment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import StoreLayout from '@/components/store/StoreLayout';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { couponsService } from '@/services/coupons';
import { trackAnalyticsEvent } from '@/hooks/useAnalyticsTracker';
import { getAffiliateCode, clearAffiliateCode } from '@/lib/affiliateUtils';
import { trackMetaInitiateCheckout, trackMetaPurchase } from '@/lib/metaPixel';

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
  const { items, getTotal, getSubtotal, clearCart, getItemCount, comboFreeShipping, appliedCoupon } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [step, setStep] = useState<'info' | 'payment'>('info');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('pix');
  const [abandonedCartSaved, setAbandonedCartSaved] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    document: '',
    zipCode: '',
    address: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    complement: '',
  });
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [shippingResult, setShippingResult] = useState<{ name: string; price: number; days: string; isFreeShipping: boolean } | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  // Save/update abandoned cart when form data or items change
  useEffect(() => {
    if (items.length === 0 || orderComplete || step === 'payment') return;
    const hasData = formData.name || formData.email || formData.phone;
    if (!hasData && abandonedCartSaved) return;
    if (!hasData) return;

    const sessionId = getOrCreateSessionId();
    const saveTimeout = setTimeout(async () => {
      try {
        const cartData = {
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
        };

        await supabase.functions.invoke('abandoned-cart', {
          body: { action: 'upsert', session_id: sessionId, cart_data: cartData },
        });
        setAbandonedCartSaved(true);
      } catch (err) {
        console.error('Error saving abandoned cart:', err);
      }
    }, 2000);

    return () => clearTimeout(saveTimeout);
  }, [formData, items, orderComplete]);

  // Get session ID to save with order for later cart recovery
  const getSessionId = () => {
    return localStorage.getItem(ABANDONED_CART_SESSION_KEY) || null;
  };

  const total = getTotal();
  const shippingPrice = shippingResult?.price || 0;
  const grandTotal = total + shippingPrice;

  // PIX discount constants (must match MercadoPagoPayment)
  const PIX_DISCOUNT_PERCENT = 5;
  const pixDiscountAmount = Math.round(grandTotal * PIX_DISCOUNT_PERCENT) / 100;
  const pixGrandTotal = Math.round((grandTotal - pixDiscountAmount) * 100) / 100;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'zipCode') {
      const cleanCep = value.replace(/\D/g, '');
      if (cleanCep.length === 8) {
        fetchAddressByCep(cleanCep);
      }
    }
  };

  const fetchAddressByCep = async (cep: string) => {
    setIsFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          address: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || '',
        }));
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error('Seu carrinho está vazio');
      return;
    }

    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPhone = formData.phone.trim();
    const trimmedDocument = formData.document.trim();
    const trimmedAddress = formData.address.trim();
    const trimmedNumber = formData.number.trim();
    const trimmedCity = formData.city.trim();
    const trimmedState = formData.state.trim();
    const trimmedZipCode = formData.zipCode.trim();

    // Validate CPF/CNPJ FIRST - it's mandatory for shipping labels and invoices
    const docDigits = trimmedDocument.replace(/\D/g, '');
    if (!trimmedDocument || docDigits.length === 0) {
      toast.error('CPF ou CNPJ é obrigatório para finalizar a compra');
      document.getElementById('document')?.focus();
      return;
    }
    if (docDigits.length !== 11 && docDigits.length !== 14) {
      toast.error('CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos');
      document.getElementById('document')?.focus();
      return;
    }
    // Reject sequences of repeated digits (e.g. 00000000000)
    if (/^(\d)\1+$/.test(docDigits)) {
      toast.error('CPF/CNPJ inválido');
      document.getElementById('document')?.focus();
      return;
    }
    // Validate CPF check digits
    if (docDigits.length === 11) {
      const calcDigit = (base: string, factor: number) => {
        let sum = 0;
        for (let i = 0; i < base.length; i++) sum += parseInt(base[i]) * (factor - i);
        const rest = (sum * 10) % 11;
        return rest === 10 ? 0 : rest;
      };
      const d1 = calcDigit(docDigits.substring(0, 9), 10);
      const d2 = calcDigit(docDigits.substring(0, 10), 11);
      if (d1 !== parseInt(docDigits[9]) || d2 !== parseInt(docDigits[10])) {
        toast.error('CPF inválido. Verifique os dígitos.');
        document.getElementById('document')?.focus();
        return;
      }
    }
    // Validate CNPJ check digits
    if (docDigits.length === 14) {
      const calcCnpj = (base: string) => {
        const weights = base.length === 12
          ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
          : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        let sum = 0;
        for (let i = 0; i < base.length; i++) sum += parseInt(base[i]) * weights[i];
        const rest = sum % 11;
        return rest < 2 ? 0 : 11 - rest;
      };
      const d1 = calcCnpj(docDigits.substring(0, 12));
      const d2 = calcCnpj(docDigits.substring(0, 13));
      if (d1 !== parseInt(docDigits[12]) || d2 !== parseInt(docDigits[13])) {
        toast.error('CNPJ inválido. Verifique os dígitos.');
        document.getElementById('document')?.focus();
        return;
      }
    }

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !trimmedAddress || !trimmedNumber || !trimmedCity || !trimmedState || !trimmedZipCode) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validate phone format (minimum digits)
    const phoneDigits = trimmedPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Telefone deve ter no mínimo 10 dígitos');
      document.getElementById('phone')?.focus();
      return;
    }

    setIsSubmitting(true);

    // Track checkout_start event
    trackAnalyticsEvent('checkout_start', {
      metadata: {
        item_count: getItemCount(),
        total: total,
      },
    });

    // Meta Pixel: InitiateCheckout
    trackMetaInitiateCheckout({
      content_ids: items.map(i => i.productId),
      num_items: getItemCount(),
      value: total,
    });

    try {
      // Re-validate applied coupon against the checkout email (per-customer limit)
      if (appliedCoupon) {
        const productIds = items.map(i => i.productId);
        const recheck = await couponsService.validateCoupon(
          appliedCoupon.coupon.code,
          getSubtotal(),
          trimmedEmail.toLowerCase(),
          productIds,
        );
        if (!recheck.valid) {
          toast.error(recheck.error || 'Cupom não pode mais ser utilizado');
          setIsSubmitting(false);
          return;
        }
      }

      // Verify real-time stock availability before creating order
      const stockChecks = await Promise.all(
        items.map(async (item) => {
          let query = supabase
            .from('store_stock')
            .select('quantity')
            .eq('product_id', item.productId);

          if (item.variationId) {
            query = query.eq('variation_id', item.variationId);
          }

          const { data: stockRows } = await query;
          const totalStock = (stockRows || []).reduce((sum, r) => sum + (r.quantity || 0), 0);
          return { item, totalStock };
        })
      );

      const outOfStock = stockChecks.filter(s => s.totalStock < s.item.quantity);
      if (outOfStock.length > 0) {
        const names = outOfStock.map(s => {
          const available = s.totalStock;
          return available <= 0
            ? `"${s.item.name}" está esgotado`
            : `"${s.item.name}" tem apenas ${available} unidade(s) disponível(is)`;
        });
        toast.error(`Estoque insuficiente: ${names.join('; ')}`);
        setIsSubmitting(false);
        return;
      }

      const orderItems = items.map(item => ({
        product_id: item.productId,
        variation_id: item.variationId || null,
        name: item.name,
        variation_label: item.variationLabel || null,
        price: item.price,
        original_price: item.originalPrice,
        is_promotional: item.isPromotional || false,
        quantity: item.quantity,
        image_url: item.imageUrl || null,
      }));

      const newOrderId = crypto.randomUUID();

      const sessionId = getSessionId();

      const { error } = await supabase
        .from('orders')
        .insert({
          id: newOrderId,
          customer_email: formData.email,
          customer_name: formData.name,
          shipping_address: {
            address: formData.address,
            number: formData.number,
            neighborhood: formData.neighborhood,
            city: formData.city,
            state: formData.state,
            zip_code: formData.zipCode,
            complement: formData.complement,
            phone: formData.phone,
          },
          items: orderItems,
          total: grandTotal,
          status: 'pending',
          payment_status: 'pending',
          store_id: 'e0b8ebbc-1b3b-4aec-b5f7-6925762e6ea1', // Site store
          metadata: {
            ...(sessionId ? { abandoned_cart_session_id: sessionId } : {}),
            ...(getAffiliateCode() ? { affiliate_code: getAffiliateCode() } : {}),
            customer_document: formData.document.trim(),
            customer_phone: formData.phone.trim(),
            ...(appliedCoupon ? {
              coupon_id: appliedCoupon.coupon.id,
              coupon_code: appliedCoupon.coupon.code,
              coupon_discount: appliedCoupon.discount,
            } : {}),
          },
        });

      if (error) throw error;

      setOrderId(newOrderId);
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
    console.log('Payment success:', paymentData.status, paymentData.id);

    // Mark abandoned cart as recovered only after payment is confirmed
    const sessionId = getSessionId();
    if (sessionId) {
      try {
        await supabase.functions.invoke('abandoned-cart', {
          body: { action: 'recover', session_id: sessionId },
        });
      } catch (recoverErr) {
        console.error('Error recovering abandoned cart:', recoverErr);
      }
    }
    localStorage.removeItem(ABANDONED_CART_SESSION_KEY);

    // Coupon usage is now recorded server-side by the payment webhook
    // when the payment is confirmed (idempotent via metadata.coupon_id)

    // Track checkout_complete event
    trackAnalyticsEvent('checkout_complete', {
      metadata: {
        order_id: orderId,
        payment_status: paymentData.status,
        total: total,
      },
    });

    // Meta Pixel: Purchase
    trackMetaPurchase({
      content_ids: items.map(i => i.productId),
      num_items: getItemCount(),
      value: total,
      order_id: orderId || undefined,
    });
    
    setOrderComplete(true);
    clearCart();
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
        {/* Progress Stepper */}
        <div className="flex items-center justify-center gap-0 mb-8 max-w-md mx-auto">
          {[
            { label: 'Carrinho', step: 0 },
            { label: 'Dados', step: 1 },
            { label: 'Pagamento', step: 2 },
          ].map((s, i) => {
            const currentStep = step === 'info' ? 1 : 2;
            const isActive = i <= currentStep;
            const isCurrent = i === currentStep;
            return (
              <div key={s.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                    isCurrent ? "bg-store-gold text-store-dark" :
                    isActive ? "bg-store-gold/80 text-store-dark" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {isActive && i < currentStep ? <CheckCircle className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={cn(
                    "text-xs mt-1 font-medium",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}>{s.label}</span>
                </div>
                {i < 2 && (
                  <div className={cn(
                    "h-0.5 flex-1 mx-1 -mt-4",
                    i < currentStep ? "bg-store-gold" : "bg-muted"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        <Button variant="ghost" asChild className="mb-6">
          <Link to={step === 'payment' ? '#' : '/carrinho'} onClick={step === 'payment' ? (e) => { e.preventDefault(); setStep('info'); } : undefined}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 'payment' ? 'Voltar aos Dados' : 'Voltar ao Carrinho'}
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">
          {step === 'info' ? 'Finalizar Compra' : 'Pagamento'}
        </h1>
        <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          <span>Compra 100% segura · Dados protegidos</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {step === 'info' ? (
              <form id="checkout-form" onSubmit={handleCreateOrder}>
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
                    <div>
                      <Label htmlFor="document">CPF / CNPJ *</Label>
                      <Input id="document" name="document" placeholder="000.000.000-00" value={formData.document} onChange={handleInputChange} required minLength={11} />
                      {formData.document && formData.document.replace(/\D/g, '').length > 0 && formData.document.replace(/\D/g, '').length !== 11 && formData.document.replace(/\D/g, '').length !== 14 && (
                        <p className="text-xs text-destructive mt-1">CPF deve ter 11 dígitos ou CNPJ 14 dígitos</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Shipping address */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Endereço de Entrega</CardTitle>
                  </CardHeader>
                  <CardContent className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-1">
                      <Label htmlFor="zipCode">CEP *</Label>
                      <div className="relative">
                        <Input id="zipCode" name="zipCode" placeholder="00000-000" value={formData.zipCode} onChange={handleInputChange} required />
                        {isFetchingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="sm:col-span-1" />
                    <div className="sm:col-span-2">
                      <Label htmlFor="address">Rua / Avenida *</Label>
                      <Input id="address" name="address" placeholder="Rua, avenida..." value={formData.address} onChange={handleInputChange} required />
                    </div>
                    <div>
                      <Label htmlFor="number">Número *</Label>
                      <Input id="number" name="number" placeholder="123" value={formData.number} onChange={handleInputChange} required />
                    </div>
                    <div>
                      <Label htmlFor="complement">Complemento</Label>
                      <Input id="complement" name="complement" placeholder="Apto, bloco..." value={formData.complement} onChange={handleInputChange} />
                    </div>
                    <div>
                      <Label htmlFor="neighborhood">Bairro *</Label>
                      <Input id="neighborhood" name="neighborhood" value={formData.neighborhood} onChange={handleInputChange} required />
                    </div>
                    <div>
                      <Label htmlFor="city">Cidade *</Label>
                      <Input id="city" name="city" value={formData.city} onChange={handleInputChange} required />
                    </div>
                    <div>
                      <Label htmlFor="state">Estado *</Label>
                      <Input id="state" name="state" placeholder="SP" maxLength={2} value={formData.state} onChange={handleInputChange} required />
                    </div>
                  </CardContent>
                </Card>

                <ShippingCalculator orderTotal={total} forceFreeShipping={comboFreeShipping} onShippingCalculated={setShippingResult} />

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
                  amount={grandTotal}
                  orderId={orderId}
                  customerEmail={formData.email}
                  customerName={formData.name}
                  description={`Pedido #${orderId.slice(0, 8).toUpperCase()}`}
                  onPaymentSuccess={handlePaymentSuccess}
                  onPaymentError={handlePaymentError}
                  onMethodChange={setSelectedPaymentMethod}
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

                {(() => {
                  const showPixDiscount = step !== 'payment' || selectedPaymentMethod === 'pix';
                  const finalTotal = showPixDiscount ? pixGrandTotal : grandTotal;
                  return (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{formatPrice(total)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Frete</span>
                          <span className={shippingResult?.price === 0 || !shippingResult ? 'text-success' : ''}>
                            {!shippingResult ? 'Calcule o frete' : shippingResult.price === 0 ? 'Grátis' : formatPrice(shippingResult.price)}
                          </span>
                        </div>
                        {showPixDiscount && (
                          <div className="flex justify-between text-sm text-emerald-600">
                            <span className="flex items-center gap-1">
                              <Percent className="h-3 w-3" />
                              Desconto PIX (5%)
                            </span>
                            <span>-{formatPrice(pixDiscountAmount)}</span>
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <div className="text-right">
                          {showPixDiscount && (
                            <div className="text-sm text-muted-foreground line-through font-normal">
                              {formatPrice(grandTotal)}
                            </div>
                          )}
                          <span className={showPixDiscount ? 'text-emerald-600' : ''}>
                            {formatPrice(finalTotal)}
                          </span>
                          {showPixDiscount && (
                            <p className="text-[11px] text-muted-foreground font-normal mt-0.5">
                              {step === 'payment' ? 'desconto aplicado' : 'pagando no PIX'}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
              {step === 'info' && (
                <CardFooter>
                  <Button
                    type="submit"
                    form="checkout-form"
                    className="w-full hidden lg:flex"
                    size="lg"
                    disabled={isSubmitting}
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
