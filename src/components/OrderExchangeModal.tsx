import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeftRight, Search, RotateCcw, Package, Loader2, Plus, Trash2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface OrderExchangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any | null;
  onExchangeComplete: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  variations: Array<{
    id: string;
    sku: string | null;
    price: number | null;
    stock: number;
    is_active: boolean;
    image_url?: string | null;
    label?: string;
  }>;
}

interface ReturnLine {
  key: string;
  source: any;
  product_id: string;
  variation_id: string | null;
  product_name: string;
  variation_label: string | null;
  price: number;
  quantity: number;
  image_url: string | null;
}

interface NewLine {
  key: string;
  product_id: string;
  variation_id: string | null;
  product_name: string;
  variation_label: string | null;
  price: number;
  quantity: number;
  image_url: string | null;
  sku: string | null;
}

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const OrderExchangeModal = ({ open, onOpenChange, order, onExchangeComplete }: OrderExchangeModalProps) => {
  const [step, setStep] = useState<'select-return' | 'select-new' | 'confirm'>('select-return');
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [newLines, setNewLines] = useState<NewLine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [processing, setProcessing] = useState(false);

  const items = (() => {
    if (!order) return [];
    try {
      const parsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      return Array.isArray(parsed) ? parsed.filter((i: any) => !i.exchanged) : [];
    } catch {
      return [];
    }
  })();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const term = searchQuery.trim();

      // Correspondência exata por código de barras / SKU (igual ao PDV: case-insensitive)
      const { data: exactVars } = await supabase
        .from('product_variations')
        .select('id, product_id, sku, barcode, is_active')
        .or(`barcode.ilike.${term},sku.ilike.${term}`)
        .limit(10);

      const normalize = (v: string | null | undefined) => (v || '').trim().toLowerCase();
      const termNorm = term.toLowerCase();
      const bestVar =
        (exactVars || []).find(v => normalize(v.barcode) === termNorm) ||
        (exactVars || []).find(v => normalize(v.sku) === termNorm) ||
        null;

      const exactVariationId = bestVar?.id || null;
      const exactProductId = bestVar?.product_id || null;




      const { data: byName } = await supabase
        .from('products')
        .select('id, name, price, image_url')
        .ilike('name', `%${term}%`)
        .eq('is_active', true)
        .limit(10);

      const { data: varMatches } = await supabase
        .from('product_variations')
        .select('product_id')
        .or(`barcode.ilike.%${term}%,sku.ilike.%${term}%`)
        .limit(10);

      const { data: byBarcode } = await supabase
        .from('products')
        .select('id, name, price, image_url')
        .ilike('barcode', `%${term}%`)
        .eq('is_active', true)
        .limit(10);

      const nameIds = (byName || []).map(p => p.id);
      const barcodeIds = (byBarcode || []).map(p => p.id);
      const varProductIds = (varMatches || []).map(v => v.product_id);
      const allIds = [...new Set([...nameIds, ...barcodeIds, ...varProductIds, ...(exactProductId ? [exactProductId] : [])])];

      const missingIds = allIds.filter(id => !nameIds.includes(id) && !barcodeIds.includes(id));
      let extraProducts: any[] = [];
      if (missingIds.length > 0) {
        const { data: extra } = await supabase
          .from('products')
          .select('id, name, price, image_url')
          .in('id', missingIds);

        extraProducts = extra || [];
      }

      const data = [...(byName || []), ...(byBarcode || []).filter(p => !nameIds.includes(p.id)), ...extraProducts];
      const productIds = data.map(p => p.id);
      let variationsList: any[] = [];
      if (productIds.length > 0) {
        const { data: variations } = await supabase
          .from('product_variations')
          .select(`
            id, product_id, sku, price, stock, is_active, image_url
          `)
          .in('product_id', productIds);

        const variationIds = (variations || []).map(v => v.id);
        const valuesMap: Record<string, Array<{ attr_name: string; value: string }>> = {};

        if (variationIds.length > 0) {
          const { data: pvvData } = await supabase
            .from('product_variation_values')
            .select(`
              variation_id,
              product_attribute_values (
                value,
                product_attributes ( name )
              )
            `)
            .in('variation_id', variationIds);

          for (const row of (pvvData || [])) {
            const vid = row.variation_id;
            if (!valuesMap[vid]) valuesMap[vid] = [];
            const pav = row.product_attribute_values as any;
            if (pav) {
              valuesMap[vid].push({
                attr_name: pav.product_attributes?.name || '',
                value: pav.value || '',
              });
            }
          }
        }

        variationsList = (variations || []).map(v => ({
          ...v,
          _attrs: valuesMap[v.id] || [],
        }));
      }

      const results: SearchResult[] = (data || []).map(p => ({
        ...p,
        variations: variationsList
          .filter(v => v.product_id === p.id)
          .map(v => {
            const attrParts = (v._attrs || [])
              .map((a: any) => `${a.value}`)
              .filter(Boolean);
            const label = attrParts.length > 0 ? attrParts.join(' / ') : (v.sku || v.id.slice(0, 6));
            return { ...v, label };
          }),
      }));

      setSearchResults(results);

      // Código de barras exato → adiciona direto a variação correspondente
      if (exactVariationId) {
        const prod = results.find(p => p.id === exactProductId);
        const variation = prod?.variations.find(v => v.id === exactVariationId);
        if (prod && variation) {
          addNewProduct(prod, variation);
          setSearchQuery('');
        }
      }
    } catch {
      toast.error('Erro ao buscar produtos');
    } finally {
      setSearching(false);
    }
  };

  const toggleReturnItem = (item: any, idx: number) => {
    const key = `ret-${idx}`;
    setReturnLines(prev => {
      if (prev.some(l => l.key === key)) return prev.filter(l => l.key !== key);
      return [...prev, {
        key,
        source: item,
        product_id: item.product_id,
        variation_id: item.variation_id || null,
        product_name: item.name || item.product_name,
        variation_label: item.variation_label || item.variation || null,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        image_url: item.image_url || item.imageUrl || null,
      }];
    });
  };

  const addNewProduct = (product: SearchResult, variation?: any) => {
    setNewLines(prev => [...prev, {
      key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      product_id: product.id,
      variation_id: variation?.id || null,
      product_name: product.name,
      variation_label: variation?.label || null,
      price: Number(variation?.price || product.price) || 0,
      quantity: 1,
      image_url: variation?.image_url || product.image_url || null,
      sku: variation?.sku || null,
    }]);
    toast.success('Produto adicionado à troca');
  };

  const updateLine = <T extends { key: string }>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    key: string,
    patch: Partial<T>
  ) => setter(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const returnTotal = returnLines.reduce((s, l) => s + l.price * l.quantity, 0);
  const newTotal = newLines.reduce((s, l) => s + l.price * l.quantity, 0);
  const diff = newTotal - returnTotal;

  const handleConfirmExchange = async () => {
    if (!order || returnLines.length === 0 || newLines.length === 0) return;
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/order-exchange`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            order_id: order.id,
            return_items: returnLines.map(l => ({
              product_id: l.product_id,
              variation_id: l.variation_id,
              quantity: l.quantity,
              product_name: l.product_name,
              variation_label: l.variation_label,
              price: l.price,
            })),
            new_items: newLines.map(l => ({
              product_id: l.product_id,
              variation_id: l.variation_id,
              quantity: l.quantity,
              product_name: l.product_name,
              variation_label: l.variation_label,
              price: l.price,
              image_url: l.image_url,
              sku: l.sku,
            })),
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao processar troca');

      toast.success('Troca realizada com sucesso!');
      onExchangeComplete();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar troca');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setStep('select-return');
    setReturnLines([]);
    setNewLines([]);
    setSearchQuery('');
    setSearchResults([]);
    onOpenChange(false);
  };

  if (!order) return null;

  const priceEditor = (value: number, onChange: (v: number) => void) => (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">R$</span>
      <Input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="h-8 w-24 text-xs"
      />
    </div>
  );

  const qtyEditor = (value: number, onChange: (v: number) => void) => (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">Qtd</span>
      <Input
        type="number"
        min="1"
        step="1"
        value={value}
        onChange={e => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="h-8 w-16 text-xs"
      />
    </div>
  );

  const summaryBar = (
    <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Total devolvido (crédito)</span>
        <span className="font-medium text-blue-600">{brl(returnTotal)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Total novos produtos</span>
        <span className="font-medium text-green-600">{brl(newTotal)}</span>
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <span className="font-semibold">{diff >= 0 ? 'Cliente paga' : 'Crédito a favor do cliente'}</span>
        <span className={cn('font-bold', diff > 0 ? 'text-red-600' : 'text-green-600')}>
          {brl(Math.abs(diff))}
        </span>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Troca de Produto - Pedido #{order.id.slice(0, 8).toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
          <div className="space-y-4 py-2">
            {/* Step 1: Select items to return */}
            {step === 'select-return' && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4 text-blue-500" />
                  Selecione os itens que estão sendo devolvidos
                </h4>
                <div className="space-y-2">
                  {items.map((item: any, idx: number) => {
                    const key = `ret-${idx}`;
                    const line = returnLines.find(l => l.key === key);
                    const selected = !!line;
                    return (
                      <div
                        key={key}
                        className={cn(
                          'rounded-md border p-3 transition-colors',
                          selected ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-950/40' : 'hover:bg-muted/50'
                        )}
                      >
                        <button
                          onClick={() => toggleReturnItem(item, idx)}
                          className="w-full flex items-center gap-3 text-sm text-left"
                        >
                          <div className={cn(
                            'h-5 w-5 rounded border flex items-center justify-center shrink-0',
                            selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-background'
                          )}>
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </div>
                          <img
                            src={item.image_url || item.imageUrl || '/placeholder.svg'}
                            alt={item.name || 'Produto'}
                            className="h-12 w-12 rounded-md object-cover border bg-muted shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{item.name || item.product_name}</p>
                            {(item.variation_label || item.variation) && (
                              <p className="text-xs text-primary">{item.variation_label || item.variation}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Qtd original: {item.quantity || 1} • {brl(Number(item.price) || 0)}
                            </p>
                          </div>
                        </button>

                        {selected && (
                          <div className="mt-3 flex flex-wrap items-center gap-3 pl-8">
                            {priceEditor(line!.price, v => updateLine(setReturnLines, key, { price: v }))}
                            {qtyEditor(line!.quantity, v => updateLine(setReturnLines, key, { quantity: v }))}
                            <span className="text-xs font-medium ml-auto">
                              Subtotal: {brl(line!.price * line!.quantity)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum item disponível para troca</p>
                  )}
                </div>

                {returnLines.length > 0 && (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {returnLines.length} item(ns) • Crédito: <strong>{brl(returnTotal)}</strong>
                    </span>
                    <Button size="sm" onClick={() => setStep('select-new')}>
                      Continuar →
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Search and add new products */}
            {step === 'select-new' && (
              <div>
                <div className="mb-3 p-2.5 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    Devolvendo: {returnLines.map(l => `${l.product_name}${l.variation_label ? ` (${l.variation_label})` : ''}`).join(', ')}
                    {' '}• Crédito {brl(returnTotal)}
                  </p>
                </div>

                {/* Selected new items */}
                {newLines.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-green-500" />
                      Novos produtos ({newLines.length})
                    </h4>
                    {newLines.map(line => (
                      <div key={line.key} className="rounded-md border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30 p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={line.image_url || '/placeholder.svg'}
                            alt={line.product_name}
                            className="h-10 w-10 rounded-md object-cover border bg-muted shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{line.product_name}</p>
                            {line.variation_label && (
                              <p className="text-xs text-green-700 dark:text-green-400">{line.variation_label}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive shrink-0"
                            onClick={() => setNewLines(prev => prev.filter(l => l.key !== line.key))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {priceEditor(line.price, v => updateLine(setNewLines, line.key, { price: v }))}
                          {qtyEditor(line.quantity, v => updateLine(setNewLines, line.key, { quantity: v }))}
                          <span className="text-xs font-medium ml-auto">
                            Subtotal: {brl(line.price * line.quantity)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {summaryBar}
                  </div>
                )}

                <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  Busque e adicione produtos
                </h4>

                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Nome ou código de barras..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
                  <Button variant="outline" size="icon" onClick={handleSearch} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="max-h-[38vh] overflow-y-auto overflow-x-hidden rounded-md border bg-background pr-1">
                  <div className="space-y-2 p-2">
                    {searchResults.map(product => (
                      <div key={product.id} className="rounded-md border">
                        {product.variations.length > 0 ? (
                          <>
                            <div className="flex items-center gap-3 p-3 text-sm border-b bg-muted/30">
                              <img
                                src={product.image_url || '/placeholder.svg'}
                                alt={product.name}
                                className="h-10 w-10 rounded-md object-cover border bg-muted shrink-0"
                              />
                              <p className="font-medium truncate">{product.name}</p>
                            </div>
                            <div className="p-2 space-y-1">
                              {product.variations.map(v => (
                                <button
                                  key={v.id}
                                  onClick={() => addNewProduct(product, v)}
                                  className="w-full flex items-center justify-between rounded p-2 text-xs hover:bg-muted/50 transition-colors"
                                >
                                  <span className="font-medium">{v.label}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`text-[10px] ${v.stock <= 0 ? 'border-destructive text-destructive' : ''}`}>
                                      Est: {v.stock}
                                    </Badge>
                                    <span className="font-medium">{brl(Number(v.price || product.price))}</span>
                                    <Plus className="h-3.5 w-3.5 text-green-600" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <button
                            onClick={() => addNewProduct(product)}
                            className="w-full flex items-center gap-3 p-3 text-sm hover:bg-muted/50 transition-colors text-left"
                          >
                            <img
                              src={product.image_url || '/placeholder.svg'}
                              alt={product.name}
                              className="h-10 w-10 rounded-md object-cover border bg-muted shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{product.name}</p>
                            </div>
                            <span className="font-medium shrink-0">{brl(Number(product.price))}</span>
                            <Plus className="h-4 w-4 text-green-600 shrink-0" />
                          </button>
                        )}
                      </div>
                    ))}

                    {searchResults.length === 0 && !searching && (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Nenhum produto encontrado.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setStep('select-return')}>
                    ← Voltar
                  </Button>
                  <Button size="sm" disabled={newLines.length === 0} onClick={() => setStep('confirm')}>
                    Continuar →
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Confirmation */}
            {step === 'confirm' && returnLines.length > 0 && newLines.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Confirme a troca</h4>

                <div className="p-3 rounded-md border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 space-y-2">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" /> Devolvendo (volta ao estoque)
                  </p>
                  {returnLines.map(l => (
                    <div key={l.key} className="text-sm">
                      <p className="font-medium">{l.product_name}</p>
                      {l.variation_label && <p className="text-xs text-red-600 dark:text-red-400">{l.variation_label}</p>}
                      <p className="text-xs text-muted-foreground">
                        Qtd: {l.quantity} × {brl(l.price)} = {brl(l.price * l.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-center">
                  <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="p-3 rounded-md border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 space-y-2">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-300 flex items-center gap-1">
                    <Package className="h-3 w-3" /> Novos produtos (saem do estoque)
                  </p>
                  {newLines.map(l => (
                    <div key={l.key} className="text-sm">
                      <p className="font-medium">{l.product_name}</p>
                      {l.variation_label && <p className="text-xs text-green-600 dark:text-green-400">{l.variation_label}</p>}
                      <p className="text-xs text-muted-foreground">
                        Qtd: {l.quantity} × {brl(l.price)} = {brl(l.price * l.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                {summaryBar}

                <Button variant="ghost" size="sm" onClick={() => setStep('select-new')}>
                  ← Voltar
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          {step === 'confirm' && (
            <Button onClick={handleConfirmExchange} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Confirmar Troca
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderExchangeModal;
