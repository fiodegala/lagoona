import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const entityLabels: Record<string, string> = {
  product: 'Produto',
  category: 'Categoria',
  order: 'Pedido',
  pos_sale: 'Venda PDV',
  customer: 'Cliente',
  coupon: 'Cupom',
  banner: 'Banner',
  user: 'Usuário',
  stock: 'Estoque',
  shipping: 'Frete',
  combo: 'Combo',
  review: 'Avaliação',
  settings: 'Configurações',
  session: 'Sessão PDV',
};

const actionLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  create: { label: 'Criação', variant: 'default' },
  update: { label: 'Atualização', variant: 'secondary' },
  delete: { label: 'Exclusão', variant: 'destructive' },
  cancel: { label: 'Cancelamento', variant: 'destructive' },
  login: { label: 'Login', variant: 'outline' },
  logout: { label: 'Logout', variant: 'outline' },
  import: { label: 'Importação', variant: 'secondary' },
  export: { label: 'Exportação', variant: 'secondary' },
  approve: { label: 'Aprovação', variant: 'default' },
  reject: { label: 'Rejeição', variant: 'destructive' },
  transfer: { label: 'Transferência', variant: 'secondary' },
};

const ITEMS_PER_PAGE = 50;

const AuditLogs = () => {
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('week');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [page, setPage] = useState(0);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday': return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
      case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
      case 'month': return { start: startOfMonth(now), end: endOfDay(now) };
      case '30days': return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case 'custom': return {
        start: customStart ? startOfDay(new Date(customStart)) : startOfDay(subDays(now, 30)),
        end: customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now),
      };
      default: return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
    }
  }, [periodFilter, customStart, customEnd]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', dateRange.start.toISOString(), dateRange.end.toISOString(), entityFilter, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs' as any)
        .select('*')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const filteredLogs = logs.filter((log: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      log.user_name?.toLowerCase().includes(s) ||
      log.entity_id?.toLowerCase().includes(s) ||
      log.action?.toLowerCase().includes(s) ||
      log.entity_type?.toLowerCase().includes(s) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(s)
    );
  });

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const getDetailsSummary = (log: any) => {
    const details = log.details || {};
    const keys = Object.keys(details);
    if (keys.length === 0) return null;

    // Show relevant fields
    const summaryParts: string[] = [];
    if (details.name) summaryParts.push(details.name);
    if (details.reason) summaryParts.push(`Motivo: ${details.reason}`);
    if (details.old_status && details.new_status) summaryParts.push(`${details.old_status} → ${details.new_status}`);
    if (details.quantity) summaryParts.push(`Qtd: ${details.quantity}`);
    if (details.total) summaryParts.push(`Total: R$ ${Number(details.total).toFixed(2)}`);
    
    if (summaryParts.length === 0) {
      // Fallback: show first 2 key-value pairs
      return keys.slice(0, 2).map(k => `${k}: ${details[k]}`).join(', ');
    }
    return summaryParts.join(' • ');
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Histórico de Ações</h1>
          <p className="text-muted-foreground mt-1">Registro de todas as ações realizadas no sistema</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário, entidade, detalhes..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>

          <Select value={periodFilter} onValueChange={v => { setPeriodFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityFilter} onValueChange={v => { setEntityFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas entidades</SelectItem>
              {Object.entries(entityLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ações</SelectItem>
              {Object.entries(actionLabels).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {periodFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-[150px]" />
              <span className="text-muted-foreground text-sm">até</span>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-[150px]" />
            </div>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Carregando histórico...</CardContent></Card>
        ) : filteredLogs.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-lg mb-2">Nenhum registro encontrado</CardTitle>
              <CardDescription className="text-center">Não há ações registradas no período selecionado</CardDescription>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log: any) => {
                      const actionInfo = actionLabels[log.action] || { label: log.action, variant: 'outline' as const };
                      const entityLabel = entityLabels[log.entity_type] || log.entity_type;
                      const detailsSummary = getDetailsSummary(log);

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {log.user_name || 'Sistema'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={actionInfo.variant} className="text-xs">
                              {actionInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{entityLabel}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                            {detailsSummary || '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Pagination */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {filteredLogs.length} registro{filteredLogs.length !== 1 ? 's' : ''} encontrado{filteredLogs.length !== 1 ? 's' : ''}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-muted-foreground">
                    Página {page + 1} de {totalPages}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AuditLogs;
