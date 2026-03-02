import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import POSLayout from '@/components/pos/POSLayout';
import ProductSearch, { ProductResult, SaleType } from '@/components/pos/ProductSearch';
import ProductGrid from '@/components/pos/ProductGrid';
import POSCart, { CartItem } from '@/components/pos/POSCart';
import PaymentPanel from '@/components/pos/PaymentPanel';
import CustomerSelector, { Customer } from '@/components/pos/CustomerSelector';
import ExchangePanel, { ExchangeData } from '@/components/pos/ExchangePanel';
import { OpenSessionModal, CloseSessionModal, CashMovementModal } from '@/components/pos/CashDrawerModals';
import { posService, POSSession, CreateSaleData } from '@/services/posService';
import { offlineService } from '@/services/offlineService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DollarSign, ArrowUpDown, ShoppingBag, Package, Star, RefreshCw } from 'lucide-react';

const POSPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userStoreId } = useAuth();
  const [session, setSession] = useState<POSSession | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saleType, setSaleType] = useState<SaleType>('varejo');

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [generalDiscount, setGeneralDiscount] = useState<{ type: 'percentage' | 'fixed'; value: number }>({ type: 'percentage', value: 0 });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerCreditBalance, setCustomerCreditBalance] = useState(0);

  // Modals
  const [openSessionModal, setOpenSessionModal] = useState(false);
  const [closeSessionModal, setCloseSessionModal] = useState(false);
  const [cashMovementModal, setCashMovementModal] = useState(false);

  const isExchangeMode = saleType === 'troca';

  useEffect(() => {
    const unsubscribe = offlineService.onOnlineStatusChange(setIsOnline);
    return unsubscribe;
  }, []);

  // Fetch customer credit balance when customer changes
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
      default:
        return product.promotional_price ?? product.price;
    }
  }, [saleType]);

  const handleProductSelect = useCallback((product: ProductResult) => {
    const unitPrice = resolvePrice(product);
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
        quantity: 1,
        discount_amount: 0,
        total: unitPrice,
        max_stock: product.stock,
      };
      setCartItems((items) => [...items, newItem]);
    }
  }, [cartItems, resolvePrice]);

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    setCartItems((items) =>
      items.map((item) => {
        if (item.id !== itemId) return item;
        const newQty = Math.min(quantity, item.max_stock);
        const itemTotal = item.unit_price * newQty - item.discount_amount;
        return { ...item, quantity: newQty, total: itemTotal };
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

  const handlePayment = async (method: 'cash' | 'card' | 'pix' | 'mixed', amountReceived?: number, paymentDetails?: Record<string, number>) => {
    if (cartItems.length === 0) return;
    setIsProcessing(true);

    const saleData: CreateSaleData = {
      local_id: offlineService.generateLocalId(),
      session_id: session?.id,
      store_id: userStoreId || undefined,
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
    };

    try {
      if (isOnline) {
        await posService.createSale(saleData);
      } else {
        await offlineService.savePendingSale(saleData);
      }
      toast({ title: 'Venda finalizada!', description: `Total: R$ ${total.toFixed(2)}${selectedCustomer ? ` • Cliente: ${selectedCustomer.name}` : ''}` });
      setCartItems([]);
      setGeneralDiscount({ type: 'percentage', value: 0 });
      setSelectedCustomer(null);
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
      // 1. Create sale record for the exchange (new items going out)
      if (data.newItems.length > 0 && data.amountToPay > 0) {
        const saleData: CreateSaleData = {
          local_id: offlineService.generateLocalId(),
          session_id: session?.id,
          store_id: userStoreId || undefined,
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
          notes: `TROCA - Devolvidos: ${data.returnedItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}`,
        };
        await posService.createSale(saleData);
      }

      // 2. Return stock for returned items
      for (const item of data.returnedItems) {
        if (userStoreId) {
          // Update store_stock
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
        // Also update main product stock
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

      // 3. Update customer credit balance
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

      toast({
        title: 'Troca finalizada!',
        description: messages.join(' • '),
      });

      setSelectedCustomer(null);
      setCustomerCreditBalance(0);
    } catch (error) {
      console.error('Error processing exchange:', error);
      toast({ title: 'Erro ao processar troca', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
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

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!session) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <DollarSign className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Caixa Fechado</h1>
        <p className="text-muted-foreground">Abra o caixa para iniciar as vendas</p>
        <Button size="lg" onClick={() => setOpenSessionModal(true)}>Abrir Caixa</Button>
        <Button variant="ghost" onClick={() => navigate('/admin')}>Voltar ao Admin</Button>
        <OpenSessionModal open={openSessionModal} onOpenChange={setOpenSessionModal} onConfirm={handleOpenSession} />
      </div>
    );
  }

  return (
    <POSLayout session={session} onOpenCashDrawer={() => setCashMovementModal(true)}>
      <div className="h-full flex">
        {/* Left side - Products / Exchange */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b space-y-3">
            {/* Sale type selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Tipo de venda:</span>
              <div className="flex gap-1.5 flex-1">
                {([
                  { value: 'varejo' as SaleType, label: 'Varejo', icon: ShoppingBag },
                  { value: 'atacado' as SaleType, label: 'Atacado', icon: Package },
                  { value: 'exclusivo' as SaleType, label: 'Exclusivo', icon: Star },
                  { value: 'troca' as SaleType, label: 'Troca', icon: RefreshCw },
                ]).map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={saleType === value ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      if (saleType !== value) {
                        if (cartItems.length > 0) {
                          setCartItems([]);
                          setGeneralDiscount({ type: 'percentage', value: 0 });
                        }
                        setSaleType(value);
                      }
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <CustomerSelector 
              selectedCustomer={selectedCustomer} 
              onSelectCustomer={setSelectedCustomer} 
            />
            {isExchangeMode && !selectedCustomer && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                ⚠️ Selecione um cliente para realizar a troca
              </div>
            )}
          </div>

          {isExchangeMode ? (
            <div className="flex-1 overflow-hidden">
              <ExchangePanel
                isOnline={isOnline}
                customerCreditBalance={customerCreditBalance}
                onConfirmExchange={handleExchange}
                isProcessing={isProcessing}
              />
            </div>
          ) : (
            <>
              <div className="px-4 pt-3">
                <ProductSearch onProductSelect={handleProductSelect} isOnline={isOnline} />
              </div>
              <ProductGrid selectedCategoryId={selectedCategoryId} onCategoryChange={setSelectedCategoryId} onProductSelect={handleProductSelect} isOnline={isOnline} />
            </>
          )}
        </div>

        {/* Right side - Cart & Payment (hidden in exchange mode) */}
        {!isExchangeMode && (
          <div className="w-96 flex flex-col border-l">
            <Tabs defaultValue="cart" className="flex-1 flex flex-col">
              <TabsList className="w-full rounded-none border-b">
                <TabsTrigger value="cart" className="flex-1">Carrinho</TabsTrigger>
                <TabsTrigger value="payment" className="flex-1" disabled={cartItems.length === 0}>Pagamento</TabsTrigger>
              </TabsList>
              <TabsContent value="cart" className="flex-1 m-0">
                <POSCart items={cartItems} onUpdateQuantity={handleUpdateQuantity} onRemoveItem={handleRemoveItem} onApplyItemDiscount={handleApplyItemDiscount} generalDiscount={generalDiscount} onApplyGeneralDiscount={(type, value) => setGeneralDiscount({ type, value })} subtotal={subtotal} discountAmount={totalDiscount} total={total} />
              </TabsContent>
              <TabsContent value="payment" className="flex-1 m-0 overflow-auto">
                <PaymentPanel total={total} onPayment={handlePayment} isProcessing={isProcessing} disabled={cartItems.length === 0} />
              </TabsContent>
            </Tabs>
            
            <div className="p-2 border-t flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setCashMovementModal(true)}>
                <ArrowUpDown className="h-4 w-4 mr-1" /> Sangria/Suprimento
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setCloseSessionModal(true)}>Fechar Caixa</Button>
            </div>
          </div>
        )}

        {/* Bottom bar in exchange mode */}
        {isExchangeMode && (
          <div className="w-0">
            {/* Exchange panel is full-width in the left side */}
          </div>
        )}
      </div>

      <OpenSessionModal open={openSessionModal} onOpenChange={setOpenSessionModal} onConfirm={handleOpenSession} />
      <CloseSessionModal open={closeSessionModal} onOpenChange={setCloseSessionModal} expectedBalance={session.opening_balance} onConfirm={handleCloseSession} />
      <CashMovementModal open={cashMovementModal} onOpenChange={setCashMovementModal} onConfirm={handleCashMovement} />
    </POSLayout>
  );
};

export default POSPage;
