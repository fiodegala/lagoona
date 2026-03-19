import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, TrendingUp, Users, ShoppingCart, Package,
  Calendar, CalendarRange, DollarSign, ArrowUpRight, ArrowDownRight,
  Download, FileSpreadsheet, FileText, Tag, Star
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
  user_id: string;
  total: number;
  subtotal: number;
  discount_amount: number | null;
  payment_method: string;
  status: string;
  sale_type: string | null;
  notes: string | null;
  items: { name?: string; qty?: number; price?: number; product_id?: string }[];
  created_at: string;
}

interface SellerOption {
  user_id: string;
  full_name: string;
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
  const { user } = useAuth();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30d');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [posSales, setPOSSales] = useState<RawPOSSale[]>([]);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [ordersRes, posRes, rolesRes] = await Promise.all([
      supabase.from('orders').select('id, status, total, customer_name, customer_email, payment_method, payment_status, items, created_at, shipping_address'),
      supabase.from('pos_sales').select('id, customer_name, user_id, total, subtotal, discount_amount, payment_method, status, items, created_at, notes, sale_type'),
      supabase.from('user_roles').select('user_id'),
    ]);
    setOrders((ordersRes.data || []).map(o => ({
      ...o,
      items: (o.items as any) || [],
      shipping_address: o.shipping_address as any,
    })));
    setPOSSales((posRes.data || []).map(s => ({
      ...s,
      items: (s.items as any) || [],
      user_id: s.user_id,
      total: Number(s.total),
      subtotal: Number(s.subtotal),
      discount_amount: s.discount_amount ? Number(s.discount_amount) : null,
      sale_type: (s as any).sale_type || null,
      notes: s.notes || null,
    })));
    // Fetch seller profiles
    if (rolesRes.data && rolesRes.data.length > 0) {
      const userIds = [...new Set(rolesRes.data.map(r => r.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      if (profiles) {
        setSellers(profiles.map(p => ({ user_id: p.user_id, full_name: p.full_name })));
      }
    }
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
      if (s.status === 'cancelled') return false;
      if (selectedSellerId !== 'all' && s.user_id !== selectedSellerId) return false;
      const d = new Date(s.created_at);
      return d >= dateRange.start && d <= dateRange.end;
    }), [posSales, dateRange, selectedSellerId]);

  // === KPI Cards ===
  const kpis = useMemo(() => {
    const paidOrders = filteredOrders.filter(o => o.status !== 'cancelled' && o.status !== 'pending');
    const deliveredOrders = filteredOrders.filter(o => ['confirmed', 'completed', 'delivered', 'processing', 'shipped'].includes(o.status));
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
      return d >= prevStart && d <= prevEnd && ['confirmed', 'completed', 'delivered', 'processing', 'shipped'].includes(o.status);
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
        .filter(o => { const d = new Date(o.created_at); return d >= dayStart && d <= dayEnd && o.status !== 'cancelled' && o.status !== 'pending'; })
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

  // === Promotional Sales ===
  const promotionalStats = useMemo(() => {
    const promoItems: { name: string; qty: number; totalValue: number; paymentMethod: string }[] = [];

    filteredPOS.forEach(sale => {
      (sale.items || []).forEach((item: any) => {
        if (item.is_promotional) {
          promoItems.push({
            name: item.name || 'Produto',
            qty: item.quantity || item.qty || 1,
            totalValue: item.total || (item.unit_price || 0) * (item.quantity || item.qty || 1),
            paymentMethod: sale.payment_method,
          });
        }
      });
    });

    filteredOrders.filter(o => o.status !== 'cancelled').forEach(order => {
      (order.items || []).forEach((item: any) => {
        if (item.is_promotional) {
          promoItems.push({
            name: item.name || 'Produto',
            qty: item.quantity || item.qty || 1,
            totalValue: (item.price || 0) * (item.quantity || item.qty || 1),
            paymentMethod: order.payment_method || 'online',
          });
        }
      });
    });

    const byProduct: Record<string, { qty: number; total: number }> = {};
    promoItems.forEach(item => {
      if (!byProduct[item.name]) byProduct[item.name] = { qty: 0, total: 0 };
      byProduct[item.name].qty += item.qty;
      byProduct[item.name].total += item.totalValue;
    });

    const byPayment: Record<string, { count: number; total: number }> = {};
    promoItems.forEach(item => {
      const label = PAYMENT_LABELS[item.paymentMethod] || item.paymentMethod;
      if (!byPayment[label]) byPayment[label] = { count: 0, total: 0 };
      byPayment[label].count += item.qty;
      byPayment[label].total += item.totalValue;
    });

    return {
      totalQty: promoItems.reduce((s, i) => s + i.qty, 0),
      totalValue: promoItems.reduce((s, i) => s + i.totalValue, 0),
      products: Object.entries(byProduct).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total),
      payments: Object.entries(byPayment).map(([method, d]) => ({ method, ...d })).sort((a, b) => b.total - a.total),
    };
  }, [filteredPOS, filteredOrders]);

  // Sales by Modality & Exchange metrics
  const modalityStats = useMemo(() => {
    const modalities: Record<string, { count: number; total: number }> = {
      varejo: { count: 0, total: 0 },
      atacado: { count: 0, total: 0 },
      exclusivo: { count: 0, total: 0 },
      colaborador: { count: 0, total: 0 },
    };
    const exchanges = { count: 0, creditGenerated: 0, cashReceived: 0 };

    filteredPOS.forEach(sale => {
      const saleType = sale.sale_type || (sale.notes?.startsWith('TROCA') ? 'troca' : 'varejo');

      if (saleType === 'troca') {
        exchanges.count++;
        const discountAmt = Number(sale.discount_amount || 0);
        const saleTotal = Number(sale.total);
        if (saleTotal > 0) {
          exchanges.cashReceived += saleTotal;
        }
        if (discountAmt > 0 && saleTotal === 0) {
          exchanges.creditGenerated += discountAmt;
        }
      } else if (modalities[saleType]) {
        modalities[saleType].count += 1;
        modalities[saleType].total += Number(sale.total);
      } else {
        modalities.varejo.count += 1;
        modalities.varejo.total += Number(sale.total);
      }
    });

    return { modalities, exchanges };
  }, [filteredPOS]);

  // Individual sales (current user only) vs store total
  const individualStats = useMemo(() => {
    if (!user) return { mySales: 0, myRevenue: 0, myTicket: 0, storeSales: 0, storeRevenue: 0, storeTicket: 0 };
    const mySales = filteredPOS.filter(s => s.user_id === user.id);
    const myRevenue = mySales.reduce((sum, s) => sum + s.total, 0);
    const storeSales = filteredPOS.length;
    const storeRevenue = filteredPOS.reduce((sum, s) => sum + s.total, 0);
    return {
      mySales: mySales.length,
      myRevenue,
      myTicket: mySales.length > 0 ? myRevenue / mySales.length : 0,
      storeSales,
      storeRevenue,
      storeTicket: storeSales > 0 ? storeRevenue / storeSales : 0,
    };
  }, [filteredPOS, user]);

  const exportToCSV = () => {
    const BOM = '\uFEFF';
    let csv = BOM + 'Relatório de Vendas\n';
    csv += `Período: ${format(dateRange.start, 'dd/MM/yyyy')} - ${format(dateRange.end, 'dd/MM/yyyy')}\n\n`;

    // KPIs
    csv += 'Resumo\n';
    csv += `Receita Total;${kpis.totalRevenue.toFixed(2)}\n`;
    csv += `Receita Online;${kpis.onlineRevenue.toFixed(2)}\n`;
    csv += `Receita PDV;${kpis.posRevenue.toFixed(2)}\n`;
    csv += `Total de Vendas;${kpis.totalSales}\n`;
    csv += `Ticket Médio;${kpis.avgTicket.toFixed(2)}\n`;
    csv += `Cancelamentos;${kpis.cancelledCount}\n\n`;

    // Sales over time
    csv += 'Vendas por Dia\n';
    csv += 'Data;Online;PDV;Total\n';
    salesOverTime.forEach(d => {
      csv += `${d.name};${d.online.toFixed(2)};${d.pdv.toFixed(2)};${d.total.toFixed(2)}\n`;
    });
    csv += '\n';

    // Top products
    csv += 'Top Produtos\n';
    csv += 'Produto;Quantidade;Receita\n';
    topProducts.forEach(p => {
      csv += `${p.name};${p.qty};${p.revenue.toFixed(2)}\n`;
    });
    csv += '\n';

    // Top customers
    csv += 'Top Clientes\n';
    csv += 'Cliente;Pedidos;Receita\n';
    topCustomers.forEach(c => {
      csv += `${c.name};${c.orders};${c.revenue.toFixed(2)}\n`;
    });
    csv += '\n';

    // Payment methods
    csv += 'Métodos de Pagamento\n';
    csv += 'Método;Quantidade;Valor\n';
    paymentDistribution.forEach(p => {
      csv += `${p.name};${p.count};${p.value.toFixed(2)}\n`;
    });
    csv += '\n';

    // Sales by state
    csv += 'Vendas por Estado\n';
    csv += 'Estado;Pedidos;Receita\n';
    salesByState.forEach(s => {
      csv += `${s.state};${s.orders};${s.revenue.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-vendas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html><head>
        <meta charset="utf-8">
        <title>Relatório de Vendas</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 16px; margin-top: 24px; border-bottom: 2px solid #eee; padding-bottom: 4px; }
          .subtitle { color: #777; font-size: 13px; margin-bottom: 20px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
          .kpi { border: 1px solid #eee; border-radius: 8px; padding: 12px; }
          .kpi-label { font-size: 11px; color: #888; }
          .kpi-value { font-size: 20px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 13px; }
          th { text-align: left; background: #f5f5f5; padding: 8px; border: 1px solid #ddd; }
          td { padding: 8px; border: 1px solid #ddd; }
          tr:nth-child(even) { background: #fafafa; }
          .text-right { text-align: right; }
          @media print { body { padding: 20px; } }
        </style>
      </head><body>
        <h1>Relatório de Vendas</h1>
        <p class="subtitle">${format(dateRange.start, 'dd/MM/yyyy')} - ${format(dateRange.end, 'dd/MM/yyyy')}</p>

        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-label">Receita Total</div><div class="kpi-value">${formatCurrency(kpis.totalRevenue)}</div></div>
          <div class="kpi"><div class="kpi-label">Total de Vendas</div><div class="kpi-value">${kpis.totalSales}</div></div>
          <div class="kpi"><div class="kpi-label">Ticket Médio</div><div class="kpi-value">${formatCurrency(kpis.avgTicket)}</div></div>
          <div class="kpi"><div class="kpi-label">Cancelamentos</div><div class="kpi-value">${kpis.cancelledCount}</div></div>
        </div>

        <h2>Top 10 Produtos</h2>
        <table>
          <thead><tr><th>#</th><th>Produto</th><th class="text-right">Qtd</th><th class="text-right">Receita</th></tr></thead>
          <tbody>${topProducts.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td class="text-right">${p.qty}</td><td class="text-right">${formatCurrency(p.revenue)}</td></tr>`).join('')}</tbody>
        </table>

        <h2>Top 10 Clientes</h2>
        <table>
          <thead><tr><th>#</th><th>Cliente</th><th class="text-right">Pedidos</th><th class="text-right">Receita</th></tr></thead>
          <tbody>${topCustomers.map((c, i) => `<tr><td>${i + 1}</td><td>${c.name}</td><td class="text-right">${c.orders}</td><td class="text-right">${formatCurrency(c.revenue)}</td></tr>`).join('')}</tbody>
        </table>

        <h2>Métodos de Pagamento</h2>
        <table>
          <thead><tr><th>Método</th><th class="text-right">Quantidade</th><th class="text-right">Valor</th></tr></thead>
          <tbody>${paymentDistribution.map(p => `<tr><td>${p.name}</td><td class="text-right">${p.count}</td><td class="text-right">${formatCurrency(p.value)}</td></tr>`).join('')}</tbody>
        </table>

        <h2>Vendas por Estado</h2>
        <table>
          <thead><tr><th>Estado</th><th class="text-right">Pedidos</th><th class="text-right">Receita</th></tr></thead>
          <tbody>${salesByState.map(s => `<tr><td>${s.state}</td><td class="text-right">${s.orders}</td><td class="text-right">${formatCurrency(s.revenue)}</td></tr>`).join('')}</tbody>
        </table>

        <script>window.onload = () => { window.print(); }</script>
      </body></html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Seller Filter */}
            {sellers.length > 0 && (
              <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                <SelectTrigger className="w-[170px]">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Todos vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos vendedores</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.user_id} value={seller.user_id}>{seller.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

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
            <TabsTrigger value="modality">Modalidades</TabsTrigger>
            <TabsTrigger value="promotional">Promoções</TabsTrigger>
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

          {/* Modality Sales */}
          <TabsContent value="modality" className="space-y-4">
            {/* Individual vs Store Sales */}
            {selectedSellerId === 'all' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="card-elevated border-l-4 border-l-primary">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Minhas Vendas</span>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(individualStats.myRevenue)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {individualStats.mySales} vendas • Ticket: {formatCurrency(individualStats.myTicket)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="card-elevated border-l-4 border-l-success">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium">Total da Loja</span>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(individualStats.storeRevenue)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {individualStats.storeSales} vendas • Ticket: {formatCurrency(individualStats.storeTicket)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Varejo */}
              <Card className="card-elevated border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Varejo</span>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(modalityStats.modalities.varejo.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {modalityStats.modalities.varejo.count} vendas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ticket: {formatCurrency(modalityStats.modalities.varejo.count > 0 ? modalityStats.modalities.varejo.total / modalityStats.modalities.varejo.count : 0)}
                  </p>
                </CardContent>
              </Card>

              {/* Atacado */}
              <Card className="card-elevated border-l-4" style={{ borderLeftColor: 'hsl(var(--chart-2, 160 60% 45%))' }}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">Atacado</span>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(modalityStats.modalities.atacado.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {modalityStats.modalities.atacado.count} vendas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ticket: {formatCurrency(modalityStats.modalities.atacado.count > 0 ? modalityStats.modalities.atacado.total / modalityStats.modalities.atacado.count : 0)}
                  </p>
                </CardContent>
              </Card>

              {/* Exclusivo */}
              <Card className="card-elevated border-l-4 border-l-warning">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-4 w-4 text-warning" />
                    <span className="text-sm font-medium">Exclusivo</span>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(modalityStats.modalities.exclusivo.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {modalityStats.modalities.exclusivo.count} vendas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ticket: {formatCurrency(modalityStats.modalities.exclusivo.count > 0 ? modalityStats.modalities.exclusivo.total / modalityStats.modalities.exclusivo.count : 0)}
                  </p>
                </CardContent>
              </Card>

              {/* Trocas */}
              <Card className="card-elevated border-l-4 border-l-destructive">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">Trocas</span>
                  </div>
                  <p className="text-2xl font-bold">{modalityStats.exchanges.count}</p>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <p>Crédito gerado: {formatCurrency(modalityStats.exchanges.creditGenerated)}</p>
                    <p>Diferença no caixa: {formatCurrency(modalityStats.exchanges.cashReceived)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Modality Pie Chart */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-lg">Distribuição por Modalidade</CardTitle>
                <CardDescription>Proporção de receita por tipo de venda</CardDescription>
              </CardHeader>
              <CardContent>
                {(modalityStats.modalities.varejo.total + modalityStats.modalities.atacado.total + modalityStats.modalities.exclusivo.total) === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Sem dados no período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Varejo', value: modalityStats.modalities.varejo.total, fill: 'hsl(var(--primary))' },
                          { name: 'Atacado', value: modalityStats.modalities.atacado.total, fill: 'hsl(var(--chart-2, 160 60% 45%))' },
                          { name: 'Exclusivo', value: modalityStats.modalities.exclusivo.total, fill: 'hsl(var(--chart-3, 30 80% 55%))' },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {[
                          { name: 'Varejo', value: modalityStats.modalities.varejo.total, fill: 'hsl(var(--primary))' },
                          { name: 'Atacado', value: modalityStats.modalities.atacado.total, fill: 'hsl(var(--chart-2, 160 60% 45%))' },
                          { name: 'Exclusivo', value: modalityStats.modalities.exclusivo.total, fill: 'hsl(var(--chart-3, 30 80% 55%))' },
                        ].filter(d => d.value > 0).map((entry, i) => (
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
          </TabsContent>

          {/* Analysis */}
          {/* Promotional Sales */}
          <TabsContent value="promotional" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Summary */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tag className="h-5 w-5 text-warning" />
                    Resumo Promocional
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-warning/5 rounded-lg border border-warning/20">
                    <div>
                      <p className="text-sm text-muted-foreground">Itens vendidos</p>
                      <p className="text-2xl font-bold">{promotionalStats.totalQty}</p>
                    </div>
                    <Package className="h-8 w-8 text-warning/60" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div>
                      <p className="text-sm text-muted-foreground">Valor total</p>
                      <p className="text-2xl font-bold">{formatCurrency(promotionalStats.totalValue)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-primary/60" />
                  </div>
                  {promotionalStats.totalQty === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma venda promocional no período
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Products */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg">Produtos em Promoção</CardTitle>
                  <CardDescription>Ranking por faturamento</CardDescription>
                </CardHeader>
                <CardContent>
                  {promotionalStats.products.length > 0 ? (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {promotionalStats.products.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="font-bold text-muted-foreground w-5">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.qty} un. vendidas</p>
                            </div>
                          </div>
                          <span className="font-semibold ml-2 shrink-0">{formatCurrency(p.total)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                  )}
                </CardContent>
              </Card>

              {/* Payment Methods */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg">Formas de Pagamento</CardTitle>
                  <CardDescription>Vendas promocionais por método</CardDescription>
                </CardHeader>
                <CardContent>
                  {promotionalStats.payments.length > 0 ? (
                    <div className="space-y-3">
                      {promotionalStats.payments.map((pm, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                          <span>{pm.method}</span>
                          <div className="text-right">
                            <span className="font-semibold">{formatCurrency(pm.total)}</span>
                            <span className="text-xs text-muted-foreground ml-1">({pm.count} itens)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                  )}
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
