import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Check, X, Clock, Search, Package, Undo2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Store {
  id: string;
  name: string;
  type: string;
}

interface TransferRecord {
  id: string;
  from_store_id: string;
  to_store_id: string;
  product_id: string;
  variation_id: string | null;
  quantity: number;
  status: string;
  notes: string | null;
  requested_by: string;
  approved_by: string | null;
  created_at: string;
  product_name?: string;
  variation_label?: string;
  from_store_name?: string;
  to_store_name?: string;
}

interface TransferItem {
  id: string; // local key
  productId: string;
  productName: string;
  productImage: string | null;
  variationId: string | null;
  variationLabel: string | null;
  quantity: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: Store[];
  onTransferComplete: () => void;
}

const StockTransferModal: React.FC<Props> = ({ open, onOpenChange, stores, onTransferComplete }) => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const physicalStores = stores.filter(s => s.type === 'physical');
  const onlineStore = stores.find(s => s.type === 'online');
  const destinationStores = [...physicalStores, ...(onlineStore ? [onlineStore] : [])];

  // Store selection (shared for all items)
  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Multi-item list
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);

  // Item picker state
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [pickerProductId, setPickerProductId] = useState('');
  const [pickerVariations, setPickerVariations] = useState<any[]>([]);
  const [pickerVariationId, setPickerVariationId] = useState('');
  const [variationSearch, setVariationSearch] = useState('');
  const [pickerQuantity, setPickerQuantity] = useState(1);

  // History
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('new');

  // Load products for search
  useEffect(() => {
    if (!open) return;
    const loadProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, image_url')
        .eq('is_active', true)
        .order('name');
      setProducts(data || []);
    };
    loadProducts();
  }, [open]);

  // Stock map for variations in the selected source store
  const [variationStockMap, setVariationStockMap] = useState<Record<string, number>>({});

  // Load variations when picker product selected
  useEffect(() => {
    if (!pickerProductId) {
      setPickerVariations([]);
      setPickerVariationId('');
      setVariationStockMap({});
      return;
    }
    const loadVariations = async () => {
      const { data: vars } = await supabase
        .from('product_variations')
        .select('id, sku, barcode, is_active')
        .eq('product_id', pickerProductId)
        .order('sort_order');

      if (!vars || vars.length === 0) {
        setPickerVariations([]);
        setPickerVariationId('');
        setVariationSearch('');
        setVariationStockMap({});
        return;
      }

      const varIds = vars.map(v => v.id);
      const allValues: any[] = [];
      for (let i = 0; i < varIds.length; i += 50) {
        const batch = varIds.slice(i, i + 50);
        const { data: vvData } = await supabase
          .from('product_variation_values')
          .select('variation_id, product_attribute_values(value, product_attributes(name))')
          .in('variation_id', batch);
        if (vvData) allValues.push(...vvData);
      }

      // Load stock from source store for all variations
      const stockMap: Record<string, number> = {};
      if (fromStoreId) {
        const { data: stockData } = await supabase
          .from('store_stock')
          .select('variation_id, quantity')
          .eq('store_id', fromStoreId)
          .eq('product_id', pickerProductId)
          .in('variation_id', varIds);
        (stockData || []).forEach((s: any) => {
          if (s.variation_id) stockMap[s.variation_id] = s.quantity;
        });
      }
      setVariationStockMap(stockMap);

      const attrMap: Record<string, { name: string; value: string }[]> = {};
      allValues.forEach((pvv: any) => {
        const vid = pvv.variation_id;
        if (!attrMap[vid]) attrMap[vid] = [];
        attrMap[vid].push({
          name: pvv.product_attribute_values?.product_attributes?.name || '',
          value: pvv.product_attribute_values?.value || '',
        });
      });

      const mapped = vars.map((v: any) => {
        const attrs = attrMap[v.id] || [];
        const label = attrs.map((a: any) => `${a.name}: ${a.value}`).join(' / ');
        return { id: v.id, label: label || v.sku || v.id.slice(0, 8), sku: v.sku, barcode: v.barcode, attrs };
      });

      setPickerVariations(mapped);
      setPickerVariationId('');
      setVariationSearch('');
    };
    loadVariations();
  }, [pickerProductId, fromStoreId]);

  // Load history
  useEffect(() => {
    if (activeTab !== 'history' || !open) return;
    loadHistory();
  }, [activeTab, open]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    const { data } = await supabase
      .from('stock_transfers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      const productIds = [...new Set(data.map(t => t.product_id))];
      const { data: prods } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);
      const prodMap: Record<string, string> = {};
      (prods || []).forEach(p => { prodMap[p.id] = p.name; });

      const storeMap: Record<string, string> = {};
      stores.forEach(s => { storeMap[s.id] = s.name; });

      const variationIds = data.filter(t => t.variation_id).map(t => t.variation_id!);
      let varLabelMap: Record<string, string> = {};
      if (variationIds.length > 0) {
        const { data: varData } = await supabase
          .from('product_variation_values')
          .select('variation_id, product_attribute_values(value)')
          .in('variation_id', variationIds);
        const grouped: Record<string, string[]> = {};
        (varData || []).forEach((v: any) => {
          if (!grouped[v.variation_id]) grouped[v.variation_id] = [];
          grouped[v.variation_id].push(v.product_attribute_values?.value || '');
        });
        Object.entries(grouped).forEach(([vid, vals]) => {
          varLabelMap[vid] = vals.join(' / ');
        });
      }

      setTransfers(data.map(t => ({
        ...t,
        product_name: prodMap[t.product_id] || 'Produto removido',
        from_store_name: storeMap[t.from_store_id] || '?',
        to_store_name: storeMap[t.to_store_id] || '?',
        variation_label: t.variation_id ? varLabelMap[t.variation_id] || '' : undefined,
      })));
    } else {
      setTransfers([]);
    }
    setIsLoadingHistory(false);
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 20);
    const q = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 20);
  }, [products, productSearch]);

  const filteredVariations = useMemo(() => {
    if (!variationSearch) return pickerVariations;
    const q = variationSearch.toLowerCase();
    return pickerVariations.filter((v: any) => {
      const label = v.label?.toLowerCase() || '';
      const sku = v.sku?.toLowerCase() || '';
      const barcode = v.barcode?.toLowerCase() || '';
      return label.includes(q) || sku.includes(q) || barcode.includes(q);
    });
  }, [pickerVariations, variationSearch]);

  const selectedPickerProduct = products.find(p => p.id === pickerProductId);

  const handleAddItem = () => {
    if (!pickerProductId) {
      toast({ title: 'Selecione um produto', variant: 'destructive' });
      return;
    }
    if (pickerVariations.length > 0 && !pickerVariationId) {
      toast({ title: 'Selecione uma variação', variant: 'destructive' });
      return;
    }
    if (pickerQuantity <= 0) {
      toast({ title: 'Quantidade inválida', variant: 'destructive' });
      return;
    }

    const product = products.find(p => p.id === pickerProductId);
    const variation = pickerVariations.find((v: any) => v.id === pickerVariationId);

    const newItem: TransferItem = {
      id: crypto.randomUUID(),
      productId: pickerProductId,
      productName: product?.name || '',
      productImage: product?.image_url || null,
      variationId: pickerVariationId || null,
      variationLabel: variation?.label || null,
      quantity: pickerQuantity,
    };

    setTransferItems(prev => [...prev, newItem]);

    // Reset picker
    setPickerProductId('');
    setPickerVariationId('');
    setPickerVariations([]);
    setProductSearch('');
    setVariationSearch('');
    setPickerQuantity(1);
  };

  const handleRemoveItem = (itemId: string) => {
    setTransferItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleSubmit = async () => {
    if (!fromStoreId || !toStoreId) {
      toast({ title: 'Selecione origem e destino', variant: 'destructive' });
      return;
    }
    if (transferItems.length === 0) {
      toast({ title: 'Adicione pelo menos um item', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const inserts = transferItems.map(item => ({
        from_store_id: fromStoreId,
        to_store_id: toStoreId,
        product_id: item.productId,
        variation_id: item.variationId,
        quantity: item.quantity,
        notes: notes || null,
        requested_by: user!.id,
        status: 'pending',
      }));

      const { error } = await supabase
        .from('stock_transfers')
        .insert(inserts as any);

      if (error) throw error;

      toast({
        title: 'Transferência solicitada!',
        description: `${transferItems.length} item(ns) enviado(s) para aprovação.`,
      });

      resetForm();
      onTransferComplete();
    } catch (error: any) {
      console.error('Error creating transfer:', error);
      toast({ title: 'Erro ao criar transferência', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeTransfer = async (
    fromStore: string,
    toStore: string,
    productId: string,
    variationId: string | null,
    qty: number
  ) => {
    const sourceQuery = supabase
      .from('store_stock')
      .select('id, quantity')
      .eq('store_id', fromStore)
      .eq('product_id', productId);
    if (variationId) sourceQuery.eq('variation_id', variationId);
    else sourceQuery.is('variation_id', null);

    const { data: source } = await sourceQuery.maybeSingle();

    if (!source) {
      throw new Error('Registro de estoque não encontrado na loja de origem.');
    }

    if (source.quantity < qty) {
      throw new Error(`Estoque insuficiente na origem. Disponível: ${source.quantity}, solicitado: ${qty}`);
    }

    const { error: updateError } = await supabase
      .from('store_stock')
      .update({ quantity: source.quantity - qty, updated_at: new Date().toISOString() } as any)
      .eq('id', source.id);

    if (updateError) {
      throw new Error('Falha ao atualizar estoque da origem: ' + updateError.message);
    }

    const destStore = stores.find(s => s.id === toStore);
    const isOnlineDestination = destStore?.type === 'online' || destStore?.type === 'website';

    if (!isOnlineDestination) {
      const destQuery = supabase
        .from('store_stock')
        .select('id, quantity')
        .eq('store_id', toStore)
        .eq('product_id', productId);
      if (variationId) destQuery.eq('variation_id', variationId);
      else destQuery.is('variation_id', null);

      const { data: dest } = await destQuery.maybeSingle();
      if (dest) {
        await supabase
          .from('store_stock')
          .update({ quantity: dest.quantity + qty, updated_at: new Date().toISOString() } as any)
          .eq('id', dest.id);
      } else {
        await supabase
          .from('store_stock')
          .insert({
            store_id: toStore,
            product_id: productId,
            variation_id: variationId,
            quantity: qty,
          } as any);
      }
    }
  };

  const handleApprove = async (transfer: TransferRecord) => {
    try {
      await executeTransfer(
        transfer.from_store_id,
        transfer.to_store_id,
        transfer.product_id,
        transfer.variation_id,
        transfer.quantity
      );

      await supabase
        .from('stock_transfers')
        .update({ status: 'completed', approved_by: user!.id } as any)
        .eq('id', transfer.id);

      toast({ title: 'Transferência aprovada e executada!' });
      loadHistory();
      onTransferComplete();
    } catch (error: any) {
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' });
    }
  };

  const handleReject = async (transfer: TransferRecord) => {
    try {
      await supabase
        .from('stock_transfers')
        .update({ status: 'rejected', approved_by: user!.id } as any)
        .eq('id', transfer.id);

      toast({ title: 'Transferência rejeitada' });
      loadHistory();
    } catch (error: any) {
      toast({ title: 'Erro ao rejeitar', description: error.message, variant: 'destructive' });
    }
  };

  const handleReverse = async (transfer: TransferRecord) => {
    if (!confirm(`Reverter transferência de ${transfer.quantity}x ${transfer.product_name}?\nIsso devolverá as peças de "${transfer.to_store_name}" para "${transfer.from_store_name}".`)) return;
    try {
      await executeTransfer(
        transfer.to_store_id,
        transfer.from_store_id,
        transfer.product_id,
        transfer.variation_id,
        transfer.quantity
      );

      await supabase
        .from('stock_transfers')
        .update({ status: 'reversed', approved_by: user!.id } as any)
        .eq('id', transfer.id);

      toast({ title: 'Transferência revertida com sucesso!' });
      loadHistory();
      onTransferComplete();
    } catch (error: any) {
      toast({ title: 'Erro ao reverter', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFromStoreId('');
    setToStoreId('');
    setPickerProductId('');
    setPickerVariationId('');
    setPickerVariations([]);
    setVariationSearch('');
    setPickerQuantity(1);
    setNotes('');
    setProductSearch('');
    setTransferItems([]);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600"><Check className="h-3 w-3 mr-1" />Concluída</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitada</Badge>;
      case 'reversed':
        return <Badge variant="outline" className="border-amber-500 text-amber-600"><Undo2 className="h-3 w-3 mr-1" />Revertida</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transferência de Estoque</DialogTitle>
         <DialogDescription>
            Transfira peças entre as lojas físicas ou para o depósito Online
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">Nova Transferência</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 mt-4">
            {/* Store selection */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div className="space-y-2">
                <Label>Loja de Origem</Label>
                <Select value={fromStoreId} onValueChange={(v) => { setFromStoreId(v); if (v === toStoreId) setToStoreId(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {physicalStores.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground mb-2" />
              <div className="space-y-2">
                <Label>Loja de Destino</Label>
                <Select value={toStoreId} onValueChange={setToStoreId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationStores.filter(s => s.id !== fromStoreId).map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.type === 'online' ? ' (Depósito)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items list */}
            {transferItems.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Itens da transferência ({transferItems.length})</Label>
                <div className="border rounded-lg divide-y">
                  {transferItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2.5">
                      {item.productImage ? (
                        <img src={item.productImage} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.productName}</p>
                        {item.variationLabel && (
                          <p className="text-xs text-muted-foreground truncate">{item.variationLabel}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0">{item.quantity} un.</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add item picker */}
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Adicionar item
              </Label>

              {/* Product selection */}
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {selectedPickerProduct && (
                  <div className="flex items-center gap-2 p-2 bg-background rounded-md border">
                    {selectedPickerProduct.image_url && (
                      <img src={selectedPickerProduct.image_url} className="h-8 w-8 rounded object-cover" alt="" />
                    )}
                    <span className="text-sm font-medium">{selectedPickerProduct.name}</span>
                    <Button variant="ghost" size="sm" className="ml-auto h-6" onClick={() => { setPickerProductId(''); setProductSearch(''); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {!pickerProductId && productSearch && (
                  <div className="border rounded-md max-h-40 overflow-y-auto bg-background">
                    {filteredProducts.map(p => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm"
                        onClick={() => { setPickerProductId(p.id); setProductSearch(p.name); }}
                      >
                        {p.image_url && <img src={p.image_url} className="h-6 w-6 rounded object-cover" alt="" />}
                        {p.name}
                      </button>
                    ))}
                    {filteredProducts.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum produto encontrado</p>
                    )}
                  </div>
                )}
              </div>

              {/* Variation selection */}
              {pickerVariations.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Variação</Label>
                  {pickerVariationId ? (
                    <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/30 rounded-lg">
                      <Package className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium flex-1">
                        {pickerVariations.find((v: any) => v.id === pickerVariationId)?.label}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {variationStockMap[pickerVariationId] ?? 0} un. disponível
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setPickerVariationId(''); setVariationSearch(''); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Filtrar por cor, tamanho, SKU..."
                          value={variationSearch}
                          onChange={(e) => setVariationSearch(e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                      <ScrollArea className="max-h-36">
                        <div className="space-y-1 pt-1">
                          {filteredVariations.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-3">Nenhuma variação encontrada</p>
                          ) : (
                            filteredVariations.map((v: any) => {
                              const stock = variationStockMap[v.id] ?? 0;
                              return (
                              <button
                                key={v.id}
                                className={cn(
                                  "w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all text-sm",
                                  "hover:border-primary/50 hover:bg-accent",
                                  stock === 0 && "opacity-50"
                                )}
                                onClick={() => setPickerVariationId(v.id)}
                              >
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">{v.label}</span>
                                  {v.sku && <span className="ml-2 text-xs text-muted-foreground font-mono">SKU: {v.sku}</span>}
                                </div>
                                <Badge
                                  variant={stock === 0 ? 'destructive' : stock <= 3 ? 'secondary' : 'default'}
                                  className="ml-2 shrink-0 text-xs"
                                >
                                  {stock} un.
                                </Badge>
                              </button>
                              );
                            })
                          )}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>
              )}

              {/* Quantity + Add button */}
              <div className="flex items-end gap-3">
                <div className="space-y-1.5 w-28">
                  <Label className="text-xs">Quantidade</Label>
                  <Input
                    type="number"
                    min={1}
                    value={pickerQuantity}
                    onChange={(e) => setPickerQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddItem}
                  disabled={!pickerProductId || (pickerVariations.length > 0 && !pickerVariationId)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Peças solicitadas pela vendedora Maria"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !fromStoreId || !toStoreId || transferItems.length === 0}
              >
                {isSubmitting ? 'Enviando...' : `Solicitar Transferência (${transferItems.length})`}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {isLoadingHistory ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : transfers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma transferência registrada</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Origem → Destino</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(t.created_at).toLocaleDateString('pt-BR')}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{t.product_name}</span>
                          {t.variation_label && (
                            <span className="block text-xs text-muted-foreground">{t.variation_label}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {t.from_store_name} <ArrowRight className="inline h-3 w-3 mx-1" /> {t.to_store_name}
                        </TableCell>
                        <TableCell className="text-center font-bold">{t.quantity}</TableCell>
                        <TableCell>{statusBadge(t.status)}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            {t.status === 'pending' && (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="default" onClick={() => handleApprove(t)}>
                                  <Check className="h-3 w-3 mr-1" /> Aprovar
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleReject(t)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            {t.status === 'completed' && (
                              <Button size="sm" variant="outline" className="text-amber-600 border-amber-500 hover:bg-amber-50" onClick={() => handleReverse(t)}>
                                <Undo2 className="h-3 w-3 mr-1" /> Reverter
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default StockTransferModal;
