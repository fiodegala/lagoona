import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, DollarSign, ArrowUpCircle, ArrowDownCircle, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SessionData {
  id: string;
  user_id: string;
  store_id: string | null;
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  user_name?: string;
  store_name?: string;
  transactions: TransactionData[];
}

interface TransactionData {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  payment_method: string | null;
  created_at: string;
  created_by_name?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const CashRegisterReport = () => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(period));

      const [sessionsRes, transactionsRes, profilesRes, storesRes] = await Promise.all([
        supabase
          .from('pos_sessions')
          .select('*')
          .gte('opened_at', daysAgo.toISOString())
          .order('opened_at', { ascending: false }),
        supabase
          .from('pos_transactions')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('user_id, full_name'),
        supabase.from('stores').select('id, name'),
      ]);

      const profiles = (profilesRes.data || []) as any[];
      const stores = (storesRes.data || []) as any[];
      const transactions = (transactionsRes.data || []) as any[];
      const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));
      const storeMap = new Map(stores.map((s: any) => [s.id, s.name]));

      const enriched: SessionData[] = (sessionsRes.data || []).map((s: any) => ({
        ...s,
        user_name: profileMap.get(s.user_id) || 'Usuário',
        store_name: storeMap.get(s.store_id) || '—',
        transactions: transactions
          .filter((t: any) => t.session_id === s.id)
          .map((t: any) => ({
            ...t,
            created_by_name: profileMap.get(t.created_by) || 'Usuário',
          })),
      }));

      setSessions(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return sessions;
    return sessions.filter((s) => s.status === statusFilter);
  }, [sessions, statusFilter]);

  const summary = useMemo(() => {
    const totalWithdrawals = sessions.reduce(
      (acc, s) => acc + s.transactions.filter((t) => t.type === 'withdrawal').reduce((a, t) => a + t.amount, 0),
      0
    );
    const totalDeposits = sessions.reduce(
      (acc, s) => acc + s.transactions.filter((t) => t.type === 'deposit').reduce((a, t) => a + t.amount, 0),
      0
    );
    const totalDifference = sessions
      .filter((s) => s.status === 'closed' && s.difference != null)
      .reduce((acc, s) => acc + (s.difference || 0), 0);

    return {
      totalSessions: sessions.length,
      openSessions: sessions.filter((s) => s.status === 'open').length,
      closedSessions: sessions.filter((s) => s.status === 'closed').length,
      totalWithdrawals,
      totalDeposits,
      totalDifference,
    };
  }, [sessions]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Relatório de Caixa</h1>
          <p className="text-muted-foreground">Acompanhe aberturas, fechamentos, sangrias e suprimentos.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="closed">Fechados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground">Total Sessões</div>
              <div className="text-2xl font-bold">{summary.totalSessions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Abertos
              </div>
              <div className="text-2xl font-bold text-orange-600">{summary.openSessions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Fechados
              </div>
              <div className="text-2xl font-bold text-green-600">{summary.closedSessions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowUpCircle className="h-3 w-3 text-destructive" /> Sangrias
              </div>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalWithdrawals)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowDownCircle className="h-3 w-3 text-green-600" /> Suprimentos
              </div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalDeposits)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground">Diferença Total</div>
              <div className={`text-2xl font-bold ${summary.totalDifference === 0 ? 'text-green-600' : summary.totalDifference > 0 ? 'text-blue-600' : 'text-destructive'}`}>
                {formatCurrency(summary.totalDifference)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma sessão encontrada no período.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sessões de Caixa</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operador</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Abertura</TableHead>
                      <TableHead>Fechamento</TableHead>
                      <TableHead className="text-right">Valor Inicial</TableHead>
                      <TableHead className="text-right">Esperado</TableHead>
                      <TableHead className="text-right">Fechamento</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mov.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((session) => {
                      const withdrawals = session.transactions.filter((t) => t.type === 'withdrawal');
                      const deposits = session.transactions.filter((t) => t.type === 'deposit');
                      const isExpanded = expandedSession === session.id;

                      return (
                        <>
                          <TableRow
                            key={session.id}
                            className="cursor-pointer"
                            onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                          >
                            <TableCell className="font-medium">{session.user_name}</TableCell>
                            <TableCell>{session.store_name}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {format(new Date(session.opened_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {session.closed_at
                                ? format(new Date(session.closed_at), "dd/MM/yy HH:mm", { locale: ptBR })
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(session.opening_balance)}</TableCell>
                            <TableCell className="text-right">
                              {session.expected_balance != null ? formatCurrency(session.expected_balance) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {session.closing_balance != null ? formatCurrency(session.closing_balance) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {session.difference != null ? (
                                <span
                                  className={
                                    session.difference === 0
                                      ? 'text-green-600'
                                      : session.difference > 0
                                        ? 'text-blue-600'
                                        : 'text-destructive'
                                  }
                                >
                                  {formatCurrency(session.difference)}
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                                {session.status === 'open' ? 'Aberto' : 'Fechado'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {session.transactions.length > 0 && (
                                <Badge variant="outline">{session.transactions.length}</Badge>
                              )}
                            </TableCell>
                          </TableRow>

                          {isExpanded && session.transactions.length > 0 && (
                            <TableRow key={`${session.id}-detail`}>
                              <TableCell colSpan={10} className="bg-muted/30 p-4">
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm mb-2">Movimentações</h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Motivo</TableHead>
                                        <TableHead>Responsável</TableHead>
                                        <TableHead>Data/Hora</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {session.transactions.map((t) => (
                                        <TableRow key={t.id}>
                                          <TableCell>
                                            <div className="flex items-center gap-1.5">
                                              {t.type === 'withdrawal' ? (
                                                <ArrowUpCircle className="h-4 w-4 text-destructive" />
                                              ) : t.type === 'deposit' ? (
                                                <ArrowDownCircle className="h-4 w-4 text-green-600" />
                                              ) : (
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                              )}
                                              <span className="text-sm">
                                                {t.type === 'withdrawal'
                                                  ? 'Sangria'
                                                  : t.type === 'deposit'
                                                    ? 'Suprimento'
                                                    : t.type === 'sale'
                                                      ? 'Venda'
                                                      : t.type}
                                              </span>
                                            </div>
                                          </TableCell>
                                          <TableCell
                                            className={
                                              t.type === 'withdrawal'
                                                ? 'text-destructive font-medium'
                                                : 'text-green-600 font-medium'
                                            }
                                          >
                                            {t.type === 'withdrawal' ? '- ' : '+ '}
                                            {formatCurrency(t.amount)}
                                          </TableCell>
                                          <TableCell className="text-sm">{t.description || '—'}</TableCell>
                                          <TableCell className="text-sm">{t.created_by_name}</TableCell>
                                          <TableCell className="text-sm whitespace-nowrap">
                                            {format(new Date(t.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>

                                  {session.notes && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                      <strong>Obs:</strong> {session.notes}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default CashRegisterReport;
