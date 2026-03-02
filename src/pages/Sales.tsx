import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Receipt, Search, Eye, Calendar, DollarSign, TrendingUp, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const paymentMethodLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit: 'Cartão de Crédito',
  debit: 'Cartão de Débito',
  pix: 'PIX',
};

const Sales = () => {
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [detailSale, setDetailSale] = useState<any>(null);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday':
        return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfDay(now) };
      case '30days':
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case 'custom':
        return {
          start: customStart ? startOfDay(new Date(customStart)) : startOfDay(subDays(now, 30)),
          end: customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now),
        };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  }, [periodFilter, customStart, customEnd]);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['pos-sales', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_sales')
        .select('*')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredSales = sales.filter(s => {
    const matchesSearch =
      s.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.customer_document?.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.total), 0);
  const totalDiscount = filteredSales.reduce((sum, s) => sum + Number(s.discount_amount || 0), 0);
  const avgTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

  const saleItems = (items: any) => {
    try {
      if (Array.isArray(items)) return items;
      return JSON.parse(items);
    } catch {
      return [];
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
          <p className="text-muted-foreground mt-1">Histórico detalhado de vendas do PDV</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Faturamento</p>
                <p className="text-xl font-bold">R$ {totalRevenue.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Vendas</p>
                <p className="text-xl font-bold">{filteredSales.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-xl font-bold">R$ {avgTicket.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, documento ou ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[180px]">
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
          {periodFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-[160px]" />
              <span className="text-muted-foreground">até</span>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-[160px]" />
            </div>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Carregando vendas...</CardContent></Card>
        ) : filteredSales.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-lg mb-2">Nenhuma venda encontrada</CardTitle>
              <CardDescription className="text-center">Não há vendas no período selecionado</CardDescription>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venda</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map(sale => {
                    const items = saleItems(sale.items);
                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-xs">{sale.id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{sale.customer_name || 'Consumidor Final'}</p>
                            {sale.customer_document && (
                              <p className="text-xs text-muted-foreground">{sale.customer_document}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {items.length} {items.length === 1 ? 'item' : 'itens'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">R$ {Number(sale.subtotal).toFixed(2)}</TableCell>
                        <TableCell className="text-sm">
                          {Number(sale.discount_amount || 0) > 0 ? (
                            <span className="text-destructive">-R$ {Number(sale.discount_amount).toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">R$ {Number(sale.total).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {paymentMethodLabels[sale.payment_method] || sale.payment_method}
                          </Badge>
                          {sale.coupon_code && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Cupom: {sale.coupon_code}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(sale.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => setDetailSale(sale)}>
                            <Eye className="h-3 w-3 mr-1" />
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Totals footer */}
        {filteredSales.length > 0 && (
          <div className="flex justify-end gap-6 text-sm">
            <span className="text-muted-foreground">
              Descontos: <strong className="text-destructive">-R$ {totalDiscount.toFixed(2)}</strong>
            </span>
            <span className="text-muted-foreground">
              Total: <strong className="text-foreground">R$ {totalRevenue.toFixed(2)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      <Dialog open={!!detailSale} onOpenChange={o => !o && setDetailSale(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
          </DialogHeader>
          {detailSale && (
            <div className="flex-1 overflow-y-auto pr-2 space-y-4" style={{ maxHeight: 'calc(90vh - 100px)' }}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">ID</p>
                  <p className="font-mono text-xs">{detailSale.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data</p>
                  <p>{format(new Date(detailSale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{detailSale.customer_name || 'Consumidor Final'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Documento</p>
                  <p>{detailSale.customer_document || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pagamento</p>
                  <p>{paymentMethodLabels[detailSale.payment_method] || detailSale.payment_method}</p>
                </div>
                {detailSale.coupon_code && (
                  <div>
                    <p className="text-muted-foreground">Cupom</p>
                    <p>{detailSale.coupon_code}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="font-medium mb-2">Itens</p>
                <div className="border rounded-lg divide-y">
                  {saleItems(detailSale.items).map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="w-10 h-10 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        {item.variation && <p className="text-xs text-muted-foreground">{item.variation}</p>}
                      </div>
                      <div className="text-right text-sm">
                        <p>{item.quantity}x R$ {Number(item.price).toFixed(2)}</p>
                        <p className="font-medium">R$ {(item.quantity * Number(item.price)).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>R$ {Number(detailSale.subtotal).toFixed(2)}</span>
                </div>
                {Number(detailSale.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Desconto{detailSale.discount_type === 'percentage' ? ` (${detailSale.discount_value}%)` : ''}</span>
                    <span>-R$ {Number(detailSale.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>Total</span>
                  <span>R$ {Number(detailSale.total).toFixed(2)}</span>
                </div>
                {detailSale.payment_method === 'cash' && detailSale.amount_received && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Valor recebido</span>
                      <span>R$ {Number(detailSale.amount_received).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Troco</span>
                      <span>R$ {Number(detailSale.change_amount || 0).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {detailSale.notes && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Observações</p>
                  <p>{detailSale.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Sales;
