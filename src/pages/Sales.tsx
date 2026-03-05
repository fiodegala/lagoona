import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Receipt, Search, Eye, Calendar, DollarSign, TrendingUp, ShoppingBag, Printer, User, Phone, Mail, MapPin, FileText, Building2, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const paymentMethodLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit: 'Cartão de Crédito',
  debit: 'Cartão de Débito',
  pix: 'PIX',
};

const Sales = () => {
  const { isAdmin, isManager, user } = useAuth();
  const queryClient = useQueryClient();
  const canCancel = isAdmin || isManager;
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [detailSale, setDetailSale] = useState<any>(null);
  const [detailCustomer, setDetailCustomer] = useState<any>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [cancelSale, setCancelSale] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch full customer data when opening detail
  const openSaleDetail = async (sale: any) => {
    setDetailSale(sale);
    setDetailCustomer(null);
    if (sale.customer_id) {
      setIsLoadingCustomer(true);
      try {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('id', sale.customer_id)
          .single();
        setDetailCustomer(data);
      } catch (e) {
        console.error('Erro ao buscar cliente:', e);
      } finally {
        setIsLoadingCustomer(false);
      }
    }
  };

  const handlePrint = () => {
    if (!detailSale) return;
    const items = saleItems(detailSale.items);
    const customerName = detailCustomer?.name || detailSale.customer_name || 'Consumidor Final';
    const customerDoc = detailCustomer?.document || detailSale.customer_document;
    const customerType = detailCustomer?.customer_type === 'pj' ? 'CNPJ' : 'CPF';

    let customerHtml = `<div><span class="label">Nome:</span> <span class="value">${customerName}</span></div>`;
    if (customerDoc) customerHtml += `<div><span class="label">${customerType}:</span> <span class="value">${customerDoc}</span></div>`;
    if (detailCustomer?.phone) customerHtml += `<div><span class="label">WhatsApp:</span> <span class="value">${detailCustomer.phone}</span></div>`;
    if (detailCustomer?.email) customerHtml += `<div><span class="label">E-mail:</span> <span class="value">${detailCustomer.email}</span></div>`;
    if (detailCustomer?.birthday) customerHtml += `<div><span class="label">Nascimento:</span> <span class="value">${format(new Date(detailCustomer.birthday + 'T12:00:00'), 'dd/MM/yyyy')}</span></div>`;
    if (detailCustomer?.customer_type === 'pj' && detailCustomer?.razao_social) customerHtml += `<div><span class="label">Razão Social:</span> <span class="value">${detailCustomer.razao_social}</span></div>`;
    if (detailCustomer?.customer_type === 'pj' && detailCustomer?.nome_fantasia) customerHtml += `<div><span class="label">Nome Fantasia:</span> <span class="value">${detailCustomer.nome_fantasia}</span></div>`;
    if (detailCustomer?.customer_type === 'pj' && detailCustomer?.inscricao_estadual) customerHtml += `<div><span class="label">Insc. Estadual:</span> <span class="value">${detailCustomer.inscricao_estadual}</span></div>`;
    if (detailCustomer?.address) {
      const addr = [detailCustomer.address, detailCustomer.city, detailCustomer.state].filter(Boolean).join(', ');
      customerHtml += `<div style="grid-column:span 2"><span class="label">Endereço:</span> <span class="value">${addr}${detailCustomer.zip_code ? ` - CEP: ${detailCustomer.zip_code}` : ''}</span></div>`;
    }

    const itemsRows = items.map((item: any) => {
      const unitPrice = Number(item.unit_price ?? item.price ?? 0);
      const itemTotal = Number(item.total ?? (item.quantity * unitPrice));
      return `<tr><td>${item.name}${item.sku ? ` (${item.sku})` : ''}</td><td class="text-right">${item.quantity}</td><td class="text-right">R$ ${unitPrice.toFixed(2)}</td><td class="text-right">R$ ${itemTotal.toFixed(2)}</td></tr>`;
    }).join('');

    let totalsHtml = `<div class="row"><span>Subtotal</span><span>R$ ${Number(detailSale.subtotal).toFixed(2)}</span></div>`;
    if (Number(detailSale.discount_amount || 0) > 0) {
      totalsHtml += `<div class="row discount"><span>Desconto${detailSale.discount_type === 'percentage' ? ` (${detailSale.discount_value}%)` : ''}</span><span>-R$ ${Number(detailSale.discount_amount).toFixed(2)}</span></div>`;
    }
    totalsHtml += `<div class="row total-row"><span>Total</span><span>R$ ${Number(detailSale.total).toFixed(2)}</span></div>`;
    totalsHtml += `<div class="row"><span>Forma de pagamento</span><span>${paymentMethodLabels[detailSale.payment_method] || detailSale.payment_method}</span></div>`;
    if (detailSale.payment_method === 'cash' && detailSale.amount_received) {
      totalsHtml += `<div class="row"><span>Valor recebido</span><span>R$ ${Number(detailSale.amount_received).toFixed(2)}</span></div>`;
      totalsHtml += `<div class="row"><span>Troco</span><span>R$ ${Number(detailSale.change_amount || 0).toFixed(2)}</span></div>`;
    }

    const notesHtml = detailSale.notes ? `<div class="section"><div class="section-title">Observações</div><div class="notes">${detailSale.notes}</div></div>` : '';

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Venda #${detailSale.id.slice(0, 8)}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:24px;color:#1a1a1a;font-size:13px}
        .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:12px}.header h1{font-size:18px;margin-bottom:4px}.header p{color:#666;font-size:12px}
        .section{margin-bottom:16px}.section-title{font-weight:bold;font-size:14px;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px}.label{color:#666;font-size:11px}.value{font-weight:500}
        table{width:100%;border-collapse:collapse;margin-top:8px}th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #eee;font-size:12px}th{background:#f5f5f5;font-weight:600}
        .text-right{text-align:right}.totals{margin-top:12px}.totals .row{display:flex;justify-content:space-between;padding:3px 0}
        .totals .total-row{font-weight:bold;font-size:15px;border-top:2px solid #333;padding-top:6px;margin-top:4px}.discount{color:#dc2626}
        .notes{background:#f9f9f9;padding:8px;border-radius:4px;margin-top:8px}@media print{body{padding:12px}}
      </style></head><body>
      <div class="header"><h1>Comprovante de Venda</h1><p>ID: ${detailSale.id}</p><p>${format(new Date(detailSale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p></div>
      <div class="section"><div class="section-title">Cliente</div><div class="grid">${customerHtml}</div></div>
      <div class="section"><div class="section-title">Itens</div><table><thead><tr><th>Produto</th><th class="text-right">Qtd</th><th class="text-right">Unit.</th><th class="text-right">Total</th></tr></thead><tbody>${itemsRows}</tbody></table></div>
      <div class="section totals">${totalsHtml}</div>
      ${notesHtml}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleCancelSale = async () => {
    if (!cancelSale || !user) return;
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('pos_sales')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancel_reason: cancelReason || null,
        } as any)
        .eq('id', cancelSale.id);
      if (error) throw error;
      toast.success('Venda cancelada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['pos-sales'] });
      setCancelSale(null);
      setCancelReason('');
      if (detailSale?.id === cancelSale.id) setDetailSale(null);
    } catch (e: any) {
      toast.error('Erro ao cancelar venda: ' + (e.message || ''));
    } finally {
      setIsCancelling(false);
    }
  };

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

  const activeSales = filteredSales.filter(s => (s as any).status !== 'cancelled');
  const totalRevenue = activeSales.reduce((sum, s) => sum + Number(s.total), 0);
  const totalDiscount = activeSales.reduce((sum, s) => sum + Number(s.discount_amount || 0), 0);
  const avgTicket = activeSales.length > 0 ? totalRevenue / activeSales.length : 0;

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
                    <TableHead>Status</TableHead>
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
                    const isCancelled = (sale as any).status === 'cancelled';
                    return (
                      <TableRow key={sale.id} className={isCancelled ? 'opacity-60' : ''}>
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
                          {isCancelled ? (
                            <Badge variant="destructive" className="text-xs">Cancelada</Badge>
                          ) : (
                            <Badge variant="default" className="text-xs bg-green-600">Concluída</Badge>
                          )}
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
                        <TableCell className={`font-medium ${isCancelled ? 'line-through text-muted-foreground' : ''}`}>
                          R$ {Number(sale.total).toFixed(2)}
                        </TableCell>
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
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" onClick={() => openSaleDetail(sale)}>
                              <Eye className="h-3 w-3 mr-1" />
                              Detalhes
                            </Button>
                            {canCancel && !isCancelled && (
                              <Button variant="destructive" size="sm" onClick={() => setCancelSale(sale)}>
                                <Ban className="h-3 w-3 mr-1" />
                                Cancelar
                              </Button>
                            )}
                          </div>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Detalhes da Venda</DialogTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </DialogHeader>
          {detailSale && (
            <div className="flex-1 overflow-y-auto pr-2 space-y-4" style={{ maxHeight: 'calc(90vh - 100px)' }}>
              {/* Sale info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">ID da Venda</p>
                  <p className="font-mono text-xs">{detailSale.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Data</p>
                  <p>{format(new Date(detailSale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Pagamento</p>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {paymentMethodLabels[detailSale.payment_method] || detailSale.payment_method}
                    </Badge>
                  </div>
                </div>
                {detailSale.coupon_code && (
                  <div>
                    <p className="text-muted-foreground text-xs">Cupom</p>
                    <p>{detailSale.coupon_code}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Customer info */}
              <div>
                <p className="font-medium mb-2 flex items-center gap-1.5 text-sm">
                  <User className="h-4 w-4" /> Dados do Cliente
                </p>
                {isLoadingCustomer ? (
                  <p className="text-sm text-muted-foreground">Carregando dados do cliente...</p>
                ) : detailCustomer ? (
                  <div className="border rounded-lg p-3 space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-muted-foreground text-xs">Nome</p>
                        <p className="font-medium">{detailCustomer.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Tipo</p>
                        <p className="flex items-center gap-1">
                          {detailCustomer.customer_type === 'pj' ? (
                            <><Building2 className="h-3 w-3" /> Pessoa Jurídica</>
                          ) : (
                            <><User className="h-3 w-3" /> Pessoa Física</>
                          )}
                        </p>
                      </div>
                      {detailCustomer.document && (
                        <div>
                          <p className="text-muted-foreground text-xs flex items-center gap-1"><FileText className="h-3 w-3" /> {detailCustomer.customer_type === 'pj' ? 'CNPJ' : 'CPF'}</p>
                          <p>{detailCustomer.document}</p>
                        </div>
                      )}
                      {detailCustomer.phone && (
                        <div>
                          <p className="text-muted-foreground text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> WhatsApp</p>
                          <p>{detailCustomer.phone}</p>
                        </div>
                      )}
                      {detailCustomer.email && (
                        <div>
                          <p className="text-muted-foreground text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> E-mail</p>
                          <p>{detailCustomer.email}</p>
                        </div>
                      )}
                      {detailCustomer.birthday && (
                        <div>
                          <p className="text-muted-foreground text-xs">Data de Nascimento</p>
                          <p>{format(new Date(detailCustomer.birthday + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                        </div>
                      )}
                      {detailCustomer.customer_type === 'pj' && detailCustomer.razao_social && (
                        <div>
                          <p className="text-muted-foreground text-xs">Razão Social</p>
                          <p>{detailCustomer.razao_social}</p>
                        </div>
                      )}
                      {detailCustomer.customer_type === 'pj' && detailCustomer.nome_fantasia && (
                        <div>
                          <p className="text-muted-foreground text-xs">Nome Fantasia</p>
                          <p>{detailCustomer.nome_fantasia}</p>
                        </div>
                      )}
                      {detailCustomer.customer_type === 'pj' && detailCustomer.inscricao_estadual && (
                        <div>
                          <p className="text-muted-foreground text-xs">Inscrição Estadual</p>
                          <p>{detailCustomer.inscricao_estadual}</p>
                        </div>
                      )}
                    </div>
                    {(detailCustomer.address || detailCustomer.city) && (
                      <div className="pt-2 border-t">
                        <p className="text-muted-foreground text-xs flex items-center gap-1 mb-1"><MapPin className="h-3 w-3" /> Endereço</p>
                        <p className="text-sm">
                          {[detailCustomer.address, detailCustomer.city, detailCustomer.state].filter(Boolean).join(', ')}
                          {detailCustomer.zip_code && ` - CEP: ${detailCustomer.zip_code}`}
                        </p>
                      </div>
                    )}
                    {detailCustomer.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-muted-foreground text-xs">Observações do Cliente</p>
                        <p className="text-sm">{detailCustomer.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-lg p-3 text-sm">
                    <p className="font-medium">{detailSale.customer_name || 'Consumidor Final'}</p>
                    {detailSale.customer_document && (
                      <p className="text-muted-foreground text-xs mt-1">{detailSale.customer_document}</p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Items */}
              <div>
                <p className="font-medium mb-2 text-sm">Itens da Venda</p>
                <div className="border rounded-lg divide-y">
                  {saleItems(detailSale.items).map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="w-10 h-10 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        {item.variation && <p className="text-xs text-muted-foreground">{item.variation}</p>}
                        {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                      </div>
                      <div className="text-right text-sm">
                        <p>{item.quantity}x R$ {Number(item.unit_price ?? item.price ?? 0).toFixed(2)}</p>
                        {Number(item.discount_amount || 0) > 0 && (
                          <p className="text-xs text-destructive">-R$ {Number(item.discount_amount).toFixed(2)}</p>
                        )}
                        <p className="font-medium">R$ {Number(item.total ?? (item.quantity * Number(item.unit_price ?? item.price ?? 0))).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
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
