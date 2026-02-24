import { useEffect, useState, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, TrendingUp, Users, ShoppingCart, Package,
  Calendar, CalendarRange, DollarSign, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  Legend
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

type PeriodFilter = '7d' | '30d' | '90d' | 'month' | 'custom';

interface RawOrder {
  id: string;
  status: string;
  total: number;
  customer_name: string | null;
  customer_email: string;
  payment_method: string | null;
  payment_status: string | null;
  items: { name?: string; qty?: number; price?: number }[];
  created_at: string;
  shipping_address: { state?: string; city?: string } | null;
}

interface RawPOSSale {
  id: string;
  customer_name: string | null;
  total: number;
  subtotal: number;
  discount_amount: number | null;
  payment_method: string;
  items: { name?: string; qty?: number; price?: number; product_id?: string }[];
  created_at: string;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
  'hsl(200, 70%, 50%)',
  'hsl(120, 50%, 45%)',
  'hsl(45, 90%, 50%)',
];

const STATUS_COLORS: Record<string, string> = {
  delivered: 'hsl(var(--chart-2, 160 60% 45%))',
  completed: 'hsl(var(--chart-2, 160 60% 45%))',
  shipped: 'hsl(200, 70%, 50%)',
  processing: 'hsl(45, 90%, 50%)',
  pending: 'hsl(var(--chart-3, 30 80% 55%))',
  cancelled: 'hsl(var(--chart-5, 340 75% 55%))',
};

const STATUS_LABELS: Record<string, string> = {
  delivered: 'Entregue',
  completed: 'Completo',
  shipped: 'Enviado',
  processing: 'Processando',
  pending: 'Pendente',
  cancelled: 'Cancelado',
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão Crédito',
  debit_card: 'Cartão Débito',
  boleto: 'Boleto',
  cash: 'Dinheiro',
  card: 'Cartão',
  mixed: 'Misto',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const Reports = () => {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30d');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [posSales, setPOSSales] = useState<RawPOSSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [ordersRes, posRes] = await Promise.all([
      supabase.from('orders').select('id, status, total, customer_name, customer_email, payment_method, payment_status, items, created_at, shipping_address'),
      supabase.from('pos_sales').select('id, customer_name, total, subtotal, discount_amount, payment_method, items, created_at'),
    ]);
    setOrders((ordersRes.data || []).map(o => ({
      ...o,
      items: (o.items as any) || [],
      shipping_address: o.shipping_address as any,
    })));
    setPOSSales((posRes.data || []).map(s => ({
      ...s,
      items: (s.items as any) || [],
      total: Number(s.total),
      subtotal: Number(s.subtotal),
      discount_amount: s.discount_amount ? Number(s.discount_amount) : null,
    })));
    setIsLoading(false);
  };

  const dateRange = useMemo(() => {
    const now = new Date();
    if (periodFilter === 'custom' && customDateRange?.from) {
      return {
        start: startOfDay(customDateRange.from),
        end: customDateRange.to ? endOfDay(customDateRange.to) : endOfDay(customDateRange.from),
      };
    }
    switch (periodFilter) {
      case '7d': return { start: subDays(now, 7), end: now };
      case '30d': return { start: subDays(now, 30), end: now };
      case '90d': return { start: subDays(now, 90), end: now };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      default: return { start: subDays(now, 30), end: now };
    }
  }, [periodFilter, customDateRange]);

  const filteredOrders = useMemo(() =>
    orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= dateRange.start && d <= dateRange.end;
    }), [orders, dateRange]);

  const filteredPOS = useMemo(() =>
    posSales.filter(s => {
      const d = new Date(s.created_at);
      return d >= dateRange.start && d <= dateRange.end;
    }), [posSales, dateRange]);

  // === KPI Cards ===
  const kpis = useMemo(() => {
    const paidOrders = filteredOrders.filter(o => o.status !== 'cancelled');
    const deliveredOrders = filteredOrders.filter(o => o.status === 'delivered' || o.status === 'completed');
    const onlineRevenue = deliveredOrders.reduce((s, o) => s + Number(o.total), 0);
    const posRevenue = filteredPOS.reduce((s, p) => s + p.total, 0);
    const totalRevenue = onlineRevenue + posRevenue;
    const totalSales = paidOrders.length + filteredPOS.length;
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    const cancelledCount = filteredOrders.filter(o => o.status === 'cancelled').length;

    // Previous period comparison
    const daysDiff = differenceInDays(dateRange.end, dateRange.start) || 1;
    const prevStart = subDays(dateRange.start, daysDiff);
    const prevEnd = subDays(dateRange.end, daysDiff);
    const prevOrders = orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= prevStart && d <= prevEnd && (o.status === 'delivered' || o.status === 'completed');
    });
    const prevPOS = posSales.filter(s => {
      const d = new Date(s.created_at);
      return d >= prevStart && d <= prevEnd;
    });
    const prevRevenue = prevOrders.reduce((s, o) => s + Number(o.total), 0) + prevPOS.reduce((s, p) => s + p.total, 0);
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    return { totalRevenue, onlineRevenue, posRevenue, totalSales, avgTicket, cancelledCount, revenueChange };
  }, [filteredOrders, filteredPOS, orders, posSales, dateRange]);

  // === Sales Over Time ===
  const salesOverTime = useMemo(() => {
    const days = differenceInDays(dateRange.end, dateRange.start) || 1;
    const data: { name: string; online: number; pdv: number; total: number }[] = [];

    for (let i = 0; i <= days; i++) {
      const date = new Date(dateRange.start);
      date.setDate(date.getDate() + i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const onlineDay = filteredOrders
        .filter(o => { const d = new Date(o.created_at); return d >= dayStart && d <= dayEnd && o.status !== 'cancelled'; })
        .reduce((s, o) => s + Number(o.total), 0);

      const posDay = filteredPOS
        .filter(s => { const d = new Date(s.created_at); return d >= dayStart && d <= dayEnd; })
        .reduce((s, p) => s + p.total, 0);

      const label = days <= 7
        ? format(date, 'EEE', { locale: ptBR })
        : days <= 31
          ? format(date, 'dd/MM')
          : format(date, 'dd/MM');

      data.push({ name: label, online: onlineDay, pdv: posDay, total: onlineDay + posDay });
    }
    return data;
  }, [filteredOrders, filteredPOS, dateRange]);

  // === Top Products ===
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();

    const processItems = (items: any[], orderTotal?: number) => {
      if (!Array.isArray(items)) return;
      items.forEach((item: any) => {
        const name = item.name || item.product_name || 'Produto';
        const qty = Number(item.qty || item.quantity || 1);
        const price = Number(item.price || 0);
        const existing = map.get(name) || { name, qty: 0, revenue: 0 };
        existing.qty += qty;
        existing.revenue += price * qty;
        map.set(name, existing);
      });
    };

    filteredOrders.filter(o => o.status !== 'cancelled').forEach(o => processItems(o.items, Number(o.total)));
    filteredPOS.forEach(s => processItems(s.items));

    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredOrders, filteredPOS]);

  // === Top Customers ===
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; revenue: number }>();

    filteredOrders.filter(o => o.status !== 'cancelled').forEach(o => {
      const key = o.customer_email || o.customer_name || 'Anônimo';
      const name = o.customer_name || o.customer_email || 'Anônimo';
      const existing = map.get(key) || { name, orders: 0, revenue: 0 };
      existing.orders++;
      existing.revenue += Number(o.total);
      map.set(key, existing);
    });

    filteredPOS.forEach(s => {
      if (!s.customer_name) return;
      const key = s.customer_name;
      const existing = map.get(key) || { name: s.customer_name, orders: 0, revenue: 0 };
      existing.orders++;
      existing.revenue += s.total;
      map.set(key, existing);
    });

    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredOrders, filteredPOS]);

  // === Status Distribution ===
  const statusDistribution = useMemo(() => {
    const map = new Map<string, number>();
    filteredOrders.forEach(o => {
      map.set(o.status, (map.get(o.status) || 0) + 1);
    });
    return [...map.entries()].map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      fill: STATUS_COLORS[status] || 'hsl(var(--muted-foreground))',
    }));
  }, [filteredOrders]);

  // === Payment Methods ===
  const paymentDistribution = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();

    filteredOrders.filter(o => o.status !== 'cancelled').forEach(o => {
      const method = o.payment_method || 'outro';
      const existing = map.get(method) || { count: 0, total: 0 };
      existing.count++;
      existing.total += Number(o.total);
      map.set(method, existing);
    });

    filteredPOS.forEach(s => {
      const method = s.payment_method;
      const existing = map.get(method) || { count: 0, total: 0 };
      existing.count++;
      existing.total += s.total;
      map.set(method, existing);
    });

    return [...map.entries()]
      .map(([method, data], i) => ({
        name: PAYMENT_LABELS[method] || method,
        value: data.total,
        count: data.count,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredOrders, filteredPOS]);

  // === Sales by State ===
  const salesByState = useMemo(() => {
    const map = new Map<string, { state: string; revenue: number; orders: number }>();
    filteredOrders.filter(o => o.status !== 'cancelled').forEach(o => {
      const state = (o.shipping_address?.state || 'N/A');
      const existing = map.get(state) || { state, revenue: 0, orders: 0 };
      existing.orders++;
      existing.revenue += Number(o.total);
      map.set(state, existing);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredOrders]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6 animate-fade-in">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-80" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground mt-1">Análise de desempenho e métricas detalhadas</p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
              <SelectTrigger className="w-[160px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="month">Mês atual</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {periodFilter === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarRange className="h-4 w-4 mr-2" />
                    {customDateRange?.from
                      ? `${format(customDateRange.from, 'dd/MM')}${customDateRange.to ? ` - ${format(customDateRange.to, 'dd/MM')}` : ''}`
                      : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="range"
                    selected={customDateRange}
                    onSelect={setCustomDateRange}
                    locale={ptBR}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Receita Total</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.totalRevenue)}</p>
                  {kpis.revenueChange !== 0 && (
                    <div className={cn('flex items-center gap-1 text-xs mt-1', kpis.revenueChange > 0 ? 'text-green-600' : 'text-red-500')}>
                      {kpis.revenueChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(kpis.revenueChange).toFixed(1)}% vs período anterior
                    </div>
                  )}
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Vendas</p>
                  <p className="text-2xl font-bold text-foreground">{kpis.totalSales}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Online: {filteredOrders.filter(o => o.status !== 'cancelled').length} · PDV: {filteredPOS.length}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.avgTicket)}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cancelamentos</p>
                  <p className="text-2xl font-bold text-foreground">{kpis.cancelledCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {filteredOrders.length > 0
                      ? `${((kpis.cancelledCount / filteredOrders.length) * 100).toFixed(1)}% dos pedidos`
                      : '0% dos pedidos'}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales Chart */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-lg">Vendas por Dia</CardTitle>
            <CardDescription>Receita online vs PDV ao longo do período</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={salesOverTime}>
                <defs>
                  <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPDV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2, 160 60% 45%))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2, 160 60% 45%))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1).toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number, name: string) => [formatCurrency(value), name === 'online' ? 'Online' : 'PDV']}
                />
                <Legend formatter={(value) => value === 'online' ? 'Online' : 'PDV'} />
                <Area type="monotone" dataKey="online" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorOnline)" strokeWidth={2} />
                <Area type="monotone" dataKey="pdv" stroke="hsl(var(--chart-2, 160 60% 45%))" fillOpacity={1} fill="url(#colorPDV)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tabs: Products, Customers, Analysis */}
        <Tabs defaultValue="products" className="space-y-4">
          <TabsList>
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="customers">Clientes</TabsTrigger>
            <TabsTrigger value="analysis">Análise</TabsTrigger>
          </TabsList>

          {/* Top Products */}
          <TabsContent value="products" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg">Produtos Mais Vendidos</CardTitle>
                  <CardDescription>Por receita no período</CardDescription>
                </CardHeader>
                <CardContent>
                  {topProducts.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Sem dados no período</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={topProducts} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} className="fill-muted-foreground" />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(value: number) => [formatCurrency(value), 'Receita']}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg">Ranking de Produtos</CardTitle>
                  <CardDescription>Quantidade vendida e receita</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topProducts.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">Sem dados no período</p>
                    ) : (
                      topProducts.map((product, i) => (
                        <div key={product.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold',
                              i < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            )}>
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-foreground">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.qty} unidades</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-foreground">{formatCurrency(product.revenue)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Top Customers */}
          <TabsContent value="customers" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg">Clientes Top</CardTitle>
                  <CardDescription>Por receita no período</CardDescription>
                </CardHeader>
                <CardContent>
                  {topCustomers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Sem dados no período</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={topCustomers} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} className="fill-muted-foreground" />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(value: number) => [formatCurrency(value), 'Receita']}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--chart-2, 160 60% 45%))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg">Ranking de Clientes</CardTitle>
                  <CardDescription>Pedidos e receita total</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topCustomers.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">Sem dados no período</p>
                    ) : (
                      topCustomers.map((customer, i) => (
                        <div key={customer.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold',
                              i < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            )}>
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-foreground">{customer.name}</p>
                              <p className="text-xs text-muted-foreground">{customer.orders} pedidos</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-foreground">{formatCurrency(customer.revenue)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analysis */}
          <TabsContent value="analysis" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Status Pie */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg">Status dos Pedidos</CardTitle>
                  <CardDescription>Distribuição por status</CardDescription>
                </CardHeader>
                <CardContent>
                  {statusDistribution.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Sem dados no período</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {statusDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(value: number, name: string) => [value, name]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Payment Methods */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg">Métodos de Pagamento</CardTitle>
                  <CardDescription>Distribuição por receita</CardDescription>
                </CardHeader>
                <CardContent>
                  {paymentDistribution.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Sem dados no período</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={paymentDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {paymentDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Sales by State */}
              <Card className="card-elevated lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Vendas por Estado</CardTitle>
                  <CardDescription>Top estados por receita</CardDescription>
                </CardHeader>
                <CardContent>
                  {salesByState.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Sem dados no período</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={salesByState}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="state" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} className="fill-muted-foreground" />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(value: number, name: string) => [
                            name === 'revenue' ? formatCurrency(value) : value,
                            name === 'revenue' ? 'Receita' : 'Pedidos'
                          ]}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Reports;
