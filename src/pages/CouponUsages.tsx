import { useEffect, useMemo, useState, useCallback } from 'react';
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
import { Loader2, Search, Download, AlertTriangle, Tag, ArrowUp, ArrowDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SortKey = 'used_at' | 'coupon_code' | 'customer_email' | 'discount_applied' | 'order_total' | 'status';

// Columns the database can sort directly. Others fall back to used_at + page-level sort.
const SERVER_SORT_COLUMNS: Partial<Record<SortKey, string>> = {
  used_at: 'used_at',
  customer_email: 'customer_email',
  discount_applied: 'discount_applied',
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

  const [sortKey, setSortKey] = useState<SortKey>('used_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [totalCount, setTotalCount] = useState(0);
  const [totals, setTotals] = useState({ count: 0, totalDiscount: 0, duplicates: 0 });

  // Load all coupons once for filter dropdown
  useEffect(() => {
    supabase.from('coupons').select('id, code').order('code').then(({ data }) => {
      setCoupons(data ?? []);
    });
  }, []);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [from, to, couponFilter, statusFilter, search, showOnlyDuplicates, pageSize, sortKey, sortDir]);

  // Build the base filter chain on coupon_usage
  const buildFilteredQuery = useCallback(async (selectExpr: string, opts?: { count?: 'exact' }): Promise<any> => {
    const fromISO = new Date(`${from}T00:00:00`).toISOString();
    const toISO = new Date(`${to}T23:59:59`).toISOString();

    let query = supabase
      .from('coupon_usage')
      .select(selectExpr, opts?.count ? { count: opts.count } : undefined)
      .gte('used_at', fromISO)
      .lte('used_at', toISO);

    if (couponFilter !== 'all') {
      query = query.eq('coupon_id', couponFilter);
    }

    // Search: customer_email ilike, optional coupon code lookup, optional order_id exact
    if (search.trim()) {
      const q = search.trim();
      const orParts: string[] = [`customer_email.ilike.%${q}%`];

      // Lookup coupons matching code
      const { data: cps } = await supabase
        .from('coupons')
        .select('id')
        .ilike('code', `%${q}%`);
      const cIds = (cps ?? []).map((c: any) => c.id);
      if (cIds.length) orParts.push(`coupon_id.in.(${cIds.join(',')})`);

      if (UUID_RE.test(q)) orParts.push(`order_id.eq.${q}`);

      query = query.or(orParts.join(','));
    }

    // Status filter (requires resolving order ids)
    if (statusFilter === 'no-order') {
      query = query.is('order_id', null);
    } else if (statusFilter !== 'all') {
      let oQuery = supabase.from('orders').select('id');
      if (statusFilter === 'paid') {
        oQuery = oQuery.in('payment_status', ['approved', 'paid']);
      } else if (statusFilter === 'pending') {
        oQuery = oQuery.eq('payment_status', 'pending');
      } else if (statusFilter === 'cancelled') {
        oQuery = oQuery.or('status.eq.cancelled,payment_status.in.(cancelled,rejected)');
      }
      const { data: ods } = await oQuery.limit(10000);
      const ids = (ods ?? []).map((o: any) => o.id);
      if (!ids.length) return null;
      query = query.in('order_id', ids);
    }

    return query;
  }, [from, to, couponFilter, statusFilter, search]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const baseQuery = await buildFilteredQuery('*', { count: 'exact' });
      if (!baseQuery) {
        setRows([]); setTotalCount(0); setTotals({ count: 0, totalDiscount: 0, duplicates: 0 });
        return;
      }

      const orderCol = SERVER_SORT_COLUMNS[sortKey] ?? 'used_at';
      const ascending = SERVER_SORT_COLUMNS[sortKey] ? sortDir === 'asc' : false;

      const fromIdx = (page - 1) * pageSize;
      const toIdx = fromIdx + pageSize - 1;

      const { data: usages, count, error } = await baseQuery
        .order(orderCol, { ascending })
        .range(fromIdx, toIdx);

      if (error) throw error;

      const list = (usages ?? []) as any[];
      setTotalCount(count ?? 0);

      // Enrich with coupons + orders for the current page only
      const couponIds = Array.from(new Set(list.map((u) => u.coupon_id)));
      const orderIds = Array.from(new Set(list.map((u) => u.order_id).filter(Boolean) as string[]));

      const [couponsRes, ordersRes] = await Promise.all([
        couponIds.length
          ? supabase.from('coupons').select('id, code, description, max_uses_per_customer').in('id', couponIds)
          : Promise.resolve({ data: [] as any[] }),
        orderIds.length
          ? supabase.from('orders').select('id, status, payment_status, total').in('id', orderIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const couponMap = new Map<string, any>((couponsRes.data ?? []).map((c: any) => [c.id, c]));
      const orderMap = new Map<string, any>((ordersRes.data ?? []).map((o: any) => [o.id, o]));

      // Duplicate detection (current page only — accurate for visible rows when sorted by used_at)
      const counts = new Map<string, number>();
      list.forEach((u) => {
        const k = `${u.coupon_id}::${(u.customer_email || '').toLowerCase()}`;
        counts.set(k, (counts.get(k) || 0) + 1);
      });

      let mapped: UsageRow[] = list.map((u) => {
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

      // Page-level sort fallback for columns the DB can't sort
      if (!SERVER_SORT_COLUMNS[sortKey]) {
        const dir = sortDir === 'asc' ? 1 : -1;
        mapped = [...mapped].sort((a, b) => {
          let av: any; let bv: any;
          switch (sortKey) {
            case 'coupon_code': av = a.coupon_code; bv = b.coupon_code; break;
            case 'order_total': av = a.order_total ?? -1; bv = b.order_total ?? -1; break;
            case 'status': av = statusFor(a.payment_status, a.order_status).label; bv = statusFor(b.payment_status, b.order_status).label; break;
            default: av = 0; bv = 0;
          }
          if (av < bv) return -1 * dir;
          if (av > bv) return 1 * dir;
          return 0;
        });
      }

      if (showOnlyDuplicates) mapped = mapped.filter((r) => r.duplicate);

      setRows(mapped);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao carregar usos de cupons');
    } finally {
      setLoading(false);
    }
  }, [buildFilteredQuery, sortKey, sortDir, page, pageSize, showOnlyDuplicates]);

  // KPI aggregates (separate, lightweight query — uses same filters)
  const fetchAggregates = useCallback(async () => {
    try {
      const aggQuery = await buildFilteredQuery('coupon_id, customer_email, discount_applied');
      if (!aggQuery) {
        setTotals({ count: 0, totalDiscount: 0, duplicates: 0 });
        return;
      }
      const { data } = await aggQuery.limit(50000);
      const list = (data ?? []) as any[];

      // Need max_uses_per_customer to detect duplicates — fetch coupons referenced
      const couponIds = Array.from(new Set(list.map((u) => u.coupon_id)));
      let maxByCoupon = new Map<string, number | null>();
      if (couponIds.length) {
        const { data: cps } = await supabase
          .from('coupons')
          .select('id, max_uses_per_customer')
          .in('id', couponIds);
        maxByCoupon = new Map((cps ?? []).map((c: any) => [c.id, c.max_uses_per_customer]));
      }

      const counts = new Map<string, number>();
      list.forEach((u) => {
        const k = `${u.coupon_id}::${(u.customer_email || '').toLowerCase()}`;
        counts.set(k, (counts.get(k) || 0) + 1);
      });

      let totalDiscount = 0;
      let duplicates = 0;
      list.forEach((u) => {
        totalDiscount += Number(u.discount_applied || 0);
        const max = maxByCoupon.get(u.coupon_id);
        const k = `${u.coupon_id}::${(u.customer_email || '').toLowerCase()}`;
        if (max != null && (counts.get(k) || 0) > max) duplicates += 1;
      });

      setTotals({ count: list.length, totalDiscount, duplicates });
    } catch (err) {
      console.error('Aggregate error', err);
    }
  }, [buildFilteredQuery]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    fetchAggregates();
  }, [fetchAggregates]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'used_at' || key === 'discount_applied' || key === 'order_total' ? 'desc' : 'asc');
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);

  const SortHeader = ({ label, k, align = 'left' }: { label: string; k: SortKey; align?: 'left' | 'right' }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${align === 'right' ? 'flex-row-reverse' : ''}`}
    >
      {label}
      {sortKey === k ? (
        sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );

  const exportCSV = async () => {
    try {
      const aggQuery = await buildFilteredQuery('*');
      if (!aggQuery) return;
      const { data } = await aggQuery.order('used_at', { ascending: false }).limit(50000);
      const list = (data ?? []) as any[];

      const couponIds = Array.from(new Set(list.map((u) => u.coupon_id)));
      const orderIds = Array.from(new Set(list.map((u) => u.order_id).filter(Boolean) as string[]));
      const [cps, ods] = await Promise.all([
        couponIds.length
          ? supabase.from('coupons').select('id, code').in('id', couponIds)
          : Promise.resolve({ data: [] as any[] }),
        orderIds.length
          ? supabase.from('orders').select('id, status, payment_status, total').in('id', orderIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const cMap = new Map<string, any>((cps.data ?? []).map((c: any) => [c.id, c]));
      const oMap = new Map<string, any>((ods.data ?? []).map((o: any) => [o.id, o]));

      const header = ['Data', 'Cupom', 'Email', 'Pedido', 'Status', 'Desconto', 'Total Pedido'];
      const lines = list.map((u) => {
        const o = u.order_id ? oMap.get(u.order_id) : null;
        const s = statusFor(o?.payment_status ?? null, o?.status ?? null).label;
        return [
          format(new Date(u.used_at), 'dd/MM/yyyy HH:mm'),
          cMap.get(u.coupon_id)?.code ?? '—',
          u.customer_email,
          u.order_id ?? '',
          s,
          Number(u.discount_applied || 0).toFixed(2).replace('.', ','),
          o?.total ? Number(o.total).toFixed(2).replace('.', ',') : '',
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
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar CSV');
    }
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
          <Button variant="outline" onClick={exportCSV} disabled={!totalCount}>
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
                {showOnlyDuplicates ? 'Mostrando apenas duplicadas (página atual)' : 'Apenas duplicadas (página atual)'}
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
            ) : totalCount === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                Nenhum uso de cupom encontrado para os filtros aplicados.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead><SortHeader label="Data" k="used_at" /></TableHead>
                        <TableHead><SortHeader label="Cupom" k="coupon_code" /></TableHead>
                        <TableHead><SortHeader label="Cliente" k="customer_email" /></TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead><SortHeader label="Status" k="status" /></TableHead>
                        <TableHead className="text-right"><SortHeader label="Desconto" k="discount_applied" align="right" /></TableHead>
                        <TableHead className="text-right"><SortHeader label="Total Pedido" k="order_total" align="right" /></TableHead>
                        <TableHead>Alerta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => {
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando{' '}
                    <span className="font-medium text-foreground">
                      {(currentPage - 1) * pageSize + 1}
                      {'–'}
                      {Math.min(currentPage * pageSize, totalCount)}
                    </span>{' '}
                    de <span className="font-medium text-foreground">{totalCount}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Por página</span>
                      <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                        <SelectTrigger className="w-[80px] h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[10, 25, 50, 100, 200].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline" size="icon" className="h-8 w-8"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm px-2">
                        Página <span className="font-medium">{currentPage}</span> de{' '}
                        <span className="font-medium">{totalPages}</span>
                      </span>
                      <Button
                        variant="outline" size="icon" className="h-8 w-8"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default CouponUsages;
