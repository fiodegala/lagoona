import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Search, Download, AlertTriangle, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UsageRow {
  id: string;
  coupon_id: string;
  order_id: string | null;
  customer_email: string;
  discount_applied: number;
  used_at: string;
  coupon_code: string;
  coupon_description: string | null;
  max_per_customer: number | null;
  order_status: string | null;
  payment_status: string | null;
  order_total: number | null;
  duplicate: boolean;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const statusFor = (paymentStatus: string | null, orderStatus: string | null) => {
  if (!paymentStatus && !orderStatus) return { label: 'Sem pedido', variant: 'outline' as const };
  if (paymentStatus === 'approved' || paymentStatus === 'paid')
    return { label: 'Pago', variant: 'default' as const };
  if (orderStatus === 'cancelled' || paymentStatus === 'cancelled' || paymentStatus === 'rejected')
    return { label: 'Cancelado', variant: 'destructive' as const };
  return { label: 'Pendente', variant: 'secondary' as const };
};

const CouponUsages = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [coupons, setCoupons] = useState<{ id: string; code: string }[]>([]);

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 3600 * 1000);

  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [couponFilter, setCouponFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const fromISO = new Date(`${from}T00:00:00`).toISOString();
      const toISO = new Date(`${to}T23:59:59`).toISOString();

      const { data: usages, error: usageErr } = await supabase
        .from('coupon_usage')
        .select('*')
        .gte('used_at', fromISO)
        .lte('used_at', toISO)
        .order('used_at', { ascending: false });
      if (usageErr) throw usageErr;

      const couponIds = Array.from(new Set((usages ?? []).map((u) => u.coupon_id)));
      const orderIds = Array.from(
        new Set((usages ?? []).map((u) => u.order_id).filter(Boolean) as string[]),
      );

      const [couponsRes, ordersRes, allCouponsRes] = await Promise.all([
        couponIds.length
          ? supabase
              .from('coupons')
              .select('id, code, description, max_uses_per_customer')
              .in('id', couponIds)
          : Promise.resolve({ data: [], error: null } as any),
        orderIds.length
          ? supabase
              .from('orders')
              .select('id, status, payment_status, total')
              .in('id', orderIds)
          : Promise.resolve({ data: [], error: null } as any),
        supabase.from('coupons').select('id, code').order('code'),
      ]);

      if (couponsRes.error) throw couponsRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (allCouponsRes.error) throw allCouponsRes.error;

      const couponMap = new Map<string, any>((couponsRes.data ?? []).map((c: any) => [c.id, c]));
      const orderMap = new Map<string, any>((ordersRes.data ?? []).map((o: any) => [o.id, o]));

      // Detect duplicates: same (coupon_id + customer_email) appearing more than allowed
      const counts = new Map<string, number>();
      (usages ?? []).forEach((u) => {
        const k = `${u.coupon_id}::${(u.customer_email || '').toLowerCase()}`;
        counts.set(k, (counts.get(k) || 0) + 1);
      });

      const mapped: UsageRow[] = (usages ?? []).map((u) => {
        const c = couponMap.get(u.coupon_id);
        const o = u.order_id ? orderMap.get(u.order_id) : null;
        const k = `${u.coupon_id}::${(u.customer_email || '').toLowerCase()}`;
        const max = c?.max_uses_per_customer ?? null;
        const duplicate = max != null && (counts.get(k) || 0) > max;
        return {
          id: u.id,
          coupon_id: u.coupon_id,
          order_id: u.order_id,
          customer_email: u.customer_email,
          discount_applied: Number(u.discount_applied || 0),
          used_at: u.used_at,
          coupon_code: c?.code ?? '—',
          coupon_description: c?.description ?? null,
          max_per_customer: max,
          order_status: o?.status ?? null,
          payment_status: o?.payment_status ?? null,
          order_total: o?.total ? Number(o.total) : null,
          duplicate,
        };
      });

      setRows(mapped);
      setCoupons(allCouponsRes.data ?? []);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao carregar usos de cupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (couponFilter !== 'all' && r.coupon_id !== couponFilter) return false;
      if (showOnlyDuplicates && !r.duplicate) return false;
      if (statusFilter !== 'all') {
        const s = statusFor(r.payment_status, r.order_status).label.toLowerCase();
        if (statusFilter === 'paid' && s !== 'pago') return false;
        if (statusFilter === 'pending' && s !== 'pendente') return false;
        if (statusFilter === 'cancelled' && s !== 'cancelado') return false;
        if (statusFilter === 'no-order' && s !== 'sem pedido') return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.customer_email.toLowerCase().includes(q) &&
          !r.coupon_code.toLowerCase().includes(q) &&
          !(r.order_id || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rows, couponFilter, statusFilter, search, showOnlyDuplicates]);

  const totals = useMemo(() => {
    const totalDiscount = filtered.reduce((s, r) => s + r.discount_applied, 0);
    const duplicates = filtered.filter((r) => r.duplicate).length;
    return { count: filtered.length, totalDiscount, duplicates };
  }, [filtered]);

  const exportCSV = () => {
    const header = [
      'Data', 'Cupom', 'Email', 'Pedido', 'Status', 'Desconto', 'Total Pedido', 'Duplicada',
    ];
    const lines = filtered.map((r) => {
      const s = statusFor(r.payment_status, r.order_status).label;
      return [
        format(new Date(r.used_at), 'dd/MM/yyyy HH:mm'),
        r.coupon_code,
        r.customer_email,
        r.order_id ?? '',
        s,
        r.discount_applied.toFixed(2).replace('.', ','),
        r.order_total != null ? r.order_total.toFixed(2).replace('.', ',') : '',
        r.duplicate ? 'Sim' : 'Não',
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';');
    });
    const csv = [header.join(';'), ...lines].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usos-cupons-${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Tag className="h-7 w-7" /> Usos de Cupons
            </h1>
            <p className="text-muted-foreground">
              Auditoria de aplicações de cupons por pedido, cliente e campanha.
            </p>
          </div>
          <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total de usos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totals.count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Desconto aplicado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(totals.totalDiscount)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Tentativas duplicadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{totals.duplicates}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <Label>De</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label>Até</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div>
                <Label>Campanha (cupom)</Label>
                <Select value={couponFilter} onValueChange={setCouponFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {coupons.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="no-order">Sem pedido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label>Buscar (email, código, pedido)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pesquisar..."
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button
                variant={showOnlyDuplicates ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowOnlyDuplicates((v) => !v)}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                {showOnlyDuplicates ? 'Mostrando apenas duplicadas' : 'Apenas duplicadas'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                Nenhum uso de cupom encontrado para os filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cupom</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Desconto</TableHead>
                      <TableHead className="text-right">Total Pedido</TableHead>
                      <TableHead>Alerta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const s = statusFor(r.payment_status, r.order_status);
                      return (
                        <TableRow key={r.id} className={r.duplicate ? 'bg-destructive/5' : ''}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(r.used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{r.coupon_code}</div>
                            {r.coupon_description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {r.coupon_description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{r.customer_email}</TableCell>
                          <TableCell>
                            {r.order_id ? (
                              <code className="text-xs">{r.order_id.slice(0, 8)}</code>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={s.variant}>{s.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(r.discount_applied)}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.order_total != null ? formatCurrency(r.order_total) : '—'}
                          </TableCell>
                          <TableCell>
                            {r.duplicate && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Duplicada
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

export default CouponUsages;
