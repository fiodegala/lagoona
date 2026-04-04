import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, Line, XAxis, YAxis, CartesianGrid, ComposedChart } from 'recharts';
import { TrendingUp, Search, Loader2, BarChart3 } from 'lucide-react';
import ABCAnalysisReport from '@/components/abc/ABCAnalysisReport';
import { subDays, startOfMonth } from 'date-fns';

type PeriodFilter = '7d' | '30d' | '90d' | 'month' | 'all';

interface ABCItem {
  productName: string;
  productId: string;
  quantitySold: number;
  totalRevenue: number;
  individualPercent: number;
  accumulatedPercent: number;
  classification: 'A' | 'B' | 'C';
  rank: number;
}

const ABCCurve = () => {
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [search, setSearch] = useState('');

  const dateFrom = useMemo(() => {
    const now = new Date();
    switch (period) {
      case '7d': return subDays(now, 7).toISOString();
      case '30d': return subDays(now, 30).toISOString();
      case '90d': return subDays(now, 90).toISOString();
      case 'month': return startOfMonth(now).toISOString();
      case 'all': return null;
    }
  }, [period]);

  const { data: posSales, isLoading: loadingPos } = useQuery({
    queryKey: ['abc-pos-sales', dateFrom],
    queryFn: async () => {
      let query = supabase.from('pos_sales').select('items, total, created_at').neq('status', 'cancelled');
      if (dateFrom) query = query.gte('created_at', dateFrom);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ['abc-orders', dateFrom],
    queryFn: async () => {
      let query = supabase.from('orders').select('items, total, created_at').neq('status', 'cancelled');
      if (dateFrom) query = query.gte('created_at', dateFrom);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const abcData = useMemo<ABCItem[]>(() => {
    if (!posSales && !orders) return [];

    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();

    const processItems = (items: any) => {
      if (!Array.isArray(items)) return;
      items.forEach((item: any) => {
        const id = item.product_id || item.productId || item.id || 'unknown';
        const name = item.product_name || item.productName || item.name || 'Produto desconhecido';
        const qty = Number(item.quantity || item.qty || 1);
        const price = Number(item.price || item.unit_price || item.unitPrice || 0);
        const revenue = qty * price;

        const existing = productMap.get(id);
        if (existing) {
          existing.qty += qty;
          existing.revenue += revenue;
        } else {
          productMap.set(id, { name, qty, revenue });
        }
      });
    };

    posSales?.forEach(sale => processItems(sale.items));
    orders?.forEach(order => processItems(order.items));

    const sorted = Array.from(productMap.entries())
      .map(([id, data]) => ({ productId: id, productName: data.name, quantitySold: data.qty, totalRevenue: data.revenue }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const totalRevenue = sorted.reduce((sum, item) => sum + item.totalRevenue, 0);
    if (totalRevenue === 0) return [];

    let accumulated = 0;
    return sorted.map((item, index) => {
      accumulated += item.totalRevenue;
      const accumulatedPercent = (accumulated / totalRevenue) * 100;
      const individualPercent = (item.totalRevenue / totalRevenue) * 100;
      const classification: 'A' | 'B' | 'C' = accumulatedPercent <= 80 ? 'A' : accumulatedPercent <= 95 ? 'B' : 'C';
      return { ...item, individualPercent, accumulatedPercent, classification, rank: index + 1 };
    });
  }, [posSales, orders]);

  const filteredData = useMemo(() => {
    if (!search) return abcData;
    return abcData.filter(item => item.productName.toLowerCase().includes(search.toLowerCase()));
  }, [abcData, search]);

  const stats = useMemo(() => {
    const totalRevenue = abcData.reduce((sum, item) => sum + item.totalRevenue, 0);
    const totalQty = abcData.reduce((sum, item) => sum + item.quantitySold, 0);
    const countA = abcData.filter(i => i.classification === 'A').length;
    const countB = abcData.filter(i => i.classification === 'B').length;
    const countC = abcData.filter(i => i.classification === 'C').length;
    return { totalRevenue, totalQty, countA, countB, countC, ticketMedio: totalQty > 0 ? totalRevenue / totalQty : 0 };
  }, [abcData]);

  const chartData = useMemo(() => {
    return abcData.slice(0, 20).map(item => ({
      name: item.productName.length > 15 ? item.productName.substring(0, 15) + '…' : item.productName,
      revenue: item.totalRevenue,
      accumulated: item.accumulatedPercent,
      fill: item.classification === 'A' ? 'hsl(142, 76%, 36%)' : item.classification === 'B' ? 'hsl(45, 93%, 47%)' : 'hsl(0, 84%, 60%)',
    }));
  }, [abcData]);

  const chartConfig = {
    revenue: { label: 'Faturamento', color: 'hsl(var(--primary))' },
    accumulated: { label: '% Acumulado', color: 'hsl(var(--destructive))' },
  };

  const isLoading = loadingPos || loadingOrders;

  const classColor = (c: string) => {
    if (c === 'A') return 'bg-green-500/10 text-green-700 border-green-500/30';
    if (c === 'B') return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30';
    return 'bg-red-500/10 text-red-700 border-red-500/30';
  };

  const periods: { key: PeriodFilter; label: string }[] = [
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: '90d', label: '90 dias' },
    { key: 'month', label: 'Mês atual' },
    { key: 'all', label: 'Todo período' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Curva ABC de Produtos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Análise de Pareto baseada em vendas reais (PDV + Online)</p>
          </div>
          <div className="flex gap-1 flex-wrap">
            {periods.map(p => (
              <Button
                key={p.key}
                variant={period === p.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-muted-foreground">Faturamento Total</div>
                  <div className="text-lg font-bold text-foreground">
                    {stats.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-muted-foreground">Ticket Médio</div>
                  <div className="text-lg font-bold text-foreground">
                    {stats.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-green-500/30">
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-green-600 font-medium">Classe A (80%)</div>
                  <div className="text-lg font-bold text-foreground">{stats.countA} SKUs</div>
                </CardContent>
              </Card>
              <Card className="border-yellow-500/30">
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-yellow-600 font-medium">Classe B (15%)</div>
                  <div className="text-lg font-bold text-foreground">{stats.countB} SKUs</div>
                </CardContent>
              </Card>
              <Card className="border-red-500/30">
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-red-600 font-medium">Classe C (5%)</div>
                  <div className="text-lg font-bold text-foreground">{stats.countC} SKUs</div>
                </CardContent>
              </Card>
            </div>

            {/* Pareto Chart */}
            {chartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Gráfico de Pareto — Top 20 Produtos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[350px] w-full">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" fontSize={11} className="fill-muted-foreground" interval={0} />
                      <YAxis yAxisId="left" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} fontSize={11} className="fill-muted-foreground" />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} domain={[0, 100]} fontSize={11} className="fill-muted-foreground" />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => {
                              if (name === 'revenue') return [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento'];
                              return [`${Number(value).toFixed(1)}%`, '% Acumulado'];
                            }}
                          />
                        }
                      />
                      <Bar yAxisId="left" dataKey="revenue" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
                      <Line yAxisId="right" dataKey="accumulated" type="monotone" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {/* Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Tabela Detalhada</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd Vendida</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                        <TableHead className="text-right">% Individual</TableHead>
                        <TableHead className="text-right">% Acumulado</TableHead>
                        <TableHead className="text-center">Classe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                            Nenhum dado de venda encontrado para o período selecionado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredData.map(item => (
                          <TableRow key={item.productId}>
                            <TableCell className="font-medium text-muted-foreground">{item.rank}</TableCell>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="text-right">{item.quantitySold}</TableCell>
                            <TableCell className="text-right font-medium">
                              {item.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                            <TableCell className="text-right">{item.individualPercent.toFixed(2)}%</TableCell>
                            <TableCell className="text-right">{item.accumulatedPercent.toFixed(2)}%</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={classColor(item.classification)}>
                                {item.classification}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default ABCCurve;
