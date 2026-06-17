import { Fragment, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, CheckCircle2, ChevronDown, RefreshCw, Wrench } from 'lucide-react';
import { startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface SaleRow {
  id: string;
  user_id: string | null;
  seller_id: string | null;
  total: number;
  status: string | null;
  sale_type: string | null;
  notes: string | null;
  payment_details: any;
  created_at: string;
  customer_name: string | null;
}

interface Profile {
  user_id: string;
  full_name: string;
}

interface SellerStat {
  profile: Profile;
  attributedTotal: number;
  attributedCount: number;
  expectedTotal: number;
  expectedCount: number;
  orphans: SaleRow[];
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function extractSellerFromSale(s: SaleRow): string | null {
  const fromPayment = s.payment_details?.seller;
  if (fromPayment && typeof fromPayment === 'string') return fromPayment.trim();
  const m = s.notes?.match(/Vendedor:\s*([^|\n]+)/i);
  if (m) return m[1].trim();
  return null;
}

function matchesProfile(sellerStr: string, profile: Profile): boolean {
  const a = norm(sellerStr);
  const b = norm(profile.full_name);
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.includes(a) || a.includes(b)) return true;
  const firstA = a.split(/[\s\-]/)[0];
  const firstB = b.split(/[\s\-]/)[0];
  if (firstA && firstA.length >= 3 && firstA === firstB) return true;
  return false;
}

export default function SellerReconciliation() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [fixing, setFixing] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case '30days': return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case 'custom':
        return {
          start: customStart ? startOfDay(new Date(customStart)) : startOfMonth(now),
          end: customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now),
        };
      case 'month':
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [period, customStart, customEnd]);

  const { data: profiles = [] } = useQuery({
    queryKey: ['recon-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return (data || []) as Profile[];
    },
  });

  const { data: sales = [], isLoading, refetch } = useQuery({
    queryKey: ['recon-sales', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const all: SaleRow[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('pos_sales')
          .select('id,user_id,seller_id,total,status,sale_type,notes,payment_details,created_at,customer_name')
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
          .neq('status', 'cancelled')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as any));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all.filter(s => s.sale_type !== 'brinde');
    },
  });

  const stats = useMemo<SellerStat[]>(() => {
    return profiles.map(profile => {
      let attributedTotal = 0;
      let attributedCount = 0;
      let expectedTotal = 0;
      let expectedCount = 0;
      const orphans: SaleRow[] = [];

      for (const s of sales) {
        const total = Number(s.total) || 0;
        const isAttributed =
          s.user_id === profile.user_id || s.seller_id === profile.user_id;

        const sellerStr = extractSellerFromSale(s);
        const isExpected = isAttributed || (!!sellerStr && matchesProfile(sellerStr, profile));

        if (isAttributed) {
          attributedTotal += total;
          attributedCount += 1;
        }
        if (isExpected) {
          expectedTotal += total;
          expectedCount += 1;
        }
        if (isExpected && !isAttributed) {
          orphans.push(s);
        }
      }

      return { profile, attributedTotal, attributedCount, expectedTotal, expectedCount, orphans };
    })
    .filter(s => s.expectedCount > 0 || s.attributedCount > 0)
    .sort((a, b) => b.expectedTotal - a.expectedTotal);
  }, [profiles, sales]);

  const totals = useMemo(() => {
    const totalDiff = stats.reduce((acc, s) => acc + (s.expectedTotal - s.attributedTotal), 0);
    const totalOrphans = stats.reduce((acc, s) => acc + s.orphans.length, 0);
    const sellersWithIssues = stats.filter(s => s.orphans.length > 0).length;
    return { totalDiff, totalOrphans, sellersWithIssues };
  }, [stats]);

  const handleFixSeller = async (stat: SellerStat) => {
    if (!stat.orphans.length) return;
    if (!confirm(`Reatribuir ${stat.orphans.length} venda(s) órfã(s) para ${stat.profile.full_name}?`)) return;
    setFixing(stat.profile.user_id);
    try {
      const ids = stat.orphans.map(o => o.id);
      const { error } = await supabase
        .from('pos_sales')
        .update({ seller_id: stat.profile.user_id })
        .in('id', ids);
      if (error) throw error;
      toast({ title: 'Reconciliado', description: `${ids.length} venda(s) reatribuídas a ${stat.profile.full_name}.` });
      await qc.invalidateQueries({ queryKey: ['recon-sales'] });
    } catch (err: any) {
      toast({ title: 'Erro ao reconciliar', description: err.message, variant: 'destructive' });
    } finally {
      setFixing(null);
    }
  };

  const handleFixAll = async () => {
    const pending = stats.filter(s => s.orphans.length > 0);
    if (!pending.length) return;
    if (!confirm(`Reatribuir ${totals.totalOrphans} venda(s) órfã(s) em ${pending.length} vendedor(es)?`)) return;
    setFixing('all');
    try {
      for (const stat of pending) {
        const ids = stat.orphans.map(o => o.id);
        const { error } = await supabase
          .from('pos_sales')
          .update({ seller_id: stat.profile.user_id })
          .in('id', ids);
        if (error) throw error;
      }
      toast({ title: 'Reconciliação completa', description: `${totals.totalOrphans} venda(s) reatribuídas.` });
      await qc.invalidateQueries({ queryKey: ['recon-sales'] });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setFixing(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reconciliação de Vendedores</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Compara o total atribuído (user_id / seller_id) com o total esperado a partir das notas de conversão e do campo de vendedor importado.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="30days">Últimos 30 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {period === 'custom' && (
              <>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-[160px]" />
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-[160px]" />
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Diferença total</p>
              <p className={`text-2xl font-bold ${totals.totalDiff > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {fmtBRL(totals.totalDiff)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Vendas órfãs</p>
              <p className="text-2xl font-bold">{totals.totalOrphans}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vendedores com divergência</p>
                <p className="text-2xl font-bold">{totals.sellersWithIssues}</p>
              </div>
              {totals.totalOrphans > 0 && (
                <Button onClick={handleFixAll} disabled={fixing === 'all'}>
                  <Wrench className="h-4 w-4 mr-2" />
                  Reconciliar tudo
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Detalhamento por vendedor</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Atribuído</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead className="text-right">Órfãs</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={6} className="text-center py-6">Carregando…</TableCell></TableRow>
                )}
                {!isLoading && stats.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sem vendas no período.</TableCell></TableRow>
                )}
                {stats.map(stat => {
                  const diff = stat.expectedTotal - stat.attributedTotal;
                  const ok = stat.orphans.length === 0;
                  return (
                    <Fragment key={stat.profile.user_id}>
                      <TableRow>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                            <span className="font-medium">{stat.profile.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>{fmtBRL(stat.attributedTotal)}</div>
                          <div className="text-xs text-muted-foreground">{stat.attributedCount} venda(s)</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>{fmtBRL(stat.expectedTotal)}</div>
                          <div className="text-xs text-muted-foreground">{stat.expectedCount} venda(s)</div>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${diff > 0 ? 'text-amber-600' : ok ? 'text-emerald-600' : ''}`}>
                          {fmtBRL(diff)}
                        </TableCell>
                        <TableCell className="text-right">
                          {ok ? (
                            <Badge variant="secondary">OK</Badge>
                          ) : (
                            <Badge variant="destructive">{stat.orphans.length}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!ok && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFixSeller(stat)}
                              disabled={fixing === stat.profile.user_id}
                            >
                              <Wrench className="h-3 w-3 mr-1" /> Reatribuir
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {!ok && (
                        <TableRow key={`${stat.profile.user_id}-orphans`}>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <Collapsible>
                              <CollapsibleTrigger className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
                                <ChevronDown className="h-3 w-3" /> Ver vendas órfãs ({stat.orphans.length})
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2">
                                <div className="space-y-1">
                                  {stat.orphans.map(o => (
                                    <div key={o.id} className="text-xs flex justify-between gap-4 border-b py-1">
                                      <span className="font-mono">#{o.id.slice(0, 8).toUpperCase()}</span>
                                      <span>{new Date(o.created_at).toLocaleDateString('pt-BR')}</span>
                                      <span className="flex-1 truncate">{o.customer_name || '-'}</span>
                                      <span className="text-muted-foreground truncate max-w-[280px]">
                                        {extractSellerFromSale(o) || '-'}
                                      </span>
                                      <span className="font-semibold">{fmtBRL(Number(o.total))}</span>
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
