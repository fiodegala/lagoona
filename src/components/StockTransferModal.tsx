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
import { ArrowRight, Check, X, Clock, Search, Package } from 'lucide-react';
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

  // New transfer form
  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [variations, setVariations] = useState<any[]>([]);
  const [selectedVariationId, setSelectedVariationId] = useState('');
  const [variationSearch, setVariationSearch] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Load variations when product selected
  useEffect(() => {
    if (!selectedProductId) {
      setVariations([]);
      setSelectedVariationId('');
      return;
    }
    const loadVariations = async () => {
      const { data: vars } = await supabase
        .from('product_variations')
        .select('id, sku, product_variation_values(attribute_value_id, product_attribute_values(value, product_attributes(name)))')
        .eq('product_id', selectedProductId)
        .eq('is_active', true);

      if (vars && vars.length > 0) {
        const mapped = vars.map((v: any) => {
          const label = (v.product_variation_values || [])
            .map((pvv: any) => {
              const attrName = pvv.product_attribute_values?.product_attributes?.name || '';
              const val = pvv.product_attribute_values?.value || '';
              return `${attrName}: ${val}`;
            })
            .join(' / ');
          return { id: v.id, label, sku: v.sku };
        });
        setVariations(mapped);
      } else {
        setVariations([]);
      }
      setSelectedVariationId('');
    };
    loadVariations();
  }, [selectedProductId]);

  // Check available stock when source store + product/variation selected
  useEffect(() => {
    if (!fromStoreId || !selectedProductId) {
      setAvailableStock(null);
      return;
    }
    const checkStock = async () => {
      let query = supabase
        .from('store_stock')
        .select('quantity')
        .eq('store_id', fromStoreId)
        .eq('product_id', selectedProductId);

      if (selectedVariationId) {
        query = query.eq('variation_id', selectedVariationId);
      } else if (variations.length > 0) {
        // Product has variations but none selected yet
        setAvailableStock(null);
        return;
      } else {
        query = query.is('variation_id', null);
      }

      const { data } = await query.maybeSingle();
      setAvailableStock(data?.quantity ?? 0);
    };
    checkStock();
  }, [fromStoreId, selectedProductId, selectedVariationId, variations.length]);

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
      // Enrich with product/store names
      const productIds = [...new Set(data.map(t => t.product_id))];
      const { data: prods } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);
      const prodMap: Record<string, string> = {};
      (prods || []).forEach(p => { prodMap[p.id] = p.name; });

      const storeMap: Record<string, string> = {};
      stores.forEach(s => { storeMap[s.id] = s.name; });

      // Get variation labels for transfers with variation_id
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

  const handleSubmit = async () => {
    if (!fromStoreId || !toStoreId || !selectedProductId || quantity <= 0) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    if (variations.length > 0 && !selectedVariationId) {
      toast({ title: 'Selecione uma variação', variant: 'destructive' });
      return;
    }
    if (availableStock !== null && quantity > availableStock) {
      toast({ title: `Estoque insuficiente. Disponível: ${availableStock}`, variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create transfer record
      const { error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          from_store_id: fromStoreId,
          to_store_id: toStoreId,
          product_id: selectedProductId,
          variation_id: selectedVariationId || null,
          quantity,
          notes: notes || null,
          requested_by: user!.id,
          status: 'pending',
        } as any);

      if (transferError) throw transferError;

      toast({
        title: 'Transferência solicitada!',
        description: 'A loja de origem receberá uma notificação para aprovar a transferência.',
      });

      // Reset form
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
    // Decrease from source
    const sourceQuery = supabase
      .from('store_stock')
      .select('id, quantity')
      .eq('store_id', fromStore)
      .eq('product_id', productId);
    if (variationId) sourceQuery.eq('variation_id', variationId);
    else sourceQuery.is('variation_id', null);

    const { data: source } = await sourceQuery.maybeSingle();
    if (source) {
      await supabase
        .from('store_stock')
        .update({ quantity: Math.max(0, source.quantity - qty), updated_at: new Date().toISOString() } as any)
        .eq('id', source.id);
    }

    // Check if destination is an online/website store (aggregated stock)
    // If so, skip adding stock there — the online stock is the sum of all physical stores
    const destStore = stores.find(s => s.id === toStore);
    const isOnlineDestination = destStore?.type === 'online' || destStore?.type === 'website';

    if (!isOnlineDestination) {
      // Increase at destination (physical store only)
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

  const resetForm = () => {
    setFromStoreId('');
    setToStoreId('');
    setSelectedProductId('');
    setSelectedVariationId('');
    setQuantity(1);
    setNotes('');
    setProductSearch('');
    setAvailableStock(null);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600"><Check className="h-3 w-3 mr-1" />Concluída</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitada</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

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

            {/* Product selection */}
            <div className="space-y-2">
              <Label>Produto</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {selectedProduct && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  {selectedProduct.image_url && (
                    <img src={selectedProduct.image_url} className="h-8 w-8 rounded object-cover" alt="" />
                  )}
                  <span className="text-sm font-medium">{selectedProduct.name}</span>
                  <Button variant="ghost" size="sm" className="ml-auto h-6" onClick={() => { setSelectedProductId(''); setProductSearch(''); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {!selectedProductId && productSearch && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm"
                      onClick={() => { setSelectedProductId(p.id); setProductSearch(p.name); }}
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
            {variations.length > 0 && (
              <div className="space-y-2">
                <Label>Variação</Label>
                <Select value={selectedVariationId} onValueChange={setSelectedVariationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a variação..." />
                  </SelectTrigger>
                  <SelectContent>
                    {variations.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label} {v.sku ? `(${v.sku})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quantity + stock info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  max={availableStock ?? undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-2">
                <Label>Estoque disponível na origem</Label>
                <div className="h-10 flex items-center">
                  {availableStock !== null ? (
                    <Badge variant={availableStock === 0 ? 'destructive' : 'default'} className="text-base px-3">
                      {availableStock} un.
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Selecione origem e produto</span>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Peça solicitada pela vendedora Maria"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !fromStoreId || !toStoreId || !selectedProductId || quantity <= 0 || (variations.length > 0 && !selectedVariationId)}
              >
                {isSubmitting ? 'Enviando...' : 'Solicitar Transferência'}
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
