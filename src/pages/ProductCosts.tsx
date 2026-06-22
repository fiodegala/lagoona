import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, Save, Package } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface ProductCostRow {
  id: string;
  name: string;
  barcode: string | null;
  price: number | null;
  cost_price: number | null;
  image_url: string | null;
  is_active: boolean;
}

const formatBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));

const parseBRLInput = (v: string): number | null => {
  if (!v || !v.trim()) return null;
  const normalized = v.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const ProductCosts = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['product-costs'],
    queryFn: async (): Promise<ProductCostRow[]> => {
      const all: ProductCostRow[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, barcode, price, cost_price, image_url, is_active')
          .order('name', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data?.length) break;
        all.push(...(data as ProductCostRow[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  // initialize drafts when data loads
  useEffect(() => {
    if (!products.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      products.forEach((p) => {
        if (next[p.id] === undefined) {
          next[p.id] = p.cost_price != null ? String(p.cost_price).replace('.', ',') : '';
        }
      });
      return next;
    });
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q),
    );
  }, [products, search]);

  const stats = useMemo(() => {
    const total = products.length;
    const withCost = products.filter((p) => (p.cost_price ?? 0) > 0).length;
    const withoutCost = total - withCost;
    const avgMargin = (() => {
      const valid = products.filter((p) => (p.price ?? 0) > 0 && (p.cost_price ?? 0) > 0);
      if (!valid.length) return 0;
      const sum = valid.reduce((acc, p) => acc + ((p.price! - p.cost_price!) / p.price!) * 100, 0);
      return sum / valid.length;
    })();
    return { total, withCost, withoutCost, avgMargin };
  }, [products]);

  const saveOne = async (id: string) => {
    const raw = drafts[id] ?? '';
    const value = parseBRLInput(raw);
    if (raw && value === null) {
      toast({ title: 'Valor inválido', description: 'Use formato 12,34', variant: 'destructive' });
      return;
    }
    setSavingId(id);
    const { error } = await supabase.from('products').update({ cost_price: value }).eq('id', id);
    setSavingId(null);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Custo atualizado', description: formatBRL(value) });
    queryClient.invalidateQueries({ queryKey: ['product-costs'] });
    queryClient.invalidateQueries({ queryKey: ['products-cost-map'] });
  };

  const saveAllChanged = async () => {
    const changed = products.filter((p) => {
      const draft = drafts[p.id];
      if (draft === undefined) return false;
      const parsed = parseBRLInput(draft);
      return parsed !== (p.cost_price ?? null);
    });
    if (!changed.length) {
      toast({ title: 'Nada a salvar', description: 'Nenhuma alteração detectada.' });
      return;
    }
    setSavingAll(true);
    let ok = 0;
    let fail = 0;
    for (const p of changed) {
      const value = parseBRLInput(drafts[p.id]);
      const { error } = await supabase.from('products').update({ cost_price: value }).eq('id', p.id);
      if (error) fail++;
      else ok++;
    }
    setSavingAll(false);
    toast({
      title: 'Atualização em lote',
      description: `${ok} salvos · ${fail} falharam`,
      variant: fail > 0 ? 'destructive' : 'default',
    });
    queryClient.invalidateQueries({ queryKey: ['product-costs'] });
    queryClient.invalidateQueries({ queryKey: ['products-cost-map'] });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Custos de Produtos</h1>
            <p className="text-muted-foreground mt-1">
              Cadastre o custo (preço de compra) de cada produto. Usado em relatórios de margem e Curva ABC.
            </p>
          </div>
          <Button onClick={saveAllChanged} disabled={savingAll}>
            {savingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar todas as alterações
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total de produtos</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Com custo definido</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">{stats.withCost}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Sem custo</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-amber-600">{stats.withoutCost}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Margem média</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.avgMargin.toFixed(1)}%</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código de barras..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Imagem</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="w-40">Código de barras</TableHead>
                      <TableHead className="text-right w-32">Preço venda</TableHead>
                      <TableHead className="text-right w-40">Custo (R$)</TableHead>
                      <TableHead className="text-right w-28">Margem</TableHead>
                      <TableHead className="w-28 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      const draft = drafts[p.id] ?? '';
                      const parsedDraft = parseBRLInput(draft);
                      const margin =
                        p.price && p.price > 0 && parsedDraft && parsedDraft > 0
                          ? ((p.price - parsedDraft) / p.price) * 100
                          : null;
                      const changed = parsedDraft !== (p.cost_price ?? null);
                      return (
                        <TableRow key={p.id} className={changed ? 'bg-amber-50/40' : undefined}>
                          <TableCell>
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded object-cover" />
                            ) : (
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{p.name}</div>
                            {!p.is_active && <Badge variant="secondary" className="mt-1">Inativo</Badge>}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {p.barcode || '—'}
                          </TableCell>
                          <TableCell className="text-right">{formatBRL(p.price)}</TableCell>
                          <TableCell>
                            <Input
                              inputMode="decimal"
                              placeholder="0,00"
                              className="text-right"
                              value={draft}
                              onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveOne(p.id);
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {margin !== null ? (
                              <span className={margin >= 0 ? 'text-green-600' : 'text-destructive'}>
                                {margin.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={changed ? 'default' : 'outline'}
                              onClick={() => saveOne(p.id)}
                              disabled={savingId === p.id}
                            >
                              {savingId === p.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!filtered.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum produto encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ProductCosts;
