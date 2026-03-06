import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import POSLayout from '@/components/pos/POSLayout';
import { ProductResult, SaleType } from '@/components/pos/ProductSearch';
import { CartItem } from '@/components/pos/POSCart';
import { Customer } from '@/components/pos/CustomerSelector';
import { Seller } from '@/components/pos/steps/SellerStep';
import SaleTypeStep from '@/components/pos/steps/SaleTypeStep';
import SellerStep from '@/components/pos/steps/SellerStep';
import CustomerStep from '@/components/pos/steps/CustomerStep';
import ProductsStep from '@/components/pos/steps/ProductsStep';
import PaymentStep from '@/components/pos/steps/PaymentStep';
import ExchangePanel, { ExchangeData } from '@/components/pos/ExchangePanel';
import FiscalReceiptModal from '@/components/pos/FiscalReceiptModal';
import { OpenSessionModal, CloseSessionModal, CashMovementModal } from '@/components/pos/CashDrawerModals';
import { posService, POSSession, CreateSaleData } from '@/services/posService';
import { offlineService } from '@/services/offlineService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, ArrowUpDown, Check, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type WizardStep = 'sale-type' | 'seller' | 'customer' | 'products' | 'payment';
const isQuoteType = (t: SaleType) => t === 'orcamento';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'sale-type', label: 'Tipo' },
  { key: 'seller', label: 'Vendedor' },
  { key: 'customer', label: 'Cliente' },
  { key: 'products', label: 'Produtos' },
  { key: 'payment', label: 'Pagamento' },
];

const POSPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userStoreId } = useAuth();
  const [session, setSession] = useState<POSSession | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('sale-type');
  const [saleType, setSaleType] = useState<SaleType>('varejo');
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerCreditBalance, setCustomerCreditBalance] = useState(0);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [generalDiscount, setGeneralDiscount] = useState<{ type: 'percentage' | 'fixed'; value: number }>({ type: 'percentage', value: 0 });

  // Modals
  const [openSessionModal, setOpenSessionModal] = useState(false);
  const [closeSessionModal, setCloseSessionModal] = useState(false);
  const [cashMovementModal, setCashMovementModal] = useState(false);
  const [fiscalModalOpen, setFiscalModalOpen] = useState(false);
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);
  const [completedSaleTotal, setCompletedSaleTotal] = useState(0);
  const [completedCustomerData, setCompletedCustomerData] = useState<{
    name?: string; document?: string; email?: string; phone?: string;
    address?: string; city?: string; state?: string; zip_code?: string;
  } | null>(null);

  const isExchangeMode = saleType === 'troca';
  const isQuoteMode = isQuoteType(saleType);

  useEffect(() => {
    const unsubscribe = offlineService.onOnlineStatusChange(setIsOnline);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchCreditBalance = async () => {
      if (selectedCustomer?.id) {
        const { data } = await supabase
          .from('customers')
          .select('credit_balance')
          .eq('id', selectedCustomer.id)
          .single();
        setCustomerCreditBalance(data?.credit_balance || 0);
      } else {
        setCustomerCreditBalance(0);
      }
    };
    fetchCreditBalance();
  }, [selectedCustomer?.id]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        await offlineService.initDB();
        const openSession = await posService.getOpenSession();
        setSession(openSession);
        if (openSession) {
          await offlineService.saveCurrentSession({
            id: openSession.id,
            user_id: openSession.user_id,
            opened_at: openSession.opened_at,
            opening_balance: openSession.opening_balance,
            status: 'open',
          });
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const itemDiscounts = cartItems.reduce((sum, item) => sum + item.discount_amount, 0);
  const generalDiscountAmount = generalDiscount.type === 'percentage'
    ? (subtotal - itemDiscounts) * (generalDiscount.value / 100)
    : generalDiscount.value;
  const totalDiscount = itemDiscounts + generalDiscountAmount;
  const total = Math.max(0, subtotal - totalDiscount);

  const resolvePrice = useCallback((product: ProductResult): number => {
    switch (saleType) {
      case 'atacado':
        return product.wholesale_price ?? product.price;
      case 'exclusivo':
        return product.exclusive_price ?? product.price;
      case 'troca':
        return 0;
      case 'orcamento':
        return product.promotional_price ?? product.price;
      default:
        // Varejo: always use regular retail price
        return product.price;
    }
  }, [saleType]);

  const handleProductSelect = useCallback((product: ProductResult, variationId?: string) => {
    if (variationId) {
      const variation = product.variations.find((v) => v.id === variationId);
      if (!variation) return;

      const basePrice = variation.price ?? product.price;
      const variationPrice = (() => {
        switch (saleType) {
          case 'atacado':
            return variation.wholesale_price ?? variation.price ?? product.wholesale_price ?? product.price;
          case 'exclusivo':
            return variation.exclusive_price ?? variation.price ?? product.exclusive_price ?? product.price;
          case 'troca':
            return 0;
          default:
            // Varejo: use regular retail price
            return variation.price ?? product.price;
        }
      })();

      // Determine available promotional price for this variation
      const availablePromoPrice = variation.promotional_price ?? product.promotional_price ?? null;
      const hasValidPromo = saleType === 'varejo' && availablePromoPrice != null && availablePromoPrice < basePrice;
      const isPromotional = false; // No longer auto-apply promo

      const existingItem = cartItems.find((item) => item.product_id === product.id && item.variation_id === variationId);
      if (existingItem) {
        setCartItems((items) =>
          items.map((item) =>
            item.id === existingItem.id
              ? { ...item, quantity: Math.min(item.quantity + 1, item.max_stock), total: item.unit_price * (item.quantity + 1) - item.discount_amount }
              : item
          )
        );
      } else {
        const label = variation.label || variation.sku || variationId.slice(0, 8);
        const newItem: CartItem = {
          id: crypto.randomUUID(),
          product_id: product.id,
          variation_id: variationId,
          name: `${product.name} — ${label}`,
          sku: variation.sku || undefined,
          image_url: variation.image_url || product.image_url || null,
          unit_price: variationPrice,
          original_price: isPromotional ? basePrice : undefined,
          is_promotional: isPromotional || undefined,
          available_promotional_price: hasValidPromo ? availablePromoPrice! : undefined,
          quantity: 1,
          discount_amount: 0,
          total: variationPrice,
          max_stock: variation.stock,
        };
        setCartItems((items) => [...items, newItem]);
      }
    } else {
      const unitPrice = resolvePrice(product);
      const isPromotional = saleType === 'varejo' && product.promotional_price != null && product.promotional_price < product.price;
      const existingItem = cartItems.find((item) => item.product_id === product.id && !item.variation_id);

      if (existingItem) {
        setCartItems((items) =>
          items.map((item) =>
            item.id === existingItem.id
              ? { ...item, quantity: Math.min(item.quantity + 1, item.max_stock), total: item.unit_price * (item.quantity + 1) - item.discount_amount }
              : item
          )
        );
      } else {
        const newItem: CartItem = {
          id: crypto.randomUUID(),
          product_id: product.id,
          name: product.name,
          image_url: product.image_url || null,
          unit_price: unitPrice,
          original_price: isPromotional ? product.price : undefined,
          is_promotional: isPromotional || undefined,
          quantity: 1,
          discount_amount: 0,
          total: unitPrice,
          max_stock: product.stock,
        };
        setCartItems((items) => [...items, newItem]);
      }
    }
  }, [cartItems, resolvePrice, saleType]);

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    setCartItems((items) =>
      items.map((item) => {
        if (item.id !== itemId) return item;
        const newQty = Math.min(quantity, item.max_stock);
        return { ...item, quantity: newQty, total: item.unit_price * newQty - item.discount_amount };
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setCartItems((items) => items.filter((item) => item.id !== itemId));
  };

  const handleApplyItemDiscount = (itemId: string, discountType: 'percentage' | 'fixed' | undefined, discountValue: number) => {
    setCartItems((items) =>
      items.map((item) => {
        if (item.id !== itemId) return item;
        const discountAmount = discountType === 'percentage'
          ? item.unit_price * item.quantity * (discountValue / 100)
          : discountValue;
        return { ...item, discount_type: discountType, discount_value: discountValue, discount_amount: discountAmount, total: item.unit_price * item.quantity - discountAmount };
      })
    );
  };

  const handlePayment = async (method: 'cash' | 'card' | 'pix' | 'mixed', amountReceived?: number, paymentDetails?: Record<string, number>, saleDate?: string) => {
    if (cartItems.length === 0) return;
    setIsProcessing(true);

    // If it's a quote, save to quotes table instead
    if (isQuoteType(saleType)) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const quoteData = {
          local_id: offlineService.generateLocalId(),
          user_id: user.id,
          store_id: selectedSeller?.store_id || userStoreId || null,
          customer_id: selectedCustomer?.id || null,
          customer_name: selectedCustomer?.name || null,
          customer_document: selectedCustomer?.document || null,
          customer_phone: selectedCustomer?.phone || null,
          items: cartItems.map((item) => ({
            product_id: item.product_id,
            variation_id: item.variation_id,
            name: item.name,
            sku: item.sku,
            image_url: item.image_url || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_amount: item.discount_amount,
            total: item.total,
          })) as unknown as Record<string, unknown>[],
          subtotal,
          discount_type: generalDiscount.value > 0 ? generalDiscount.type : null,
          discount_value: generalDiscount.value,
          discount_amount: totalDiscount,
          total,
          payment_method: method,
          payment_details: paymentDetails || {},
          notes: selectedSeller ? `Vendedor: ${selectedSeller.full_name}` : null,
          status: 'pending',
        };

        await supabase.from('quotes').insert(quoteData as never);

        toast({ title: 'Orçamento gerado!', description: `Total: R$ ${total.toFixed(2)}${selectedCustomer ? ` • Cliente: ${selectedCustomer.name}` : ''}` });
        resetWizard();
      } catch (error) {
        console.error('Error creating quote:', error);
        toast({ title: 'Erro ao gerar orçamento', variant: 'destructive' });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    const saleData: CreateSaleData = {
      local_id: offlineService.generateLocalId(),
      session_id: session?.id,
      store_id: selectedSeller?.store_id || userStoreId || undefined,
      customer_id: selectedCustomer?.id,
      customer_name: selectedCustomer?.name,
      customer_document: selectedCustomer?.document || undefined,
      items: cartItems.map((item) => ({
        product_id: item.product_id,
        variation_id: item.variation_id,
        name: item.name,
        sku: item.sku,
        image_url: item.image_url || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        original_price: item.original_price,
        is_promotional: item.is_promotional || false,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        discount_amount: item.discount_amount,
        total: item.total,
      })),
      subtotal,
      discount_type: generalDiscount.value > 0 ? generalDiscount.type : undefined,
      discount_value: generalDiscount.value,
      discount_amount: totalDiscount,
      total,
      payment_method: method,
      payment_details: paymentDetails,
      amount_received: amountReceived,
      change_amount: amountReceived ? Math.max(0, amountReceived - total) : 0,
      notes: selectedSeller ? `Vendedor: ${selectedSeller.full_name}` : undefined,
      sale_date: saleDate,
    };

    try {
      let saleResult: any = null;
      if (isOnline) {
        saleResult = await posService.createSale(saleData);
      } else {
        await offlineService.savePendingSale(saleData);
      }
      toast({ title: 'Venda finalizada!', description: `Total: R$ ${total.toFixed(2)}${selectedCustomer ? ` • Cliente: ${selectedCustomer.name}` : ''}` });
      
      // Show fiscal receipt modal
      setCompletedSaleId(saleResult?.id || null);
      setCompletedSaleTotal(total);
      if (selectedCustomer) {
        // Fetch full customer data for pre-fill
        const { data: fullCustomer } = await supabase
          .from('customers')
          .select('name, document, email, phone, address, city, state, zip_code')
          .eq('id', selectedCustomer.id)
          .single();
        setCompletedCustomerData(fullCustomer || { name: selectedCustomer.name, document: selectedCustomer.document });
      } else {
        setCompletedCustomerData(null);
      }
      setFiscalModalOpen(true);
    } catch (error) {
      console.error('Error processing sale:', error);
      toast({ title: 'Erro ao processar venda', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExchange = async (data: ExchangeData) => {
    if (!selectedCustomer) {
      toast({ title: 'Selecione um cliente', description: 'É necessário vincular um cliente à troca.', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);

    try {
      if (data.newItems.length > 0 && data.amountToPay > 0) {
        const saleData: CreateSaleData = {
          local_id: offlineService.generateLocalId(),
          session_id: session?.id,
          store_id: selectedSeller?.store_id || userStoreId || undefined,
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          customer_document: selectedCustomer.document || undefined,
          items: data.newItems.map(item => ({
            product_id: item.product_id,
            variation_id: item.variation_id,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_amount: 0,
            total: item.unit_price * item.quantity,
          })),
          subtotal: data.newTotal,
          discount_amount: data.returnTotal + data.creditUsed,
          total: data.amountToPay,
          payment_method: data.paymentMethod || 'cash',
          amount_received: data.amountReceived,
          change_amount: data.amountReceived ? Math.max(0, data.amountReceived - data.amountToPay) : 0,
          notes: `TROCA - Devolvidos: ${data.returnedItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}${selectedSeller ? ` | Vendedor: ${selectedSeller.full_name}` : ''}`,
        };
        await posService.createSale(saleData);
      }

      for (const item of data.returnedItems) {
        if (userStoreId) {
          let stockQuery = supabase
            .from('store_stock')
            .select('id, quantity')
            .eq('store_id', userStoreId)
            .eq('product_id', item.product_id);

          if (item.variation_id) {
            stockQuery = stockQuery.eq('variation_id', item.variation_id);
          } else {
            stockQuery = stockQuery.is('variation_id', null);
          }

          const { data: existingStock } = await stockQuery.maybeSingle();

          if (existingStock) {
            await supabase
              .from('store_stock')
              .update({ quantity: existingStock.quantity + item.quantity })
              .eq('id', existingStock.id);
          } else {
            await supabase
              .from('store_stock')
              .insert({
                store_id: userStoreId,
                product_id: item.product_id,
                variation_id: item.variation_id || null,
                quantity: item.quantity,
              });
          }
        }
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single();
        if (product) {
          await supabase
            .from('products')
            .update({ stock: product.stock + item.quantity })
            .eq('id', item.product_id);
        }
      }

      const newCreditBalance = customerCreditBalance - data.creditUsed + data.creditToStore;
      await supabase
        .from('customers')
        .update({ credit_balance: newCreditBalance })
        .eq('id', selectedCustomer.id);

      const messages: string[] = [];
      if (data.returnedItems.length > 0) messages.push(`${data.returnedItems.reduce((s, i) => s + i.quantity, 0)} item(ns) devolvido(s)`);
      if (data.newItems.length > 0) messages.push(`${data.newItems.reduce((s, i) => s + i.quantity, 0)} item(ns) novo(s)`);
      if (data.creditToStore > 0) messages.push(`Crédito de R$ ${data.creditToStore.toFixed(2)} gerado`);
      if (data.amountToPay > 0) messages.push(`Diferença de R$ ${data.amountToPay.toFixed(2)} paga`);

      toast({ title: 'Troca finalizada!', description: messages.join(' • ') });
      
      // Show fiscal modal for exchanges too
      setCompletedSaleId(null);
      setCompletedSaleTotal(data.amountToPay || 0);
      if (selectedCustomer) {
        const { data: fullCustomer } = await supabase
          .from('customers')
          .select('name, document, email, phone, address, city, state, zip_code')
          .eq('id', selectedCustomer.id)
          .single();
        setCompletedCustomerData(fullCustomer || { name: selectedCustomer.name, document: selectedCustomer.document });
      } else {
        setCompletedCustomerData(null);
      }
      setFiscalModalOpen(true);
    } catch (error) {
      console.error('Error processing exchange:', error);
      toast({ title: 'Erro ao processar troca', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetWizard = () => {
    setCurrentStep('sale-type');
    setSaleType('varejo');
    setSelectedSeller(null);
    setSelectedCustomer(null);
    setCustomerCreditBalance(0);
    setCartItems([]);
    setGeneralDiscount({ type: 'percentage', value: 0 });
  };

  const handleOpenSession = async (openingBalance: number, notes?: string) => {
    const newSession = await posService.openSession(openingBalance, notes, userStoreId || undefined);
    setSession(newSession);
    await offlineService.saveCurrentSession({ id: newSession.id, user_id: newSession.user_id, opened_at: newSession.opened_at, opening_balance: newSession.opening_balance, status: 'open' });
    toast({ title: 'Caixa aberto!' });
  };

  const handleCloseSession = async (closingBalance: number, notes?: string) => {
    if (!session) return;
    await posService.closeSession(session.id, closingBalance, notes);
    setSession(null);
    await offlineService.clearCurrentSession();
    toast({ title: 'Caixa fechado!' });
  };

  const handleCashMovement = async (type: 'withdrawal' | 'deposit', amount: number, description?: string) => {
    if (!session) return;
    await posService.addTransaction(session.id, type, amount, description);
    toast({ title: type === 'withdrawal' ? 'Sangria registrada' : 'Suprimento registrado' });
  };

  const stepIndex = STEPS.findIndex(s => s.key === currentStep);

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!session) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 px-4">
        <DollarSign className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground" />
        <h1 className="text-xl sm:text-2xl font-bold">Caixa Fechado</h1>
        <p className="text-muted-foreground text-center text-sm sm:text-base">Abra o caixa para iniciar as vendas</p>
        <Button size="lg" onClick={() => setOpenSessionModal(true)}>Abrir Caixa</Button>
        <Button variant="ghost" onClick={() => navigate('/admin')}>Voltar ao Admin</Button>
        <OpenSessionModal open={openSessionModal} onOpenChange={setOpenSessionModal} onConfirm={handleOpenSession} />
      </div>
    );
  }

  return (
    <POSLayout session={session} onOpenCashDrawer={() => setCashMovementModal(true)}>
      <div className="h-full flex flex-col">
        {/* Stepper */}
        <div className="border-b bg-card px-3 sm:px-6 py-2 sm:py-3 overflow-x-auto">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {STEPS.map((step, index) => {
              const isCompleted = index < stepIndex;
              const isCurrent = index === stepIndex;

              // Skip products step display for exchange mode
              if (step.key === 'products' && isExchangeMode) {
                return (
                  <div key={step.key} className="flex items-center gap-2">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all',
                      isCompleted ? 'bg-primary border-primary text-primary-foreground' :
                      isCurrent ? 'border-primary text-primary bg-primary/10' :
                      'border-muted-foreground/30 text-muted-foreground'
                    )}>
                      {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <span className={cn('text-sm font-medium hidden sm:block', isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground')}>
                      Troca
                    </span>
                    {index < STEPS.length - 1 && <div className={cn('w-8 h-0.5 mx-2', isCompleted ? 'bg-primary' : 'bg-muted-foreground/20')} />}
                  </div>
                );
              }

              return (
                <div key={step.key} className="flex items-center gap-2">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all',
                    isCompleted ? 'bg-primary border-primary text-primary-foreground' :
                    isCurrent ? 'border-primary text-primary bg-primary/10' :
                    'border-muted-foreground/30 text-muted-foreground'
                  )}>
                    {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className={cn('text-sm font-medium hidden sm:block', isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground')}>
                    {step.key === 'payment' && isQuoteMode ? 'Orçamento' : step.label}
                  </span>
                  {index < STEPS.length - 1 && <div className={cn('w-8 h-0.5 mx-2', isCompleted ? 'bg-primary' : 'bg-muted-foreground/20')} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {currentStep === 'sale-type' && (
            <SaleTypeStep
              saleType={saleType}
              onSelect={(type) => {
                if (type !== saleType) {
                  setCartItems([]);
                  setGeneralDiscount({ type: 'percentage', value: 0 });
                }
                setSaleType(type);
              }}
              onNext={() => setCurrentStep('seller')}
            />
          )}

          {currentStep === 'seller' && (
            <SellerStep
              selectedSeller={selectedSeller}
              onSelect={setSelectedSeller}
              onNext={() => setCurrentStep('customer')}
              onBack={() => setCurrentStep('sale-type')}
            />
          )}

          {currentStep === 'customer' && (
            <CustomerStep
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomer}
              saleType={saleType}
              onNext={() => setCurrentStep(isExchangeMode ? 'products' : 'products')}
              onBack={() => setCurrentStep('seller')}
            />
          )}

          {currentStep === 'products' && !isExchangeMode && (
            <ProductsStep
              cartItems={cartItems}
              onProductSelect={handleProductSelect}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onApplyItemDiscount={handleApplyItemDiscount}
              generalDiscount={generalDiscount}
              onApplyGeneralDiscount={(type, value) => setGeneralDiscount({ type, value })}
              subtotal={subtotal}
              discountAmount={totalDiscount}
              total={total}
              isOnline={isOnline}
              onNext={() => setCurrentStep('payment')}
              onBack={() => setCurrentStep('customer')}
            />
          )}

          {currentStep === 'products' && isExchangeMode && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-4 border-b flex items-center gap-4">
                <Button variant="outline" onClick={() => setCurrentStep('customer')}>
                  ← Voltar
                </Button>
                <h2 className="text-lg font-bold">Troca de Produtos</h2>
              </div>
              <div className="flex-1 overflow-hidden">
                <ExchangePanel
                  isOnline={isOnline}
                  customerCreditBalance={customerCreditBalance}
                  onConfirmExchange={handleExchange}
                  isProcessing={isProcessing}
                />
              </div>
            </div>
          )}

          {currentStep === 'payment' && isQuoteMode && (
            <PaymentStep
              cartItems={cartItems}
              subtotal={subtotal}
              discountAmount={totalDiscount}
              total={total}
              saleType={saleType}
              selectedSeller={selectedSeller}
              selectedCustomer={selectedCustomer}
              isProcessing={isProcessing}
              onPayment={handlePayment}
              onBack={() => setCurrentStep('products')}
            />
          )}

          {currentStep === 'payment' && !isQuoteMode && (
            <PaymentStep
              cartItems={cartItems}
              subtotal={subtotal}
              discountAmount={totalDiscount}
              total={total}
              saleType={saleType}
              selectedSeller={selectedSeller}
              selectedCustomer={selectedCustomer}
              isProcessing={isProcessing}
              onPayment={handlePayment}
              onBack={() => setCurrentStep('products')}
            />
          )}
        </div>

        {/* Bottom bar */}
        <div className="p-2 border-t flex flex-wrap gap-2 bg-card">
          <Button variant="outline" size="sm" className="flex-1 min-w-[140px]" onClick={() => setCashMovementModal(true)}>
            <ArrowUpDown className="h-4 w-4 mr-1" /> Sangria/Suprimento
          </Button>
          <Button variant="outline" size="sm" className="flex-1 min-w-[100px]" onClick={resetWizard}>
            Nova Venda
          </Button>
          <Button variant="destructive" size="sm" className="flex-1 min-w-[100px]" onClick={() => setCloseSessionModal(true)}>Fechar Caixa</Button>
        </div>
      </div>

      <OpenSessionModal open={openSessionModal} onOpenChange={setOpenSessionModal} onConfirm={handleOpenSession} />
      <CloseSessionModal open={closeSessionModal} onOpenChange={setCloseSessionModal} expectedBalance={session.opening_balance} onConfirm={handleCloseSession} />
      <CashMovementModal open={cashMovementModal} onOpenChange={setCashMovementModal} onConfirm={handleCashMovement} />
      <FiscalReceiptModal
        open={fiscalModalOpen}
        onOpenChange={setFiscalModalOpen}
        saleId={completedSaleId}
        customerData={completedCustomerData}
        total={completedSaleTotal}
        onComplete={resetWizard}
      />
    </POSLayout>
  );
};

export default POSPage;
