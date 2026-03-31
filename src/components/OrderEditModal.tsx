import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, Pencil, Percent, DollarSign, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  variation?: string;
  sku?: string;
  image_url?: string;
  imageUrl?: string;
  product_name?: string;
}

interface OrderEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any | null;
  onSaved: () => void;
}

const paymentStatusOptions = [
  { value: 'pending', label: 'Pendente' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'in_process', label: 'Em análise' },
  { value: 'rejected', label: 'Recusado' },
  { value: 'refunded', label: 'Devolvido' },
  { value: 'cancelled', label: 'Cancelado' },
];

const OrderEditModal = ({ open, onOpenChange, order, onSaved }: OrderEditModalProps) => {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [swapSearch, setSwapSearch] = useState('');
  const [swapResults, setSwapResults] = useState<any[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapSelectedProduct, setSwapSelectedProduct] = useState<any | null>(null);

  useEffect(() => {
    if (!order) return;
    try {
      const parsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      setItems(Array.isArray(parsed) ? parsed.map((i: any) => ({
        name: i.name || i.product_name || 'Produto',
        price: Number(i.price || 0),
        quantity: Number(i.quantity || 1),
        variation: i.variation || '',
        sku: i.sku || '',
        image_url: i.image_url || i.imageUrl || '',
      })) : []);
    } catch {
      setItems([]);
    }
    const meta = order.metadata || {};
    setDiscountType(meta.edit_discount_type || 'fixed');
    setDiscountValue(Number(meta.edit_discount_value || 0));
    setShippingCost(Number(meta.shipping_cost || 0));
    setPaymentStatus(order.payment_status || 'pending');
    setNotes(order.notes || '');
    setCustomerName(order.customer_name || '');
    setCustomerEmail(order.customer_email || '');
    setCustomerDocument(meta.customer_document || '');
    setCustomerPhone(meta.customer_phone || '');
  }, [order]);

  const searchProducts = useCallback(async (term: string) => {
    if (term.trim().length < 2) { setSwapResults([]); return; }
    setSwapLoading(true);
    try {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price, image_url')
        .ilike('name', `%${term.trim()}%`)
        .eq('is_active', true)
        .limit(15);

      if (!products || products.length === 0) { setSwapResults([]); return; }

      const productIds = products.map(p => p.id);
      const { data: variations } = await supabase
        .from('product_variations')
        .select('id, product_id, sku, price, stock')
        .in('product_id', productIds)
        .eq('is_active', true);

      // Get variation labels from attribute values
      const variationIds = (variations || []).map(v => v.id);
      let labelsMap: Record<string, string> = {};
      if (variationIds.length > 0) {
        const { data: vvData } = await supabase
          .from('product_variation_values')
          .select('variation_id, attribute_value_id')
          .in('variation_id', variationIds);
        if (vvData && vvData.length > 0) {
          const avIds = [...new Set(vvData.map(v => v.attribute_value_id))];
          const { data: avData } = await supabase
            .from('product_attribute_values')
            .select('id, value')
            .in('id', avIds);
          const avMap = Object.fromEntries((avData || []).map(a => [a.id, a.value]));
          for (const vv of vvData) {
            const label = avMap[vv.attribute_value_id] || '';
            if (label) {
              labelsMap[vv.variation_id] = labelsMap[vv.variation_id]
                ? `${labelsMap[vv.variation_id]} / ${label}` : label;
            }
          }
        }
      }

      const results = products.map(p => ({
        ...p,
        variations: (variations || []).filter(v => v.product_id === p.id).map(v => ({
          ...v,
          label: labelsMap[v.id] || v.sku || v.id.slice(0, 8),
        })),
      }));
      setSwapResults(results);
    } catch {
      setSwapResults([]);
    } finally {
      setSwapLoading(false);
    }
  }, []);

  useEffect(() => {
    if (swapIdx === null) { setSwapSearch(''); setSwapResults([]); return; }
    const timer = setTimeout(() => searchProducts(swapSearch), 300);
    return () => clearTimeout(timer);
  }, [swapSearch, swapIdx, searchProducts]);

  const handleSwapProduct = (idx: number, product: any, variation?: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return {
        ...item,
        name: product.name,
        price: variation?.price ?? product.price,
        variation: variation?.label || '',
        sku: variation?.sku || '',
        image_url: product.image_url || '',
      };
    }));
    setSwapIdx(null);
    toast.success('Produto alterado!');
  };

  if (!order) return null;

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountAmount = discountType === 'percent'
    ? Math.round(subtotal * discountValue) / 100
    : discountValue;
  const total = Math.max(0, subtotal - discountAmount + shippingCost);

  const updateItem = (idx: number, field: keyof OrderItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setItems(prev => [...prev, { name: 'Novo item', price: 0, quantity: 1 }]);
  };

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error('O pedido deve ter pelo menos 1 item');
      return;
    }
    setSaving(true);
    try {
      const newMetadata = {
        ...(order.metadata || {}),
        edit_discount_type: discountType,
        edit_discount_value: discountValue,
        shipping_cost: shippingCost,
        customer_document: customerDocument,
        customer_phone: customerPhone,
        edited_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('orders')
        .update({
          items: items as any,
          total: Math.round(total * 100) / 100,
          payment_status: paymentStatus,
          notes,
          customer_name: customerName,
          customer_email: customerEmail,
          metadata: newMetadata as any,
        })
        .eq('id', order.id);

      if (error) throw error;
      toast.success('Pedido atualizado com sucesso!');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Editar Pedido #{order.id.slice(0, 8).toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-2 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="space-y-5 py-2">
            {/* Customer Data */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Dados do Cliente</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <Label className="text-xs">CPF / CNPJ</Label>
                  <Input
                    value={customerDocument}
                    onChange={e => setCustomerDocument(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">Itens do Pedido</h4>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Item
                </Button>
              </div>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <div>
                          <Label className="text-xs">Nome do produto</Label>
                          <Input
                            value={item.name}
                            onChange={e => updateItem(idx, 'name', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Preço (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price}
                              onChange={e => updateItem(idx, 'price', Number(e.target.value))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Quantidade</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => updateItem(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Variação</Label>
                            <Input
                              value={item.variation || ''}
                              onChange={e => updateItem(idx, 'variation', e.target.value)}
                              className="h-8 text-sm"
                              placeholder="Ex: P / Azul"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0 mt-5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          title="Trocar produto"
                          onClick={() => setSwapIdx(swapIdx === idx ? null : idx)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeItem(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Swap product panel */}
                    {swapIdx === idx && (
                      <div className="rounded-md border border-primary/30 bg-muted/30 p-3 space-y-2">
                        <Label className="text-xs font-semibold">Trocar por outro produto:</Label>
                        <Input
                          value={swapSearch}
                          onChange={e => setSwapSearch(e.target.value)}
                          className="h-8 text-sm"
                          placeholder="Buscar produto por nome..."
                          autoFocus
                        />
                        {swapLoading && <p className="text-xs text-muted-foreground">Buscando...</p>}
                        {swapResults.length > 0 && (
                          <ScrollArea className="max-h-48">
                            <div className="space-y-1">
                              {swapResults.map(product => (
                                <div key={product.id}>
                                  {product.variations.length === 0 ? (
                                    <button
                                      type="button"
                                      className="w-full text-left p-2 rounded hover:bg-accent text-sm flex items-center gap-2"
                                      onClick={() => handleSwapProduct(idx, product)}
                                    >
                                      {product.image_url && (
                                        <img src={product.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{product.name}</p>
                                        <p className="text-xs text-muted-foreground">R$ {product.price.toFixed(2)}</p>
                                      </div>
                                    </button>
                                  ) : (
                                    <>
                                      <p className="text-xs font-medium px-2 pt-1 text-muted-foreground">{product.name}</p>
                                      {product.variations.map((v: any) => (
                                        <button
                                          key={v.id}
                                          type="button"
                                          className="w-full text-left p-2 pl-4 rounded hover:bg-accent text-sm flex items-center justify-between"
                                          onClick={() => handleSwapProduct(idx, product, v)}
                                        >
                                          <span>{v.label}</span>
                                          <span className="text-xs text-muted-foreground">
                                            R$ {(v.price ?? product.price).toFixed(2)} • {v.stock} un.
                                          </span>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                        {swapSearch.length >= 2 && !swapLoading && swapResults.length === 0 && (
                          <p className="text-xs text-muted-foreground">Nenhum produto encontrado.</p>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground text-right">
                      Subtotal: R$ {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Discount */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Desconto</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={discountType} onValueChange={(v: 'percent' | 'fixed') => setDiscountType(v)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> Valor fixo (R$)</span>
                      </SelectItem>
                      <SelectItem value="percent">
                        <span className="flex items-center gap-1"><Percent className="h-3 w-3" /> Percentual (%)</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountValue}
                    onChange={e => setDiscountValue(Number(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Shipping */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Frete</h4>
              <div className="max-w-[200px]">
                <Label className="text-xs">Valor do frete (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingCost}
                  onChange={e => setShippingCost(Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Separator />

            {/* Payment Status */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Status de Pagamento</h4>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentStatusOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Notes */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Observações</h4>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px]"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observações internas..."
              />
            </div>

            <Separator />

            {/* Totals Summary */}
            <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span>Subtotal ({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Desconto {discountType === 'percent' ? `(${discountValue}%)` : ''}</span>
                  <span>- R$ {discountAmount.toFixed(2)}</span>
                </div>
              )}
              {shippingCost > 0 && (
                <div className="flex justify-between">
                  <span>Frete</span>
                  <span>R$ {shippingCost.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderEditModal;
