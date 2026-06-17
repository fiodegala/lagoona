import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Store as StoreIcon, ShoppingBag } from 'lucide-react';
import { startOfMonth, endOfMonth, format, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WEBSITE_STORE_ID = 'e0b8ebbc-1b3b-4aec-b5f7-6925762e6ea1';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dayKey = (iso: string) => iso.slice(0, 10);

interface PosSale {
  id: string;
  user_id: string | null;
  seller_id: string | null;
  total: number;
  status: string | null;
  store_id: string | null;
  payment_details: any;
  notes: string | null;
  customer_name: string | null;
  created_at: string;
}
interface OrderRow {
  id: string;
  total: number;
  status: string | null;
  payment_status: string | null;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
}
interface Store { id: string; name: string; type: string; }
interface Profile { user_id: string; full_name: string; }

type Classification = 'site' | 'pdv';

function classifyPosSale(s: PosSale, storesById: Map<string, Store>): { kind: Classification; flag?: string } {
  const origin = s.payment_details?.sale_origin as string | undefined;
  const store = s.store_id ? storesById.get(s.store_id) : undefined;
  const isOnlineStore = store && (store.type === 'online' || store.type === 'website');
  if (origin === 'online') {
    return { kind: 'site', flag: isOnlineStore ? undefined : 'Marcada como site, mas loja é presencial' };
  }
  if (origin === 'presencial') {
    return { kind: 'pdv' };
  }
  // origin undefined
  if (isOnlineStore) {
    return { kind: 'site', flag: 'Origem não definida (loja online): conferir se é site ou WhatsApp/PDV' };
  }
  return { kind: 'pdv' };
}

export default function PdvSiteReport() {
  const [monthStart, setMonthStart] = useState<Date>(startOfMonth(new Date()));
  const monthEnd = endOfMonth(monthStart);

  const { data: stores = [] } = useQuery({
    queryKey: ['pdv-site-stores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stores').select('id, name, type');
      if (error) throw error;
      return (data || []) as Store[];
    },
  });
  const storesById = useMemo(() => new Map(stores.map(s => [s.id, s])), [stores]);

  const { data: profiles = [] } = useQuery({
    queryKey: ['pdv-site-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name');
      if (error) throw error;
      return (data || []) as Profile[];
    },
  });
  const nameByUser = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach(p => m.set(p.user_id, p.full_name || 'Sem nome'));
    return m;
  }, [profiles]);

  const { data: posSales = [], isLoading: loadingPos } = useQuery({
    queryKey: ['pdv-site-pos', monthStart.toISOString()],
    queryFn: async () => {
      const all: PosSale[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('pos_sales')
          .select('id,user_id,seller_id,total,status,store_id,payment_details,notes,customer_name,created_at')
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString())
          .neq('status', 'cancelled')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = (data || []) as PosSale[];
        all.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['pdv-site-orders', monthStart.toISOString()],
    queryFn: async () => {
      const all: OrderRow[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('orders')
          .select('id,total,status,payment_status,customer_name,customer_email,created_at')
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString())
          .neq('status', 'cancelled')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = (data || []) as OrderRow[];
        all.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

  const report = useMemo(() => {
    const totals = { pdv: 0, site: 0 };
    const perSeller = new Map<string, { name: string; pdv: number; site: number; pdvCount: number; siteCount: number; flags: number }>();
    const perDay = new Map<string, { date: string; pdv: number; site: number; pdvCount: number; siteCount: number; flags: number }>();
    const flagged: Array<{ id: string; date: string; seller: string; customer: string; total: number; kind: Classification; flag: string; source: 'pos' | 'site' }> = [];

    const bumpSeller = (userId: string, kind: Classification, total: number, flagged?: boolean) => {
      const name = nameByUser.get(userId) || 'Sem vendedor';
      const key = userId || 'sem-vendedor';
      const row = perSeller.get(key) || { name, pdv: 0, site: 0, pdvCount: 0, siteCount: 0, flags: 0 };
      row[kind] += total;
      if (kind === 'pdv') row.pdvCount++; else row.siteCount++;
      if (flagged) row.flags++;
      perSeller.set(key, row);
    };
    const bumpDay = (iso: string, kind: Classification, total: number, flagged?: boolean) => {
      const d = dayKey(iso);
      const row = perDay.get(d) || { date: d, pdv: 0, site: 0, pdvCount: 0, siteCount: 0, flags: 0 };
      row[kind] += total;
      if (kind === 'pdv') row.pdvCount++; else row.siteCount++;
      if (flagged) row.flags++;
      perDay.set(d, row);
    };

    posSales.forEach(s => {
      const { kind, flag } = classifyPosSale(s, storesById);
      const total = Number(s.total) || 0;
      totals[kind] += total;
      const uid = s.seller_id || s.user_id || '';
      bumpSeller(uid, kind, total, !!flag);
      bumpDay(s.created_at, kind, total, !!flag);
      if (flag) {
        flagged.push({
          id: s.id,
          date: s.created_at,
          seller: nameByUser.get(uid) || 'Sem vendedor',
          customer: s.customer_name || '-',
          total,
          kind,
          flag,
          source: 'pos',
        });
      }
    });

    // Orders count fully as site (no seller attribution)
    orders.forEach(o => {
      const total = Number(o.total) || 0;
      totals.site += total;
      const row = perSeller.get('site-online') || { name: 'Site (sem vendedor)', pdv: 0, site: 0, pdvCount: 0, siteCount: 0, flags: 0 };
      row.site += total;
      row.siteCount++;
      perSeller.set('site-online', row);
      bumpDay(o.created_at, 'site', total, false);
    });

    // Cross-source duplicate detection: order + pos_sale (site-classified) same day, same customer, value within R$ 0.50
    const sitePos = posSales
      .map(s => ({ s, c: classifyPosSale(s, storesById) }))
      .filter(x => x.c.kind === 'site');
    orders.forEach(o => {
      const day = dayKey(o.created_at);
      const match = sitePos.find(x =>
        dayKey(x.s.created_at) === day &&
        Math.abs((Number(x.s.total) || 0) - (Number(o.total) || 0)) < 0.5 &&
        (x.s.customer_name || '').trim().toLowerCase() === (o.customer_name || '').trim().toLowerCase() &&
        (o.customer_name || '').trim() !== ''
      );
      if (match) {
        flagged.push({
          id: o.id,
          date: o.created_at,
          seller: '—',
          customer: o.customer_name || '-',
          total: Number(o.total) || 0,
          kind: 'site',
          flag: `Possível duplicidade com venda PDV ${match.s.id.slice(0, 8)}`,
          source: 'site',
        });
        const day = dayKey(o.created_at);
        const dr = perDay.get(day);
        if (dr) dr.flags++;
      }
    });

    return {
      totals,
      perSeller: Array.from(perSeller.values()).sort((a, b) => (b.pdv + b.site) - (a.pdv + a.site)),
      perDay: Array.from(perDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
      flagged: flagged.sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [posSales, orders, storesById, nameByUser]);

  const exportCSV = () => {
    const rows: string[] = [];
    rows.push('Vendedor;PDV;Site;Total;# Vendas PDV;# Vendas Site;Discrepâncias');
    report.perSeller.forEach(r => {
      const total = r.pdv + r.site;
      rows.push([r.name, r.pdv.toFixed(2).replace('.', ','), r.site.toFixed(2).replace('.', ','), total.toFixed(2).replace('.', ','), r.pdvCount, r.siteCount, r.flags].join(';'));
    });
    rows.push('');
    rows.push('Dia;PDV;Site;Total;# Vendas PDV;# Vendas Site;Discrepâncias');
    report.perDay.forEach(r => {
      const total = r.pdv + r.site;
      rows.push([format(parseISO(r.date), 'dd/MM/yyyy'), r.pdv.toFixed(2).replace('.', ','), r.site.toFixed(2).replace('.', ','), total.toFixed(2).replace('.', ','), r.pdvCount, r.siteCount, r.flags].join(';'));
    });
    const blob = new Blob(["\ufeff" + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-pdv-site-${format(monthStart, 'yyyy-MM')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = loadingPos || loadingOrders;
  const grand = report.totals.pdv + report.totals.site;

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Relatório Mensal — PDV vs Site</h1>
            <p className="text-sm text-muted-foreground">
              Compare totais por vendedor e por dia, com discrepâncias destacadas automaticamente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMonthStart(s => startOfMonth(addMonths(s, -1)))} aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              value={format(monthStart, 'yyyy-MM')}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                if (y && m) setMonthStart(startOfMonth(new Date(y, m - 1, 1)));
              }}
              className="w-[160px]"
            />
            <Button variant="outline" size="icon" onClick={() => setMonthStart(s => startOfMonth(addMonths(s, 1)))} aria-label="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={isLoading}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><StoreIcon className="h-4 w-4" />PDV</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{fmtBRL(report.totals.pdv)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShoppingBag className="h-4 w-4" />Site</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{fmtBRL(report.totals.site)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total geral</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{fmtBRL(grand)}</div></CardContent>
          </Card>
          <Card className={report.flagged.length > 0 ? 'border-amber-500' : ''}>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Discrepâncias</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{report.flagged.length}</div></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sellers">
          <TabsList>
            <TabsTrigger value="sellers">Por vendedor</TabsTrigger>
            <TabsTrigger value="days">Por dia</TabsTrigger>
            <TabsTrigger value="flags">
              Discrepâncias{report.flagged.length > 0 ? ` (${report.flagged.length})` : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sellers">
            <Card>
              <CardHeader>
                <CardTitle>Totais por vendedor</CardTitle>
                <CardDescription>Ordenado por total. Linhas com discrepâncias aparecem destacadas.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">PDV</TableHead>
                      <TableHead className="text-right">Site</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Vendas (PDV/Site)</TableHead>
                      <TableHead className="text-right">Discrepâncias</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.perSeller.length === 0 && !isLoading && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem dados no período.</TableCell></TableRow>
                    )}
                    {report.perSeller.map(r => (
                      <TableRow key={r.name} className={r.flags > 0 ? 'bg-amber-50 dark:bg-amber-950/20' : undefined}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{fmtBRL(r.pdv)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(r.site)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtBRL(r.pdv + r.site)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.pdvCount} / {r.siteCount}</TableCell>
                        <TableCell className="text-right">
                          {r.flags > 0 ? <Badge variant="destructive">{r.flags}</Badge> : <span className="text-muted-foreground">0</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="days">
            <Card>
              <CardHeader>
                <CardTitle>Totais por dia</CardTitle>
                <CardDescription>Dias com discrepâncias aparecem destacados.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">PDV</TableHead>
                      <TableHead className="text-right">Site</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Vendas (PDV/Site)</TableHead>
                      <TableHead className="text-right">Discrepâncias</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.perDay.length === 0 && !isLoading && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem dados no período.</TableCell></TableRow>
                    )}
                    {report.perDay.map(r => (
                      <TableRow key={r.date} className={r.flags > 0 ? 'bg-amber-50 dark:bg-amber-950/20' : undefined}>
                        <TableCell className="font-medium">{format(parseISO(r.date), "dd/MM/yyyy (EEE)", { locale: ptBR })}</TableCell>
                        <TableCell className="text-right">{fmtBRL(r.pdv)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(r.site)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtBRL(r.pdv + r.site)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.pdvCount} / {r.siteCount}</TableCell>
                        <TableCell className="text-right">
                          {r.flags > 0 ? <Badge variant="destructive">{r.flags}</Badge> : <span className="text-muted-foreground">0</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flags">
            <Card>
              <CardHeader>
                <CardTitle>Vendas com discrepância</CardTitle>
                <CardDescription>
                  Vendas em PDV marcadas como site (ou vice-versa), origem não definida e prováveis duplicidades entre PDV e pedidos do site.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Classificado como</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.flagged.length === 0 && !isLoading && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma discrepância encontrada 🎉</TableCell></TableRow>
                    )}
                    {report.flagged.map(f => (
                      <TableRow key={`${f.source}-${f.id}`}>
                        <TableCell>{format(parseISO(f.date), 'dd/MM HH:mm', { locale: ptBR })}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{f.source === 'pos' ? 'PDV' : 'Pedido site'}</Badge>
                        </TableCell>
                        <TableCell>{f.kind === 'site' ? 'Site' : 'PDV'}</TableCell>
                        <TableCell>{f.seller}</TableCell>
                        <TableCell>{f.customer}</TableCell>
                        <TableCell className="text-right">{fmtBRL(f.total)}</TableCell>
                        <TableCell className="text-sm">{f.flag}</TableCell>
                        <TableCell className="font-mono text-xs">{f.id.slice(0, 8)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
