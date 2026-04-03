import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { Loader2, Search, Package, TrendingUp, TrendingDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StockItem {
  productId: string;
  productName: string;
  totalQuantity: number;
  percentage: number;
}

const PAGE_SIZE = 1000;

async function fetchAllStockRows() {
  const allRows: { product_id: string; quantity: number; variation_id: string | null }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('store_stock')
      .select('product_id, quantity, variation_id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

async function fetchAllProducts() {
  const all: { id: string; name: string }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name')
      .range(from, from + PAGE_SIZE - 1);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

const StockDistribution = () => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'percentage' | 'quantity' | 'name'>('percentage');
  const [totalStock, setTotalStock] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stockRows, products] = await Promise.all([
        fetchAllStockRows(),
        fetchAllProducts(),
      ]);

      const productMap = new Map(products.map(p => [p.id, p.name]));

      // Sum quantities per product
      const stockMap: Record<string, number> = {};
      let total = 0;
      stockRows.forEach(row => {
        stockMap[row.product_id] = (stockMap[row.product_id] || 0) + row.quantity;
        total += row.quantity;
      });

      setTotalStock(total);

      const result: StockItem[] = Object.entries(stockMap)
        .map(([productId, totalQuantity]) => ({
          productId,
          productName: productMap.get(productId) || 'Produto desconhecido',
          totalQuantity,
          percentage: total > 0 ? (totalQuantity / total) * 100 : 0,
        }));

      setItems(result);
    } catch (err) {
      console.error('Error loading stock distribution:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(i => i.productName.toLowerCase().includes(s));
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'percentage') return b.percentage - a.percentage;
      if (sortBy === 'quantity') return b.totalQuantity - a.totalQuantity;
      return a.productName.localeCompare(b.productName);
    });
    return list;
  }, [items, search, sortBy]);

  const top5 = useMemo(() => [...items].sort((a, b) => b.percentage - a.percentage).slice(0, 5), [items]);

  const getBarColor = (pct: number) => {
    if (pct >= 10) return 'bg-primary';
    if (pct >= 5) return 'bg-blue-500';
    if (pct >= 1) return 'bg-amber-500';
    return 'bg-muted-foreground/40';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Distribuição de Estoque</h1>
          <p className="text-muted-foreground">Veja quanto cada produto representa do estoque total</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Peças</p>
                      <p className="text-2xl font-bold text-foreground">{totalStock.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Produtos em Estoque</p>
                      <p className="text-2xl font-bold text-foreground">{items.filter(i => i.totalQuantity > 0).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <TrendingDown className="h-8 w-8 text-destructive" />
                    <div>
                      <p className="text-sm text-muted-foreground">Produtos sem Estoque</p>
                      <p className="text-2xl font-bold text-foreground">{items.filter(i => i.totalQuantity <= 0).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top 5 */}
            {top5.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top 5 — Maior Representatividade</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {top5.map((item, i) => (
                    <div key={item.productId} className="space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-medium text-foreground truncate max-w-[70%]">
                          {i + 1}. {item.productName}
                        </span>
                        <span className="text-sm font-bold text-primary">
                          {item.percentage.toFixed(1)}% ({item.totalQuantity} un.)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getBarColor(item.percentage)}`}
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Maior %</SelectItem>
                  <SelectItem value="quantity">Maior quantidade</SelectItem>
                  <SelectItem value="name">Nome A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Full list */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                  {filtered.map(item => (
                    <div key={item.productId} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.totalQuantity.toLocaleString('pt-BR')} unidades</p>
                      </div>
                      <div className="w-32 sm:w-48">
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getBarColor(item.percentage)}`}
                            style={{ width: `${Math.max(item.percentage, 0.5)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-foreground w-16 text-right">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Nenhum produto encontrado</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default StockDistribution;
