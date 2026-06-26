import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { auditService } from '@/services/auditService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SaleItem {
  product_id?: string;
  variation_id?: string | null;
  name: string;
  variation?: string;
  sku?: string;
  image_url?: string;
  quantity: number;
  unit_price?: number;
  price?: number;
  discount_amount?: number;
  total?: number;
}

interface EditSaleItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: any;
  onUpdated?: (updatedSale: any) => void;
}

interface ProductSearchResult {
  id: string;
  name: string;
  price: number;
  variations: Array<{ id: string; price?: number; sku?: string; label: string }>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const normalizeItem = (raw: any): SaleItem => ({
  ...raw,
  quantity: Number(raw.quantity || 1),
  unit_price: Number(raw.unit_price ?? raw.price ?? 0),
  discount_amount: Number(raw.discount_amount || 0),
});

const recalcItem = (it: SaleItem): SaleItem => ({
  ...it,
  total: Math.max(0, it.quantity * Number(it.unit_price || 0) - Number(it.discount_amount || 0)),
});

const EditSaleItemsModal = ({ open, onOpenChange, sale, onUpdated }: EditSaleItemsModalProps) => {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !sale) return;
    const initial = Array.isArray(sale.items) ? sale.items : [];
    setItems(initial.map((i: any) => recalcItem(normalizeItem(i))));
    setSearch('');
    setResults([]);
  }, [open, sale]);

  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + it.quantity * Number(it.unit_price || 0), 0),
    [items]
  );
  const itemsDiscount = useMemo(
    () => items.reduce((acc, it) => acc + Number(it.discount_amount || 0), 0),
    [items]
  );
  const headerDiscount = Number(sale?.discount_amount || 0) - Number(sale?.items?.reduce?.((a: number, i: any) => a + Number(i.discount_amount || 0), 0) || 0);
  const total = Math.max(0, subtotal - itemsDiscount - Math.max(0, headerDiscount));

  const updateItem = (idx: number, patch: Partial<SaleItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = recalcItem({ ...next[idx], ...patch });
      return next;
    });
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const runSearch = async () => {
    const term = search.trim();
    if (term.length < 2) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, product_variations(id, price, sku, attribute_values:product_variation_values(value:product_attribute_values(value)))')
        .or(`name.ilike.%${term}%,sku.ilike.%${term}%,barcode.eq.${term}`)
        .eq('is_active', true)
        .limit(15);
      if (error) throw error;
      const mapped: ProductSearchResult[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price || 0),
        variations: (p.product_variations || []).map((v: any) => ({
          id: v.id,
          price: v.price != null ? Number(v.price) : undefined,
          sku: v.sku,
          label:
            (v.attribute_values || [])
              .map((av: any) => av?.value?.value)
              .filter(Boolean)
              .join(' / ') || v.sku || 'Variação',
        })),
      }));
      setResults(mapped);
    } catch (e: any) {
      toast.error('Erro ao buscar produtos: ' + (e.message || ''));
    } finally {
      setSearching(false);
    }
  };

  const addFromProduct = (p: ProductSearchResult) => {
    let variationId: string | null = null;
    let variationLabel: string | undefined;
    let unitPrice = p.price;
    let sku: string | undefined;

    if (p.variations.length > 0) {
      const chosen = selectedVariation[p.id];
      if (!chosen) {
        toast.error('Selecione uma variação');
        return;
      }
      const v = p.variations.find((x) => x.id === chosen);
      if (!v) return;
      variationId = v.id;
      variationLabel = v.label;
      if (v.price != null) unitPrice = v.price;
      sku = v.sku;
    }

    const newItem: SaleItem = recalcItem({
      product_id: p.id,
      variation_id: variationId,
      name: p.name,
      variation: variationLabel,
      sku,
      quantity: 1,
      unit_price: unitPrice,
      discount_amount: 0,
    });
    setItems((prev) => [...prev, newItem]);
    setResults([]);
    setSearch('');
    setSelectedVariation({});
    toast.success('Item adicionado');
  };

  const adjustStock = async (
    storeId: string,
    productId: string,
    variationId: string | null,
    delta: number // positive = add to stock (item removed), negative = deduct (item added)
  ) => {
    if (!storeId || !productId || delta === 0) return;
    let q = supabase
      .from('store_stock')
      .select('id, quantity')
      .eq('store_id', storeId)
      .eq('product_id', productId);
    q = variationId ? q.eq('variation_id', variationId) : q.is('variation_id', null);
    const { data: row } = await q.maybeSingle();
    if (row) {
      await supabase
        .from('store_stock')
        .update({ quantity: Math.max(0, row.quantity + delta), updated_at: new Date().toISOString() })
        .eq('id', row.id);
    } else if (delta < 0) {
      // Item added but no stock row yet — create one at 0 (already over-sold)
      await supabase.from('store_stock').insert({
        store_id: storeId,
        product_id: productId,
        variation_id: variationId,
        quantity: 0,
      } as any);
    } else {
      await supabase.from('store_stock').insert({
        store_id: storeId,
        product_id: productId,
        variation_id: variationId,
        quantity: delta,
      } as any);
    }
  };

  const handleSave = async () => {
    if (!sale) return;
    if (items.length === 0) {
      toast.error('A venda precisa ter ao menos 1 item');
      return;
    }
    setSaving(true);
    try {
      // Compute stock deltas per (product_id|variation_id)
      const key = (pid: string, vid: string | null) => `${pid}::${vid || ''}`;
      const oldMap = new Map<string, number>();
      const oldItems: SaleItem[] = Array.isArray(sale.items) ? sale.items.map(normalizeItem) : [];
      for (const it of oldItems) {
        if (!it.product_id) continue;
        oldMap.set(key(it.product_id, it.variation_id ?? null), (oldMap.get(key(it.product_id, it.variation_id ?? null)) || 0) + Number(it.quantity || 0));
      }
      const newMap = new Map<string, number>();
      for (const it of items) {
        if (!it.product_id) continue;
        newMap.set(key(it.product_id, it.variation_id ?? null), (newMap.get(key(it.product_id, it.variation_id ?? null)) || 0) + Number(it.quantity || 0));
      }
      const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);
      const storeId = sale.store_id;

      // Update DB first, then adjust stock (best-effort)
      const newSubtotal = items.reduce((a, i) => a + i.quantity * Number(i.unit_price || 0), 0);
      const newTotal = Math.max(0, newSubtotal - itemsDiscount - Math.max(0, headerDiscount));

      const { error } = await supabase
        .from('pos_sales')
        .update({
          items: items as any,
          subtotal: newSubtotal,
          total: newTotal,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', sale.id);
      if (error) throw error;

      if (storeId) {
        for (const k of allKeys) {
          const oldQ = oldMap.get(k) || 0;
          const newQ = newMap.get(k) || 0;
          const diff = newQ - oldQ; // positive = more sold now -> deduct stock; negative = less -> add
          if (diff === 0) continue;
          const [pid, vid] = k.split('::');
          await adjustStock(storeId, pid, vid || null, -diff);
        }
      }

      await auditService.log({
        action: 'update',
        entity_type: 'pos_sale',
        entity_id: sale.id,
        details: {
          field: 'items',
          old_subtotal: Number(sale.subtotal || 0),
          new_subtotal: newSubtotal,
          old_total: Number(sale.total || 0),
          new_total: newTotal,
          old_items_count: oldItems.length,
          new_items_count: items.length,
        },
      });

      toast.success('Venda atualizada com sucesso');
      onUpdated?.({
        ...sale,
        items,
        subtotal: newSubtotal,
        total: newTotal,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Itens da Venda</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* Items list */}
          <div className="space-y-2">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum item na venda</p>
            )}
            {items.map((it, idx) => (
              <div key={idx} className="border rounded-lg p-3 grid grid-cols-12 gap-2 items-center">
                <div className="col-span-12 sm:col-span-5">
                  <p className="text-sm font-medium truncate">{it.name}</p>
                  {it.variation && <p className="text-xs text-muted-foreground">{it.variation}</p>}
                  {it.sku && <p className="text-xs text-muted-foreground">SKU: {it.sku}</p>}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">Qtd</Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="h-8"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">Preço unit.</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={it.unit_price ?? 0}
                    onChange={(e) => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                    className="h-8"
                  />
                </div>
                <div className="col-span-3 sm:col-span-2 text-right">
                  <Label className="text-[10px] uppercase text-muted-foreground">Total</Label>
                  <p className="text-sm font-medium h-8 flex items-center justify-end">{fmt(Number(it.total || 0))}</p>
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(idx)} title="Remover item">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Add item */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Adicionar produto</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nome, SKU ou código de barras..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
              />
              <Button type="button" variant="outline" onClick={runSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {results.length > 0 && (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {results.map((p) => (
                  <div key={p.id} className="p-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{fmt(p.price)}</p>
                    </div>
                    {p.variations.length > 0 && (
                      <Select
                        value={selectedVariation[p.id] || ''}
                        onValueChange={(v) => setSelectedVariation((prev) => ({ ...prev, [p.id]: v }))}
                      >
                        <SelectTrigger className="h-8 w-40 text-xs">
                          <SelectValue placeholder="Variação" />
                        </SelectTrigger>
                        <SelectContent>
                          {p.variations.map((v) => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={() => addFromProduct(p)}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {itemsDiscount > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Desconto nos itens</span>
                <span>-{fmt(itemsDiscount)}</span>
              </div>
            )}
            {headerDiscount > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Desconto da venda</span>
                <span>-{fmt(headerDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t mt-1">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando...</> : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditSaleItemsModal;
