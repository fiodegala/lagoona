import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Package, Warehouse, AlertTriangle, Plus, Minus, Save, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { variationsService, ProductVariation, ProductAttribute } from '@/services/variations';

interface Store {
  id: string;
  name: string;
  slug: string;
  type: string;
}

interface StockProduct {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  barcode: string | null;
  category_name: string | null;
  is_active: boolean;
  stock_legacy: number;
  min_stock: number;
  stores: Record<string, number>;
  total: number;
  has_variations: boolean;
}

interface VariationDetail {
  variation: ProductVariation;
  storeQuantities: Record<string, number>;
  total: number;
}

interface ColorGroup {
  color: string;
  variations: VariationDetail[];
  total: number;
}

const Stock = () => {
  const { isAdmin, userStoreId, isOnlineStore } = useAuth();
  const { toast } = useToast();
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStore, setFilterStore] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Edit modal
  const [editingProduct, setEditingProduct] = useState<StockProduct | null>(null);
  const [editQuantities, setEditQuantities] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Expansion state for variation details
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<ColorGroup[]>([]);
  const [isLoadingExpanded, setIsLoadingExpanded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [storesRes, productsRes, stockRes, variationsRes] = await Promise.all([
        supabase.from('stores').select('id, name, slug, type').eq('is_active', true).order('name'),
        supabase.from('products').select('id, name, image_url, price, barcode, stock, min_stock, is_active, categories(name)').order('name'),
        supabase.from('store_stock').select('store_id, product_id, variation_id, quantity'),
        supabase.from('product_variations').select('id, product_id').eq('is_active', true),
      ]);

      const storesList = storesRes.data || [];
      const physicalStores = storesList.filter(s => s.type === 'physical');
      setStores(storesList);

      // Build set of products that have variations
      const productsWithVariations = new Set<string>();
      (variationsRes.data || []).forEach((v: any) => {
        productsWithVariations.add(v.product_id);
      });

      // Build stock maps: one for simple products (variation_id is null), one for variation-level
      const simpleStockMap: Record<string, Record<string, number>> = {};
      const variationStockMap: Record<string, Record<string, number>> = {}; // product_id -> store_id -> sum
      (stockRes.data || []).forEach((s: any) => {
        if (s.variation_id) {
          // Variation-level stock: aggregate by product_id + store_id
          if (!variationStockMap[s.product_id]) variationStockMap[s.product_id] = {};
          variationStockMap[s.product_id][s.store_id] = (variationStockMap[s.product_id][s.store_id] || 0) + s.quantity;
        } else {
          if (!simpleStockMap[s.product_id]) simpleStockMap[s.product_id] = {};
          simpleStockMap[s.product_id][s.store_id] = s.quantity;
        }
      });

      const mappedProducts: StockProduct[] = (productsRes.data || []).map((p: any) => {
        const hasVariations = productsWithVariations.has(p.id);
        const stockSource = hasVariations ? variationStockMap : simpleStockMap;
        const storeQuantities: Record<string, number> = {};
        let total = 0;
        physicalStores.forEach(store => {
          const qty = stockSource[p.id]?.[store.id] || 0;
          storeQuantities[store.id] = qty;
          total += qty;
        });

        return {
          id: p.id,
          name: p.name,
          image_url: p.image_url,
          price: p.price,
          barcode: p.barcode,
          category_name: p.categories?.name || null,
          is_active: p.is_active,
          stock_legacy: p.stock,
          min_stock: p.min_stock || 0,
          stores: storeQuantities,
          total,
          has_variations: hasVariations,
        };
      });

      setProducts(mappedProducts);
    } catch (error) {
      console.error('Error loading stock data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !search || 
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = filterStatus === 'all' ||
        (filterStatus === 'in-stock' && p.total > 0) ||
        (filterStatus === 'low-stock' && p.total > 0 && p.total <= 5) ||
        (filterStatus === 'out-of-stock' && p.total === 0) ||
        (filterStatus === 'below-min' && p.min_stock > 0 && p.total <= p.min_stock);

      return matchesSearch && matchesStatus;
    });
  }, [products, search, filterStatus]);

  const physicalStores = stores.filter(s => s.type === 'physical');

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const openEditModal = (product: StockProduct) => {
    setEditingProduct(product);
    setEditQuantities({ ...product.stores });
  };

  const toggleExpand = async (product: StockProduct) => {
    if (expandedProductId === product.id) {
      setExpandedProductId(null);
      setExpandedData([]);
      return;
    }

    if (!product.has_variations) {
      setExpandedProductId(null);
      return;
    }

    setExpandedProductId(product.id);
    setIsLoadingExpanded(true);

    try {
      const [variations, stockRes] = await Promise.all([
        variationsService.getVariationsByProduct(product.id),
        supabase
          .from('store_stock')
          .select('variation_id, store_id, quantity')
          .eq('product_id', product.id)
          .not('variation_id', 'is', null),
      ]);

      const stockData = stockRes.data || [];

      // Build per-variation store quantities
      const variationDetails: VariationDetail[] = variations.filter(v => v.is_active).map(v => {
        const storeQuantities: Record<string, number> = {};
        let total = 0;
        stockData.forEach((s: any) => {
          if (s.variation_id === v.id) {
            storeQuantities[s.store_id] = (storeQuantities[s.store_id] || 0) + s.quantity;
            total += s.quantity;
          }
        });
        return { variation: v, storeQuantities, total };
      });

      // Group by color (first attribute named "Cor" or the first attribute)
      const colorGroups: Record<string, VariationDetail[]> = {};
      variationDetails.forEach(vd => {
        const colorAttr = vd.variation.attribute_values?.find(
          av => av.attribute_name.toLowerCase() === 'cor'
        );
        const colorKey = colorAttr?.value || 'Sem cor';
        if (!colorGroups[colorKey]) colorGroups[colorKey] = [];
        colorGroups[colorKey].push(vd);
      });

      const groups: ColorGroup[] = Object.entries(colorGroups).map(([color, vars]) => ({
        color,
        variations: vars,
        total: vars.reduce((sum, v) => sum + v.total, 0),
      }));

      setExpandedData(groups);
    } catch (error) {
      console.error('Error loading variation details:', error);
    } finally {
      setIsLoadingExpanded(false);
    }
  };

  const handleSaveStock = async () => {
    if (!editingProduct) return;
    setIsSaving(true);

    try {
      for (const store of physicalStores) {
        const qty = editQuantities[store.id] ?? 0;

        const { data: existing } = await supabase
          .from('store_stock')
          .select('id')
          .eq('store_id', store.id)
          .eq('product_id', editingProduct.id)
          .is('variation_id', null)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('store_stock')
            .update({ quantity: qty, updated_at: new Date().toISOString() } as never)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('store_stock')
            .insert({
              store_id: store.id,
              product_id: editingProduct.id,
              variation_id: null,
              quantity: qty,
            } as never);
        }
      }

      toast({ title: 'Estoque atualizado com sucesso!' });
      setEditingProduct(null);
      loadData();
    } catch (error) {
      console.error('Error saving stock:', error);
      toast({ title: 'Erro ao salvar estoque', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const totalProducts = products.length;
  const outOfStock = products.filter(p => p.total === 0).length;
  const lowStock = products.filter(p => p.total > 0 && p.total <= 5).length;
  const belowMinStock = products.filter(p => p.min_stock > 0 && p.total <= p.min_stock).length;
  const totalOnlineStock = products.reduce((sum, p) => sum + p.total, 0);

  const exportToCSV = () => {
    const headers = ['Produto', 'Código de Barras', 'Categoria', 'Preço', ...physicalStores.map(s => s.name), 'Estoque Online (Geral)'];
    const rows = filteredProducts.map(p => [
      p.name,
      p.barcode || '',
      p.category_name || '',
      p.price.toFixed(2).replace('.', ','),
      ...physicalStores.map(s => String(p.stores[s.id] || 0)),
      String(p.total),
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estoque_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Relatório exportado com sucesso!' });
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
          <p className="text-muted-foreground mt-1">
            Controle de estoque por loja
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalProducts}</p>
                  <p className="text-xs text-muted-foreground">Produtos cadastrados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {physicalStores.map(store => {
            const storeTotal = products.reduce((sum, p) => sum + (p.stores[store.id] || 0), 0);
            return (
              <Card key={store.id} className="card-elevated">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Warehouse className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{storeTotal}</p>
                      <p className="text-xs text-muted-foreground">{store.name}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalOnlineStock}</p>
                  <p className="text-xs text-muted-foreground">Estoque Online</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{belowMinStock}</p>
                  <p className="text-xs text-muted-foreground">Abaixo do mínimo</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{outOfStock}</p>
                  <p className="text-xs text-muted-foreground">Sem estoque</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="in-stock">Em estoque</SelectItem>
              <SelectItem value="low-stock">Estoque baixo (≤5)</SelectItem>
              <SelectItem value="below-min">Abaixo do mínimo</SelectItem>
              <SelectItem value="out-of-stock">Sem estoque</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToCSV} disabled={filteredProducts.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Stock Table */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-lg">
              {filteredProducts.length} produto(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-center">Preço</TableHead>
                      {physicalStores.map(store => (
                        <TableHead key={store.id} className="text-center">
                          {store.name}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold">Estoque Online (Geral)</TableHead>
                      {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5 + physicalStores.length} className="text-center py-8 text-muted-foreground">
                          Nenhum produto encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => (
                        <React.Fragment key={product.id}>
                        <TableRow 
                          
                          className={product.has_variations ? 'cursor-pointer hover:bg-muted/50' : ''}
                          onClick={() => product.has_variations && toggleExpand(product)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {product.has_variations && (
                                expandedProductId === product.id 
                                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              {product.image_url ? (
                                <img src={product.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                              ) : (
                                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-sm">{product.name}</p>
                                  {product.min_stock > 0 && product.total <= product.min_stock && (
                                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                  )}
                                </div>
                                {product.barcode && (
                                  <p className="text-xs text-muted-foreground">{product.barcode}</p>
                                )}
                                {product.min_stock > 0 && (
                                  <p className="text-xs text-muted-foreground">Mín: {product.min_stock}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {product.category_name || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {formatCurrency(product.price)}
                          </TableCell>
                          {physicalStores.map(store => {
                            const qty = product.stores[store.id] || 0;
                            return (
                              <TableCell key={store.id} className="text-center">
                                <Badge
                                  variant={qty === 0 ? 'destructive' : qty <= 5 ? 'secondary' : 'default'}
                                  className="min-w-[40px] justify-center"
                                >
                                  {qty}
                                </Badge>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center">
                            <Badge
                              variant={product.total === 0 ? 'destructive' : product.total <= 5 ? 'secondary' : 'default'}
                              className="min-w-[40px] justify-center font-bold"
                            >
                              {product.total}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              {product.has_variations ? (
                                <Badge variant="outline" className="text-xs">Variável</Badge>
                              ) : (
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditModal(product); }}>
                                  Editar
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                        {/* Expanded variation details */}
                        {expandedProductId === product.id && (
                          <TableRow key={`${product.id}-expanded`}>
                            <TableCell colSpan={4 + physicalStores.length + (isAdmin ? 1 : 0)} className="bg-muted/30 p-0">
                              {isLoadingExpanded ? (
                                <div className="p-4 space-y-2">
                                  <Skeleton className="h-6 w-full" />
                                  <Skeleton className="h-6 w-full" />
                                  <Skeleton className="h-6 w-full" />
                                </div>
                              ) : (
                                <div className="p-4 space-y-5">
                                  {expandedData.map((group) => (
                                    <div key={group.color}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline" className="font-semibold">
                                          {group.color}
                                        </Badge>
                                        <span className="text-sm font-bold text-foreground">
                                          Total: {group.total}
                                        </span>
                                      </div>
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-muted/50">
                                            <TableHead className="text-xs h-8">Tamanho</TableHead>
                                            {physicalStores.map(store => (
                                              <TableHead key={store.id} className="text-xs text-center h-8">{store.name}</TableHead>
                                            ))}
                                            <TableHead className="text-xs text-center font-bold h-8">Total</TableHead>
                                            <TableHead className="text-xs h-8">SKU</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {group.variations.map((vd) => {
                                            const label = vd.variation.attribute_values
                                              ?.filter(av => av.attribute_name.toLowerCase() !== 'cor')
                                              .map(av => av.value)
                                              .join(' / ') || '—';
                                            return (
                                              <TableRow key={vd.variation.id} className="hover:bg-muted/30">
                                                <TableCell className="py-1.5 text-sm font-medium">{label}</TableCell>
                                                {physicalStores.map(store => (
                                                  <TableCell key={store.id} className="py-1.5 text-center">
                                                    <Badge
                                                      variant={(vd.storeQuantities[store.id] || 0) === 0 ? 'destructive' : 'secondary'}
                                                      className="min-w-[32px] justify-center text-xs"
                                                    >
                                                      {vd.storeQuantities[store.id] || 0}
                                                    </Badge>
                                                  </TableCell>
                                                ))}
                                                <TableCell className="py-1.5 text-center font-bold text-sm">{vd.total}</TableCell>
                                                <TableCell className="py-1.5 text-xs text-muted-foreground">{vd.variation.sku || '—'}</TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  ))}
                                  {expandedData.length === 0 && (
                                    <p className="text-sm text-muted-foreground">Nenhuma variação encontrada.</p>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                        </React.Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Stock Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Estoque</DialogTitle>
            <DialogDescription>
              {editingProduct?.name} — Ajuste a quantidade de cada loja física
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {physicalStores.map(store => (
              <div key={store.id} className="flex items-center gap-4">
                <Label className="w-40 text-sm font-medium">{store.name}</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditQuantities(prev => ({
                      ...prev,
                      [store.id]: Math.max(0, (prev[store.id] || 0) - 1),
                    }))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    value={editQuantities[store.id] ?? 0}
                    onChange={(e) => setEditQuantities(prev => ({
                      ...prev,
                      [store.id]: Math.max(0, parseInt(e.target.value) || 0),
                    }))}
                    className="w-20 text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditQuantities(prev => ({
                      ...prev,
                      [store.id]: (prev[store.id] || 0) + 1,
                    }))}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 pt-2 border-t">
              <Label className="w-40 text-sm font-bold">Estoque Online (Geral)</Label>
              <span className="text-lg font-bold">
                {Object.values(editQuantities).reduce((a, b) => a + b, 0)}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancelar</Button>
            <Button onClick={handleSaveStock} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Stock;
